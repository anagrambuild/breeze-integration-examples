import 'package:breeze_demo/models/breeze_balance.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fromJson falls back to token metadata by mint', () {
    final position = BreezePosition.fromJson({
      'mint': 'So11111111111111111111111111111111111111112',
      'symbol': '',
      'deposited': '1000000000',
      'yield_earned': '0',
      'total': '1000000000',
    });

    expect(position.symbol, 'SOL');
    expect(position.decimals, 9);
    expect(position.totalDisplay, 1);
  });

  test('fromJson maps Breeze balances data payload shape', () {
    final balance = BreezeBalance.fromJson({
      'data': [
        {
          'token_address': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          'token_symbol': 'USDC',
          'decimals': 6,
          'total_position_value': 100000,
          'total_deposited_value': 100000,
          'yield_earned': 0,
        },
      ],
      'meta': {'count': 1},
    });

    expect(balance.positions, hasLength(1));
    final position = balance.positions.first;
    expect(position.mint, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(position.symbol, 'USDC');
    expect(position.decimals, 6);
    expect(position.deposited, BigInt.from(100000));
    expect(position.total, BigInt.from(100000));
    expect(position.yieldEarned, BigInt.zero);
  });
}
