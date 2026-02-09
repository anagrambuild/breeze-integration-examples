import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/token_amount.dart';
import '../models/breeze_balance.dart';
import '../models/strategy_info.dart';
import '../repositories/breeze_repository.dart';
import '../services/breeze_api_service.dart';
import '../services/solana_service.dart';
import '../theme/app_theme.dart';
import '../widgets/asset_selector.dart';
import '../widgets/loading_overlay.dart';
import '../widgets/refined_panel.dart';
import '../widgets/tx_status_dialog.dart';

class WithdrawScreen extends StatefulWidget {
  final StrategyInfo strategy;
  final BreezeRepository breezeRepository;
  final SolanaService solanaService;
  final BreezePosition? preselectedPosition;

  const WithdrawScreen({
    super.key,
    required this.strategy,
    required this.breezeRepository,
    required this.solanaService,
    this.preselectedPosition,
  });

  @override
  State<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends State<WithdrawScreen> {
  final _amountController = TextEditingController();
  StrategyAsset? _selectedAsset;
  bool _withdrawAll = false;
  bool _submitting = false;

  double? _walletBalance;
  bool _loadingBalance = false;

  @override
  void initState() {
    super.initState();
    if (widget.preselectedPosition != null) {
      _selectedAsset = widget.strategy.supportedAssets
          .cast<StrategyAsset?>()
          .firstWhere(
            (a) => a!.mint == widget.preselectedPosition!.mint,
            orElse: () => widget.strategy.supportedAssets.firstOrNull,
          );
    } else if (widget.strategy.supportedAssets.isNotEmpty) {
      _selectedAsset = widget.strategy.supportedAssets.first;
    }
    _fetchBalance();
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _fetchBalance() async {
    final asset = _selectedAsset;
    if (asset == null) return;

    setState(() => _loadingBalance = true);
    try {
      const solMint = 'So11111111111111111111111111111111111111112';
      if (asset.mint == solMint) {
        final sol = await widget.solanaService.getSolBalance();
        if (!mounted || _selectedAsset?.mint != asset.mint) return;
        setState(() => _walletBalance = sol);
      } else {
        final tokens = await widget.solanaService.getTokenBalances();
        if (!mounted || _selectedAsset?.mint != asset.mint) return;
        final match = tokens.where((t) => t.mint == asset.mint).firstOrNull;
        setState(() => _walletBalance = match?.amount ?? 0);
      }
    } catch (_) {
      if (mounted) setState(() => _walletBalance = null);
    } finally {
      if (mounted) setState(() => _loadingBalance = false);
    }
  }

  void _onAssetChanged(StrategyAsset? asset) {
    setState(() {
      _selectedAsset = asset;
      _walletBalance = null;
      _amountController.clear();
    });
    _fetchBalance();
  }

  void _setPercentage(double fraction) {
    final balance = _walletBalance;
    if (balance == null || balance <= 0) return;

    final decimals = _selectedAsset?.decimals ?? 6;
    final value = balance * fraction;
    _amountController.text = value.toStringAsFixed(decimals);
    _amountController.selection = TextSelection.fromPosition(
      TextPosition(offset: _amountController.text.length),
    );
  }

  String _formatBalance(double balance, int decimals) {
    return balance.toStringAsFixed(decimals > 4 ? 4 : decimals);
  }

  Future<void> _submit() async {
    if (_selectedAsset == null) return;
    if (!_withdrawAll && _amountController.text.isEmpty) return;

    BigInt? parsedAmount;
    if (!_withdrawAll) {
      try {
        parsedAmount = TokenAmount.parseDisplayAmount(
          input: _amountController.text,
          decimals: _selectedAsset!.decimals,
        );
      } on FormatException catch (error) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
        return;
      }
    }

    unawaited(HapticFeedback.mediumImpact());
    setState(() => _submitting = true);
    try {
      final result = await widget.breezeRepository.submitWithdraw(
        baseAssetMint: _selectedAsset!.mint,
        rawAmount: parsedAmount,
        withdrawAll: _withdrawAll,
      );

      if (!mounted) return;
      setState(() => _submitting = false);
      await TxStatusDialog.show(context, result);
      if (result.success && mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_mapSubmissionError(e))));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  String _mapSubmissionError(Object error) {
    if (error is BreezeApiException) {
      return 'Breeze API error: ${error.message}';
    }
    return 'Transaction failed: $error';
  }

  @override
  Widget build(BuildContext context) {
    final decimals = _selectedAsset?.decimals ?? 6;

    return LoadingOverlay(
      isLoading: _submitting,
      message: 'Transaction is processing...',
      child: Scaffold(
        appBar: AppBar(title: const Text('Withdraw')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                'Withdraw from ${widget.strategy.name}',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            RefinedPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Asset', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 8),
                  AssetSelector(
                    assets: widget.strategy.supportedAssets,
                    selected: _selectedAsset,
                    onChanged: _onAssetChanged,
                  ),
                  const SizedBox(height: 8),
                  // Balance display
                  Row(
                    children: [
                      Text(
                        'Balance: ',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      if (_loadingBalance)
                        const SizedBox(
                          height: 12,
                          width: 12,
                          child: CircularProgressIndicator(strokeWidth: 1.5),
                        )
                      else
                        Text(
                          _walletBalance != null
                              ? '${_formatBalance(_walletBalance!, decimals)} ${_selectedAsset?.symbol ?? ''}'
                              : '—',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: AppTheme.ink,
                                fontFeatures: [
                                  const FontFeature.tabularFigures(),
                                ],
                              ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Withdraw all',
                          style: Theme.of(
                            context,
                          ).textTheme.bodyMedium?.copyWith(color: AppTheme.ink),
                        ),
                      ),
                      Switch(
                        value: _withdrawAll,
                        onChanged: (value) {
                          unawaited(HapticFeedback.selectionClick());
                          setState(() => _withdrawAll = value);
                        },
                      ),
                    ],
                  ),
                  if (!_withdrawAll) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Amount',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        hintText: (0).toStringAsFixed(
                          decimals > 4 ? 4 : decimals,
                        ),
                        suffixText: _selectedAsset?.symbol ?? '',
                      ),
                    ),
                    const SizedBox(height: 10),
                    // Percentage buttons
                    Row(
                      children: [
                        for (final entry in [
                          ('25%', 0.25),
                          ('50%', 0.50),
                          ('75%', 0.75),
                          ('Max', 1.0),
                        ]) ...[
                          if (entry != ('25%', 0.25)) const SizedBox(width: 8),
                          Expanded(
                            child: _PercentButton(
                              label: entry.$1,
                              onTap:
                                  _walletBalance != null && _walletBalance! > 0
                                  ? () => _setPercentage(entry.$2)
                                  : null,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: Text(
                        _withdrawAll ? 'Withdraw All' : 'Submit Withdrawal',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PercentButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;

  const _PercentButton({required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: () {
        if (enabled) {
          HapticFeedback.selectionClick();
          onTap!();
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: enabled ? AppTheme.surface : AppTheme.surfaceMuted,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: enabled ? AppTheme.border : AppTheme.border.withAlpha(100),
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: enabled ? AppTheme.ink : AppTheme.mutedInk,
          ),
        ),
      ),
    );
  }
}
