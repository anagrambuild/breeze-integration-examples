import 'package:breeze_demo/core/token_registry.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('byMint returns metadata for known mints', () {
    final token = TokenRegistry.byMint(
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    );

    expect(token, isNotNull);
    expect(token!.symbol, 'USDC');
    expect(token.decimals, 6);
  });

  test('byMint returns null for unknown mints', () {
    final token = TokenRegistry.byMint('unknown-mint');
    expect(token, isNull);
  });
}
