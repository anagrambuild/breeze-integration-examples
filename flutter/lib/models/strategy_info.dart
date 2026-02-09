import '../core/token_registry.dart';

class StrategyAsset {
  final String mint;
  final String symbol;
  final int decimals;

  const StrategyAsset({
    required this.mint,
    required this.symbol,
    required this.decimals,
  });

  factory StrategyAsset.fromJson(Map<String, dynamic> json) {
    final mint = (json['mint'] as String? ?? '').trim();
    final symbol = (json['symbol'] as String? ?? '').trim();
    final decimals = (json['decimals'] as num?)?.toInt();
    final metadata = TokenRegistry.byMint(mint);

    return StrategyAsset(
      mint: mint,
      symbol: symbol.isNotEmpty ? symbol : (metadata?.symbol ?? mint),
      decimals: decimals ?? metadata?.decimals ?? 6,
    );
  }
}

class StrategyInfo {
  final String id;
  final String strategyName;
  final List<String> assets;
  final double apy;
  final Map<String, double> apyPerAsset;

  // Compatibility field used by existing deposit/withdraw UI.
  final List<StrategyAsset> supportedAssets;

  const StrategyInfo({
    required this.id,
    required this.strategyName,
    required this.assets,
    required this.apy,
    required this.apyPerAsset,
    required this.supportedAssets,
  });

  // Backward-compatible alias for existing UI call sites.
  String get name => strategyName;

  // API payloads may return APY as a fraction (0.12) or as percent (12.0).
  // Normalize to percent for display.
  double get apyPercent => apy.abs() <= 1 ? apy * 100 : apy;

  factory StrategyInfo.fromJson(Map<String, dynamic> json) {
    final parsedAssets = _parseAssets(json);
    final parsedApyPerAsset = _parseApyPerAsset(json);
    final rawAssets =
        (json['assets'] as List<dynamic>?)
            ?.map((asset) => '$asset'.trim())
            .where((asset) => asset.isNotEmpty)
            .toList() ??
        [];

    // New shape: `assets: string[]`
    final assets = rawAssets.isNotEmpty
        ? rawAssets
              .map((asset) => TokenRegistry.byMint(asset)?.symbol ?? asset)
              .toList()
        : parsedAssets.map((asset) => asset.symbol).toList();

    final supportedAssets = parsedAssets.isNotEmpty
        ? parsedAssets
        : rawAssets.map((asset) {
            final metadata = TokenRegistry.byMint(asset);
            return StrategyAsset(
              mint: asset,
              symbol: metadata?.symbol ?? asset,
              decimals: metadata?.decimals ?? 6,
            );
          }).toList();

    return StrategyInfo(
      id: (json['strategy_id'] as String? ?? '').trim(),
      strategyName:
          (json['strategy_name'] as String? ?? json['name'] as String? ?? '')
              .trim(),
      assets: assets,
      apy: (json['apy'] as num?)?.toDouble() ?? 0.0,
      apyPerAsset: parsedApyPerAsset,
      supportedAssets: supportedAssets,
    );
  }

  static List<StrategyAsset> _parseAssets(Map<String, dynamic> json) {
    return (json['supported_assets'] as List<dynamic>?)
            ?.whereType<Map<String, dynamic>>()
            .map(StrategyAsset.fromJson)
            .where((asset) => asset.mint.isNotEmpty || asset.symbol.isNotEmpty)
            .toList() ??
        [];
  }

  static Map<String, double> _parseApyPerAsset(Map<String, dynamic> json) {
    final rawMap = json['apy_per_asset'];
    if (rawMap is! Map) {
      return const {};
    }

    final mapped = <String, double>{};
    for (final entry in rawMap.entries) {
      final key = '${entry.key}'.trim();
      final value = entry.value;
      if (key.isEmpty || value is! num) {
        continue;
      }
      mapped[key] = value.toDouble();
    }
    return mapped;
  }
}
