import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/breeze_balance.dart';
import '../models/strategy_info.dart';
import '../repositories/breeze_repository.dart';
import '../services/solana_service.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import '../widgets/balance_card.dart';
import '../widgets/refined_panel.dart';
import 'deposit_screen.dart';
import 'withdraw_screen.dart';

class StrategyTab extends StatefulWidget {
  final WalletService walletService;
  final BreezeRepository breezeRepository;
  final SolanaService solanaService;

  const StrategyTab({
    super.key,
    required this.walletService,
    required this.breezeRepository,
    required this.solanaService,
  });

  @override
  State<StrategyTab> createState() => _StrategyTabState();
}

class _StrategyTabState extends State<StrategyTab> {
  StrategyInfo? _strategy;
  BreezeBalance? _balance;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final strategy = await widget.breezeRepository.getStrategyInfo();
      BreezeBalance? balance;
      if (widget.walletService.hasWallet) {
        balance = await widget.breezeRepository.getBalancesForCurrentWallet();
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _strategy = strategy;
        _balance = balance;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _openDeposit() {
    if (_strategy == null) {
      return;
    }
    unawaited(HapticFeedback.mediumImpact());
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DepositScreen(
          strategy: _strategy!,
          breezeRepository: widget.breezeRepository,
          solanaService: widget.solanaService,
        ),
      ),
    ).then((_) => _loadData());
  }

  void _openWithdraw({BreezePosition? position}) {
    if (_strategy == null) {
      return;
    }
    unawaited(HapticFeedback.selectionClick());
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WithdrawScreen(
          strategy: _strategy!,
          breezeRepository: widget.breezeRepository,
          solanaService: widget.solanaService,
          preselectedPosition: position,
        ),
      ),
    ).then((_) => _loadData());
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.walletService.hasWallet) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: RefinedPanel(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Earn', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 6),
                Text(
                  'Create a wallet in the Wallet tab to deposit funds into Breeze.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_loading && _strategy == null) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: RefinedPanel(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 14),
                FilledButton(onPressed: _loadData, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    final strategy = _strategy!;
    final positions = _balance?.positions ?? [];
    final strategyTitle = strategy.name.replaceAll(RegExp(r'\s+'), ' ').trim();

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppTheme.accent,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          RefinedPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (strategyTitle.isNotEmpty) ...[
                  Text(
                    strategyTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                ],
                _MetricLine(
                  label: 'Estimated APY',
                  value: '${strategy.apyPercent.toStringAsFixed(2)}%',
                  valueColor: AppTheme.accent,
                ),
                if (strategy.assets.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Assets: ${strategy.assets.join(', ')}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: _openDeposit,
                        child: const Text('Deposit'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: _loading
                          ? null
                          : () {
                              unawaited(HapticFeedback.selectionClick());
                              _loadData();
                            },
                      child: const Icon(Icons.refresh_rounded),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Your Balances',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          if (positions.isEmpty)
            RefinedPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'No open positions yet.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: _openDeposit,
                    child: const Text('Make first deposit'),
                  ),
                ],
              ),
            )
          else
            ...positions.map(
              (pos) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: BalanceCard(
                  position: pos,
                  onDeposit: _openDeposit,
                  onWithdraw: () => _openWithdraw(position: pos),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MetricLine extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _MetricLine({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: AppTheme.mutedInk),
        ),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(color: valueColor ?? AppTheme.ink),
        ),
      ],
    );
  }
}
