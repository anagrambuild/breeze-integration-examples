import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../repositories/breeze_repository.dart';
import '../services/solana_service.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import 'strategy_tab.dart';
import 'wallet_tab.dart';

class HomeScreen extends StatefulWidget {
  final WalletService walletService;
  final BreezeRepository breezeRepository;
  final SolanaService solanaService;
  final String networkLabel;

  const HomeScreen({
    super.key,
    required this.walletService,
    required this.breezeRepository,
    required this.solanaService,
    required this.networkLabel,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  void _selectTab(int index) {
    if (index == _currentIndex) {
      return;
    }
    unawaited(HapticFeedback.selectionClick());
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      WalletTab(
        walletService: widget.walletService,
        solanaService: widget.solanaService,
      ),
      StrategyTab(
        walletService: widget.walletService,
        breezeRepository: widget.breezeRepository,
        solanaService: widget.solanaService,
      ),
    ];

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
              child: Row(
                children: [
                  Text(
                    'Breeze',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppTheme.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    widget.networkLabel,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeIn,
                child: KeyedSubtree(
                  key: ValueKey(_currentIndex),
                  child: tabs[_currentIndex],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _selectTab,
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: AppTheme.accent,
        unselectedItemColor: AppTheme.mutedInk,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_wallet_outlined),
            activeIcon: Icon(Icons.account_balance_wallet),
            label: 'Wallet',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.stacked_line_chart_outlined),
            activeIcon: Icon(Icons.stacked_line_chart),
            label: 'Earn',
          ),
        ],
      ),
    );
  }
}
