import 'package:breeze_demo/core/token_amount.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TokenAmount.parseDisplayAmount', () {
    test('parses integer amounts', () {
      final value = TokenAmount.parseDisplayAmount(input: '2', decimals: 6);
      expect(value, BigInt.from(2000000));
    });

    test('parses decimal amounts', () {
      final value = TokenAmount.parseDisplayAmount(input: '1.25', decimals: 6);
      expect(value, BigInt.from(1250000));
    });

    test('supports trimmed input', () {
      final value = TokenAmount.parseDisplayAmount(input: ' 0.5 ', decimals: 9);
      expect(value, BigInt.from(500000000));
    });

    test('throws when too many decimals are provided', () {
      expect(
        () => TokenAmount.parseDisplayAmount(input: '1.1234567', decimals: 6),
        throwsFormatException,
      );
    });

    test('throws for invalid format', () {
      expect(
        () => TokenAmount.parseDisplayAmount(input: 'abc', decimals: 6),
        throwsFormatException,
      );
    });

    test('throws when value is zero', () {
      expect(
        () => TokenAmount.parseDisplayAmount(input: '0', decimals: 6),
        throwsFormatException,
      );
    });
  });
}
