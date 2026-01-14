"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { WalletButton } from "./components/WalletButton";
import BreezeDepositComponent from "./components/Deposit";
import BreezeWithdrawComponent from "./components/Withdraw";
import {
  Copy,
  Check,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";

const ENV_STRATEGY_ID = process.env.NEXT_PUBLIC_BREEZE_STRATEGY_ID || "";

type TabType = "deposit" | "withdraw";

const NoStrategyId = () => {
  return (
    <div className="w-full max-w-md">
      <div className="relative rounded-2xl border border-amber-500/20 bg-card/60 backdrop-blur-sm p-8 overflow-hidden">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
        </div>
        <h3 className="text-center text-lg font-medium text-foreground mb-2">
          Strategy Not Configured
        </h3>
        <p className="text-center text-sm text-muted-foreground mb-4">
          Set your strategy ID to enable deposits and withdrawals.
        </p>
        <div className="bg-secondary/50 rounded-lg p-3">
          <code className="text-xs text-muted-foreground block text-center">
            {" "}
            NEXT_PUBLIC_BREEZE_STRATEGY_ID=your_strategy_id{" "}
          </code>
        </div>
      </div>
    </div>
  );
};

function HomeContent() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("deposit");
  const { connected } = useWallet();
  const searchParams = useSearchParams();

  // Easter egg: allow strategy-id override via URL param
  const STRATEGY_ID = searchParams.get("strategy-id") || ENV_STRATEGY_ID;

  const copyStrategyId = async () => {
    if (STRATEGY_ID) {
      await navigator.clipboard.writeText(STRATEGY_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen breeze-gradient-bg grid-pattern flex flex-col items-center justify-center p-4 relative">
      {/* Strategy ID */}
      {STRATEGY_ID && (
        <button
          onClick={copyStrategyId}
          className="absolute top-4 left-4 flex items-center gap-2 text-xs text-gray-500 hover:text-gray-400 transition-colors font-mono"
        >
          <span className="opacity-60">Strategy ID:</span>
          <span>{STRATEGY_ID.slice(0, 8)}...</span>
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3 opacity-60" />
          )}
        </button>
      )}

      {/* Wallet Button - only show when connected */}
      {connected && (
        <div className="absolute top-4 right-4">
          <WalletButton />
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <Image
          src="/breezefull.svg"
          alt="Breeze"
          width={183}
          height={46}
          className="h-12 w-auto mx-auto"
        />
        <p className="text-muted-foreground max-w-md">
          Earning yield on your assets has never been easier.
        </p>
      </div>

      {!STRATEGY_ID ? (
        <NoStrategyId />
      ) : connected ? (
        <>
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card/50 backdrop-blur-sm border border-[#e357d5]/20 mb-6">
            <button
              onClick={() => setActiveTab("deposit")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                activeTab === "deposit"
                  ? "bg-[#e357d5] text-white shadow-lg shadow-[#e357d5]/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              Deposit
            </button>
            <button
              onClick={() => setActiveTab("withdraw")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                activeTab === "withdraw"
                  ? "bg-[#e357d5] text-white shadow-lg shadow-[#e357d5]/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <ArrowUpFromLine className="w-4 h-4" />
              Withdraw
            </button>
          </div>

          {/* Playground Component */}
          <div className="w-full max-w-md relative">
            {/* Pulsing glow effect */}
            <div className="absolute inset-0 bg-[#e357d5]/10 rounded-2xl blur-xl animate-pulse pointer-events-none" />
            <div className="relative rounded-2xl">
              {activeTab === "deposit" ? (
                <BreezeDepositComponent hideWalletButton />
              ) : (
                <BreezeWithdrawComponent hideWalletButton />
              )}
            </div>
          </div>
        </>
      ) : (
        /* Connect Wallet Card */
        <div className="w-full max-w-md">
          <div className="relative rounded-2xl border border-[#e357d5]/20 bg-card/60 backdrop-blur-sm p-8 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-[#e357d5]" />
                  Deposit
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span className="flex items-center gap-1">
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-[#e357d5]" />
                  Withdraw
                </span>
              </div>
              <WalletButton />
            </div>

            {/* Icon with pulsing glow */}
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center">
                {/* Pulsing glow effect */}
                <div className="absolute w-24 h-24 bg-[#e357d5]/30 rounded-full blur-xl animate-pulse" />
                <div className="absolute w-16 h-16 bg-[#e357d5]/20 rounded-full blur-lg animate-pulse [animation-delay:150ms]" />
                {/* Wallet icon */}
                <Wallet className="relative w-10 h-10 text-[#e357d5]" />
              </div>
            </div>

            {/* Text */}
            <p className="text-center text-muted-foreground">
              Connect your wallet to start earning yield
            </p>
          </div>
        </div>
      )}

      {/* Footer hint - only show when connected and strategy is configured */}
      {connected && STRATEGY_ID && (
        <p className="mt-8 text-xs text-muted-foreground/60 text-center">
          These customizable deposit and withdraw components
          <br />
          are available in our{" "}
          <a
            href="https://ui.breeze.baby"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#e357d5] hover:underline cursor-pointer"
          >
            UI Playground
          </a>
        </p>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
