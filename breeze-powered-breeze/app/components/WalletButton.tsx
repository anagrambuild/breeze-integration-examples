"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName, WalletReadyState } from "@solana/wallet-adapter-base";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wallet, LogOut, Copy, Check, ChevronDown } from "lucide-react";

export function WalletButton() {
  const { wallets, select, disconnect, connected, publicKey } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const installedWallets = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed
  );
  const otherWallets = wallets.filter(
    (w) => w.readyState !== WalletReadyState.Installed
  );

  const handleWalletSelect = useCallback(
    async (walletName: WalletName) => {
      try {
        select(walletName);
        setIsModalOpen(false);
      } catch (error) {
        console.error("Failed to select wallet:", error);
      }
    },
    [select]
  );

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }, [disconnect]);

  const copyAddress = useCallback(async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [publicKey]);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Connected state
  if (connected && publicKey) {
    return (
      <div className="relative">
        <Button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          variant="outline"
          className="border-[#e357d5]/50 bg-[#e357d5]/10 hover:bg-[#e357d5]/20 text-foreground font-medium gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-500" />
          {truncateAddress(publicKey.toBase58())}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>

        {isDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-xl border border-[#e357d5]/30 bg-card shadow-lg shadow-[#e357d5]/10 overflow-hidden">
              <div className="p-3 border-b border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Connected</p>
                <p className="font-mono text-sm">
                  {truncateAddress(publicKey.toBase58())}
                </p>
              </div>
              <div className="p-1">
                <button
                  onClick={copyAddress}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                  {copied ? "Copied!" : "Copy Address"}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className="bg-[#e357d5] hover:bg-[#c235b5] text-white font-semibold gap-2 breeze-glow-subtle"
      >
        <Wallet className="w-4 h-4" />
        Connect
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-[#e357d5]/30 max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl text-center">
              Connect Wallet
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-4 space-y-2">
            {installedWallets.length > 0 && (
              <div className="space-y-2">
                {installedWallets.map((w) => (
                  <button
                    key={w.adapter.name}
                    onClick={() => handleWalletSelect(w.adapter.name)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-secondary/30 hover:bg-[#e357d5]/20 hover:border-[#e357d5]/50 transition-all group"
                  >
                    {w.adapter.icon && (
                      <img
                        src={w.adapter.icon}
                        alt={w.adapter.name}
                        className="w-10 h-10 rounded-lg"
                      />
                    )}
                    <span className="font-semibold text-foreground">
                      {w.adapter.name}
                    </span>
                    <span className="ml-auto text-xs text-[#e357d5] bg-[#e357d5]/10 px-2 py-1 rounded-full">
                      Detected
                    </span>
                  </button>
                ))}
              </div>
            )}

            {otherWallets.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2 px-1">
                  More wallets
                </p>
                <div className="space-y-1">
                  {otherWallets.slice(0, 3).map((w) => (
                    <button
                      key={w.adapter.name}
                      onClick={() => handleWalletSelect(w.adapter.name)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      {w.adapter.icon && (
                        <img
                          src={w.adapter.icon}
                          alt={w.adapter.name}
                          className="w-8 h-8 rounded-lg opacity-70"
                        />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {w.adapter.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {installedWallets.length === 0 && (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#e357d5]/10 flex items-center justify-center mb-3">
                  <Wallet className="w-6 h-6 text-[#e357d5]" />
                </div>
                <p className="text-muted-foreground text-sm">
                  No wallets detected. Install a Solana wallet to continue.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
