import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Plus, ChevronDown, Loader2 } from "lucide-react";
import React, { useState } from "react";

interface AssetConfig {
  symbol: string;
  mint: string;
  decimals: number;
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function DepositContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-(--breeze-modal-background) shadow-lg px-6 py-5 sm:max-w-[425px]",
        "rounded-(--breeze-border-radius)",
        "border border-white/10",
        className
      )}
      {...props}
    />
  );
}

export function DepositHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      <span className="font-medium text-2xl text-(--breeze-text-color)">
        {children}
        <br />
        <span className="text-sm font-normal text-(--breeze-secondary-text-color)">
          powered by{" "}
          <span className="text-(--breeze-pink-text) font-medium underline">
            breeze.
          </span>
        </span>
      </span>
    </div>
  );
}

export function DepositAmountLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-center mb-2", className)} {...props}>
      <span className="text-sm font-medium text-(--breeze-tertiary-text-color) bg-(--breeze-secondary-background) rounded-full px-3 inline-block">
        Amount
      </span>
    </div>
  );
}

export function DepositAmountInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0.00"
      type="number"
      className={cn(
        "w-full text-6xl font-medium text-center px-0 h-auto leading-tight bg-transparent",
        "border-none outline-none focus:outline-none focus:ring-0",
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        "text-(--breeze-input-color) min-h-[1.2em]",
        className
      )}
    />
  );
}

export function DepositTokenLabel({
  className,
  availableAssets,
  selectedAsset,
  onAssetChange,
  ...props
}: React.ComponentProps<"div"> & {
  availableAssets: AssetConfig[];
  selectedAsset: AssetConfig;
  onAssetChange: (asset: AssetConfig) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAssetChange = (asset: AssetConfig) => {
    onAssetChange(asset);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative text-center", className)} {...props}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-0.5 text-xl font-medium text-(--breeze-tertiary-text-color) transition-colors cursor-pointer"
      >
        {selectedAsset.symbol}
        <ChevronDown
          size={20}
          className={cn("transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 mt-2 bg-(--breeze-modal-background) rounded-(--breeze-border-radius) 
          shadow-lg border border-(--breeze-secondary-background) 
          overflow-hidden z-20 min-w-[120px]"
          >
            {availableAssets.map((asset) => (
              <button
                key={asset.mint}
                type="button"
                onClick={() => handleAssetChange(asset)}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition-colors",
                  "hover:bg-(--breeze-secondary-background)"
                )}
              >
                {asset.symbol}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DepositApyMessage({
  className,
  apy,
  ...props
}: React.ComponentProps<"div"> & {
  apy?: number | null;
}) {
  return (
    <div
      className={cn(
        "text-center mt-6 text-sm font-normal text-(--breeze-secondary-text-color)",
        className
      )}
      {...props}
    >
      <span>
        Earn yield{" "}
        <span className="text-(--breeze-pink-text) font-medium">
          {apy !== null && apy !== undefined
            ? `${apy.toFixed(2)}%`
            : "..."}
        </span>{" "}
        APY on your deposit.
      </span>
    </div>
  );
}

export function DepositSubmitButton({
  className,
  children,
  disabled,
  loading,
  ...props
}: React.ComponentProps<"button"> & {
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "w-full mt-6 h-10 flex items-center justify-center font-medium transition-colors",
        "bg-(--breeze-button-background) text-(--breeze-button-color) rounded-(--breeze-button-border-radius)",
        "hover:bg-(--breeze-button-hover-background)",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={16} />
      ) : (
        <>
          {children} <Plus className="ml-1.5" size={16} />
        </>
      )}
    </button>
  );
}
