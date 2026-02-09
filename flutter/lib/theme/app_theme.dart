import 'package:flutter/material.dart';

class AppTheme {
  static const Color background = Color(0xFFF7F7F7);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF0F0F0);
  static const Color ink = Color(0xFF111111);
  static const Color mutedInk = Color(0xFF8B8B8B);
  static const Color accent = Color(0xFFE357D5);
  static const Color accentSoft = Color(0xFFFCF0FB);
  static const Color border = Color(0xFFE5E5E5);
  static const Color positive = Color(0xFF22C55E);

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme.light(
        primary: accent,
        secondary: accent,
        surface: surface,
        onSurface: ink,
        onPrimary: Colors.white,
      ),
    );

    return base.copyWith(
      scaffoldBackgroundColor: background,
      dividerColor: border,
      textTheme: base.textTheme.copyWith(
        headlineMedium: base.textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.5,
          color: ink,
          height: 1.15,
        ),
        headlineSmall: base.textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.3,
          color: ink,
          height: 1.2,
        ),
        titleLarge: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
          color: ink,
        ),
        titleMedium: base.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w500,
          letterSpacing: -0.1,
          color: ink,
        ),
        bodyLarge: base.textTheme.bodyLarge?.copyWith(
          color: ink,
          height: 1.5,
        ),
        bodyMedium: base.textTheme.bodyMedium?.copyWith(
          color: mutedInk,
          height: 1.45,
        ),
        labelLarge: base.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w500,
          letterSpacing: 0,
        ),
      ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        centerTitle: false,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: ink,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: ink,
        contentTextStyle: base.textTheme.bodyMedium?.copyWith(
          color: Colors.white,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: accent, width: 1.5),
        ),
        labelStyle: const TextStyle(color: mutedInk),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ink,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: base.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          side: const BorderSide(color: border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          textStyle: base.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: border),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return Colors.white;
          }
          return Colors.white;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return accent;
          }
          return border;
        }),
      ),
    );
  }
}
