import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../state/pass_store.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';

/// Настройки (разбиты на тематические папки) и DiagHub (Процессы / История / Журнал).
class SettingsPage extends StatefulWidget {
  final Store store;
  final PassStore passStore;
  final bool isMobile;

  const SettingsPage({
    super.key,
    required this.store,
    required this.passStore,
    required this.isMobile,
  });

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  String _section = 'general';

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final store = widget.store;
    final s = store.settings;

    final sections = [
      ('general', 'Основные', Icons.tune),
      ('sync', 'Синхронизация и бэкап', Icons.cloud_outlined),
      ('notes', 'Заметки', Icons.description_outlined),
      ('calendar', 'Календарь', Icons.calendar_today_outlined),
      ('shared', 'Общая папка', Icons.group_outlined),
      ('passwords', 'Пароли', Icons.key_outlined),
      ('voice', 'Голос', Icons.mic_none),
      if (!widget.isMobile) ('desktop', 'Компьютер', Icons.desktop_windows_outlined),
      ('debug', 'Отладка', Icons.bug_report_outlined),
    ];

    return Row(
      children: [
        Container(
          width: 215,
          decoration: BoxDecoration(
            color: pal.sidebar,
            border: Border(right: BorderSide(color: pal.divider)),
          ),
          child: ListView(
            padding: const EdgeInsets.all(8),
            children: [
              for (final item in sections)
                ListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  selected: _section == item.$1,
                  selectedTileColor: pal.linkBg,
                  leading: Icon(item.$3, size: 17),
                  title: Text(item.$2, style: const TextStyle(fontSize: 12.5)),
                  onTap: () => setState(() => _section = item.$1),
                ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (_section == 'general') ...[
                Text('Основные настройки', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: pal.text)),
                const SizedBox(height: 16),
                SwitchListTile(
                  title: const Text('Тёмная тема'),
                  value: s.isDark,
                  onChanged: (v) => store.updateSettings((cfg) => cfg.isDark = v),
                ),
                ListTile(
                  title: Text('Масштаб интерфейса (uiScale): ${(s.uiScale * 100).round()}%'),
                  subtitle: Slider(
                    min: 0.8,
                    max: 1.6,
                    divisions: 16,
                    value: s.uiScale,
                    onChanged: (v) => store.updateSettings((cfg) => cfg.uiScale = v),
                  ),
                ),
                ListTile(
                  title: Text('Масштаб текста (fontScale): ${(s.fontScale * 100).round()}%'),
                  subtitle: Slider(
                    min: 0.8,
                    max: 1.6,
                    divisions: 16,
                    value: s.fontScale,
                    onChanged: (v) => store.updateSettings((cfg) => cfg.fontScale = v),
                  ),
                ),
                const Divider(),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text('Активные модули', style: TextStyle(fontWeight: FontWeight.w600, color: pal.text)),
                ),
                for (final m in AppModuleId.values.where((e) => e != AppModuleId.settings))
                  SwitchListTile(
                    dense: true,
                    title: Text(m.name),
                    value: s.enabledModules[m] ?? true,
                    onChanged: (_) => store.toggleModule(m),
                  ),
              ] else if (_section == 'sync') ...[
                Text('Синхронизация и бэкапы', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: pal.text)),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: s.syncEndpoint,
                  decoration: const InputDecoration(labelText: 'WebDAV / Google Диск / папка'),
                  onChanged: (v) => store.updateSettings((cfg) => cfg.syncEndpoint = v),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  children: [
                    ElevatedButton(onPressed: store.toggleSync, child: const Text('Синхронизировать сейчас')),
                    OutlinedButton(
                      onPressed: () => store.createSafetyBackup('manual_settings'),
                      child: const Text('Создать страховочную копию safety/'),
                    ),
                  ],
                ),
              ] else if (_section == 'debug') ...[
                Text('Отладка и DiagHub', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: pal.text)),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: ElevatedButton(
                    onPressed: () => showDiagHubDialog(context, store),
                    child: const Text('Открыть DiagHub'),
                  ),
                ),
              ] else ...[
                Text('Раздел «$_section»', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: pal.text)),
                const SizedBox(height: 10),
                SwitchListTile(
                  title: const Text('Показывать блокноты в сайдбаре'),
                  value: s.showNotebooksInSidebar,
                  onChanged: (v) => store.updateSettings((cfg) => cfg.showNotebooksInSidebar = v),
                ),
                SwitchListTile(
                  title: const Text('Показывать правую панель расписания'),
                  value: s.showSchedulePanel,
                  onChanged: (v) => store.updateSettings((cfg) => cfg.showSchedulePanel = v),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

void showDiagHubDialog(BuildContext context, Store store) {
  showDialog(
    context: context,
    builder: (ctx) => DefaultTabController(
      length: 3,
      child: AlertDialog(
        title: const Text('Диагностика (DiagHub)'),
        content: SizedBox(
          width: 560,
          height: 380,
          child: Column(
            children: [
              const TabBar(
                tabs: [
                  Tab(text: 'Процессы'),
                  Tab(text: 'История'),
                  Tab(text: 'Журнал'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    ListView(
                      children: [
                        for (final p in store.diagProcesses)
                          ListTile(
                            dense: true,
                            title: Text(p['op'] ?? ''),
                            subtitle: Text(p['detail'] ?? ''),
                            trailing: Text((p['time'] ?? '').substring(11, 19)),
                          ),
                      ],
                    ),
                    ListView(
                      children: [
                        for (final h in store.syncHistory)
                          ListTile(
                            dense: true,
                            title: Text(h['target'] ?? ''),
                            subtitle: Text(h['summary'] ?? ''),
                          ),
                      ],
                    ),
                    ListView(
                      children: [
                        for (final l in store.diagLogs)
                          ListTile(
                            dense: true,
                            title: Text('[${l['source']}] ${l['message']}'),
                            subtitle: Text('${l['level']} · ${l['time']}'),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Закрыть')),
        ],
      ),
    ),
  );
}
