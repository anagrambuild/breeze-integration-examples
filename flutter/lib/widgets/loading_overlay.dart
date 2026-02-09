import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'refined_panel.dart';

class LoadingOverlay extends StatelessWidget {
  final bool isLoading;
  final String? message;
  final Widget child;
  final AlignmentGeometry indicatorAlignment;
  final EdgeInsetsGeometry indicatorPadding;

  const LoadingOverlay({
    super.key,
    required this.isLoading,
    this.message,
    required this.child,
    this.indicatorAlignment = Alignment.center,
    this.indicatorPadding = EdgeInsets.zero,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (isLoading)
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
              child: ColoredBox(
                color: AppTheme.ink.withValues(alpha: 0.12),
                child: Align(
                  alignment: indicatorAlignment,
                  child: Padding(
                    padding: indicatorPadding,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 300),
                      child: RefinedPanel(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            if (message != null) ...[
                              const SizedBox(height: 12),
                              Text(
                                message!,
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
