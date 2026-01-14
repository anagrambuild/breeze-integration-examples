"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TokenSymbol } from "../config/tokens";

export function useBreezeYield(selectedToken: TokenSymbol) {
  const { publicKey, connected } = useWallet();

  const [currentYield, setCurrentYield] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchYield = useCallback(async () => {
    if (!connected || !publicKey) {
      setCurrentYield(0);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/yield?user_pubkey=${publicKey.toBase58()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch yield");
      }

      const data = await response.json();

      if (data.data?.length > 0) {
        const yieldData = data.data.find(
          (item: { token_symbol: string }) =>
            item.token_symbol === selectedToken
        );
        setCurrentYield(yieldData?.apy ?? 0);
      } else {
        setCurrentYield(0);
      }
    } catch (error) {
      console.error("Error fetching yield:", error);
      setCurrentYield(0);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, selectedToken]);

  return {
    currentYield,
    loading,
    fetchYield,
  };
}
