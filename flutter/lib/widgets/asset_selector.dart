import 'package:flutter/material.dart';

import '../models/strategy_info.dart';

class AssetSelector extends StatelessWidget {
  final List<StrategyAsset> assets;
  final StrategyAsset? selected;
  final ValueChanged<StrategyAsset?> onChanged;

  const AssetSelector({
    super.key,
    required this.assets,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<StrategyAsset>(
      initialValue: selected,
      decoration: const InputDecoration(labelText: 'Select Asset'),
      items: assets.map((asset) {
        return DropdownMenuItem(
          value: asset,
          child: Text('${asset.symbol} (${_truncate(asset.mint)})'),
        );
      }).toList(),
      onChanged: onChanged,
    );
  }

  String _truncate(String s) =>
      s.length > 8 ? '${s.substring(0, 4)}...${s.substring(s.length - 4)}' : s;
}
