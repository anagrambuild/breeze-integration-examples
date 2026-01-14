"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import { SUPPORTED_TOKENS, TokenSymbol } from "../config/tokens";

const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
const connection = new Connection(rpcUrl, "confirmed");

export function useBreezeBalances(selectedToken: TokenSymbol) {
  const { publicKey, connected } = useWallet();

  const [walletBalance, setWalletBalance] = useState(0);
  const [breezeBalance, setBreezeBalance] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [strategyName, setStrategyName] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchWalletBalance = useCallback(async (): Promise<number> => {
    if (!connected || !publicKey) {
      setWalletBalance(0);
      return 0;
    }

    try {
      const tokenConfig = SUPPORTED_TOKENS[selectedToken];
      const tokenDecimals = tokenConfig.decimals;

      // SOL is native, not an SPL token - use getBalance instead
      if (selectedToken === "SOL") {
        const lamports = await connection.getBalance(publicKey);
        const balance = lamports / Math.pow(10, tokenDecimals);
        setWalletBalance(balance);
        return balance;
      }

      // For SPL tokens, use the associated token account
      const tokenMint = new PublicKey(tokenConfig.mint);
      const ata = await getAssociatedTokenAddress(tokenMint, publicKey);
      const accountInfo = await getAccount(connection, ata);
      const balance = Number(accountInfo.amount) / Math.pow(10, tokenDecimals);

      setWalletBalance(balance);
      return balance;
    } catch (error) {
      if (!(error instanceof TokenAccountNotFoundError)) {
        console.error("Error fetching wallet balance:", error);
      }
      setWalletBalance(0);
      return 0;
    }
  }, [connected, publicKey, selectedToken]);

  const fetchBreezeBalance = useCallback(async (): Promise<{
    balance: number;
    strategy: string;
  }> => {
    if (!connected || !publicKey) {
      return { balance: 0, strategy: "" };
    }

    try {
      const response = await fetch(
        `/api/balance?user_pubkey=${publicKey.toBase58()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch balance");
      }

      const data = await response.json();
      console.log("[useBreezeBalances] API response data:", data);

      if (data.data?.length > 0) {
        const tokenBalance = data.data.find(
          (item: { token_symbol: string }) =>
            item.token_symbol === selectedToken
        );

        console.log(
          "[useBreezeBalances] Token balance for",
          selectedToken,
          ":",
          tokenBalance
        );

        if (tokenBalance) {
          return {
            balance: tokenBalance.total_position_value || 0,
            strategy: tokenBalance.strategy_name || "Unknown Strategy",
          };
        }

        // Return strategy name from any token if available
        return {
          balance: 0,
          strategy: data.data[0]?.strategy_name || "",
        };
      }

      return { balance: 0, strategy: "" };
    } catch (error) {
      console.error("Error fetching Breeze balance:", error);
      return { balance: 0, strategy: "" };
    }
  }, [connected, publicKey, selectedToken]);

  const fetchBalances = useCallback(async () => {
    if (!connected || !publicKey) {
      setWalletBalance(0);
      setBreezeBalance(0);
      setTotalBalance(0);
      setStrategyName("");
      return;
    }

    console.log(
      "[useBreezeBalances] Fetching balances for token:",
      selectedToken
    );
    setLoading(true);
    try {
      const [walletBal, breezeData] = await Promise.all([
        fetchWalletBalance(),
        fetchBreezeBalance(),
      ]);

      console.log("[useBreezeBalances] Fetched balances:", {
        walletBalance: walletBal,
        breezeBalance: breezeData.balance,
        total: walletBal + breezeData.balance,
        strategy: breezeData.strategy,
      });

      setBreezeBalance(breezeData.balance);
      setTotalBalance(walletBal + breezeData.balance);
      setStrategyName(breezeData.strategy);
    } finally {
      setLoading(false);
    }
  }, [
    connected,
    publicKey,
    selectedToken,
    fetchWalletBalance,
    fetchBreezeBalance,
  ]);

  return {
    walletBalance,
    breezeBalance,
    totalBalance,
    strategyName,
    loading,
    fetchBalances,
  };
}
