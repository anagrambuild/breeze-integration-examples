# Environment Setup

## Try this on try.breeze.baby

Create a `.env.local` file with the following environment variables:

```env
BREEZE_API_KEY=your-x-api-key-here
NEXT_PUBLIC_BREEZE_STRATEGY_ID=your-strategy-id-here  
BREEZE_API_BASE_URL=https://api.breeze.baby
NEXT_PUBLIC_RPC_URL=your-solana-rpc-url-here
```

**Required Environment Variables:**
- `BREEZE_API_KEY`: Your Breeze API authentication key
- `NEXT_PUBLIC_BREEZE_STRATEGY_ID`: The strategy ID you want to interact with
- `BREEZE_API_BASE_URL`: The base URL for the Breeze API (use production URL: https://api.breeze.baby)
- `NEXT_PUBLIC_RPC_URL`: Your Solana RPC endpoint URL (optional, defaults to public mainnet RPC)
  - **Recommended RPC providers:**
    - Alchemy: `https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
    - QuickNode: `https://YOUR_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_TOKEN/`
    - Helius: `https://rpc.helius.xyz/?api-key=YOUR_API_KEY`
    - **Note:** Free public RPCs may have rate limits that cause 403 errors




This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
