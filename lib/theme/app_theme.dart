import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppPalette {
  final Color bg;
  final Color sidebar;
  final Color panel;
  final Color text;
  final Color text2;
  final Color muted;
  final Color divider;
  final Color accent;
  final Color tagFg;
  final Color tagBg;
  final Color linkBg;
  final Color success;
  final Color warn;
  final Color error;

  const AppPalette({
    required this.bg,
    required this.sidebar,
    required this.panel,
    required this.text,
    required this.text2,
    required this.muted,
    required this.divider,
    required this.accent,
    required this.tagFg,
    required this.tagBg,
    required this.linkBg,
    required this.success,
    required this.warn,
    required this.error,
  });

  static const light = AppPalette(
    bg: Color(0xFFFAFAF9),
    sidebar: Color(0xFFF4F4F5),
    panel: Color(0xFFFFFFFF),
    text: Color(0xFF18181B),
    text2: Color(0xFF71717A),
    muted: Color(0xFFA1A1AA),
    divider: Color(0xFFE4E4E7),
    accent: Color(0xFF4F46E5),
    tagFg: Color(0xFFD97706),
    tagBg: Color(0xFFFEF3C7),
    linkBg: Color(0xFFEEF2FF),
    success: Color(0xFF059669),
    warn: Color(0xFFD97706),
    error: Color(0xFFDC2626),
  );

  static const dark = AppPalette(
    bg: Color(0xFF09090B),
    sidebar: Color(0xFF111113),
    panel: Color(0xFF18181B),
    text: Color(0xFFFAFAFA),
    text2: Color(0xFFA1A1AA),
    muted: Color(0xFF71717A),
    divider: Color(0xFF27272A),
    accent: Color(0xFF818CF8),
    tagFg: Color(0xFFFBBF24),
    tagBg: Color(0x33D97706),
    linkBg: Color(0x33818CF8),
    success: Color(0xFF34D399),
    warn: Color(0xFFFBBF24),
    error: Color(0xFFF87171),
  );
}

class AppColors extends ThemeExtension<AppColors> {
  final AppPalette p;
  const AppColors(this.p);

  @override
  AppColors copyWith({AppPalette? p}) => AppColors(p ?? this.p);

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return t < 0.5 ? this : other;
  }
}

extension ThemePaletteX on BuildContext {
  AppPalette get pal => Theme.of(this).extension<AppColors>()?.p ?? AppPalette.light;
}

class AppTheme {
  static bool get isDesktopPlatform {
    if (kIsWeb) return false;
    return Platform.isWindows || Platform.isLinux || Platform.isMacOS;
  }

  static const List<String> fontFallback = [
    'SF Pro Text',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
  ];

  static ThemeData build(Brightness brightness, {bool desktopDensity = false}) {
    final isDark = brightness == Brightness.dark;
    final p = isDark ? AppPalette.dark : AppPalette.light;
    final scaleFactor = desktopDensity ? 0.92 : 1.0;

    final baseText = (isDark ? ThemeData.dark() : ThemeData.light()).textTheme.apply(
          fontFamily: 'Inter',
          fontFamilyFallback: fontFallback,
          bodyColor: p.text,
          displayColor: p.text,
          fontSizeFactor: scaleFactor,
        );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: p.bg,
      canvasColor: p.bg,
      cardColor: p.panel,
      dividerColor: p.divider,
      visualDensity: desktopDensity ? VisualDensity.compact : VisualDensity.standard,
      fontFamily: 'Inter',
      fontFamilyFallback: fontFallback,
      textTheme: baseText,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: p.accent,
        onPrimary: Colors.white,
        secondary: p.accent,
        onSecondary: Colors.white,
        error: p.error,
        onError: Colors.white,
        surface: p.panel,
        onSurface: p.text,
        outline: p.divider,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.bg,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: p.divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: p.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: p.accent, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.accent,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.text,
          side: BorderSide(color: p.divider),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        side: BorderSide(color: p.muted, width: 1.5),
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? p.accent : Colors.transparent,
        ),
      ),
      dividerTheme: DividerThemeData(color: p.divider, thickness: 1, space: 1),
      extensions: [AppColors(p)],
    );
  }
}
