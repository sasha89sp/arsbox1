import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';

/// Модуль «Общая папка и чат»:
/// Группы с отдельным ключом шифрования, чат с конвертацией в заметку или событие, общие заметки.
class SharedPage extends StatefulWidget {
  final Store store;
  const SharedPage({super.key, required this.store});

  @override
  State<SharedPage> createState() => _SharedPageState();
}

class _SharedPageState extends State<SharedPage> {
  final _msgCtrl = TextEditingController();
  int _tabIdx = 0;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final store = widget.store;
    if (store.sharedGroups.isEmpty) {
      return Center(child: Text('Общих групп пока нет', style: TextStyle(color: pal.text2)));
    }
    final group = store.sharedGroups.first;

    return Container(
      color: pal.panel,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: pal.sidebar,
              border: Border(bottom: BorderSide(color: pal.divider)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(group.name, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: pal.text)),
                      Text('Ключ: ${group.keyFingerprint}', style: TextStyle(fontSize: 11, color: pal.text2)),
                    ],
                  ),
                ),
                SegmentedButton<int>(
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment(value: 0, label: Text('Чат')),
                    ButtonSegment(value: 1, label: Text('Заметки')),
                    ButtonSegment(value: 2, label: Text('Участники')),
                  ],
                  selected: {_tabIdx},
                  onSelectionChanged: (s) => setState(() => _tabIdx = s.first),
                ),
              ],
            ),
          ),
          Expanded(
            child: _tabIdx == 0
                ? Column(
                    children: [
                      Expanded(
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: group.messages.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final m = group.messages[i];
                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: pal.bg,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: pal.divider),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(m['author'] ?? '', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: pal.text)),
                                  const SizedBox(height: 4),
                                  Text(m['text'] ?? '', style: TextStyle(color: pal.text)),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      TextButton(
                                        onPressed: () {
                                          store.createNote(title: 'Из чата: ${group.name}', content: m['text'] ?? '');
                                          store.setModule(AppModuleId.notes);
                                        },
                                        child: const Text('В заметку', style: TextStyle(fontSize: 11.5)),
                                      ),
                                      TextButton(
                                        onPressed: () {
                                          final today = DateTime.now().toIso8601String().substring(0, 10);
                                          store.addEvent(
                                            CalendarEvent(
                                              id: 'ev-${DateTime.now().millisecondsSinceEpoch}',
                                              calendarId: store.calendars.first.id,
                                              title: (m['text'] ?? 'Событие').split('\n').first,
                                              date: today,
                                            ),
                                          );
                                          store.setModule(AppModuleId.calendar);
                                        },
                                        child: const Text('В календарь', style: TextStyle(fontSize: 11.5)),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _msgCtrl,
                                decoration: const InputDecoration(hintText: 'Зашифрованное сообщение...'),
                                onSubmitted: (_) => _send(group.id),
                              ),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton(onPressed: () => _send(group.id), child: const Text('Отправить')),
                          ],
                        ),
                      ),
                    ],
                  )
                : _tabIdx == 1
                    ? ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          for (final d in group.docs)
                            Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${d['title']}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                    const SizedBox(height: 6),
                                    Text('${d['content']}'),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          for (final mem in group.members)
                            ListTile(
                              title: Text(mem['name'] ?? ''),
                              subtitle: Text('Онлайн: ${mem['lastOnline']}'),
                              trailing: Text(mem['role'] ?? ''),
                            ),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  void _send(String groupId) {
    if (_msgCtrl.text.trim().isEmpty) return;
    widget.store.sendSharedMessage(groupId, _msgCtrl.text.trim());
    _msgCtrl.clear();
  }
}
