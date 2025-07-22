import TelegramBot from 'node-telegram-bot-api';
import { Connection, PublicKey, Keypair, VersionedTransaction, Transaction } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { BreezeSDK } from '@breezebaby/breeze-sdk';

dotenv.config();

// Add token decimals configuration
const TOKEN_DECIMALS = {
    USDC: 6,
    USDT: 6,
    PYUSD: 6,
    USDS: 6,
    SOL: 9
};

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN!;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const BREEZE_API_KEY = process.env.BREEZE_API_KEY!;
const BREEZE_FUND_ID = process.env.BREEZE_FUND_ID!;

// Token mint addresses (mainnet)
const TOKEN_MINTS = {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY7xgxACzBn3wqHg',
    PYUSD: 'CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM',
    USDS: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo'
};

interface UserData {
    keypair?: Keypair;
    publicKey?: string;
    currentMenu?: string;
    pendingTransaction?: {
        serializedTx: string;
        type: 'deposit' | 'withdraw';
        amount?: number;
        asset?: string;
    };
}

class BreezeBot {
    private bot: TelegramBot;
    private connection: Connection;
    private breezeSDK: BreezeSDK;
    private users: Map<number, UserData> = new Map();

    constructor() {
        this.bot = new TelegramBot(BOT_TOKEN, { polling: true });
        this.connection = new Connection(SOLANA_RPC_URL);
        this.breezeSDK = new BreezeSDK({
            baseUrl: 'https://api.breeze.baby/',
            apiKey: BREEZE_API_KEY
        });
        this.setupHandlers();
    }

    private setupHandlers() {
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
        this.bot.on('message', this.handleMessage.bind(this));
    }


    // FIXED: Better decimal handling for token amounts
    private convertToTokenAmount(humanAmount: number, tokenSymbol: string): bigint {
        const decimals = TOKEN_DECIMALS[tokenSymbol as keyof typeof TOKEN_DECIMALS] || 6;

        // Use string manipulation for precise decimal handling
        const amountStr = humanAmount.toFixed(decimals);
        const [integerPart, decimalPart = ''] = amountStr.split('.');

        // Pad decimal part to required length
        const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals);

        // Combine and convert to bigint
        const fullAmountStr = integerPart + paddedDecimal;
        return BigInt(fullAmountStr);
    }

    private convertFromTokenAmount(tokenAmount: bigint, tokenSymbol: string): number {
        const decimals = TOKEN_DECIMALS[tokenSymbol as keyof typeof TOKEN_DECIMALS] || 6;
        const divisor = BigInt(10 ** decimals);

        // Convert to number with proper decimal places
        const integerPart = Number(tokenAmount / divisor);
        const remainder = tokenAmount % divisor;
        const decimalPart = Number(remainder) / Number(divisor);

        return integerPart + decimalPart;
    }

    // FIXED: Better balance handling for exact amounts
    private async getBalances(publicKey: string) {
        try {
            const pubKey = new PublicKey(publicKey);

            // Get SOL balance
            const solBalance = await this.connection.getBalance(pubKey) / 1e9;

            // Get token balances
            const balances = {
                sol: solBalance,
                usdc: { raw: BigInt(0), human: 0 },
                usdt: { raw: BigInt(0), human: 0 },
                pyusd: { raw: BigInt(0), human: 0 },
                usds: { raw: BigInt(0), human: 0 }
            };

            for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
                try {
                    const tokenMint = new PublicKey(mint);
                    const tokenAccount = await getAssociatedTokenAddress(tokenMint, pubKey);
                    const accountInfo = await getAccount(this.connection, tokenAccount);

                    const rawAmount = BigInt(accountInfo.amount.toString());
                    const humanAmount = this.convertFromTokenAmount(rawAmount, symbol);

                    const key = symbol.toLowerCase() as 'usdc' | 'usdt' | 'pyusd' | 'usds';
                    balances[key] = { raw: rawAmount, human: humanAmount };
                } catch (error) {
                    // Token account doesn't exist, balance remains 0
                }
            }

            return balances;
        } catch (error) {
            console.error('Error fetching balances:', error);
            return {
                sol: 0,
                usdc: { raw: BigInt(0), human: 0 },
                usdt: { raw: BigInt(0), human: 0 },
                pyusd: { raw: BigInt(0), human: 0 },
                usds: { raw: BigInt(0), human: 0 }
            };
        }
    }

    private async handleStart(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;

        if (!this.users.has(chatId)) {
            this.users.set(chatId, {});
        }

        const userData = this.users.get(chatId)!;

        if (!userData.keypair) {
            await this.bot.sendMessage(chatId,
                '🚀 Welcome to BREEZE INTEGRATION BOT! 🌊\n\n' +
                'To get started, you need to set up your wallet:',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔑 Generate New Keypair', callback_data: 'generate_keypair' }],
                            [{ text: '📥 Import Private Key', callback_data: 'import_keypair' }]
                        ]
                    }
                }
            );
        } else {
            await this.showMainInterface(chatId);
        }
    }

    private async generateKeypair(chatId: number) {
        const keypair = Keypair.generate();
        const userData = this.users.get(chatId)!;
        userData.keypair = keypair;
        userData.publicKey = keypair.publicKey.toString();

        await this.bot.sendMessage(chatId,
            '🔑 New keypair generated!\n\n' +
            `📍 Public Key: \`${keypair.publicKey.toString()}\`\n\n` +
            `🔐 Private Key: \`${bs58.encode(keypair.secretKey)}\`\n\n` +
            '⚠️ **IMPORTANT**: Save your private key securely! This is the only time it will be shown.',
            { parse_mode: 'Markdown' }
        );

        setTimeout(() => this.showMainInterface(chatId), 2000);
    }

    private async importKeypair(chatId: number) {
        await this.bot.sendMessage(chatId,
            '🔐 Please send your private key (base58 encoded):',
            {
                reply_markup: {
                    force_reply: true
                }
            }
        );

        const userData = this.users.get(chatId)!;
        userData.currentMenu = 'awaiting_private_key';
    }

    private async handlePrivateKeyInput(chatId: number, privateKey: string) {
        try {
            const secretKey = bs58.decode(privateKey);
            const keypair = Keypair.fromSecretKey(secretKey);

            const userData = this.users.get(chatId)!;
            userData.keypair = keypair;
            userData.publicKey = keypair.publicKey.toString();
            userData.currentMenu = undefined;

            await this.bot.sendMessage(chatId,
                '✅ Keypair imported successfully!\n\n' +
                `📍 Public Key: \`${keypair.publicKey.toString()}\``,
                { parse_mode: 'Markdown' }
            );

            setTimeout(() => this.showMainInterface(chatId), 1500);
        } catch (error) {
            await this.bot.sendMessage(chatId,
                '❌ Invalid private key format. Please try again or use /start to go back.'
            );
        }
    }

    private async showMainInterface(chatId: number) {
        const userData = this.users.get(chatId)!;

        if (!userData.keypair) {
            await this.handleStart({ chat: { id: chatId } } as TelegramBot.Message);
            return;
        }

        const publicKey = userData.publicKey!;
        const balances = await this.getBalances(publicKey);
        const breezeBalance = await this.getUserCurrentValue(publicKey);
        const currentYield = await this.getBreezeYieldFromAPI(publicKey);

        const message =
            '🌊 **BREEZE INTEGRATION BOT** 🌊\n\n' +
            `💳 Wallet: \`${publicKey.slice(0, 8)}...${publicKey.slice(-8)}\`\n\n` +
            '💰 **Balances:**\n' +
            `• SOL: ${balances.sol.toFixed(4)} ◎\n` +
            `• USDC: ${balances.usdc.human.toFixed(2)} 💵\n` +
            `• USDT: ${balances.usdt.human.toFixed(2)} 💵\n` +
            `• PYUSD: ${balances.pyusd.human.toFixed(2)} 💵\n` +
            `• USDS: ${balances.usds.human.toFixed(2)} 💵\n\n` +
            `🌊 **Breeze Balance:** $${breezeBalance.toFixed(2)}\n` +
            `📈 **Current APY:** ${currentYield.toFixed(2)}%\n\n` +
            '🚀 Ready to earn yield with Breeze!';

        const keyboard = {
            inline_keyboard: [
                [{ text: '🌊 Earn Yield with Breeze', callback_data: 'earn_yield' }],
                [
                    { text: '💳 Detailed Balances', callback_data: 'view_balances' },
                    { text: '📈 Yield History', callback_data: 'view_yield_history' }
                ],
                [
                    { text: '💸 Buy', callback_data: 'buy_mock' },
                    { text: '💰 Sell', callback_data: 'sell_mock' }
                ],
                [
                    { text: '📊 Positions', callback_data: 'positions_mock' },
                    { text: '📋 Limit Orders', callback_data: 'limit_orders_mock' }
                ],
                [
                    { text: '👥 Copy Trade', callback_data: 'copy_trade_mock' },
                    { text: '⚙️ Settings', callback_data: 'settings_mock' }
                ],
                [{ text: '🎯 Slippage Settings', callback_data: 'slippage_mock' }]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private async getUserCurrentValue(userPublicKey: string): Promise<number> {
        try {
            const data = await this.breezeSDK.getUserBalances({
                userId: userPublicKey
            });

            return parseFloat(data.total_portfolio_value) || 0;
        } catch (error) {
            console.error('Error fetching user current value:', error);
            return 0;
        }
    }

    private async getBreezeYieldFromAPI(userPublicKey: string): Promise<number> {
        try {
            const yieldData = await this.breezeSDK.getUserYield({
                userId: userPublicKey
            });

            if (!yieldData || !yieldData.yields || yieldData.yields.length === 0) {
                return 0;
            }

            // Calculate average APY from all positions
            let totalAPY = 0;
            let count = 0;
            
            for (const position of yieldData.yields) {
                const apy = parseFloat(position.apy);
                if (!isNaN(apy)) {
                    totalAPY += apy;
                    count++;
                }
            }

            return count > 0 ? totalAPY / count : 0;
        } catch (error) {
            console.error('Error calculating Breeze yield:', error);
            return 0;
        }
    }

    private async showEarnYieldInterface(chatId: number) {
        const userData = this.users.get(chatId)!;
        const publicKey = userData.publicKey!;
        const balances = await this.getBalances(publicKey);
        const currentYield = await this.getBreezeYieldFromAPI(publicKey);
        const breezeBalance = await this.getUserCurrentValue(publicKey);

        const message =
            '🌊 **Earn Yield with Breeze** 🌊\n\n' +
            '💰 **Current Balances:**\n' +
            `• USDC: ${balances.usdc.human.toFixed(2)} 💵\n` +
            `• USDT: ${balances.usdt.human.toFixed(2)} 💵\n` +
            `• PYUSD: ${balances.pyusd.human.toFixed(2)} 💵\n` +
            `• USDS: ${balances.usds.human.toFixed(2)} 💵\n\n` +
            `📈 **Current Breeze Yield:** ${currentYield.toFixed(1)}% APY\n` +
            `🌊 **Deposited in Breeze:** $${breezeBalance.toFixed(2)}\n\n` +
            '💡 Earn passive yield on your stablecoins!';

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📥 Deposit', callback_data: 'deposit' },
                    { text: '📤 Withdraw', callback_data: 'withdraw' }
                ],
                [{ text: '🔙 Back to Main', callback_data: 'back_to_main' }]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private async showDepositInterface(chatId: number) {
        const message =
            '📥 **Deposit to Breeze** 📥\n\n' +
            'Select the asset you want to deposit:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '💵 USDC (Supported)', callback_data: 'deposit_usdc' }],
                [{ text: '💵 USDT (Coming Soon)', callback_data: 'deposit_unsupported' }],
                [{ text: '💵 PYUSD (Coming Soon)', callback_data: 'deposit_unsupported' }],
                [{ text: '💵 USDS (Coming Soon)', callback_data: 'deposit_unsupported' }],
                [{ text: '🔙 Back', callback_data: 'earn_yield' }]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private async showWithdrawInterface(chatId: number) {
        const userData = this.users.get(chatId)!;
        const breezeBalance = await this.getUserCurrentValue(userData.publicKey!);

        const message =
            '📤 **Withdraw from Breeze** 📤\n\n' +
            `💰 Available to withdraw: $${breezeBalance.toFixed(2)} USDC\n\n` +
            'Select withdrawal amount:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '50%', callback_data: 'withdraw_50' }],
                [{ text: '100%', callback_data: 'withdraw_100' }],
                [{ text: '💰 Custom Amount', callback_data: 'withdraw_custom' }],
                [{ text: '🔙 Back', callback_data: 'earn_yield' }]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private async showDepositAmountSelection(chatId: number) {
        const userData = this.users.get(chatId)!;
        const balances = await this.getBalances(userData.publicKey!);

        const message =
            '📥 **USDC Deposit Amount** 📥\n\n' +
            `💰 Available USDC: ${balances.usdc.human.toFixed(6)}\n\n` +
            'Select deposit amount:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '50%', callback_data: 'deposit_usdc_50' }],
                [{ text: '100%', callback_data: 'deposit_usdc_100' }],
                [{ text: '💰 Custom Amount', callback_data: 'deposit_usdc_custom' }],
                [{ text: '🔙 Back', callback_data: 'deposit' }]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private logTransactionDetails(serializedTx: string, context: string) {
        try {
            console.log(`\n=== ${context} TRANSACTION DEBUG ===`);
            console.log('Serialized TX (base64):', serializedTx.substring(0, 100) + '...');

            const transaction = VersionedTransaction.deserialize(Buffer.from(serializedTx, 'base64'));

            console.log('Transaction details:');
            console.log('- Version:', transaction.version);
            console.log('- Message keys:', transaction.message.staticAccountKeys.length);
            console.log('- Instructions:', transaction.message.compiledInstructions.length);
            console.log('- Account keys:');
            transaction.message.staticAccountKeys.forEach((key, index) => {
                console.log(`  [${index}]: ${key.toString()}`);
            });

            console.log('===========================\n');
        } catch (error) {
            console.error(`Failed to deserialize transaction in ${context}:`, error);
            console.log('Raw serialized data:', serializedTx);
        }
    }

    // FIXED: Updated processDeposit method with proper BigInt handling
    private async processDeposit(chatId: number, percentage?: number, customAmount?: number) {
        const userData = this.users.get(chatId)!;
        const balances = await this.getBalances(userData.publicKey!);

        let tokenAmount: bigint;
        let humanAmount: number;
        let isAll = false;

        if (percentage === 100) {
            // Use exact raw balance for 100%
            tokenAmount = balances.usdc.raw;
            humanAmount = balances.usdc.human;
            isAll = true;
        } else if (percentage === 50) {
            // Calculate 50% of raw balance
            tokenAmount = balances.usdc.raw / BigInt(2);
            humanAmount = this.convertFromTokenAmount(tokenAmount, 'USDC');
        } else if (customAmount) {
            humanAmount = customAmount;
            tokenAmount = this.convertToTokenAmount(customAmount, 'USDC');
        } else {
            return;
        }

        if (tokenAmount <= 0) {
            await this.bot.sendMessage(chatId, '❌ Insufficient USDC balance!');
            return;
        }

        console.log(`Deposit: ${humanAmount} USDC (${tokenAmount.toString()} token units)`);

        try {
            console.log(`Creating deposit transaction: ${humanAmount} USDC (${tokenAmount.toString()} token units)`);

            // Call Breeze SDK for deposit
            const data = await this.breezeSDK.createDepositTransaction({
                fundId: BREEZE_FUND_ID,
                amount: Number(tokenAmount), // Convert BigInt to number
                all: isAll,
                userKey: userData.publicKey!,
                payerKey: undefined
            });

            if (!data.success || !data.result) {
                await this.bot.sendMessage(chatId, `❌ Error: Failed to create deposit transaction`);
                return;
            }

            userData.pendingTransaction = {
                serializedTx: data.result,
                type: 'deposit',
                amount: humanAmount,
                asset: 'USDC'
            };

            await this.showTransactionConfirmation(chatId, 'deposit', humanAmount, 'USDC');
        } catch (error) {
            console.error('Deposit error:', error);
            await this.bot.sendMessage(chatId, '❌ Failed to create deposit transaction. Please try again.');
        }
    }

    private async processWithdraw(chatId: number, percentage?: number, customAmount?: number) {
        const userData = this.users.get(chatId)!;
        const breezeBalance = await this.getUserCurrentValue(userData.publicKey!);

        let humanAmount: number;
        let isAll = false;
        let tokenAmount: number;

        if (percentage === 100) {
            humanAmount = breezeBalance;
            isAll = true;
            // For 100% withdrawals, we pass 0 as amount and set all=true
            tokenAmount = 0;
        } else if (percentage === 50) {
            humanAmount = breezeBalance * 0.5;
            tokenAmount = Number(this.convertToTokenAmount(humanAmount, 'USDC'));
        } else if (customAmount) {
            humanAmount = customAmount;
            tokenAmount = Number(this.convertToTokenAmount(customAmount, 'USDC'));
        } else {
            return;
        }

        if (humanAmount <= 0) {
            await this.bot.sendMessage(chatId, '❌ No funds available to withdraw!');
            return;
        }

        console.log(`Withdraw: ${humanAmount} USDC (${tokenAmount} token units, all=${isAll})`);

        try {
            console.log(`Creating withdraw transaction: ${humanAmount} USDC (${tokenAmount} token units, all=${isAll})`);

            // Call Breeze SDK for withdraw
            const data = await this.breezeSDK.createWithdrawTransaction({
                fundId: BREEZE_FUND_ID,
                amount: tokenAmount,
                all: isAll,
                userKey: userData.publicKey!,
                payerKey: undefined
            });

            if (!data.success || !data.result) {
                await this.bot.sendMessage(chatId, `❌ Error: Failed to create withdraw transaction`);
                return;
            }

            userData.pendingTransaction = {
                serializedTx: data.result,
                type: 'withdraw',
                amount: humanAmount,
                asset: 'USDC'
            };

            await this.showTransactionConfirmation(chatId, 'withdraw', humanAmount, 'USDC');
        } catch (error) {
            console.error('Withdraw error:', error);
            await this.bot.sendMessage(chatId, '❌ Failed to create withdrawal transaction. Please try again.');
        }
    }


    private async showTransactionConfirmation(chatId: number, type: string, amount: number, asset: string) {
        const message =
            `✅ **Confirm ${type.charAt(0).toUpperCase() + type.slice(1)}** ✅\n\n` +
            `💰 Amount: ${amount.toFixed(6)} ${asset}\n` +
            `🎯 Action: ${type.charAt(0).toUpperCase() + type.slice(1)} ${type === 'deposit' ? 'to' : 'from'} Breeze\n\n` +
            '⚠️ Please confirm this transaction:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '✅ Confirm Transaction', callback_data: 'confirm_transaction' }],
                [{ text: '❌ Cancel', callback_data: 'earn_yield' }]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private async confirmTransaction(chatId: number) {
        const userData = this.users.get(chatId)!;
        const pendingTx = userData.pendingTransaction;

        if (!pendingTx) {
            await this.bot.sendMessage(chatId, '❌ No pending transaction found.');
            return;
        }

        try {
            if (!pendingTx.serializedTx) {
                await this.bot.sendMessage(chatId, '❌ Invalid transaction data.');
                return;
            }

            this.logTransactionDetails(pendingTx.serializedTx, 'CONFIRMING');

            const transaction = VersionedTransaction.deserialize(Buffer.from(pendingTx.serializedTx, 'base64'));
            transaction.sign([userData.keypair!]);

            const signature = await this.connection.sendTransaction(transaction);

            await this.bot.sendMessage(chatId, '⏳ Transaction sent! Waiting for confirmation...');

            const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

            if (confirmation.value.err) {
                await this.bot.sendMessage(chatId, '❌ Transaction failed!');
                return;
            }

            const action = pendingTx.type === 'deposit' ? 'deposited to' : 'withdrawn from';
            await this.bot.sendMessage(chatId,
                `🎉 **Successfully ${action} Breeze!**\n\n` +
                `💰 Amount: ${pendingTx.amount?.toFixed(2)} ${pendingTx.asset}\n` +
                `🔗 Transaction: \`${signature}\``,
                { parse_mode: 'Markdown' }
            );

            setTimeout(() => this.showMainInterface(chatId), 2000);

            // Clear pending transaction
            userData.pendingTransaction = undefined;

        } catch (error) {
            console.error('Transaction error:', error);
            await this.bot.sendMessage(chatId, '❌ Failed to process transaction. Please try again.');
        }
    }

    private async showDetailedBalances(chatId: number) {
        const userData = this.users.get(chatId)!;
        const publicKey = userData.publicKey!;

        try {
            const breezeBalances = await this.breezeSDK.getUserBalances({
                userId: publicKey
            });

            let message = '💳 **Detailed Breeze Balances** 💳\n\n';
            message += `💰 **Total Portfolio Value:** $${parseFloat(breezeBalances.total_portfolio_value).toFixed(2)}\n`;
            message += `🎯 **Total Yield Earned:** $${parseFloat(breezeBalances.total_yield_earned).toFixed(2)}\n\n`;

            if (breezeBalances.balances.length === 0) {
                message += 'No positions found in Breeze.';
            } else {
                for (const balance of breezeBalances.balances) {
                    message += `**${balance.symbol}**\n`;
                    message += `• Wallet Balance: ${parseFloat(balance.wallet_balance).toFixed(6)}\n`;
                    message += `• Total Balance: ${parseFloat(balance.total_balance).toFixed(6)}\n`;
                    message += `• Total Yield: $${parseFloat(balance.total_yield).toFixed(2)}\n`;

                    if (balance.fund_positions.length > 0) {
                        message += `• Fund Positions:\n`;
                        for (const position of balance.fund_positions) {
                            message += `  - ${position.fund_name}: $${parseFloat(position.position_value).toFixed(2)} (APY: ${parseFloat(position.apy).toFixed(2)}%)\n`;
                        }
                    }
                    message += '\n';
                }
            }

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Back to Main', callback_data: 'back_to_main' }]
                ]
            };

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('Error fetching detailed balances:', error);
            await this.bot.sendMessage(chatId, '❌ Unable to fetch Breeze balances. Please try again later.');
        }
    }

    private async showYieldHistory(chatId: number) {
        const userData = this.users.get(chatId)!;
        const publicKey = userData.publicKey!;

        try {
            const yieldData = await this.breezeSDK.getUserYield({
                userId: publicKey
            });

            let message = '📈 **Yield History** 📈\n\n';
            message += `💰 **Total Yield Earned:** $${parseFloat(yieldData.total_yield_earned).toFixed(2)}\n\n`;

            if (yieldData.yields.length === 0) {
                message += 'No yield history found.';
            } else {
                for (const yieldEntry of yieldData.yields) {
                    const entryDate = new Date(yieldEntry.entry_date).toLocaleDateString();
                    const lastUpdated = new Date(yieldEntry.last_updated).toLocaleDateString();
                    
                    message += `**${yieldEntry.fund_name}** (${yieldEntry.base_asset})\n`;
                    message += `• Position Value: $${parseFloat(yieldEntry.position_value).toFixed(2)}\n`;
                    message += `• Yield Earned: $${parseFloat(yieldEntry.yield_earned).toFixed(2)}\n`;
                    message += `• APY: ${parseFloat(yieldEntry.apy).toFixed(2)}%\n`;
                    message += `• Entry Date: ${entryDate}\n`;
                    message += `• Last Updated: ${lastUpdated}\n\n`;
                }

                if (yieldData.pagination.total_pages > 1) {
                    message += `📄 Page ${yieldData.pagination.page} of ${yieldData.pagination.total_pages} (${yieldData.pagination.total_items} total items)`;
                }
            }

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Back to Main', callback_data: 'back_to_main' }]
                ]
            };

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('Error fetching yield history:', error);
            await this.bot.sendMessage(chatId, '❌ Unable to fetch yield history. Please try again later.');
        }
    }

    private async handleMockFeature(chatId: number, feature: string) {
        const messages = {
            buy: "💸 You're on the Breeze side! Buy functionality isn't supported yet, but hey, at least you're earning yield! 😄",
            sell: "💰 You're on the Breeze side! Sell functionality isn't supported yet, but your funds are working hard! 🚀",
            positions: "📊 You're on the Breeze side! No trading positions here, just steady yield earning! 📈",
            limit_orders: "📋 You're on the Breeze side! No limit orders needed when you're earning passive yield! 💪",
            copy_trade: "👥 You're on the Breeze side! Why copy trades when you can earn guaranteed yield? 🎯",
            settings: "⚙️ You're on the Breeze side! Settings are simple - just earn yield and relax! 🌊",
            slippage: "🎯 You're on the Breeze side! No slippage worries here, just smooth sailing! ⛵"
        };

        await this.bot.sendMessage(chatId, messages[feature as keyof typeof messages] || "Feature coming soon! 🚧");

        setTimeout(() => this.showMainInterface(chatId), 2000);
    }

    private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
        const chatId = query.message!.chat.id;
        const data = query.data!;

        await this.bot.answerCallbackQuery(query.id);

        switch (data) {
            case 'generate_keypair':
                await this.generateKeypair(chatId);
                break;
            case 'import_keypair':
                await this.importKeypair(chatId);
                break;
            case 'back_to_main':
                await this.showMainInterface(chatId);
                break;
            case 'earn_yield':
                await this.showEarnYieldInterface(chatId);
                break;
            case 'deposit':
                await this.showDepositInterface(chatId);
                break;
            case 'withdraw':
                await this.showWithdrawInterface(chatId);
                break;
            case 'deposit_usdc':
                await this.showDepositAmountSelection(chatId);
                break;
            case 'deposit_unsupported':
                await this.bot.sendMessage(chatId, "🚧 This asset isn't supported yet, but it's coming soon! Back to Breeze for now! 😉");
                setTimeout(() => this.showDepositInterface(chatId), 1500);
                break;
            case 'deposit_usdc_50':
                await this.processDeposit(chatId, 50);
                break;
            case 'deposit_usdc_100':
                await this.processDeposit(chatId, 100);
                break;
            case 'deposit_usdc_custom':
                await this.bot.sendMessage(chatId, '💰 Please enter the custom USDC amount to deposit:', {
                    reply_markup: { force_reply: true }
                });
                this.users.get(chatId)!.currentMenu = 'awaiting_deposit_amount';
                break;
            case 'withdraw_50':
                await this.processWithdraw(chatId, 50);
                break;
            case 'withdraw_100':
                await this.processWithdraw(chatId, 100);
                break;
            case 'withdraw_custom':
                await this.bot.sendMessage(chatId, '💰 Please enter the custom USDC amount to withdraw:', {
                    reply_markup: { force_reply: true }
                });
                this.users.get(chatId)!.currentMenu = 'awaiting_withdraw_amount';
                break;
            case 'confirm_transaction':
                await this.confirmTransaction(chatId);
                break;
            case 'buy_mock':
                await this.handleMockFeature(chatId, 'buy');
                break;
            case 'sell_mock':
                await this.handleMockFeature(chatId, 'sell');
                break;
            case 'positions_mock':
                await this.handleMockFeature(chatId, 'positions');
                break;
            case 'limit_orders_mock':
                await this.handleMockFeature(chatId, 'limit_orders');
                break;
            case 'copy_trade_mock':
                await this.handleMockFeature(chatId, 'copy_trade');
                break;
            case 'settings_mock':
                await this.handleMockFeature(chatId, 'settings');
                break;
            case 'slippage_mock':
                await this.handleMockFeature(chatId, 'slippage');
                break;
            case 'view_balances':
                await this.showDetailedBalances(chatId);
                break;
            case 'view_yield_history':
                await this.showYieldHistory(chatId);
                break;
        }
    }

    private async handleMessage(msg: TelegramBot.Message) {
        if (!msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const userData = this.users.get(chatId);

        if (!userData || !userData.currentMenu) return;

        switch (userData.currentMenu) {
            case 'awaiting_private_key':
                await this.handlePrivateKeyInput(chatId, msg.text);
                break;
            case 'awaiting_deposit_amount':
                const depositAmount = parseFloat(msg.text);
                if (isNaN(depositAmount) || depositAmount <= 0) {
                    await this.bot.sendMessage(chatId, '❌ Please enter a valid amount.');
                    return;
                }
                // Add precision check for USDC (max 6 decimal places)
                if (depositAmount.toString().split('.')[1]?.length > 6) {
                    await this.bot.sendMessage(chatId, '❌ USDC supports maximum 6 decimal places.');
                    return;
                }
                userData.currentMenu = undefined;
                await this.processDeposit(chatId, undefined, depositAmount);
                break;
            case 'awaiting_withdraw_amount':
                const withdrawAmount = parseFloat(msg.text);
                if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
                    await this.bot.sendMessage(chatId, '❌ Please enter a valid amount.');
                    return;
                }
                // Add precision check for USDC (max 6 decimal places)
                if (withdrawAmount.toString().split('.')[1]?.length > 6) {
                    await this.bot.sendMessage(chatId, '❌ USDC supports maximum 6 decimal places.');
                    return;
                }
                userData.currentMenu = undefined;
                await this.processWithdraw(chatId, undefined, withdrawAmount);
                break;
        }
    }
}

// Start the bot
const breezeBot = new BreezeBot();
console.log('🌊 Breeze Telegram Bot is running...');