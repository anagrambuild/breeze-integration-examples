import 'package:breeze_demo/models/strategy_info.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('apyPercent converts fractional APY to percent', () {
    final strategy = StrategyInfo(
      id: 's1',
      strategyName: 'Strategy',
      assets: const ['USDC'],
      apy: 0.1234,
      apyPerAsset: const {'USDC': 0.1234},
      supportedAssets: [],
    );

    expect(strategy.apyPercent, closeTo(12.34, 0.0001));
  });

  test('apyPercent keeps percentage APY unchanged', () {
    final strategy = StrategyInfo(
      id: 's1',
      strategyName: 'Strategy',
      assets: const ['USDC'],
      apy: 3.6746,
      apyPerAsset: const {'USDC': 3.6746},
      supportedAssets: [],
    );

    expect(strategy.apyPercent, closeTo(3.6746, 0.0001));
  });

  test('fromJson maps the current strategy-info response shape', () {
    final strategy = StrategyInfo.fromJson({
      'strategy_id': 's1',
      'strategy_name': 'Main Strategy',
      'assets': ['USDC', 'USDT'],
      'apy': 0.2,
      'apy_per_asset': {'USDC': 0.18, 'USDT': 0.22},
    });

    expect(strategy.id, 's1');
    expect(strategy.strategyName, 'Main Strategy');
    expect(strategy.assets, ['USDC', 'USDT']);
    expect(strategy.apyPerAsset['USDC'], 0.18);
    expect(strategy.apyPerAsset['USDT'], 0.22);
  });

  test('fromJson maps known mint assets to token metadata', () {
    final strategy = StrategyInfo.fromJson({
      'strategy_id': 's1',
      'strategy_name': 'Main Strategy',
      'assets': ['So11111111111111111111111111111111111111112'],
      'apy': 0.2,
      'apy_per_asset': {'SOL': 0.2},
    });

    expect(strategy.assets, ['SOL']);
    expect(strategy.supportedAssets, hasLength(1));
    expect(
      strategy.supportedAssets.first.mint,
      'So11111111111111111111111111111111111111112',
    );
    expect(strategy.supportedAssets.first.symbol, 'SOL');
    expect(strategy.supportedAssets.first.decimals, 9);
  });
}
