import TelegramBot from 'node-telegram-bot-api';
import { Connection, PublicKey, Keypair, VersionedTransaction, Transaction } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

type BreezeApiResponseUpdated =
    | string // when the response is just the serialized transaction
    | { message: string }; // when there's an error

// Breeze Balances API response (with strategy_id)
interface BreezeBalance {
    strategy_name: string;
    strategy_id: string;
    fund_id: string;
    token_address: string;
    token_symbol: string;
    token_name: string;
    decimals: number;
    total_position_value: number;
    total_deposited_value: number;
    yield_earned: number;
    apy: number;
    last_updated: string;
}

interface BreezeBalancesResponse {
    data: BreezeBalance[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    };
}

// Strategy Info API response
interface StrategyInfo {
    strategy_id: string;
    strategy_name: string;
    assets: string[];
    apy: number;
    apy_per_asset: Record<string, number>; // mint -> APY
}

// Legacy user balances (for wallet balances)
interface BreezeUserBalancesInstance {
    token_address: string;
    token_symbol: string;
    token_name: string;
    decimals: number;
    total_balance: number;
    yield_balance: BreezeUserBalancesYieldsInstance;
}

interface BreezeUserBalancesYieldsInstance {
    fund_id: string;
    funds: string; // amount of funds
    amount_of_yield: string;
    fund_apy: number;
}
interface BreezeUserBalancesResponse {
    data: BreezeUserBalancesInstance[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    }
}
interface BreezeUserYieldInstance {
    fund_id: string;
    fund_name: string;
    base_asset: string;
    position_value: string;
    yield_earned: string;
    apy: string;
    entry_date: string;
    last_updated: string;
}
interface BreezeUserYieldResponse {
    data: BreezeUserYieldInstance[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    }
}

// Asset configuration
interface AssetConfig {
    symbol: string;
    mint: string;
    decimals: number;
}

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN!;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const BREEZE_API_KEY = process.env.BREEZE_API_KEY!;
const STRATEGY_ID = process.env.STRATEGY_ID!;

// Available assets for the strategy (with their mint addresses and decimals)
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

// Create lookup maps for quick access
const TOKEN_DECIMALS: Record<string, number> = {};
const TOKEN_MINTS: Record<string, string> = {};
const MINT_TO_SYMBOL: Record<string, string> = {};
for (const asset of AVAILABLE_ASSETS) {
    TOKEN_DECIMALS[asset.symbol] = asset.decimals;
    TOKEN_MINTS[asset.symbol] = asset.mint;
    MINT_TO_SYMBOL[asset.mint] = asset.symbol;
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
    private users: Map<number, UserData> = new Map();

    constructor() {
        this.bot = new TelegramBot(BOT_TOKEN, { polling: true });
        this.connection = new Connection(SOLANA_RPC_URL);
        this.setupHandlers();
    }

    private setupHandlers() {
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
        this.bot.on('message', this.handleMessage.bind(this));
    }

    // Fetch strategy info with APY per asset
    private async getStrategyInfo(): Promise<StrategyInfo | null> {
        try {
            const response = await fetch(`https://api.breeze.baby/strategy-info/${STRATEGY_ID}`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": BREEZE_API_KEY
                }
            });

            if (!response.ok) {
                console.error('Error fetching strategy info: HTTP', response.status);
                return null;
            }

            const data = await response.json() as StrategyInfo;
            return data;
        } catch (error) {
            console.error('Error fetching strategy info:', error);
            return null;
        }
    }

    // Fetch breeze balances with strategy_id
    private async getBreezeBalances(userPublicKey: string): Promise<BreezeBalancesResponse | null> {
        try {
            const response = await fetch(`https://api.breeze.baby/breeze-balances/${userPublicKey}?strategy_id=${STRATEGY_ID}`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": BREEZE_API_KEY
                }
            });

            if (!response.ok) {
                console.error('Error fetching breeze balances: HTTP', response.status);
                return null;
            }

            const data = await response.json() as BreezeBalancesResponse;
            return data;
        } catch (error) {
            console.error('Error fetching breeze balances:', error);
            return null;
        }
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

    // Get wallet balances for all supported assets
    private async getBalances(publicKey: string): Promise<Record<string, { raw: bigint, human: number }>> {
        const balances: Record<string, { raw: bigint, human: number }> = {};

        try {
            const pubKey = new PublicKey(publicKey);

            // Get SOL balance
            const solBalance = await this.connection.getBalance(pubKey);
            balances['sol'] = { raw: BigInt(solBalance), human: solBalance / 1e9 };

            // Get token balances for all supported assets
            for (const asset of AVAILABLE_ASSETS) {
                if (asset.symbol === 'SOL') continue; // Already handled above

                try {
                    const tokenMint = new PublicKey(asset.mint);
                    const tokenAccount = await getAssociatedTokenAddress(tokenMint, pubKey);
                    const accountInfo = await getAccount(this.connection, tokenAccount);

                    const rawAmount = BigInt(accountInfo.amount.toString());
                    const humanAmount = this.convertFromTokenAmount(rawAmount, asset.symbol);

                    balances[asset.symbol.toLowerCase()] = { raw: rawAmount, human: humanAmount };
                } catch (error) {
                    // Token account doesn't exist, balance is 0
                    balances[asset.symbol.toLowerCase()] = { raw: BigInt(0), human: 0 };
                }
            }

            return balances;
        } catch (error) {
            console.error('Error fetching balances:', error);
            // Return empty balances for all assets
            balances['sol'] = { raw: BigInt(0), human: 0 };
            for (const asset of AVAILABLE_ASSETS) {
                if (asset.symbol !== 'SOL') {
                    balances[asset.symbol.toLowerCase()] = { raw: BigInt(0), human: 0 };
                }
            }
            return balances;
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
        const strategyInfo = await this.getStrategyInfo();
        const averageAPY = strategyInfo?.apy || 0;

        const message =
            '🌊 **BREEZE INTEGRATION BOT** 🌊\n\n' +
            `💳 Wallet: \`${publicKey.slice(0, 8)}...${publicKey.slice(-8)}\`\n\n` +
            '💰 **Wallet Balances:**\n' +
            `• SOL: ${balances['sol']?.human.toFixed(4) || '0.0000'} ◎\n` +
            `• USDC: ${balances['usdc']?.human.toFixed(2) || '0.00'} 💵\n` +
            `• USDT: ${balances['usdt']?.human.toFixed(2) || '0.00'} 💵\n` +
            `• USDS: ${balances['usds']?.human.toFixed(2) || '0.00'} 💵\n\n` +
            `🌊 **Breeze Balance:** $${breezeBalance.toFixed(2)}\n` +
            `📈 **Average APY:** ${averageAPY.toFixed(2)}%\n\n` +
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
            // Use the breeze-balances endpoint with strategy_id
            const balanceData = await this.getBreezeBalances(userPublicKey);

            if (!balanceData) {
                return 0;
            }

            let totalPortfolioValue: number = 0;
            for (const balance of balanceData.data) {
                // Convert from token units to human-readable using decimals
                const humanValue = this.convertFromTokenAmount(
                    BigInt(Math.floor(balance.total_position_value)),
                    balance.token_symbol
                );
                totalPortfolioValue += humanValue;
            }

            return totalPortfolioValue;
        } catch (error) {
            console.error('Error fetching user current value:', error);
            return 0;
        }
    }

    // Get user's balance for a specific asset in Breeze
    private async getUserAssetBalance(userPublicKey: string, mint: string): Promise<number> {
        try {
            const balanceData = await this.getBreezeBalances(userPublicKey);

            if (!balanceData) {
                return 0;
            }

            for (const balance of balanceData.data) {
                if (balance.token_address === mint) {
                    // Convert from token units to human-readable
                    return this.convertFromTokenAmount(
                        BigInt(Math.floor(balance.total_position_value)),
                        balance.token_symbol
                    );
                }
            }

            return 0;
        } catch (error) {
            console.error('Error fetching asset balance:', error);
            return 0;
        }
    }

    private async getUserBalances(userPublicKey: string): Promise<BreezeUserBalancesResponse | null> {
        try {
            const response = await fetch(`https://api.breeze.baby/user-balances/${userPublicKey}`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": BREEZE_API_KEY
                }
            });

            if (!response.ok) {
                console.error('Error fetching user balances: HTTP', response.status);
                return null;
            }

            const data = await response.json() as BreezeUserBalancesResponse;
            return data;
        } catch (error) {
            console.error('Error fetching user balances:', error);
            return null;
        }
    }

    private async getUserYield(userPublicKey: string, fundId?: string, page: number = 1, limit: number = 10): Promise<BreezeUserYieldResponse | null> {
        try {
            let url = `https://api.breeze.baby/user-yield/${userPublicKey}?page=${page}&limit=${limit}`;
            if (fundId) {
                url += `&fund_id=${fundId}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": BREEZE_API_KEY
                }
            });

            if (!response.ok) {
                console.error('Error fetching user yield: HTTP', response.status);
                return null;
            }

            const data = await response.json() as BreezeUserYieldResponse;
            return data;
        } catch (error) {
            console.error('Error fetching user yield:', error);
            return null;
        }
    }

    private async getBreezeYieldFromAPI(userPublicKey: string): Promise<number> {
        try {
            const yieldData = await this.getUserYield(userPublicKey);
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
        const breezeBalance = await this.getUserCurrentValue(publicKey);
        const strategyInfo = await this.getStrategyInfo();

        let message = '🌊 **Earn Yield with Breeze** 🌊\n\n';
        message += `📊 **Strategy:** ${strategyInfo?.strategy_name || 'Unknown'}\n`;
        message += `📈 **Average APY:** ${(strategyInfo?.apy || 0).toFixed(2)}%\n`;
        message += `🌊 **Your Position:** $${breezeBalance.toFixed(2)}\n\n`;

        message += '**APY by Asset:**\n';
        if (strategyInfo?.apy_per_asset) {
            for (const asset of AVAILABLE_ASSETS) {
                const apy = strategyInfo.apy_per_asset[asset.mint] || 0;
                if (apy > 0) {
                    message += `• ${asset.symbol}: ${apy.toFixed(2)}%\n`;
                }
            }
        } else {
            message += 'Loading APY data...\n';
        }

        message += '\n💡 Select an asset to earn passive yield!';

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
        const strategyInfo = await this.getStrategyInfo();
        const userData = this.users.get(chatId)!;
        const balances = await this.getBalances(userData.publicKey!);

        let message = '📥 **Deposit to Breeze** 📥\n\n' +
            'Select the asset you want to deposit:\n\n';

        // Build keyboard with all available assets and their APY
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

        for (const asset of AVAILABLE_ASSETS) {
            const apy = strategyInfo?.apy_per_asset?.[asset.mint] || 0;
            const assetKey = asset.symbol.toLowerCase();
            const balance = balances[assetKey]?.human || 0;

            const buttonText = `${asset.symbol} - ${apy.toFixed(2)}% APY (${balance.toFixed(2)} available)`;
            keyboard.push([{ text: buttonText, callback_data: `deposit_asset_${asset.symbol}` }]);
        }

        keyboard.push([{ text: '🔙 Back', callback_data: 'earn_yield' }]);

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    private async showWithdrawInterface(chatId: number) {
        const userData = this.users.get(chatId)!;
        const breezeBalances = await this.getBreezeBalances(userData.publicKey!);
        const strategyInfo = await this.getStrategyInfo();

        let message = '📤 **Withdraw from Breeze** 📤\n\n' +
            'Select the asset you want to withdraw:\n\n';

        // Build keyboard with assets that have a position
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

        if (breezeBalances && breezeBalances.data.length > 0) {
            for (const balance of breezeBalances.data) {
                if (balance.total_position_value > 0) {
                    // Convert from token units to human-readable
                    const positionValue = this.convertFromTokenAmount(
                        BigInt(Math.floor(balance.total_position_value)),
                        balance.token_symbol
                    );
                    const apy = strategyInfo?.apy_per_asset?.[balance.token_address] || balance.apy || 0;
                    const buttonText = `${balance.token_symbol} - $${positionValue.toFixed(2)} (${apy.toFixed(2)}% APY)`;
                    keyboard.push([{ text: buttonText, callback_data: `withdraw_asset_${balance.token_symbol}` }]);
                }
            }
        }

        if (keyboard.length === 0) {
            message += 'No positions found to withdraw.';
        }

        keyboard.push([{ text: '🔙 Back', callback_data: 'earn_yield' }]);

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    private async showDepositAmountSelection(chatId: number) {
        const userData = this.users.get(chatId)!;
        const selectedAsset = userData.selectedAsset;

        if (!selectedAsset) {
            await this.bot.sendMessage(chatId, '❌ No asset selected.');
            return;
        }

        const balances = await this.getBalances(userData.publicKey!);
        const assetKey = selectedAsset.symbol.toLowerCase();
        const assetBalance = balances[assetKey]?.human || 0;
        const strategyInfo = await this.getStrategyInfo();
        const apy = strategyInfo?.apy_per_asset?.[selectedAsset.mint] || 0;

        const message =
            `📥 **${selectedAsset.symbol} Deposit** 📥\n\n` +
            `💰 Available: ${assetBalance.toFixed(6)} ${selectedAsset.symbol}\n` +
            `📈 Current APY: ${apy.toFixed(2)}%\n\n` +
            'Select deposit amount:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '50%', callback_data: 'deposit_50' }],
                [{ text: '100%', callback_data: 'deposit_100' }],
                [{ text: '💰 Custom Amount', callback_data: 'deposit_custom' }],
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
            await this.bot.sendMessage(chatId, '❌ No asset selected.');
            return;
        }

        // getUserAssetBalance already converts to human-readable
        const assetBreezeBalance = await this.getUserAssetBalance(userData.publicKey!, selectedAsset.mint);
        const strategyInfo = await this.getStrategyInfo();
        const apy = strategyInfo?.apy_per_asset?.[selectedAsset.mint] || 0;

        const message =
            `📤 **${selectedAsset.symbol} Withdraw** 📤\n\n` +
            `💰 Available to withdraw: ${assetBreezeBalance.toFixed(2)} ${selectedAsset.symbol}\n` +
            `📈 Current APY: ${apy.toFixed(2)}%\n\n` +
            'Select withdrawal amount:';

        const keyboard = {
            inline_keyboard: [
                [{ text: '50%', callback_data: 'withdraw_50' }],
                [{ text: '100%', callback_data: 'withdraw_100' }],
                [{ text: '💰 Custom Amount', callback_data: 'withdraw_custom' }],
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

    // Process deposit with strategy_id + base_asset
    private async processDeposit(chatId: number, percentage?: number, customAmount?: number) {
        const userData = this.users.get(chatId)!;
        const selectedAsset = userData.selectedAsset;

        if (!selectedAsset) {
            await this.bot.sendMessage(chatId, '❌ No asset selected. Please select an asset first.');
            return;
        }

        const balances = await this.getBalances(userData.publicKey!);
        const assetKey = selectedAsset.symbol.toLowerCase();
        const assetBalance = balances[assetKey] || { raw: BigInt(0), human: 0 };

        let tokenAmount: bigint;
        let humanAmount: number;
        let isAll = false;

        if (percentage === 100) {
            tokenAmount = assetBalance.raw;
            humanAmount = assetBalance.human;
            isAll = true;
        } else if (percentage === 50) {
            tokenAmount = assetBalance.raw / BigInt(2);
            humanAmount = this.convertFromTokenAmount(tokenAmount, selectedAsset.symbol);
        } else if (customAmount) {
            humanAmount = customAmount;
            tokenAmount = this.convertToTokenAmount(customAmount, selectedAsset.symbol);
        } else {
            return;
        }

        if (tokenAmount <= 0) {
            await this.bot.sendMessage(chatId, `❌ Insufficient ${selectedAsset.symbol} balance!`);
            return;
        }

        console.log(`Deposit: ${humanAmount} ${selectedAsset.symbol} (${tokenAmount.toString()} token units)`);

        try {
            // Use strategy_id + base_asset instead of fund_id
            const requestBody = {
                "params": {
                    "strategy_id": STRATEGY_ID,
                    "base_asset": selectedAsset.mint,
                    "amount": Number(tokenAmount),
                    "all": isAll,
                    "user_key": userData.publicKey,
                    "payer_key": userData.publicKey
                }
            };

            console.log('Deposit request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('https://api.breeze.baby/deposit/tx', {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": BREEZE_API_KEY
                },
                body: JSON.stringify(requestBody)
            }).catch((error) => {
                console.error('Deposit error:', error);
                throw error;
            });

            const data = await response.json() as BreezeApiResponseUpdated;

            if (typeof data === 'object' && 'message' in data) {
                await this.bot.sendMessage(chatId, `❌ Error: ${data.message}`);
                return;
            }

            userData.pendingTransaction = {
                serializedTx: data,
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

    // Process withdraw with strategy_id + base_asset
    private async processWithdraw(chatId: number, percentage?: number, customAmount?: number) {
        const userData = this.users.get(chatId)!;
        const selectedAsset = userData.selectedAsset;

        if (!selectedAsset) {
            await this.bot.sendMessage(chatId, '❌ No asset selected. Please select an asset first.');
            return;
        }

        // Get user's balance for this specific asset in Breeze
        const assetBreezeBalance = await this.getUserAssetBalance(userData.publicKey!, selectedAsset.mint);

        let humanAmount: number;
        let isAll = false;

        if (percentage === 100) {
            humanAmount = assetBreezeBalance;
            isAll = true;
        } else if (percentage === 50) {
            humanAmount = assetBreezeBalance * 0.5;
        } else if (customAmount) {
            humanAmount = customAmount;
        } else {
            return;
        }

        if (humanAmount <= 0) {
            await this.bot.sendMessage(chatId, `❌ No ${selectedAsset.symbol} funds available to withdraw!`);
            return;
        }

        const tokenAmount = this.convertToTokenAmount(humanAmount, selectedAsset.symbol);

        console.log(`Withdraw: ${humanAmount} ${selectedAsset.symbol} (${tokenAmount.toString()} token units)`);

        try {
            // Use strategy_id + base_asset instead of fund_id
            const requestBody = {
                "params": {
                    "strategy_id": STRATEGY_ID,
                    "base_asset": selectedAsset.mint,
                    "amount": Number(tokenAmount),
                    "all": isAll,
                    "user_key": userData.publicKey,
                    "payer_key": userData.publicKey
                }
            };

            console.log('Withdraw request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('https://api.breeze.baby/withdraw/tx', {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": BREEZE_API_KEY
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json() as BreezeApiResponseUpdated;

            if (typeof data === 'object' && 'message' in data) {
                await this.bot.sendMessage(chatId, `❌ Error: ${data.message}`);
                return;
            }

            userData.pendingTransaction = {
                serializedTx: data,
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
        const breezeBalances = await this.getBreezeBalances(publicKey);
        const strategyInfo = await this.getStrategyInfo();

        let totalPortfolioValue = 0;
        let totalYieldEarned = 0;

        if (breezeBalances) {
            for (const balance of breezeBalances.data) {
                // Convert from token units to human-readable
                const positionValue = this.convertFromTokenAmount(
                    BigInt(Math.floor(balance.total_position_value)),
                    balance.token_symbol
                );
                const yieldEarned = this.convertFromTokenAmount(
                    BigInt(Math.floor(balance.yield_earned)),
                    balance.token_symbol
                );
                totalPortfolioValue += positionValue;
                totalYieldEarned += yieldEarned;
            }
        }

        let message = '💳 **Detailed Breeze Balances** 💳\n\n';
        message += `📊 **Strategy:** ${strategyInfo?.strategy_name || 'Unknown'}\n`;
        message += `💰 **Total Portfolio Value:** $${totalPortfolioValue.toFixed(2)}\n`;
        message += `🎯 **Total Yield Earned:** $${totalYieldEarned.toFixed(2)}\n\n`;

        if (!breezeBalances || breezeBalances.data.length === 0) {
            message += 'No positions found in Breeze.';
        } else {
            message += '**Positions by Asset:**\n\n';
            for (const balance of breezeBalances.data) {
                if (balance.total_position_value > 0) {
                    // Convert from token units to human-readable
                    const positionValue = this.convertFromTokenAmount(
                        BigInt(Math.floor(balance.total_position_value)),
                        balance.token_symbol
                    );
                    const depositedValue = this.convertFromTokenAmount(
                        BigInt(Math.floor(balance.total_deposited_value)),
                        balance.token_symbol
                    );
                    const yieldEarned = this.convertFromTokenAmount(
                        BigInt(Math.floor(balance.yield_earned)),
                        balance.token_symbol
                    );
                    const apy = strategyInfo?.apy_per_asset?.[balance.token_address] || balance.apy || 0;

                    message += `**${balance.token_symbol}**\n`;
                    message += `• Position Value: $${positionValue.toFixed(2)}\n`;
                    message += `• Deposited: $${depositedValue.toFixed(2)}\n`;
                    message += `• Yield Earned: $${yieldEarned.toFixed(2)}\n`;
                    message += `• APY: ${apy.toFixed(2)}%\n\n`;
                }
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
    }

    private async showYieldHistory(chatId: number) {
        const userData = this.users.get(chatId)!;
        const publicKey = userData.publicKey!;
        const yieldData = await this.getUserYield(publicKey);

        if (!yieldData) {
            await this.bot.sendMessage(chatId, '❌ Unable to fetch yield history. Please try again later.');
            return;
        }

        let totalYieldEarned: number = 0;
        
        // FIXED: Calculate total yield earned by converting from token amounts
        for (const position of yieldData.data) {
            // Assuming yield_earned is in token amounts, convert to human readable
            // You might need to determine the token symbol for each position
            // If the API doesn't provide token symbol, you might need to infer it from base_asset
            const tokenSymbol = position.base_asset === 'USDC' ? 'USDC' : 
                              position.base_asset === 'USDT' ? 'USDT' : 
                              position.base_asset === 'PYUSD' ? 'PYUSD' : 
                              position.base_asset === 'USDS' ? 'USDS' : 'USDC'; // default to USDC
            
            const yieldEarned = this.convertFromTokenAmount(
                BigInt(position.yield_earned), 
                tokenSymbol
            );
            totalYieldEarned += yieldEarned;
        }

        let message = '📈 **Yield History** 📈\n\n';
        message += `💰 **Total Yield Earned:** $${totalYieldEarned.toFixed(2)}\n\n`;

        if (yieldData.data.length === 0) {
            message += 'No yield history found.';
        } else {
            for (const yieldEntry of yieldData.data) {
                const entryDate = new Date(yieldEntry.entry_date).toLocaleDateString();
                const lastUpdated = new Date(yieldEntry.last_updated).toLocaleDateString();

                // FIXED: Convert position value and yield earned from token amounts
                const tokenSymbol = yieldEntry.base_asset === 'USDC' ? 'USDC' : 
                                  yieldEntry.base_asset === 'USDT' ? 'USDT' : 
                                  yieldEntry.base_asset === 'PYUSD' ? 'PYUSD' : 
                                  yieldEntry.base_asset === 'USDS' ? 'USDS' : 'USDC';
                
                const positionValue = this.convertFromTokenAmount(
                    BigInt(yieldEntry.position_value), 
                    tokenSymbol
                );
                const yieldEarned = this.convertFromTokenAmount(
                    BigInt(yieldEntry.yield_earned), 
                    tokenSymbol
                );

                message += `**${yieldEntry.fund_name}** (${yieldEntry.base_asset})\n`;
                message += `• Position Value: $${positionValue.toFixed(6)}\n`;
                message += `• Yield Earned: $${yieldEarned.toFixed(6)}\n`;
                message += `• APY: ${parseFloat(yieldEntry.apy).toFixed(6)}%\n`;
                message += `• Entry Date: ${entryDate}\n`;
                message += `• Last Updated: ${lastUpdated}\n\n`;
            }

            if (yieldData.meta.total_pages > 1) {
                message += `📄 Page ${yieldData.meta.page} of ${yieldData.meta.total_pages}`;
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
            const assetSymbol = data.replace('deposit_asset_', '');
            const asset = AVAILABLE_ASSETS.find(a => a.symbol === assetSymbol);
            if (asset) {
                this.users.get(chatId)!.selectedAsset = asset;
                await this.showDepositAmountSelection(chatId);
            }
            return;
        }

        // Handle asset selection for withdraw
        if (data.startsWith('withdraw_asset_')) {
            const assetSymbol = data.replace('withdraw_asset_', '');
            const asset = AVAILABLE_ASSETS.find(a => a.symbol === assetSymbol);
            if (asset) {
                this.users.get(chatId)!.selectedAsset = asset;
                await this.showWithdrawAmountSelection(chatId);
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
            case 'deposit_50':
                await this.processDeposit(chatId, 50);
                break;
            case 'deposit_100':
                await this.processDeposit(chatId, 100);
                break;
            case 'deposit_custom':
                const depositAsset = this.users.get(chatId)?.selectedAsset;
                await this.bot.sendMessage(chatId, `💰 Please enter the custom ${depositAsset?.symbol || ''} amount to deposit:`, {
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
                const withdrawAsset = this.users.get(chatId)?.selectedAsset;
                await this.bot.sendMessage(chatId, `💰 Please enter the custom ${withdrawAsset?.symbol || ''} amount to withdraw:`, {
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
                // Check precision based on selected asset
                const depositAsset = userData.selectedAsset;
                const depositDecimals = depositAsset?.decimals || 6;
                if (depositAmount.toString().split('.')[1]?.length > depositDecimals) {
                    await this.bot.sendMessage(chatId, `❌ ${depositAsset?.symbol || 'This asset'} supports maximum ${depositDecimals} decimal places.`);
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
                // Check precision based on selected asset
                const withdrawAsset = userData.selectedAsset;
                const withdrawDecimals = withdrawAsset?.decimals || 6;
                if (withdrawAmount.toString().split('.')[1]?.length > withdrawDecimals) {
                    await this.bot.sendMessage(chatId, `❌ ${withdrawAsset?.symbol || 'This asset'} supports maximum ${withdrawDecimals} decimal places.`);
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