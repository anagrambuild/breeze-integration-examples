export interface AssetConfig {
  symbol: string;
  mint: string;
  decimals: number;
}

// Recomended to fetch this information from the https://api.breeze.baby/strategy-info/{strategy_id} endpoint once and use then as hardcoded values
export const AVAILABLE_ASSETS: AssetConfig[] = [
  {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  {
    symbol: "USDT",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
  {
    symbol: "USDS",
    mint: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
    decimals: 6,
  },
  {
    symbol: "JupSOL",
    mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
    decimals: 9,
  },
  {
    symbol: "JLP",
    mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
    decimals: 6,
  },
  {
    symbol: "mSOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
  },
  {
    symbol: "JitoSOL",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    decimals: 9,
  },
  {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
];

// Token configuration as object (for lookups by symbol)
export const SUPPORTED_TOKENS: Record<string, AssetConfig> = Object.fromEntries(
  AVAILABLE_ASSETS.map((asset) => [asset.symbol, asset])
);

// Token symbol type
export type TokenSymbol =
  | "USDC"
  | "USDT"
  | "USDS"
  | "JupSOL"
  | "JLP"
  | "mSOL"
  | "JitoSOL"
  | "SOL";
