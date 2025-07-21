# Telegram Bot with Breeze SDK

A TypeScript-based Telegram bot that demonstrates seamless DeFi yield farming integration using the Breeze SDK.

## 🚀 Features

- **Breeze SDK Integration** - Clean, type-safe interface for DeFi operations
- **Real-time Portfolio Tracking** - Live balance and yield monitoring
- **Multi-Asset Support** - USDC, USDT, PYUSD, and USDS compatibility
- **Intuitive User Interface** - Interactive keyboards and conversational flow
- **Secure Transaction Handling** - User confirmation and blockchain submission
- **TypeScript Support** - Full type safety and enhanced development experience
- **ES Module Architecture** - Modern JavaScript with optimal performance

## 📋 Prerequisites

- Node.js 18+ (ES modules support)
- npm or yarn
- Breeze API key
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)

## 🛠️ Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here

# Solana RPC URL
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Breeze SDK Configuration
BREEZE_API_KEY=your_breeze_api_key_here
BREEZE_FUND_ID=your_breeze_fund_id
```

### 3. Build and run the bot

```bash
npm run build
npm start
```

For development with hot reload:
```bash
npm run dev
```

## 🎯 Usage

Start a conversation with your bot on Telegram:

1. **Initialize Wallet** - Use `/start` to create or import a Solana wallet
2. **View Portfolio** - Monitor your token balances and Breeze positions
3. **Deposit Funds** - Deposit stablecoins to earn yield (50%, 100%, or custom amounts)
4. **Withdraw Funds** - Withdraw your funds with flexible amount options
5. **Track Performance** - Real-time updates on your yield farming positions

### Available Commands

- `/start` - Initialize the bot and set up your wallet
- Interactive buttons for all operations (no manual commands needed)

## 🏗️ Architecture

The bot leverages the Breeze SDK for simplified DeFi operations:

```typescript
// Initialize Breeze SDK
const breezeSDK = new BreezeSDK({
    baseUrl: 'http://localhost:8080',
    apiKey: BREEZE_API_KEY
});


// Seamless deposits
const depositTx = await breezeSDK.createDepositTransaction({
    fundId: BREEZE_FUND_ID,
    amount: tokenAmount,
    userKey: userPublicKey
});

// Flexible withdrawals
const withdrawTx = await breezeSDK.createWithdrawTransaction({
    fundId: BREEZE_FUND_ID,
    shares: sharesAmount,
    all: isAll,
    userKey: userPublicKey
});
```

## 🔧 Development

### Project Structure

```
breeze-telegram-bot/
├── src/
│   └── bot.ts              # Main bot implementation
├── dist/                   # Compiled JavaScript
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md             # This file
```

### Key Dependencies

```json
{
  "dependencies": {
    "sdk-brreeezze": "^0.0.6",
    "@solana/web3.js": "^1.98.2",
    "@solana/spl-token": "^0.4.13",
    "node-telegram-bot-api": "^0.66.0",
    "bs58": "^6.0.0",
    "dotenv": "^16.5.0"
  }
}
```

### Configuration

The project uses ES modules with TypeScript. Key configuration:

**package.json:**
```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/bot.js",
    "dev": "ts-node --esm src/bot.ts"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

## 🔐 Security Features

- **Secure Wallet Management** - Private keys handled securely in memory
- **Transaction Confirmation** - User approval required for all operations
- **Input Validation** - Comprehensive validation of user inputs
- **Error Handling** - Graceful handling of network and API errors

## 📊 Supported Operations

### Deposit Operations
- **Percentage-based**: 50% or 100% of available balance
- **Custom amounts**: Specify exact amounts with precision validation
- **Multi-asset support**: USDC, USDT, PYUSD, USDS (expandable)

### Withdrawal Operations
- **Flexible withdrawals**: 50%, 100%, or custom amounts
- **Smart share calculation**: Automatic conversion between USD and shares
- **Complete withdrawals**: Optimized handling for 100% withdrawals

### Portfolio Management
- **Real-time tracking**: Live balance updates via Breeze SDK
- **Multi-asset aggregation**: Combined portfolio view across all assets
- **Yield monitoring**: Track earnings and performance over time


### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram bot token | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `BREEZE_API_KEY` | Breeze API authentication | `your_api_key_here` |
| `BREEZE_FUND_ID` | Target fund identifier | `HxAjeopgWUQn6H4xCQipe2gUFcZc66B1G7u7w6Hk1VZq` |

## 📚 Learn More

- [Breeze Documentation]([https://docs.breeze.so/sdk](https://docs.breeze.baby/introduction/welcome))

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Review the [Breeze SDK documentation]([https://docs.breeze.so](https://docs.breeze.baby/breeze-sdk/breeze-sdk))

## 🎉 Acknowledgments

- Built with [Breeze SDK]([https://breeze.so](https://docs.breeze.baby/breeze-sdk/breeze-sdk)) for simplified DeFi integration
- Telegram Bot API for seamless messaging interface
