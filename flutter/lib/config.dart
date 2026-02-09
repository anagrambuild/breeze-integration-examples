class AppConfig {
  final String breezeApiKey;
  final String strategyId;
  final Uri solanaRpcUri;
  final Uri breezeBaseUri;
  final Duration networkTimeout;

  const AppConfig({
    required this.breezeApiKey,
    required this.strategyId,
    required this.solanaRpcUri,
    required this.breezeBaseUri,
    this.networkTimeout = const Duration(seconds: 20),
  });

  String get networkLabel {
    final haystack = '${solanaRpcUri.host}${solanaRpcUri.path}'.toLowerCase();

    if (haystack.contains('mainnet')) {
      return 'Mainnet';
    }
    if (haystack.contains('devnet')) {
      return 'Devnet';
    }
    if (haystack.contains('testnet')) {
      return 'Testnet';
    }
    if (haystack.contains('localhost') || haystack.contains('127.0.0.1')) {
      return 'Localnet';
    }

    return 'Custom';
  }

  factory AppConfig.fromEnvironment() {
    final apiKey = const String.fromEnvironment('BREEZE_API_KEY').trim();
    final strategyId = const String.fromEnvironment('STRATEGY_ID').trim();
    final rpcUrl = const String.fromEnvironment(
      'SOLANA_RPC_URL',
      defaultValue: 'https://api.devnet.solana.com',
    ).trim();
    final baseUrl = const String.fromEnvironment(
      'BREEZE_BASE_URL',
      defaultValue: 'https://api.breeze.baby',
    ).trim();

    if (apiKey.isEmpty) {
      throw const FormatException('Missing BREEZE_API_KEY (use --dart-define).');
    }
    if (strategyId.isEmpty) {
      throw const FormatException('Missing STRATEGY_ID (use --dart-define).');
    }

    final solanaRpcUri = Uri.tryParse(rpcUrl);
    if (solanaRpcUri == null || !solanaRpcUri.hasScheme) {
      throw FormatException('Invalid SOLANA_RPC_URL: $rpcUrl');
    }

    final breezeBaseUri = Uri.tryParse(baseUrl);
    if (breezeBaseUri == null || !breezeBaseUri.hasScheme) {
      throw FormatException('Invalid BREEZE_BASE_URL: $baseUrl');
    }

    return AppConfig(
      breezeApiKey: apiKey,
      strategyId: strategyId,
      solanaRpcUri: solanaRpcUri,
      breezeBaseUri: breezeBaseUri,
    );
  }
}
