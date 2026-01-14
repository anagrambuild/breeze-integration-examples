"use client";

import { useState, useEffect, useCallback } from "react";

export interface StrategyInfo {
  strategy_id: string;
  strategy_name: string;
  assets: string[];
  apy: number;
  apy_per_asset: Record<string, number>;
}

export function useStrategyInfo() {
  const [strategyInfo, setStrategyInfo] = useState<StrategyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategyInfo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/strategy-info");

      if (!response.ok) {
        throw new Error(`Failed to fetch strategy info: ${response.status}`);
      }

      const data = await response.json();
      console.log("[useStrategyInfo] Fetched strategy info:", data);

      setStrategyInfo(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching strategy info:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategyInfo();
  }, [fetchStrategyInfo]);

  // Helper function to get APY for a specific mint
  const getApyForMint = useCallback(
    (mint: string): number | null => {
      if (!strategyInfo?.apy_per_asset) return null;
      return strategyInfo.apy_per_asset[mint] ?? null;
    },
    [strategyInfo]
  );

  return {
    strategyInfo,
    loading,
    error,
    fetchStrategyInfo,
    getApyForMint,
  };
}
