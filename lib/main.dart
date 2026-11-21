import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:window_manager/window_manager.dart';
import 'state/pass_store.dart';
import 'state/store.dart';
import 'theme/app_theme.dart';
import 'ui/lock_screen.dart';
import 'ui/shell/adaptive_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb && (Platform.isWindows || Platform.isLinux || Platform.isMacOS)) {
    await windowManager.ensureInitialized();
    const options = WindowOptions(
      size: Size(1280, 820),
      minimumSize: Size(760, 520),
      center: true,
      title: 'Свод — Личное зашифрованное пространство',
    );
    await windowManager.waitUntilReadyToShow(options, () async {
      await windowManager.show();
      await windowManager.focus();
    });
  }

  final store = Store();
  final passStore = PassStore();
  await store.init();
  await passStore.init();

  runApp(SvodApp(store: store, passStore: passStore));
}

class SvodApp extends StatefulWidget {
  final Store store;
  final PassStore passStore;

  const SvodApp({super.key, required this.store, required this.passStore});

  @override
  State<SvodApp> createState() => _SvodAppState();
}

class _SvodAppState extends State<SvodApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Автоблокировка хранилища паролей при сворачивании приложения (paused / hidden)
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      if (widget.passStore.activeVault != null) {
        widget.passStore.lock();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([widget.store, widget.passStore]),
      builder: (context, _) {
        final s = widget.store.settings;
        final desktopDensity = AppTheme.isDesktopPlatform;
        return MaterialApp(
          title: 'Свод',
          debugShowCheckedModeBanner: false,
          locale: const Locale('ru', 'RU'),
          supportedLocales: const [Locale('ru', 'RU'), Locale('en', 'US')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          themeMode: s.isDark ? ThemeMode.dark : ThemeMode.light,
          theme: AppTheme.build(Brightness.light, desktopDensity: desktopDensity),
          darkTheme: AppTheme.build(Brightness.dark, desktopDensity: desktopDensity),
          builder: (context, child) {
            final mq = MediaQuery.of(context);
            return MediaQuery(
              data: mq.copyWith(textScaler: TextScaler.linear(s.fontScale)),
              child: Transform.scale(
                scale: s.uiScale,
                alignment: Alignment.topLeft,
                child: FractionallySizedBox(
                  widthFactor: 1 / s.uiScale,
                  heightFactor: 1 / s.uiScale,
                  alignment: Alignment.topLeft,
                  child: child ?? const SizedBox.shrink(),
                ),
              ),
            );
          },
          home: widget.store.isLocked
              ? LockScreen(store: widget.store)
              : AdaptiveShell(store: widget.store, passStore: widget.passStore),
        );
      },
    );
  }
}
