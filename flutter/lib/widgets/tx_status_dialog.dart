import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/tx_result.dart';
import '../theme/app_theme.dart';

class TxStatusDialog extends StatelessWidget {
  final TxResult result;

  const TxStatusDialog({super.key, required this.result});

  static Future<void> show(BuildContext context, TxResult result) {
    if (result.success) {
      unawaited(HapticFeedback.lightImpact());
    } else {
      unawaited(HapticFeedback.heavyImpact());
    }

    return showDialog(
      context: context,
      builder: (_) => TxStatusDialog(result: result),
    );
  }

  String get _signature => (result.signature ?? '').trim();

  Uri? get _explorerUri {
    if (_signature.isEmpty) {
      return null;
    }
    return Uri.parse('https://explorer.solana.com/tx/$_signature');
  }

  Future<void> _openExplorer(BuildContext context) async {
    final uri = _explorerUri;
    if (uri == null) {
      return;
    }

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open explorer link.')),
      );
    }
  }

  Future<void> _copySignature(BuildContext context) async {
    if (_signature.isEmpty) {
      return;
    }

    await Clipboard.setData(ClipboardData(text: _signature));
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Signature copied')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 20),
      backgroundColor: AppTheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppTheme.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              result.success ? 'Transaction Submitted' : 'Transaction Failed',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 14),
            if (result.success) ...[
              Text(
                'Your transaction will be confirmed soon.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceMuted,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SelectableText(
                  _signature,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.ink,
                    fontFamily: 'Menlo',
                    fontSize: 11,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _explorerUri == null
                          ? null
                          : () {
                              unawaited(HapticFeedback.selectionClick());
                              _openExplorer(context);
                            },
                      icon: const Icon(Icons.open_in_new_rounded, size: 18),
                      label: const Text('View on Explorer'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: _signature.isEmpty
                        ? null
                        : () {
                            unawaited(HapticFeedback.selectionClick());
                            _copySignature(context);
                          },
                    child: const Text('Copy'),
                  ),
                ],
              ),
            ] else
              Text(
                result.error ?? 'Unknown error',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
