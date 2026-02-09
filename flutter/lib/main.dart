import 'package:flutter/material.dart';

import 'config.dart';
import 'repositories/breeze_repository.dart';
import 'screens/home_screen.dart';
import 'services/breeze_api_service.dart';
import 'services/solana_service.dart';
import 'services/wallet_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    final config = AppConfig.fromEnvironment();

    final walletService = WalletService();
    await walletService.tryLoadExisting();

    final breezeApiService = BreezeApiService(config: config);
    final solanaService = SolanaService(
      walletService: walletService,
      config: config,
    );
    final breezeRepository = BreezeRepository(
      breezeApiService: breezeApiService,
      solanaService: solanaService,
      walletService: walletService,
    );

    runApp(
      BreezeApp(
        walletService: walletService,
        breezeRepository: breezeRepository,
        solanaService: solanaService,
        networkLabel: config.networkLabel,
      ),
    );
  } on FormatException catch (error) {
    runApp(_BootstrapErrorApp(message: error.message));
  }
}

class BreezeApp extends StatelessWidget {
  final WalletService walletService;
  final BreezeRepository breezeRepository;
  final SolanaService solanaService;
  final String networkLabel;

  const BreezeApp({
    super.key,
    required this.walletService,
    required this.breezeRepository,
    required this.solanaService,
    required this.networkLabel,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Breeze Demo',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: HomeScreen(
        walletService: walletService,
        breezeRepository: breezeRepository,
        solanaService: solanaService,
        networkLabel: networkLabel,
      ),
    );
  }
}

class _BootstrapErrorApp extends StatelessWidget {
  final String message;

  const _BootstrapErrorApp({required this.message});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Configuration error: $message',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
