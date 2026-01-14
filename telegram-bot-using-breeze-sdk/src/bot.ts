import TelegramBot from 'node-telegram-bot-api';
import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { BreezeSDK } from '@breezebaby/breeze-sdk';

dotenv.config();

// Available assets configuration (matching breeze-tester-2)
interface AssetConfig {
    symbol: string;
    mint: string;
    decimals: number;
}

const AVAILABLE_ASSETS: AssetConfig[] = [
    { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
    { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
    { symbol: 'USDS', mint: 'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA', decimals: 6 },
    { symbol: 'JupSOL', mint: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v', decimals: 9 },
    { symbol: 'JLP', mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4', decimals: 6 },
    { symbol: 'mSOL', mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', decimals: 9 },
    { symbol: 'JitoSOL', mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', decimals: 9 },
    { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
];

// Helper to get asset by symbol
const getAssetBySymbol = (symbol: string): AssetConfig | undefined =>
    AVAILABLE_ASSETS.find(a => a.symbol === symbol);

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN!;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const BREEZE_API_KEY = process.env.BREEZE_API_KEY!;
const STRATEGY_ID = process.env.STRATEGY_ID!;

// Strategy info type
interface StrategyInfo {
    strategy_id: string;
    strategy_name: string;
    assets: string[];
    apy: number;
    apy_per_asset: Record<string, number>;
}

interface UserData {
    keypair?: Keypair;
    publicKey?: string;
    currentMenu?: string;
    selectedAsset?: AssetConfig;
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
    private strategyInfo: StrategyInfo | null = null;
    private strategyInfoLastFetch: number = 0;
    private readonly STRATEGY_INFO_CACHE_TTL = 60000; // 1 minute cache

    constructor() {
        this.bot = new TelegramBot(BOT_TOKEN, { polling: true });
        this.connection = new Connection(SOLANA_RPC_URL);
        this.breezeSDK = new BreezeSDK({
            baseUrl: 'https://api.breeze.baby/',
            apiKey: BREEZE_API_KEY
        });
        this.setupHandlers();
        // Fetch strategy info on startup
        this.fetchStrategyInfo();
    }

    // Fetch strategy info (APY per asset) using SDK
    private async fetchStrategyInfo(): Promise<StrategyInfo | null> {
        const now = Date.now();
        if (this.strategyInfo && (now - this.strategyInfoLastFetch) < this.STRATEGY_INFO_CACHE_TTL) {
            return this.strategyInfo;
        }

        try {
            this.strategyInfo = await this.breezeSDK.getStrategyInfo(STRATEGY_ID);
            this.strategyInfoLastFetch = now;
            console.log('Strategy info fetched:', this.strategyInfo);
            return this.strategyInfo;
        } catch (error) {
            console.error('Error fetching strategy info:', error);
            return this.strategyInfo;
        }
    }

    // Get APY for a specific mint
    private getApyForMint(mint: string): number | null {
        if (!this.strategyInfo?.apy_per_asset) return null;
        return this.strategyInfo.apy_per_asset[mint] ?? null;
    }

    private setupHandlers() {
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
        this.bot.on('message', this.handleMessage.bind(this));
    }


    // Convert human-readable amount to token units
    private convertToTokenAmount(humanAmount: number, decimals: number): bigint {
        // Use string manipulation for precise decimal handling
        const amountStr = humanAmount.toFixed(decimals);
        const [integerPart, decimalPart = ''] = amountStr.split('.');

        // Pad decimal part to required length
        const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals);

        // Combine and convert to bigint
        const fullAmountStr = integerPart + paddedDecimal;
        return BigInt(fullAmountStr);
    }

    private convertFromTokenAmount(tokenAmount: bigint, decimals: number): number {
        const divisor = BigInt(10 ** decimals);

        // Convert to number with proper decimal places
        const integerPart = Number(tokenAmount / divisor);
        const remainder = tokenAmount % divisor;
        const decimalPart = Number(remainder) / Number(divisor);

        return integerPart + decimalPart;
    }

    // Get balance for a specific asset
    private async getAssetBalance(publicKey: string, asset: AssetConfig): Promise<{ raw: bigint; human: number }> {
        try {
            const pubKey = new PublicKey(publicKey);

            // Handle native SOL differently
            if (asset.symbol === 'SOL') {
                const lamports = await this.connection.getBalance(pubKey);
                return {
                    raw: BigInt(lamports),
                    human: lamports / Math.pow(10, asset.decimals)
                };
            }

            // SPL token balance
            const tokenMint = new PublicKey(asset.mint);
            const tokenAccount = await getAssociatedTokenAddress(tokenMint, pubKey);
            const accountInfo = await getAccount(this.connection, tokenAccount);

            const rawAmount = BigInt(accountInfo.amount.toString());
            const humanAmount = this.convertFromTokenAmount(rawAmount, asset.decimals);

            return { raw: rawAmount, human: humanAmount };
        } catch (error) {
            // Token account doesn't exist
            return { raw: BigInt(0), human: 0 };
        }
    }

    // Get all balances for display
    private async getAllBalances(publicKey: string): Promise<Map<string, { raw: bigint; human: number }>> {
        const balances = new Map<string, { raw: bigint; human: number }>();

        for (const asset of AVAILABLE_ASSETS) {
            const balance = await this.getAssetBalance(publicKey, asset);
            balances.set(asset.symbol, balance);
        }

        return balances;
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

        // Fetch strategy info for APY
        await this.fetchStrategyInfo();

        // Get wallet balances for all assets
        const walletBalances = await this.getAllBalances(publicKey);
        const breezeBalance = await this.getUserCurrentValue(publicKey);

        let balanceStr = '';
        for (const asset of AVAILABLE_ASSETS) {
            const balance = walletBalances.get(asset.symbol);
            const apy = this.getApyForMint(asset.mint);
            const apyStr = apy !== null ? ` (${apy.toFixed(2)}% APY)` : '';

            if (asset.symbol === 'SOL') {
                balanceStr += `• ${asset.symbol}: ${balance?.human.toFixed(4) || '0.0000'} ◎${apyStr}\n`;
            } else {
                balanceStr += `• ${asset.symbol}: ${balance?.human.toFixed(2) || '0.00'}${apyStr}\n`;
            }
        }

        const message =
            '🌊 **BREEZE INTEGRATION BOT** 🌊\n\n' +
            `💳 Wallet: \`${publicKey.slice(0, 8)}...${publicKey.slice(-8)}\`\n\n` +
            '💰 **Wallet Balances:**\n' +
            balanceStr + '\n' +
            `🌊 **Breeze Balance:** $${breezeBalance.toFixed(2)}\n\n` +
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

    // Get total Breeze balance using getBreezeBalances with strategyId
    private async getUserCurrentValue(userPublicKey: string): Promise<number> {
        try {
            const data = await this.breezeSDK.getBreezeBalances({
                userId: userPublicKey,
                strategyId: STRATEGY_ID
            });

            // Calculate total from data array
            let total = 0;
            for (const balance of data.data) {
                total += balance.total_position_value / Math.pow(10, balance.decimals);
            }
            return total;
        } catch (error) {
            console.error('Error fetching user current value:', error);
            return 0;
        }
    }

    // Get Breeze balance for a specific asset symbol
    private async getUserAssetBalance(userPublicKey: string, symbol: string): Promise<number> {
        try {
            const data = await this.breezeSDK.getBreezeBalances({
                userId: userPublicKey,
                strategyId: STRATEGY_ID
            });

            for (const balance of data.data) {
                if (balance.token_symbol === symbol) {
                    return balance.total_position_value / Math.pow(10, balance.decimals);
                }
            }
            return 0;
        } catch (error) {
            console.error(`Error fetching user ${symbol} balance:`, error);
            return 0;
        }
    }

    // Get all Breeze balances mapped by symbol using getBreezeBalances with strategyId
    private async getUserBreezeBalances(userPublicKey: string): Promise<Map<string, { balance: number; apy: number }>> {
        const balances = new Map<string, { balance: number; apy: number }>();

        try {
            const data = await this.breezeSDK.getBreezeBalances({
                userId: userPublicKey,
                strategyId: STRATEGY_ID,
                sortBy: 'balance',
                sortOrder: 'desc'
            });

            for (const balance of data.data) {
                const positionValue = balance.total_position_value / Math.pow(10, balance.decimals);
                balances.set(balance.token_symbol, {
                    balance: positionValue,
                    apy: balance.apy
                });
            }
        } catch (error) {
            console.error('Error fetching user Breeze balances:', error);
        }

        return balances;
    }

    private async getBreezeYieldFromAPI(userPublicKey: string): Promise<number> {
        try {
            const yieldData = await this.breezeSDK.getUserYield({
                userId: userPublicKey
            });

            if (!yieldData || !yieldData.data || yieldData.data.length === 0) {
                return 0;
            }

            // Calculate average APY from all positions
            let totalAPY = 0;
            let count = 0;
            
            for (const position of yieldData.data) {
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

        // Fetch strategy info for APY
        await this.fetchStrategyInfo();

        const walletBalances = await this.getAllBalances(publicKey);
        const breezeBalances = await this.getUserBreezeBalances(publicKey);

        let walletBalanceStr = '';
        let breezeBalanceStr = '';

        for (const asset of AVAILABLE_ASSETS) {
            const walletBal = walletBalances.get(asset.symbol);
            const breezeBal = breezeBalances.get(asset.symbol);
            const apy = this.getApyForMint(asset.mint);

            const apyStr = apy !== null ? ` (${apy.toFixed(2)}% APY)` : '';

            if (walletBal && walletBal.human > 0) {
                walletBalanceStr += `• ${asset.symbol}: ${walletBal.human.toFixed(asset.decimals > 6 ? 4 : 2)}${apyStr}\n`;
            }

            if (breezeBal && breezeBal.balance > 0) {
                breezeBalanceStr += `• ${asset.symbol}: ${breezeBal.balance.toFixed(asset.decimals > 6 ? 4 : 2)}\n`;
            }
        }

        if (!walletBalanceStr) walletBalanceStr = 'No supported assets in wallet\n';
        if (!breezeBalanceStr) breezeBalanceStr = 'No deposits yet\n';

        const message =
            '🌊 **Earn Yield with Breeze** 🌊\n\n' +
            '💰 **Wallet Balances:**\n' +
            walletBalanceStr + '\n' +
            '🌊 **Breeze Deposits:**\n' +
            breezeBalanceStr + '\n' +
            '💡 Deposit to earn passive yield!';

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
        // Fetch strategy info for APY and available assets
        await this.fetchStrategyInfo();

        const availableAssets = this.strategyInfo?.assets || [];

        let message = '📥 **Deposit to Breeze** 📥\n\n' +
            'Select the asset you want to deposit:\n\n';

        // Build keyboard with all available assets and their APYs
        const assetButtons: TelegramBot.InlineKeyboardButton[][] = [];

        for (const asset of AVAILABLE_ASSETS) {
            const apy = this.getApyForMint(asset.mint);
            const isAvailable = availableAssets.length === 0 || availableAssets.includes(asset.mint);

            if (isAvailable && apy !== null) {
                assetButtons.push([{
                    text: `${asset.symbol} (${apy.toFixed(2)}% APY)`,
                    callback_data: `deposit_asset_${asset.symbol}`
                }]);
            }
        }

        if (assetButtons.length === 0) {
            message += '⚠️ No assets available for deposit. Please try again later.';
        }

        assetButtons.push([{ text: '🔙 Back', callback_data: 'earn_yield' }]);

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: assetButtons }
        });
    }

    private async showWithdrawInterface(chatId: number) {
        const userData = this.users.get(chatId)!;

        // Get all Breeze balances
        const breezeBalances = await this.getUserBreezeBalances(userData.publicKey!);

        let message = '📤 **Withdraw from Breeze** 📤\n\n' +
            'Select the asset you want to withdraw:\n\n';

        // Build keyboard with assets that have balances
        const assetButtons: TelegramBot.InlineKeyboardButton[][] = [];

        for (const asset of AVAILABLE_ASSETS) {
            const breezeBal = breezeBalances.get(asset.symbol);
            if (breezeBal && breezeBal.balance > 0) {
                const displayBalance = asset.decimals > 6
                    ? breezeBal.balance.toFixed(4)
                    : breezeBal.balance.toFixed(2);
                assetButtons.push([{
                    text: `${asset.symbol}: ${displayBalance}`,
                    callback_data: `withdraw_asset_${asset.symbol}`
                }]);
            }
        }

        if (assetButtons.length === 0) {
            message += '⚠️ No assets available to withdraw.';
        }

        assetButtons.push([{ text: '🔙 Back', callback_data: 'earn_yield' }]);

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: assetButtons }
        });
    }

    private async showDepositAmountSelection(chatId: number) {
        const userData = this.users.get(chatId)!;
        const selectedAsset = userData.selectedAsset;

        if (!selectedAsset) {
            await this.bot.sendMessage(chatId, '❌ No asset selected. Please select an asset first.');
            await this.showDepositInterface(chatId);
            return;
        }

        const balance = await this.getAssetBalance(userData.publicKey!, selectedAsset);
        const apy = this.getApyForMint(selectedAsset.mint);
        const apyStr = apy !== null ? `\n📈 APY: ${apy.toFixed(2)}%` : '';

        const displayBalance = selectedAsset.decimals > 6
            ? balance.human.toFixed(4)
            : balance.human.toFixed(6);

        const message =
            `📥 **${selectedAsset.symbol} Deposit Amount** 📥\n\n` +
            `💰 Available ${selectedAsset.symbol}: ${displayBalance}${apyStr}\n\n` +
            'Select deposit amount:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '50%', callback_data: 'deposit_amount_50' }],
                [{ text: '100%', callback_data: 'deposit_amount_100' }],
                [{ text: '💰 Custom Amount', callback_data: 'deposit_amount_custom' }],
                [{ text: '🔙 Back', callback_data: 'deposit' }]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private async showWithdrawAmountSelection(chatId: number) {
        const userData = this.users.get(chatId)!;
        const selectedAsset = userData.selectedAsset;

        if (!selectedAsset) {
            await this.bot.sendMessage(chatId, '❌ No asset selected. Please select an asset first.');
            await this.showWithdrawInterface(chatId);
            return;
        }

        const breezeBalance = await this.getUserAssetBalance(userData.publicKey!, selectedAsset.symbol);

        const displayBalance = selectedAsset.decimals > 6
            ? breezeBalance.toFixed(4)
            : breezeBalance.toFixed(6);

        const message =
            `📤 **${selectedAsset.symbol} Withdrawal Amount** 📤\n\n` +
            `💰 Available to withdraw: ${displayBalance} ${selectedAsset.symbol}\n\n` +
            'Select withdrawal amount:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '50%', callback_data: 'withdraw_amount_50' }],
                [{ text: '100%', callback_data: 'withdraw_amount_100' }],
                [{ text: '💰 Custom Amount', callback_data: 'withdraw_amount_custom' }],
                [{ text: '🔙 Back', callback_data: 'withdraw' }]
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

    // Create deposit transaction using direct API call with strategy_id + mint
    private async processDeposit(chatId: number, percentage?: number, customAmount?: number) {
        const userData = this.users.get(chatId)!;
        const selectedAsset = userData.selectedAsset;

        if (!selectedAsset) {
            await this.bot.sendMessage(chatId, '❌ No asset selected. Please select an asset first.');
            return;
        }

        const balance = await this.getAssetBalance(userData.publicKey!, selectedAsset);

        let tokenAmount: bigint;
        let humanAmount: number;
        let isAll = false;

        if (percentage === 100) {
            // Use exact raw balance for 100%
            tokenAmount = balance.raw;
            humanAmount = balance.human;
            isAll = true;
        } else if (percentage === 50) {
            // Calculate 50% of raw balance
            tokenAmount = balance.raw / BigInt(2);
            humanAmount = this.convertFromTokenAmount(tokenAmount, selectedAsset.decimals);
        } else if (customAmount) {
            humanAmount = customAmount;
            tokenAmount = this.convertToTokenAmount(customAmount, selectedAsset.decimals);
        } else {
            return;
        }

        if (tokenAmount <= 0) {
            await this.bot.sendMessage(chatId, `❌ Insufficient ${selectedAsset.symbol} balance!`);
            return;
        }

        console.log(`Deposit: ${humanAmount} ${selectedAsset.symbol} (${tokenAmount.toString()} token units)`);

        try {
            console.log(`Creating deposit transaction: ${humanAmount} ${selectedAsset.symbol} (${tokenAmount.toString()} token units)`);

            // Use SDK to create deposit transaction with strategyId + baseAsset
            const data = await this.breezeSDK.createDepositTransaction({
                strategyId: STRATEGY_ID,
                baseAsset: selectedAsset.mint,
                amount: Number(tokenAmount),
                all: isAll,
                userKey: userData.publicKey!,
                payerKey: userData.publicKey!
            });

            // Check if response is string (success) or error object
            if (typeof data === 'object' && 'message' in data) {
                await this.bot.sendMessage(chatId, `❌ Error: ${data.message}`);
                return;
            }

            userData.pendingTransaction = {
                serializedTx: data as string,
                type: 'deposit',
                amount: humanAmount,
                asset: selectedAsset.symbol
            };

            await this.showTransactionConfirmation(chatId, 'deposit', humanAmount, selectedAsset.symbol);
        } catch (error) {
            console.error('Deposit error:', error);
            await this.bot.sendMessage(chatId, '❌ Failed to create deposit transaction. Please try again.');
        }
    }

    // Create withdraw transaction using direct API call with strategy_id + mint
    private async processWithdraw(chatId: number, percentage?: number, customAmount?: number) {
        const userData = this.users.get(chatId)!;
        const selectedAsset = userData.selectedAsset;

        if (!selectedAsset) {
            await this.bot.sendMessage(chatId, '❌ No asset selected. Please select an asset first.');
            return;
        }

        // Get Breeze balance for this specific asset
        const breezeBalance = await this.getUserAssetBalance(userData.publicKey!, selectedAsset.symbol);

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
            tokenAmount = Number(this.convertToTokenAmount(humanAmount, selectedAsset.decimals));
        } else if (customAmount) {
            humanAmount = customAmount;
            tokenAmount = Number(this.convertToTokenAmount(customAmount, selectedAsset.decimals));
        } else {
            return;
        }

        if (humanAmount <= 0) {
            await this.bot.sendMessage(chatId, `❌ No ${selectedAsset.symbol} funds available to withdraw!`);
            return;
        }

        console.log(`Withdraw: ${humanAmount} ${selectedAsset.symbol} (${tokenAmount} token units, all=${isAll})`);

        try {
            console.log(`Creating withdraw transaction: ${humanAmount} ${selectedAsset.symbol} (${tokenAmount} token units, all=${isAll})`);

            // Use SDK to create withdraw transaction with strategyId + baseAsset
            const data = await this.breezeSDK.createWithdrawTransaction({
                strategyId: STRATEGY_ID,
                baseAsset: selectedAsset.mint,
                amount: tokenAmount,
                all: isAll,
                userKey: userData.publicKey!,
                payerKey: userData.publicKey!
            });

            // Check if response is string (success) or error object
            if (typeof data === 'object' && 'message' in data) {
                await this.bot.sendMessage(chatId, `❌ Error: ${data.message}`);
                return;
            }

            userData.pendingTransaction = {
                serializedTx: data as string,
                type: 'withdraw',
                amount: humanAmount,
                asset: selectedAsset.symbol
            };

            await this.showTransactionConfirmation(chatId, 'withdraw', humanAmount, selectedAsset.symbol);
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
            
            // Calculate totals from data array
            let totalPortfolioValue = 0;
            let totalYieldEarned = 0;
            
            for (const balance of breezeBalances.data) {
                if (balance.yield_balance) {
                    const funds = parseFloat(balance.yield_balance.funds) / Math.pow(10, balance.decimals);
                    const yieldAmount = parseFloat(balance.yield_balance.amount_of_yield) / Math.pow(10, balance.decimals);
                    totalPortfolioValue += funds;
                    totalYieldEarned += yieldAmount;
                }
            }

            message += `💰 **Total Portfolio Value:** $${totalPortfolioValue.toFixed(2)}\n`;
            message += `🎯 **Total Yield Earned:** $${totalYieldEarned.toFixed(2)}\n\n`;

            if (breezeBalances.data.length === 0) {
                message += 'No positions found in Breeze.';
            } else {
                for (const balance of breezeBalances.data) {
                    const totalBalance = parseFloat(balance.total_balance.toString()) / Math.pow(10, balance.decimals);
                    
                    message += `**${balance.token_symbol}**\n`;
                    message += `• Total Balance: ${totalBalance.toFixed(6)}\n`;

                    if (balance.yield_balance) {
                        const funds = parseFloat(balance.yield_balance.funds) / Math.pow(10, balance.decimals);
                        const yieldAmount = parseFloat(balance.yield_balance.amount_of_yield) / Math.pow(10, balance.decimals);
                        const apy = parseFloat(balance.yield_balance.fund_apy.toString());
                        
                        message += `• Breeze Position: ${funds.toFixed(6)}\n`;
                        message += `• Yield Earned: $${yieldAmount.toFixed(6)}\n`;
                        message += `• APY: ${apy.toFixed(2)}%\n`;
                    } else {
                        message += `• No Breeze position\n`;
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
            
            // Calculate total yield earned from data array
            let totalYieldEarned = 0;
            for (const yieldEntry of yieldData.data) {
                totalYieldEarned += parseFloat(yieldEntry.yield_earned);
            }
            
            message += `💰 **Total Yield Earned:** $${totalYieldEarned.toFixed(2)}\n\n`;

            if (yieldData.data.length === 0) {
                message += 'No yield history found.';
            } else {
                for (const yieldEntry of yieldData.data) {
                    const entryDate = new Date(yieldEntry.entry_date).toLocaleDateString();
                    const lastUpdated = new Date(yieldEntry.last_updated).toLocaleDateString();
                    
                    message += `**${yieldEntry.fund_name}** (${yieldEntry.base_asset})\n`;
                    message += `• Position Value: $${parseFloat(yieldEntry.position_value).toFixed(2)}\n`;
                    message += `• Yield Earned: $${parseFloat(yieldEntry.yield_earned).toFixed(2)}\n`;
                    message += `• APY: ${parseFloat(yieldEntry.apy).toFixed(2)}%\n`;
                    message += `• Entry Date: ${entryDate}\n`;
                    message += `• Last Updated: ${lastUpdated}\n\n`;
                }

                if (yieldData.meta.total_pages > 1) {
                    message += `📄 Page ${yieldData.meta.page} of ${yieldData.meta.total_pages} (${yieldData.meta.total} total items)`;
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

        // Handle asset selection for deposit
        if (data.startsWith('deposit_asset_')) {
            const symbol = data.replace('deposit_asset_', '');
            const asset = getAssetBySymbol(symbol);
            if (asset) {
                this.users.get(chatId)!.selectedAsset = asset;
                await this.showDepositAmountSelection(chatId);
            } else {
                await this.bot.sendMessage(chatId, '❌ Asset not found.');
            }
            return;
        }

        // Handle asset selection for withdraw
        if (data.startsWith('withdraw_asset_')) {
            const symbol = data.replace('withdraw_asset_', '');
            const asset = getAssetBySymbol(symbol);
            if (asset) {
                this.users.get(chatId)!.selectedAsset = asset;
                await this.showWithdrawAmountSelection(chatId);
            } else {
                await this.bot.sendMessage(chatId, '❌ Asset not found.');
            }
            return;
        }

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

            // Deposit amount selection
            case 'deposit_amount_50':
                await this.processDeposit(chatId, 50);
                break;
            case 'deposit_amount_100':
                await this.processDeposit(chatId, 100);
                break;
            case 'deposit_amount_custom':
                const depositAsset = this.users.get(chatId)!.selectedAsset;
                await this.bot.sendMessage(chatId, `💰 Please enter the custom ${depositAsset?.symbol || 'asset'} amount to deposit:`, {
                    reply_markup: { force_reply: true }
                });
                this.users.get(chatId)!.currentMenu = 'awaiting_deposit_amount';
                break;

            // Withdraw amount selection
            case 'withdraw_amount_50':
                await this.processWithdraw(chatId, 50);
                break;
            case 'withdraw_amount_100':
                await this.processWithdraw(chatId, 100);
                break;
            case 'withdraw_amount_custom':
                const withdrawAsset = this.users.get(chatId)!.selectedAsset;
                await this.bot.sendMessage(chatId, `💰 Please enter the custom ${withdrawAsset?.symbol || 'asset'} amount to withdraw:`, {
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
                // Check decimal places based on selected asset
                const depositAsset = userData.selectedAsset;
                const maxDepositDecimals = depositAsset?.decimals || 6;
                if (depositAmount.toString().split('.')[1]?.length > maxDepositDecimals) {
                    await this.bot.sendMessage(chatId, `❌ ${depositAsset?.symbol || 'This asset'} supports maximum ${maxDepositDecimals} decimal places.`);
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
                // Check decimal places based on selected asset
                const withdrawAsset = userData.selectedAsset;
                const maxWithdrawDecimals = withdrawAsset?.decimals || 6;
                if (withdrawAmount.toString().split('.')[1]?.length > maxWithdrawDecimals) {
                    await this.bot.sendMessage(chatId, `❌ ${withdrawAsset?.symbol || 'This asset'} supports maximum ${maxWithdrawDecimals} decimal places.`);
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