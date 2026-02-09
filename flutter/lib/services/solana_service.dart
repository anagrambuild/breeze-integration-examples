import 'dart:async';

import 'package:solana/dto.dart';
import 'package:solana/encoder.dart';
import 'package:solana/solana.dart';

import '../config.dart';
import '../core/token_registry.dart';
import '../models/tx_result.dart';
import 'wallet_service.dart';

class TokenBalance {
  final String mint;
  final String symbol;
  final double amount;
  final int decimals;

  const TokenBalance({
    required this.mint,
    required this.symbol,
    required this.amount,
    required this.decimals,
  });
}

class SolanaService {
  static const Duration _confirmationTimeout = Duration(seconds: 75);
  static const Duration _confirmationPollInterval = Duration(seconds: 1);

  final WalletService _walletService;
  final Duration _timeout;
  late final RpcClient _rpcClient;

  SolanaService({
    required WalletService walletService,
    required AppConfig config,
    Duration timeout = const Duration(seconds: 20),
  }) : _walletService = walletService,
       _timeout = timeout {
    _rpcClient = RpcClient(config.solanaRpcUri.toString());
  }

  Future<double> getSolBalance() async {
    final pubkey = _walletService.publicKeyBase58;
    if (pubkey == null) {
      return 0;
    }

    final result = await _rpcClient
        .getBalance(pubkey, commitment: Commitment.confirmed)
        .timeout(_timeout);

    return result.value / 1e9;
  }

  /// Fetches all SPL token accounts for the current wallet.
  Future<List<TokenBalance>> getTokenBalances() async {
    final pubkey = _walletService.publicKeyBase58;
    if (pubkey == null) {
      return [];
    }

    final result = await _rpcClient
        .getTokenAccountsByOwner(
          pubkey,
          const TokenAccountsFilter.byProgramId(TokenProgram.programId),
          encoding: Encoding.jsonParsed,
          commitment: Commitment.confirmed,
        )
        .timeout(_timeout);

    final balances = <TokenBalance>[];
    for (final account in result.value) {
      final data = account.account.data;
      if (data is ParsedSplTokenProgramAccountData) {
        final parsed = data.parsed;
        if (parsed is TokenAccountData) {
          final info = parsed.info;
          final rawAmount =
              BigInt.tryParse(info.tokenAmount.amount) ?? BigInt.zero;
          if (rawAmount == BigInt.zero) continue;

          final decimals = info.tokenAmount.decimals;
          final amount = rawAmount / BigInt.from(10).pow(decimals);
          final meta = TokenRegistry.byMint(info.mint);

          balances.add(
            TokenBalance(
              mint: info.mint,
              symbol: meta?.symbol ?? _shortenMint(info.mint),
              amount: amount.toDouble(),
              decimals: decimals,
            ),
          );
        }
      }
    }

    return balances;
  }

  static String _shortenMint(String mint) {
    if (mint.length <= 8) return mint;
    return '${mint.substring(0, 4)}..${mint.substring(mint.length - 4)}';
  }

  Future<TxResult> signAndSend(String base64Tx) async {
    String? txId;
    try {
      final unsignedTx = SignedTx.decode(base64Tx);
      final messageBytes = unsignedTx.compiledMessage.toByteArray().toList();
      final signature = await _walletService.sign(messageBytes);

      final signedTx = SignedTx(
        signatures: [signature, ...unsignedTx.signatures.skip(1)],
        compiledMessage: unsignedTx.compiledMessage,
      );

      final encoded = signedTx.encode();
      txId = await _rpcClient
          .sendTransaction(encoded, preflightCommitment: Commitment.confirmed)
          .timeout(_timeout);

      await _waitForConfirmation(txId);
      return TxResult.ok(txId);
    } on TimeoutException {
      if (txId != null) {
        return TxResult.fail(
          'Transaction submitted but confirmation is still pending. '
          'You can check status on explorer with signature: $txId',
        );
      }
      return TxResult.fail('Transaction request timed out.');
    } catch (error) {
      return TxResult.fail(error.toString());
    }
  }

  Future<void> _waitForConfirmation(String txId) async {
    final deadline = DateTime.now().add(_confirmationTimeout);

    while (DateTime.now().isBefore(deadline)) {
      final statuses = await _rpcClient
          .getSignatureStatuses([txId], searchTransactionHistory: true)
          .timeout(_timeout);
      final status = statuses.value.firstOrNull;

      if (status != null) {
        if (status.err != null) {
          throw StateError('Transaction failed on-chain: ${status.err}');
        }

        if (status.confirmationStatus == Commitment.confirmed ||
            status.confirmationStatus == Commitment.finalized) {
          return;
        }
      }

      await Future<void>.delayed(_confirmationPollInterval);
    }

    throw TimeoutException('Transaction confirmation timed out.');
  }
}
