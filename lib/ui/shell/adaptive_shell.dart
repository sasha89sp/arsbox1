import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/models.dart';
import '../../state/pass_store.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';
import '../modules/calendar_page.dart';
import '../modules/extras_pages.dart';
import '../modules/notes_page.dart';
import '../modules/passwords_page.dart';
import '../modules/settings_page.dart';
import '../modules/shared_page.dart';
import '../widgets/schedule_panel.dart';

/// Адаптивная оболочка (Компьютер >= 900 px vs Телефон):
/// - Desktop: AppMenu (Файл·Правка·Вид·Переход·Блокноты·Заметка·Сервис·Помощь),
///   левая колонка (170–420 px), центр (ThreePane), правая колонка SchedulePanel (240–560 px при >= 980 px)
/// - Mobile: AppBar + кнопка синхронизации + Drawer + NavigationBar (до 5 пунктов)
/// - Глобальная StatusStrip (22–26 px) с открытием DiagHub
class AdaptiveShell extends StatefulWidget {
  final Store store;
  final PassStore passStore;

  const AdaptiveShell({super.key, required this.store, required this.passStore});

  @override
  State<AdaptiveShell> createState() => _AdaptiveShellState();
}

class _AdaptiveShellState extends State<AdaptiveShell> {
  double _sidebarWidth = 220;
  double _scheduleWidth = 290;

  bool _isDesktop(double width) {
    final mode = widget.store.settings.layoutMode;
    if (mode == LayoutMode.desktop) return true;
    if (mode == LayoutMode.mobile) return false;
    return width >= 900;
  }

  Widget _buildActiveModule(bool isMobile) {
    switch (widget.store.activeModule) {
      case AppModuleId.notes:
        return NotesPage(store: widget.store, isMobile: isMobile);
      case AppModuleId.passwords:
        return PasswordsPage(store: widget.store, passStore: widget.passStore, isMobile: isMobile);
      case AppModuleId.calendar:
        return CalendarPage(store: widget.store);
      case AppModuleId.shared:
        return SharedPage(store: widget.store);
      case AppModuleId.voice:
        return VoicePage(store: widget.store);
      case AppModuleId.dock:
        return DockPage(store: widget.store);
      case AppModuleId.win:
        return WinPage(store: widget.store);
      case AppModuleId.settings:
        return SettingsPage(store: widget.store, passStore: widget.passStore, isMobile: isMobile);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final store = widget.store;
    final width = MediaQuery.of(context).size.width;
    final isDesktop = _isDesktop(width);

    final shellBody = isDesktop
        ? _buildDesktopLayout(context, width, pal)
        : _buildMobileLayout(context, pal);

    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.equal, control: true): () => store.adjustUiScale(0.05),
        const SingleActivator(LogicalKeyboardKey.minus, control: true): () => store.adjustUiScale(-0.05),
        const SingleActivator(LogicalKeyboardKey.digit0, control: true): store.resetUiScale,
      },
      child: Focus(
        autofocus: true,
        child: Scaffold(
          backgroundColor: pal.bg,
          body: Column(
            children: [
              if (store.settings.statusStripPos == StatusStripPos.top)
                _buildStatusStrip(context, pal),
              Expanded(child: shellBody),
              if (store.settings.statusStripPos == StatusStripPos.bottom ||
                  (store.settings.statusStripPos == StatusStripPos.syncOnly && store.isSyncing))
                _buildStatusStrip(context, pal),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDesktopLayout(BuildContext context, double width, AppPalette pal) {
    final store = widget.store;
    final showSchedule = store.settings.showSchedulePanel &&
        (store.settings.enabledModules[AppModuleId.calendar] ?? true) &&
        width >= 980 &&
        store.activeModule != AppModuleId.calendar;

    return Column(
      children: [
        _buildAppMenuBar(context, pal),
        Expanded(
          child: Row(
            children: [
              _buildDesktopSidebar(pal),
              MouseRegion(
                cursor: SystemMouseCursors.resizeColumn,
                child: GestureDetector(
                  onHorizontalDragUpdate: (d) => setState(() {
                    _sidebarWidth = (_sidebarWidth + d.delta.dx).clamp(170.0, 420.0);
                  }),
                  child: Container(width: 4, color: pal.divider),
                ),
              ),
              Expanded(child: _buildActiveModule(false)),
              if (showSchedule) ...[
                MouseRegion(
                  cursor: SystemMouseCursors.resizeColumn,
                  child: GestureDetector(
                    onHorizontalDragUpdate: (d) => setState(() {
                      _scheduleWidth = (_scheduleWidth - d.delta.dx).clamp(240.0, 560.0);
                    }),
                    child: Container(width: 4, color: pal.divider),
                  ),
                ),
                SchedulePanel(store: store, width: _scheduleWidth),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAppMenuBar(BuildContext context, AppPalette pal) {
    final store = widget.store;
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: pal.sidebar,
        border: Border(bottom: BorderSide(color: pal.divider)),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('Свод', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: pal.text)),
          ),
          _menuPopup('Файл', [
            PopupMenuItem(onTap: () => store.createNote(), child: const Text('Новая заметка')),
            PopupMenuItem(onTap: () => store.createFolder('Новый блокнот'), child: const Text('Новый блокнот')),
            PopupMenuItem(onTap: () => store.createSafetyBackup('manual_menu'), child: const Text('Страховочная копия safety/')),
            PopupMenuItem(onTap: store.toggleSync, child: const Text('Синхронизировать')),
            PopupMenuItem(onTap: store.lockProfile, child: const Text('Заблокировать профиль')),
          ], pal),
          _menuPopup('Правка', [
            PopupMenuItem(onTap: () {}, child: const Text('Отменить (Ctrl+Z)')),
            PopupMenuItem(onTap: () {}, child: const Text('Повторить (Ctrl+Y)')),
          ], pal),
          _menuPopup('Вид', [
            PopupMenuItem(
              onTap: () => store.updateSettings((s) => s.isDark = !s.isDark),
              child: Text(store.settings.isDark ? 'Светлая тема' : 'Тёмная тема'),
            ),
            PopupMenuItem(
              onTap: () => store.adjustUiScale(0.05),
              child: const Text('Увеличить масштаб (Ctrl+)'),
            ),
            PopupMenuItem(
              onTap: () => store.adjustUiScale(-0.05),
              child: const Text('Уменьшить масштаб (Ctrl−)'),
            ),
            PopupMenuItem(
              onTap: store.resetUiScale,
              child: const Text('Сбросить масштаб (Ctrl 0)'),
            ),
            PopupMenuItem(
              onTap: () => store.updateSettings((s) => s.layoutMode = LayoutMode.mobile),
              child: const Text('Вид: телефон'),
            ),
          ], pal),
          _menuPopup('Переход', [
            PopupMenuItem(onTap: () => store.setModule(AppModuleId.notes), child: const Text('Заметки и таблицы')),
            PopupMenuItem(onTap: () => store.setModule(AppModuleId.passwords), child: const Text('Пароли')),
            PopupMenuItem(onTap: () => store.setModule(AppModuleId.calendar), child: const Text('Календарь')),
            PopupMenuItem(onTap: () => store.setModule(AppModuleId.shared), child: const Text('Общая папка')),
            PopupMenuItem(onTap: () => store.setModule(AppModuleId.settings), child: const Text('Настройки')),
          ], pal),
          _menuPopup('Блокноты', [
            PopupMenuItem(
              onTap: () {
                store.selectedFolderFilter = 'all';
                store.setModule(AppModuleId.notes);
              },
              child: const Text('Все заметки'),
            ),
            PopupMenuItem(
              onTap: () {
                store.selectedFolderFilter = 'favorites';
                store.setModule(AppModuleId.notes);
              },
              child: const Text('Избранное'),
            ),
            PopupMenuItem(
              onTap: () {
                store.selectedFolderFilter = 'trash';
                store.setModule(AppModuleId.notes);
              },
              child: const Text('Корзина'),
            ),
          ], pal),
          _menuPopup('Заметка', [
            PopupMenuItem(
              onTap: () {
                if (store.selectedNoteId != null) {
                  store.updateNote(store.selectedNoteId!, (n) {}, saveVersion: true);
                }
              },
              child: const Text('Сохранить снимок версии'),
            ),
          ], pal),
          _menuPopup('Сервис', [
            PopupMenuItem(onTap: store.toggleSync, child: const Text('Дельта-синхронизация')),
            PopupMenuItem(onTap: () => showDiagHubDialog(context, store), child: const Text('Диагностика (DiagHub)')),
          ], pal),
          _menuPopup('Помощь', [
            PopupMenuItem(
              onTap: () => showAboutDialog(
                context: context,
                applicationName: 'Свод',
                applicationVersion: '0.1.0',
                children: const [Text('Модульное зашифрованное пространство (AES-256-GCM).')],
              ),
              child: const Text('О программе'),
            ),
          ], pal),
          const Spacer(),
          Text(
            '${store.activeProfile?.name ?? ''} · ${(store.settings.uiScale * 100).round()}%',
            style: TextStyle(fontSize: 11.5, color: pal.text2),
          ),
          const SizedBox(width: 8),
        ],
      ),
    );
  }

  Widget _menuPopup(String title, List<PopupMenuEntry> items, AppPalette pal) {
    return PopupMenuButton(
      tooltip: '',
      itemBuilder: (_) => items,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(title, style: TextStyle(fontSize: 12, color: pal.text2)),
      ),
    );
  }

  Widget _buildDesktopSidebar(AppPalette pal) {
    final store = widget.store;
    final mods = [
      (AppModuleId.notes, 'Заметки и таблицы', Icons.description_outlined),
      (AppModuleId.passwords, 'Пароли', Icons.key_outlined),
      (AppModuleId.calendar, 'Календарь', Icons.calendar_today_outlined),
      (AppModuleId.shared, 'Общая папка', Icons.group_outlined),
      (AppModuleId.voice, 'Диктовка', Icons.mic_none),
      (AppModuleId.dock, 'Док', Icons.apps_outlined),
      (AppModuleId.win, 'Windows-клавиши', Icons.keyboard_outlined),
    ].where((m) => store.settings.enabledModules[m.$1] ?? true).toList();

    return Container(
      width: _sidebarWidth,
      color: pal.sidebar,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: Color(store.activeProfile?.avatarColor ?? 0xFF4F46E5),
                  child: Text(
                    (store.activeProfile?.name ?? 'С').characters.first.toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    store.activeProfile?.name ?? 'Профиль',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: pal.text),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Синхронизация',
                  icon: Icon(Icons.sync, size: 17, color: store.isSyncing ? pal.accent : pal.text2),
                  onPressed: store.toggleSync,
                ),
              ],
            ),
          ),
          const Divider(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(8),
              children: [
                if (store.settings.showNotebooksInSidebar &&
                    (store.settings.enabledModules[AppModuleId.notes] ?? true)) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Text('Блокноты', style: TextStyle(fontSize: 11, color: pal.muted)),
                  ),
                  for (final f in store.folders)
                    ListTile(
                      dense: true,
                      visualDensity: VisualDensity.compact,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      selected: store.activeModule == AppModuleId.notes && store.selectedFolderFilter == f.id,
                      selectedTileColor: pal.linkBg,
                      leading: Icon(Icons.folder_outlined, size: 16, color: pal.text2),
                      title: Text(f.name, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
                      onTap: () {
                        store.selectedFolderFilter = f.id;
                        store.setModule(AppModuleId.notes);
                      },
                    ),
                  const SizedBox(height: 10),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Text('Модули', style: TextStyle(fontSize: 11, color: pal.muted)),
                ),
                for (final m in mods)
                  ListTile(
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    selected: store.activeModule == m.$1,
                    selectedTileColor: pal.accent,
                    selectedColor: Colors.white,
                    leading: Icon(m.$3, size: 17),
                    title: Text(m.$2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                    onTap: () => store.setModule(m.$1),
                  ),
              ],
            ),
          ),
          const Divider(),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              children: [
                ListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  selected: store.activeModule == AppModuleId.settings,
                  selectedTileColor: pal.linkBg,
                  leading: const Icon(Icons.settings_outlined, size: 17),
                  title: const Text('Настройки', style: TextStyle(fontSize: 13)),
                  onTap: () => store.setModule(AppModuleId.settings),
                ),
                Row(
                  children: [
                    Expanded(
                      child: TextButton.icon(
                        onPressed: () => store.updateSettings((s) => s.isDark = !s.isDark),
                        icon: Icon(store.settings.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, size: 16),
                        label: Text(store.settings.isDark ? 'Светлая' : 'Тёмная', style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Вид: телефон',
                      icon: const Icon(Icons.smartphone, size: 17),
                      onPressed: () => store.updateSettings((s) => s.layoutMode = LayoutMode.mobile),
                    ),
                    IconButton(
                      tooltip: 'Заблокировать профиль',
                      icon: Icon(Icons.lock_outline, size: 17, color: pal.error),
                      onPressed: store.lockProfile,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileLayout(BuildContext context, AppPalette pal) {
    final store = widget.store;
    final navItems = [
      (AppModuleId.notes, 'Заметки', Icons.description_outlined),
      (AppModuleId.calendar, 'Календарь', Icons.calendar_today_outlined),
      (AppModuleId.passwords, 'Пароли', Icons.key_outlined),
      (AppModuleId.shared, 'Общее', Icons.group_outlined),
      (AppModuleId.voice, 'Голос', Icons.mic_none),
    ].where((e) => store.settings.enabledModules[e.$1] ?? true).take(5).toList();

    final currentNavIdx = navItems.indexWhere((e) => e.$1 == store.activeModule);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: pal.panel,
        surfaceTintColor: Colors.transparent,
        title: Text(_moduleTitle(store.activeModule), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            tooltip: store.isSyncing ? 'Остановить синхронизацию' : 'Синхронизация',
            icon: Icon(Icons.sync, color: store.isSyncing ? pal.accent : pal.text2),
            onPressed: store.toggleSync,
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: pal.sidebar,
        child: SafeArea(
          child: Column(
            children: [
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: Color(store.activeProfile?.avatarColor ?? 0xFF4F46E5),
                  child: Text((store.activeProfile?.name ?? 'С').characters.first.toUpperCase(),
                      style: const TextStyle(color: Colors.white)),
                ),
                title: Text(store.activeProfile?.name ?? 'Профиль'),
                subtitle: Text('@${store.activeProfile?.login ?? ''}'),
              ),
              const Divider(),
              Expanded(
                child: ListView(
                  children: [
                    for (final item in navItems)
                      ListTile(
                        leading: Icon(item.$3),
                        title: Text(item.$2),
                        selected: store.activeModule == item.$1,
                        onTap: () {
                          store.setModule(item.$1);
                          Navigator.pop(context);
                        },
                      ),
                    const Divider(),
                    ListTile(
                      leading: const Icon(Icons.star_outline),
                      title: const Text('Избранное'),
                      onTap: () {
                        store.selectedFolderFilter = 'favorites';
                        store.setModule(AppModuleId.notes);
                        Navigator.pop(context);
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.delete_outline),
                      title: const Text('Корзина'),
                      onTap: () {
                        store.selectedFolderFilter = 'trash';
                        store.setModule(AppModuleId.notes);
                        Navigator.pop(context);
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.settings_outlined),
                      title: const Text('Настройки'),
                      onTap: () {
                        store.setModule(AppModuleId.settings);
                        Navigator.pop(context);
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.desktop_windows_outlined),
                      title: const Text('Вид: компьютер'),
                      onTap: () {
                        store.updateSettings((s) => s.layoutMode = LayoutMode.desktop);
                        Navigator.pop(context);
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: _buildActiveModule(true),
      bottomNavigationBar: navItems.length >= 2
          ? NavigationBar(
              selectedIndex: currentNavIdx >= 0 ? currentNavIdx : 0,
              onDestinationSelected: (idx) => store.setModule(navItems[idx].$1),
              destinations: navItems
                  .map((e) => NavigationDestination(icon: Icon(e.$3), label: e.$2))
                  .toList(),
            )
          : null,
    );
  }

  Widget _buildStatusStrip(BuildContext context, AppPalette pal) {
    final store = widget.store;
    final passStore = widget.passStore;
    return InkWell(
      onTap: () => showDiagHubDialog(context, store),
      child: Container(
        height: 24,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: pal.sidebar,
          border: Border(
            top: BorderSide(color: pal.divider),
            bottom: BorderSide(color: pal.divider),
          ),
        ),
        child: Row(
          children: [
            Icon(
              store.isSyncing ? Icons.sync : Icons.verified_user_outlined,
              size: 13,
              color: store.isSyncing ? pal.accent : pal.success,
            ),
            const SizedBox(width: 8),
            if (store.isSyncing) ...[
              SizedBox(
                width: 90,
                child: LinearProgressIndicator(value: store.syncProgress, minHeight: 4),
              ),
              const SizedBox(width: 8),
              Text('${(store.syncProgress * 100).round()}% · ', style: TextStyle(fontSize: 11, color: pal.text)),
            ],
            Expanded(
              child: Text(
                store.syncStage,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, color: pal.text2),
              ),
            ),
            if (passStore.clipboardSecondsLeft > 0) ...[
              Text(
                'Буфер: ${passStore.clipboardSecondsLeft}с · ',
                style: TextStyle(fontSize: 11, color: pal.warn),
              ),
            ],
            if (store.isSyncing)
              Text(
                '↓${store.speedDownKbps} ↑${store.speedUpKbps} КБ/с',
                style: TextStyle(fontSize: 11, color: pal.muted),
              )
            else
              Text('Диагностика', style: TextStyle(fontSize: 11, color: pal.muted)),
          ],
        ),
      ),
    );
  }

  String _moduleTitle(AppModuleId m) {
    switch (m) {
      case AppModuleId.notes:
        return 'Заметки и таблицы';
      case AppModuleId.passwords:
        return 'Пароли';
      case AppModuleId.calendar:
        return 'Календарь';
      case AppModuleId.shared:
        return 'Общая папка';
      case AppModuleId.voice:
        return 'Диктовка';
      case AppModuleId.dock:
        return 'Док';
      case AppModuleId.win:
        return 'Windows';
      case AppModuleId.settings:
        return 'Настройки';
    }
  }
}
