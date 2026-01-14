"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { SUPPORTED_TOKENS, TokenSymbol } from "../config/tokens";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
const connection = new Connection(rpcUrl, "confirmed");

const getExplorerUrl = (signature: string) =>
  `https://solscan.io/tx/${signature}`;

const TransactionToast = ({
  message,
  signature,
}: {
  message: string;
  signature: string;
}) => (
  <div className="flex items-center justify-between gap-4 w-full">
    <span>{message}</span>
    <a
      href={getExplorerUrl(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[#e357d5] hover:text-[#e357d5]/80 underline underline-offset-2 transition-colors whitespace-nowrap"
    >
      View transaction
      <ExternalLink className="w-3 h-3" />
    </a>
  </div>
);

interface TransactionOptions {
  selectedToken: TokenSymbol;
  amount: string;
  walletBalance: number;
  breezeBalance: number;
  onSuccess: () => Promise<void>;
  all?: boolean; // Optional flag to deposit/withdraw all
}

export function useBreezeTransactions() {
  const { publicKey, signTransaction, connected } = useWallet();
  const searchParams = useSearchParams();

  // Easter egg: allow strategy-id override via URL param
  const strategyIdOverride = searchParams.get("strategy-id");

  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTxSignature, setSuccessTxSignature] = useState("");
  const [successOperationType, setSuccessOperationType] = useState<
    "deposit" | "withdraw"
  >("deposit");

  const clearError = useCallback(() => setError(null), []);

  const validateAmount = useCallback(
    (
      amount: string | number,
      maxBalance: number,
      selectedToken: TokenSymbol,
      isWithdraw: boolean
    ): boolean => {
      if (!connected || !publicKey) {
        toast.error("Please connect your wallet first");
        return false;
      }

      const amountStr = String(amount);
      const amountNum = parseFloat(amountStr);

      if (!amountStr || amountNum <= 0) {
        toast.error("Please enter a valid amount");
        return false;
      }

      if (amountStr.includes(".") && amountStr.split(".")[1].length > 6) {
        toast.error("Amount cannot have more than 6 decimal places");
        return false;
      }

      if (amountNum > maxBalance) {
        const message = isWithdraw
          ? "Insufficient balance in Breeze"
          : `Insufficient ${selectedToken} in wallet`;
        toast.error(message);
        return false;
      }

      return true;
    },
    [connected, publicKey]
  );

  const executeTransaction = useCallback(
    async (
      endpoint: string,
      operationType: "deposit" | "withdraw",
      onSuccess: () => Promise<void>
    ) => {
      setLoading(true);
      setError(null);
      setConfirming(false);

      const toastId = toast.loading(
        operationType === "deposit"
          ? "Processing deposit..."
          : "Processing withdrawal..."
      );

      console.log(`[${operationType}] Endpoint:`, endpoint);

      let txSignature: string | null = null;

      try {
        const response = await fetch(endpoint, { method: "POST" });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[${operationType}] API error response:`, errorText);
          throw new Error(`Failed to fetch ${operationType} transaction`);
        }

        const data = await response.json();
        console.log(`[${operationType}] API response:`, data);
        const txString = typeof data.data === "string" ? data.data : data;

        if (typeof txString !== "string") {
          throw new Error("Invalid response format");
        }

        const txBytes = Buffer.from(txString, "base64");
        const versionedTx = VersionedTransaction.deserialize(txBytes);

        if (!signTransaction) {
          throw new Error("Wallet does not support transaction signing");
        }

        const signedTx = await signTransaction(versionedTx);
        console.log(`[${operationType}] Sending transaction...`);
        txSignature = await connection.sendTransaction(signedTx, {
          skipPreflight: true,
          preflightCommitment: "confirmed",
        });
        console.log(`[${operationType}] Transaction signature:`, txSignature);

        setLoading(false);
        setConfirming(true);

        toast.loading("Confirming transaction...", { id: toastId });

        const confirmation = await connection.confirmTransaction(
          txSignature,
          "confirmed"
        );
        console.log(`[${operationType}] Confirmation result:`, confirmation);

        if (confirmation.value.err) {
          console.error(
            `[${operationType}] Transaction error:`,
            confirmation.value.err
          );
          toast.error(
            <TransactionToast
              message="Transaction failed"
              signature={txSignature!}
            />,
            { id: toastId }
          );
          throw new Error("Transaction failed to confirm");
        }

        toast.success(
          <TransactionToast
            message={
              operationType === "deposit"
                ? "Deposit successful!"
                : "Withdrawal successful!"
            }
            signature={txSignature!}
          />,
          { id: toastId }
        );

        setSuccessTxSignature(txSignature);
        setSuccessOperationType(operationType);
        setShowSuccessModal(true);
        await onSuccess();
      } catch (err) {
        console.error(`${operationType} error:`, err);
        const errorMessage =
          err instanceof Error ? err.message : `${operationType} failed`;
        setError(errorMessage);

        // Include "View transaction" link if we have a signature
        if (txSignature) {
          toast.error(
            <TransactionToast
              message="Transaction failed"
              signature={txSignature}
            />,
            { id: toastId }
          );
        } else {
          toast.error("Transaction failed", { id: toastId });
        }
      } finally {
        setLoading(false);
        setConfirming(false);
      }
    },
    [signTransaction]
  );

  const deposit = useCallback(
    async (options: TransactionOptions) => {
      const {
        selectedToken,
        amount,
        walletBalance,
        onSuccess,
        all = false,
      } = options;

      // Skip validation if depositing all
      if (!all) {
        const isValid = validateAmount(
          amount,
          walletBalance,
          selectedToken,
          false
        );
        if (!isValid) {
          return;
        }
      }

      const mint = SUPPORTED_TOKENS[selectedToken].mint;
      const strategyId =
        strategyIdOverride || process.env.NEXT_PUBLIC_BREEZE_STRATEGY_ID;
      const endpoint = `/api/deposittx?user_pubkey=${publicKey!.toBase58()}&amount=${amount}&base_asset=${mint}&all=${all}&strategy_id=${strategyId}`;

      await executeTransaction(endpoint, "deposit", onSuccess);
    },
    [publicKey, validateAmount, executeTransaction, strategyIdOverride]
  );

  const withdraw = useCallback(
    async (options: TransactionOptions) => {
      const {
        selectedToken,
        amount,
        breezeBalance,
        onSuccess,
        all = false,
      } = options;

      console.log("[withdraw] Input values:", {
        amount,
        amountType: typeof amount,
        breezeBalance,
        selectedToken,
        all,
      });

      // Skip validation if withdrawing all
      if (!all) {
        const isValid = validateAmount(
          amount,
          breezeBalance,
          selectedToken,
          true
        );
        if (!isValid) {
          return;
        }
      }

      const mint = SUPPORTED_TOKENS[selectedToken].mint;
      const strategyId =
        strategyIdOverride || process.env.NEXT_PUBLIC_BREEZE_STRATEGY_ID;
      const endpoint = `/api/withdrawtx?user_pubkey=${publicKey!.toBase58()}&amount=${amount}&base_asset=${mint}&all=${all}&strategy_id=${strategyId}`;

      await executeTransaction(endpoint, "withdraw", onSuccess);
    },
    [publicKey, validateAmount, executeTransaction, strategyIdOverride]
  );

  return {
    loading,
    confirming,
    error,
    clearError,
    deposit,
    withdraw,
    // Success modal
    showSuccessModal,
    setShowSuccessModal,
    successTxSignature,
    successOperationType,
  };
}
