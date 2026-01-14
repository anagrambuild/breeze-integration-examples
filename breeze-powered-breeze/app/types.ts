// Transaction response types
export interface DepositTxResponse {
  deposit_transaction: string;
}

export interface WithdrawTxResponse {
  withdraw_transaction: string;
}

// Unified Breeze Balance API response types
export interface BreezeBalanceItem {
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
  strategy_name: string;
  strategy_id: string;
}

export interface BreezeBalanceResponse {
  data: BreezeBalanceItem[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

// Legacy types for backwards compatibility
export interface YieldBalance {
  amount_of_yield?: number;
  funds?: number;
  [key: string]: unknown;
}

export interface LegacyBalanceItem {
  total_balance: number;
  yield_balance?: YieldBalance;
  token_symbol?: string;
  [key: string]: unknown;
}

