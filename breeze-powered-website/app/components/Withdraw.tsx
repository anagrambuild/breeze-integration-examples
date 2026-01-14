"use client";

import { WithdrawContainer } from "./playground/withdraw";
import { WithdrawAmountLabel } from "./playground/withdraw";
import { WithdrawAmountInput } from "./playground/withdraw";
import { WithdrawTokenLabel } from "./playground/withdraw";
import { WithdrawApyMessage } from "./playground/withdraw";
import { WithdrawSubmitButton } from "./playground/withdraw";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  AssetConfig,
  AVAILABLE_ASSETS,
  SUPPORTED_TOKENS,
  TokenSymbol,
} from "@/app/config/tokens";
import { useBreeze } from "@/app/hooks/useBreeze";
import { useStrategyInfo } from "@/app/hooks/useStrategyInfo";

interface BreezeWithdrawProps {
  hideWalletButton?: boolean;
}

export default function BreezeWithdrawComponent({
  hideWalletButton,
}: BreezeWithdrawProps = {}) {
  const {
    connected,
    selectedToken,
    setSelectedToken,
    amount,
    setAmount,
    breezeBalance,
    loading,
    transactionLoading,
    handleWithdraw,
    handleWithdrawAll,
  } = useBreeze();

  // Get the AssetConfig for the selected token
  const selectedAsset = SUPPORTED_TOKENS[selectedToken] as AssetConfig;

  // Get strategy info for APY
  const { getApyForMint } = useStrategyInfo();
  const currentApy = getApyForMint(selectedAsset.mint);

  // Handle asset change from the dropdown (converts AssetConfig to TokenSymbol)
  const handleAssetChange = (asset: AssetConfig) => {
    setSelectedToken(asset.symbol as TokenSymbol);
  };

  const isProcessing = loading || transactionLoading;
  const buttonText = isProcessing ? "Processing..." : "Withdraw";

  return (
    <WithdrawContainer>
      <WithdrawAmountLabel />
      <WithdrawAmountInput value={amount} onChange={setAmount} />
      <div className="min-h-[52px]">
        <WithdrawTokenLabel
          availableAssets={AVAILABLE_ASSETS}
          selectedAsset={selectedAsset}
          onAssetChange={handleAssetChange}
        />
        {connected && breezeBalance !== null && (
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            Available:{" "}
            {breezeBalance.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}{" "}
            {selectedAsset.symbol}
            {" · "}
            <button
              onClick={handleWithdrawAll}
              disabled={isProcessing || !connected || breezeBalance === 0}
              className="text-[#e357d5] hover:text-[#e357d5]/80 underline underline-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Max
            </button>
          </p>
        )}
      </div>
      <WithdrawApyMessage apy={currentApy} />
      {connected || hideWalletButton ? (
        <WithdrawSubmitButton
          onClick={handleWithdraw}
          disabled={isProcessing || !connected}
          loading={isProcessing}
        >
          {buttonText}
        </WithdrawSubmitButton>
      ) : (
        <div className="flex justify-center mt-6">
          <WalletMultiButton />
        </div>
      )}
    </WithdrawContainer>
  );
}
