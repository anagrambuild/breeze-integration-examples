import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/breeze_balance.dart';
import '../theme/app_theme.dart';
import 'refined_panel.dart';

class BalanceCard extends StatelessWidget {
  final BreezePosition position;
  final VoidCallback? onDeposit;
  final VoidCallback? onWithdraw;

  const BalanceCard({
    super.key,
    required this.position,
    this.onDeposit,
    this.onWithdraw,
  });

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.######');

    return RefinedPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            position.symbol,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          _MetricRow(
            label: 'Deposited',
            value: fmt.format(position.depositedDisplay),
          ),
          const SizedBox(height: 6),
          _MetricRow(
            label: 'Yield',
            value: fmt.format(position.yieldDisplay),
            valueColor: AppTheme.accent,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Divider(height: 1, color: AppTheme.border),
          ),
          _MetricRow(
            label: 'Total',
            value: fmt.format(position.totalDisplay),
            bold: true,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onDeposit,
                  child: const Text('Deposit'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: onWithdraw,
                  child: const Text('Withdraw'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;

  const _MetricRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
        Text(
          value,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
            color: valueColor ?? (bold ? AppTheme.ink : AppTheme.mutedInk),
          ),
        ),
      ],
    );
  }
}
