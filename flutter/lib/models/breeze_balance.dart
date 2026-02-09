import '../core/token_registry.dart';

class BreezePosition {
  final String mint;
  final String symbol;
  final int decimals;
  final BigInt deposited;
  final BigInt yieldEarned;
  final BigInt total;

  BreezePosition({
    required this.mint,
    required this.symbol,
    required this.decimals,
    required this.deposited,
    required this.yieldEarned,
    required this.total,
  });

  double get depositedDisplay =>
      deposited.toDouble() / BigInt.from(10).pow(decimals).toDouble();
  double get yieldDisplay =>
      yieldEarned.toDouble() / BigInt.from(10).pow(decimals).toDouble();
  double get totalDisplay =>
      total.toDouble() / BigInt.from(10).pow(decimals).toDouble();

  factory BreezePosition.fromJson(Map<String, dynamic> json) {
    final mint = _readString(json['mint'] ?? json['token_address']);
    final symbol = _readString(json['symbol'] ?? json['token_symbol']);
    final decimals = (json['decimals'] as num?)?.toInt();
    final metadata = TokenRegistry.byMint(mint);

    return BreezePosition(
      mint: mint,
      symbol: symbol.isNotEmpty ? symbol : (metadata?.symbol ?? mint),
      decimals: decimals ?? metadata?.decimals ?? 0,
      deposited: _readBigInt(
        json['deposited'] ?? json['total_deposited_value'],
      ),
      yieldEarned: _readBigInt(
        json['yield_earned'] ?? json['yieldEarned'] ?? 0,
      ),
      total: _readBigInt(json['total'] ?? json['total_position_value']),
    );
  }

  static String _readString(Object? value) => '${value ?? ''}'.trim();

  static BigInt _readBigInt(Object? value) =>
      BigInt.tryParse('${value ?? 0}') ?? BigInt.zero;
}

class BreezeBalance {
  final List<BreezePosition> positions;

  BreezeBalance({required this.positions});

  factory BreezeBalance.fromJson(Map<String, dynamic> json) {
    final rawPositions =
        (json['positions'] as List<dynamic>?) ??
        (json['data'] as List<dynamic>?) ??
        const [];

    final positionsList = rawPositions
        .whereType<Map<String, dynamic>>()
        .map(BreezePosition.fromJson)
        .toList();

    return BreezeBalance(positions: positionsList);
  }
}
