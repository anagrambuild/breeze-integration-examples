class TokenAmount {
  TokenAmount._();

  static BigInt parseDisplayAmount({
    required String input,
    required int decimals,
  }) {
    final normalizedInput = input.trim();
    if (normalizedInput.isEmpty) {
      throw const FormatException('Amount is required.');
    }

    final regex = RegExp(r'^\d+(?:\.\d+)?$');
    if (!regex.hasMatch(normalizedInput)) {
      throw const FormatException('Amount must be a positive number.');
    }

    final parts = normalizedInput.split('.');
    final wholePart = parts[0];
    final fractionalPart = parts.length == 2 ? parts[1] : '';

    if (fractionalPart.length > decimals) {
      throw FormatException('Amount supports up to $decimals decimal places.');
    }

    final rawString = '$wholePart${fractionalPart.padRight(decimals, '0')}';
    final value = BigInt.parse(rawString);

    if (value <= BigInt.zero) {
      throw const FormatException('Amount must be greater than 0.');
    }

    return value;
  }
}
