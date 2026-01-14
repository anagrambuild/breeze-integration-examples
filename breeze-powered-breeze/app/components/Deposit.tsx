"use client";

import { DepositContainer } from "./playground/deposit";
import { DepositAmountLabel } from "./playground/deposit";
import { DepositAmountInput } from "./playground/deposit";
import { DepositTokenLabel } from "./playground/deposit";
import { DepositApyMessage } from "./playground/deposit";
import { DepositSubmitButton } from "./playground/deposit";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  AssetConfig,
  AVAILABLE_ASSETS,
  SUPPORTED_TOKENS,
  TokenSymbol,
} from "@/app/config/tokens";
import { useBreeze } from "@/app/hooks/useBreeze";
import { useStrategyInfo } from "@/app/hooks/useStrategyInfo";

interface BreezeDepositProps {
  hideWalletButton?: boolean;
}

export default function BreezeDepositComponent({
  hideWalletButton,
}: BreezeDepositProps = {}) {
  const {
    connected,
    selectedToken,
    setSelectedToken,
    amount,
    setAmount,
    walletBalance,
    loading,
    transactionLoading,
    handleDeposit,
    handleDepositAll,
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
  const buttonText = isProcessing ? "Processing..." : "Deposit";

  return (
    <DepositContainer>
      <DepositAmountLabel />
      <DepositAmountInput value={amount} onChange={setAmount} />
      <div className="min-h-[52px]">
        <DepositTokenLabel
          availableAssets={AVAILABLE_ASSETS}
          selectedAsset={selectedAsset}
          onAssetChange={handleAssetChange}
        />
        {connected && walletBalance !== null && (
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            Available:{" "}
            {walletBalance.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}{" "}
            {selectedAsset.symbol}
            {" · "}
            <button
              onClick={handleDepositAll}
              disabled={isProcessing || !connected || walletBalance === 0}
              className="text-[#e357d5] hover:text-[#e357d5]/80 underline underline-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Max
            </button>
          </p>
        )}
      </div>
      <DepositApyMessage apy={currentApy} />
      {connected || hideWalletButton ? (
        <DepositSubmitButton
          onClick={handleDeposit}
          disabled={isProcessing || !connected}
          loading={isProcessing}
        >
          {buttonText}
        </DepositSubmitButton>
      ) : (
        <div className="flex justify-center mt-6">
          <WalletMultiButton />
        </div>
      )}
    </DepositContainer>
  );
}
