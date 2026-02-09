import '../models/breeze_balance.dart';
import '../models/strategy_info.dart';
import '../models/tx_result.dart';
import '../services/breeze_api_service.dart';
import '../services/solana_service.dart';
import '../services/wallet_service.dart';

class BreezeRepository {
  final BreezeApiService _breezeApiService;
  final SolanaService _solanaService;
  final WalletService _walletService;

  const BreezeRepository({
    required BreezeApiService breezeApiService,
    required SolanaService solanaService,
    required WalletService walletService,
  }) : _breezeApiService = breezeApiService,
       _solanaService = solanaService,
       _walletService = walletService;

  Future<StrategyInfo> getStrategyInfo() {
    return _breezeApiService.getStrategyInfo();
  }

  Future<BreezeBalance> getBalancesForCurrentWallet() {
    return _breezeApiService.getBalances(_requireWalletPubkey());
  }

  Future<TxResult> submitDeposit({
    required String baseAssetMint,
    required BigInt rawAmount,
  }) async {
    final unsignedTx = await _breezeApiService.getDepositTx(
      userKey: _requireWalletPubkey(),
      baseAsset: baseAssetMint,
      amount: rawAmount,
    );

    return _solanaService.signAndSend(unsignedTx);
  }

  Future<TxResult> submitWithdraw({
    required String baseAssetMint,
    BigInt? rawAmount,
    bool withdrawAll = false,
  }) async {
    final unsignedTx = await _breezeApiService.getWithdrawTx(
      userKey: _requireWalletPubkey(),
      baseAsset: baseAssetMint,
      amount: rawAmount,
      all: withdrawAll,
    );

    return _solanaService.signAndSend(unsignedTx);
  }

  String _requireWalletPubkey() {
    final pubkey = _walletService.publicKeyBase58;
    if (pubkey == null || pubkey.isEmpty) {
      throw StateError('A wallet is required for this action.');
    }
    return pubkey;
  }
}
