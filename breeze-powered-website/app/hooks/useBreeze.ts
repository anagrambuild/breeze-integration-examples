"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TokenSymbol } from "../config/tokens";
import { useBreezeBalances } from "./useBreezeBalances";
import { useBreezeYield } from "./useBreezeYield";
import { useBreezeTransactions } from "./useBreezeTransactions";

export function useBreeze() {
  const { connected } = useWallet();

  const [selectedToken, setSelectedToken] = useState<TokenSymbol>("USDC");
  const [operationType, setOperationType] = useState<
    "deposit" | "withdraw" | null
  >(null);
  const [amount, setAmount] = useState("");

  // Compose smaller hooks
  const balances = useBreezeBalances(selectedToken);
  const yields = useBreezeYield(selectedToken);
  const transactions = useBreezeTransactions();

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    balances.fetchBalances();
    yields.fetchYield();
  }, [connected, selectedToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeposit = useCallback(async () => {
    await transactions.deposit({
      selectedToken,
      amount,
      walletBalance: balances.walletBalance,
      breezeBalance: balances.breezeBalance,
      onSuccess: async () => {
        setAmount("");
        setOperationType(null);
        await balances.fetchBalances();
      },
    });
  }, [selectedToken, amount, balances, transactions]);

  const handleWithdraw = useCallback(async () => {
    await transactions.withdraw({
      selectedToken,
      amount,
      walletBalance: balances.walletBalance,
      breezeBalance: balances.breezeBalance,
      onSuccess: async () => {
        setAmount("");
        setOperationType(null);
        await balances.fetchBalances();
      },
    });
  }, [selectedToken, amount, balances, transactions]);

  const handleDepositAll = useCallback(async () => {
    await transactions.deposit({
      selectedToken,
      amount: "0", // Amount is ignored when all=true
      walletBalance: balances.walletBalance,
      breezeBalance: balances.breezeBalance,
      all: true,
      onSuccess: async () => {
        setAmount("");
        setOperationType(null);
        await balances.fetchBalances();
      },
    });
  }, [selectedToken, balances, transactions]);

  const handleWithdrawAll = useCallback(async () => {
    await transactions.withdraw({
      selectedToken,
      amount: "0", // Amount is ignored when all=true
      walletBalance: balances.walletBalance,
      breezeBalance: balances.breezeBalance,
      all: true,
      onSuccess: async () => {
        setAmount("");
        setOperationType(null);
        await balances.fetchBalances();
      },
    });
  }, [selectedToken, balances, transactions]);

  const cancelOperation = useCallback(() => {
    setOperationType(null);
    setAmount("");
    transactions.clearError();
  }, [transactions]);

  return {
    // Connection
    connected,

    // Token selection
    selectedToken,
    setSelectedToken,

    // Operation state
    operationType,
    setOperationType,
    amount,
    setAmount,

    // Balances
    walletBalance: balances.walletBalance,
    breezeBalance: balances.breezeBalance,
    balance: balances.totalBalance,
    balanceLoading: balances.loading,
    strategyName: balances.strategyName,

    // Yield
    currentYield: yields.currentYield,
    yieldLoading: yields.loading,

    // Transactions
    loading: transactions.loading,
    transactionLoading: transactions.confirming,
    error: transactions.error,
    clearError: transactions.clearError,
    handleDeposit,
    handleWithdraw,
    handleDepositAll,
    handleWithdrawAll,
    cancelOperation,

    // Success modal
    showSuccessModal: transactions.showSuccessModal,
    setShowSuccessModal: transactions.setShowSuccessModal,
    successTxSignature: transactions.successTxSignature,
    successOperationType: transactions.successOperationType,
  };
}
