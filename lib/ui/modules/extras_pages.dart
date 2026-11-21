import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/models.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';

/// Диктовка (VoicePage)
class VoicePage extends StatefulWidget {
  final Store store;
  const VoicePage({super.key, required this.store});

  @override
  State<VoicePage> createState() => _VoicePageState();
}

class _VoicePageState extends State<VoicePage> {
  final _ctrl = TextEditingController();
  bool _recording = false;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final store = widget.store;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('Диктовка (VoicePage)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: pal.text)),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ElevatedButton.icon(
                  icon: Icon(_recording ? Icons.stop : Icons.mic),
                  label: Text(_recording ? 'Остановить запись (WAV 16 кГц)' : 'Начать запись речи'),
                  onPressed: () => setState(() => _recording = !_recording),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _ctrl,
                  maxLines: 3,
                  decoration: const InputDecoration(hintText: 'Расшифровка речи (локальный Whisper или API)...'),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    ElevatedButton(
                      onPressed: () {
                        if (_ctrl.text.trim().isEmpty) return;
                        store.addVoiceEntry(_ctrl.text.trim());
                        Clipboard.setData(ClipboardData(text: _ctrl.text.trim()));
                        _ctrl.clear();
                      },
                      child: const Text('В буфер и историю'),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: () {
                        if (_ctrl.text.trim().isEmpty) return;
                        store.createNote(title: 'Диктовка', content: _ctrl.text.trim());
                        store.setModule(AppModuleId.notes);
                      },
                      child: const Text('Сохранить как заметку'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        for (final item in store.voiceHistory)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              title: Text(item['text'] ?? ''),
              subtitle: Text(item['createdAt'] ?? ''),
            ),
          ),
      ],
    );
  }
}

/// Док быстрого запуска в стиле RocketDock 1.3.5 (DockPage)
class DockPage extends StatefulWidget {
  final Store store;
  const DockPage({super.key, required this.store});

  @override
  State<DockPage> createState() => _DockPageState();
}

class _DockPageState extends State<DockPage> {
  double _iconSize = 46;
  double _opacity = 0.94;
  int? _hovered;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final items = [
      ('Заметки', Icons.description_outlined, AppModuleId.notes, const Color(0xFF4F46E5)),
      ('Календарь', Icons.calendar_today_outlined, AppModuleId.calendar, const Color(0xFF059669)),
      ('Пароли', Icons.key_outlined, AppModuleId.passwords, const Color(0xFFD97706)),
      ('Общее', Icons.group_outlined, AppModuleId.shared, const Color(0xFF0284C7)),
    ];

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('Док (RocketDock 1.3.5)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: pal.text)),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Opacity(
                opacity: _opacity,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < items.length; i++)
                      MouseRegion(
                        onEnter: (_) => setState(() => _hovered = i),
                        onExit: (_) => setState(() => _hovered = null),
                        child: GestureDetector(
                          onTap: () => widget.store.setModule(items[i].$3),
                          child: AnimatedScale(
                            duration: const Duration(milliseconds: 140),
                            scale: _hovered == i ? 1.35 : 1.0,
                            child: Container(
                              width: _iconSize,
                              height: _iconSize,
                              margin: const EdgeInsets.symmetric(horizontal: 6),
                              decoration: BoxDecoration(
                                color: items[i].$4,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(items[i].$2, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Slider(min: 36, max: 64, value: _iconSize, onChanged: (v) => setState(() => _iconSize = v)),
        Slider(min: 0.4, max: 1.0, value: _opacity, onChanged: (v) => setState(() => _opacity = v)),
      ],
    );
  }
}

/// Модуль Windows (WinPage): системное переназначение клавиш (WH_KEYBOARD_LL при подключении win32 + ffi)
class WinPage extends StatelessWidget {
  final Store store;
  const WinPage({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('Модуль Windows (WinPage)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: pal.text)),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Системное переназначение клавиш через хук WH_KEYBOARD_LL в отдельном изоляте. '
              'Для активации на Windows раскомментируйте пакеты win32 и ffi в pubspec.yaml.',
              style: TextStyle(color: pal.text2),
            ),
          ),
        ),
      ],
    );
  }
}
