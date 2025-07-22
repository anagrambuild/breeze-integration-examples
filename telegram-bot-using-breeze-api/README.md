# Telegram Bot with Breeze API

A TypeScript-based Telegram bot that illustartes Breeze integration.

## 🚀 Features

- **Breeze API** Integration
- **Command handling** for bot interactions
- **TypeScript** for type safety and better development experience
- **Error handling** and logging

## 📋 Prerequisites

- Node.js 16+
- npm or yarn
- [Breeze API key](https://docs.breeze.baby/get-your-api-key/instruction)
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

## 🛠️ Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
    BOT_TOKEN=your_telegram_bot_token_here
    
    # Solana RPC URL
    SOLANA_RPC_URL=solana_rpc_url
    
    # Breeze API Configuration
    BREEZE_API_KEY=your_breeze_api_key_here
    BREEZE_FUND_ID=your_breeze_fund_id
   ```
  
3. **Run the bot**
   ```bash
   npm run build
   npm start
   ```

## 🎯 Usage

Start a conversation with your bot on Telegram:
- Use `/start` to begin

## 📚 Learn More

- [Breeze API Documentation](https://docs.breeze.baby/breeze-api/breeze-api)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Full Integration Guide](https://docs.breeze.baby/Integration-Guide/Integration-Guide)
