import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../services/solana_service.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import '../widgets/refined_panel.dart';

enum _WalletAction { backup, disconnect }

class WalletTab extends StatefulWidget {
  final WalletService walletService;
  final SolanaService solanaService;

  const WalletTab({
    super.key,
    required this.walletService,
    required this.solanaService,
  });

  @override
  State<WalletTab> createState() => _WalletTabState();
}

class _WalletTabState extends State<WalletTab> {
  double? _solBalance;
  List<TokenBalance> _tokenBalances = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    if (widget.walletService.hasWallet) {
      _refreshBalance();
    }
  }

  Future<void> _refreshBalance() async {
    if (!mounted) return;

    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        widget.solanaService.getSolBalance(),
        widget.solanaService.getTokenBalances(),
      ]);
      if (!mounted) return;
      setState(() {
        _solBalance = results[0] as double;
        _tokenBalances = results[1] as List<TokenBalance>;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error fetching balance: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _createWallet() async {
    unawaited(HapticFeedback.mediumImpact());
    if (!mounted) return;

    setState(() => _loading = true);
    try {
      await widget.walletService.createWallet();
      await _refreshBalance();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error creating wallet: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _disconnectWallet() async {
    unawaited(HapticFeedback.selectionClick());

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Disconnect Wallet?'),
        content: const Text(
          'This will remove your local wallet from this device. '
          'Back up your wallet first from Wallet Actions -> Backup Wallet.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Disconnect'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() => _loading = true);
    try {
      await widget.walletService.deleteWallet();
      if (!mounted) return;
      setState(() {
        _solBalance = null;
        _tokenBalances = [];
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Wallet disconnected')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error disconnecting wallet: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _copyAddress(String pubkey) {
    unawaited(HapticFeedback.selectionClick());
    Clipboard.setData(ClipboardData(text: pubkey));
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Address copied')));
  }

  Future<void> _showBackupSheet() async {
    unawaited(HapticFeedback.selectionClick());

    String secretHex;
    try {
      secretHex = await widget.walletService.exportSecretKeyHex();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Unable to export wallet: $e')));
      return;
    }

    if (!mounted) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        var revealed = false;
        var copied = false;
        return StatefulBuilder(
          builder: (context, setModalState) => Padding(
            padding: EdgeInsets.fromLTRB(
              24,
              8,
              24,
              24 + MediaQuery.of(context).viewInsets.bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: AppTheme.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Text(
                  'Backup Wallet',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                Text(
                  'Store this secret key securely. Anyone with it can control your wallet.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppTheme.ink),
                ),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceMuted,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: SelectableText(
                    revealed ? secretHex : 'Tap reveal to view your secret key',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.ink,
                      fontFamily: 'Menlo',
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          unawaited(HapticFeedback.selectionClick());
                          setModalState(() => revealed = !revealed);
                        },
                        child: Text(revealed ? 'Hide' : 'Reveal'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: !revealed
                            ? null
                            : () {
                                unawaited(HapticFeedback.selectionClick());
                                Clipboard.setData(
                                  ClipboardData(text: secretHex),
                                );
                                setModalState(() => copied = true);
                                unawaited(
                                  Future<void>.delayed(
                                    const Duration(seconds: 2),
                                    () {
                                      if (context.mounted) {
                                        setModalState(() => copied = false);
                                      }
                                    },
                                  ),
                                );
                              },
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              copied
                                  ? Icons.check_circle_rounded
                                  : Icons.copy_rounded,
                              size: 16,
                            ),
                            const SizedBox(width: 6),
                            Text(copied ? 'Copied' : 'Copy Secret'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showReceiveSheet(String pubkey) {
    unawaited(HapticFeedback.selectionClick());
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: AppTheme.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text('Receive', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
              child: QrImageView(
                data: pubkey,
                version: QrVersions.auto,
                size: 200,
                backgroundColor: Colors.white,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: AppTheme.ink,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: AppTheme.ink,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              pubkey,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontFamily: 'Menlo',
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  _copyAddress(pubkey);
                  Navigator.pop(context);
                },
                icon: const Icon(Icons.copy_rounded, size: 16),
                label: const Text('Copy Address'),
              ),
            ),
          ],
        ),
      ),
    );
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
                Text(
                  'Create a wallet',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'Generate a local Solana keypair to get started.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _loading ? null : _createWallet,
                    child: const Text('Create Wallet'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final pubkey = widget.walletService.publicKeyBase58 ?? '';

    return RefreshIndicator(
      onRefresh: _refreshBalance,
      color: AppTheme.accent,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          // Address card with copy + QR buttons
          RefinedPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Wallet', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _short(pubkey),
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontFamily: 'Menlo', fontSize: 14),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _showReceiveSheet(pubkey),
                      child: const Padding(
                        padding: EdgeInsets.only(right: 12),
                        child: Icon(
                          Icons.qr_code_rounded,
                          size: 18,
                          color: AppTheme.mutedInk,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _copyAddress(pubkey),
                      child: const Icon(
                        Icons.copy_rounded,
                        size: 18,
                        color: AppTheme.mutedInk,
                      ),
                    ),
                    const SizedBox(width: 2),
                    PopupMenuButton<_WalletAction>(
                      enabled: !_loading,
                      icon: const Icon(
                        Icons.more_vert_rounded,
                        size: 18,
                        color: AppTheme.mutedInk,
                      ),
                      tooltip: 'Wallet actions',
                      onSelected: (action) {
                        switch (action) {
                          case _WalletAction.backup:
                            _showBackupSheet();
                            break;
                          case _WalletAction.disconnect:
                            _disconnectWallet();
                            break;
                        }
                      },
                      itemBuilder: (context) => const [
                        PopupMenuItem(
                          value: _WalletAction.backup,
                          child: Row(
                            children: [
                              Icon(
                                Icons.key_rounded,
                                size: 16,
                                color: AppTheme.ink,
                              ),
                              SizedBox(width: 8),
                              Text('Backup Wallet'),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: _WalletAction.disconnect,
                          child: Row(
                            children: [
                              Icon(
                                Icons.link_off_rounded,
                                size: 16,
                                color: AppTheme.ink,
                              ),
                              SizedBox(width: 8),
                              Text('Disconnect Wallet'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Balances panel
          RefinedPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Balances',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    GestureDetector(
                      onTap: _loading
                          ? null
                          : () {
                              unawaited(HapticFeedback.selectionClick());
                              _refreshBalance();
                            },
                      child: Icon(
                        Icons.refresh_rounded,
                        size: 20,
                        color: _loading ? AppTheme.border : AppTheme.mutedInk,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 160),
                  child: _loading && _solBalance == null
                      ? const Padding(
                          key: ValueKey('balance-loading'),
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Center(
                            child: SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        )
                      : Column(
                          key: const ValueKey('balance-list'),
                          children: [
                            _BalanceRow(
                              symbol: 'SOL',
                              amount: _solBalance?.toStringAsFixed(4) ?? '—',
                            ),
                            for (final token in _tokenBalances) ...[
                              const Divider(height: 1, color: AppTheme.border),
                              _BalanceRow(
                                symbol: token.symbol,
                                amount: token.amount.toStringAsFixed(
                                  token.decimals > 4 ? 4 : token.decimals,
                                ),
                              ),
                            ],
                          ],
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _short(String pubkey) {
    if (pubkey.length <= 14) return pubkey;
    return '${pubkey.substring(0, 7)}...${pubkey.substring(pubkey.length - 7)}';
  }
}

class _BalanceRow extends StatelessWidget {
  final String symbol;
  final String amount;

  const _BalanceRow({required this.symbol, required this.amount});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Text(symbol, style: Theme.of(context).textTheme.titleMedium),
          const Spacer(),
          Text(
            amount,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontFeatures: [const FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
