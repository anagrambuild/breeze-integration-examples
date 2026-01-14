// USDC has 6 decimal places (kept for backward compatibility)
export const USDC_DECIMALS = 6;

// Convert user-facing amount to API amount (multiply by 10^decimals)
export const toApiAmount = (userAmount: number, decimals: number = USDC_DECIMALS): number => {
  return Math.floor(userAmount * Math.pow(10, decimals));
};

// Convert API amount to user-facing amount (divide by 10^decimals)
export const fromApiAmount = (apiAmount: number, decimals: number = USDC_DECIMALS): number => {
  return apiAmount / Math.pow(10, decimals);
};

// Format user amount for display
export const formatBalance = (amount: number): string => {
  return amount.toFixed(2);
};