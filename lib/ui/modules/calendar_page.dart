import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';

/// Модуль «Календарь и напоминания»:
/// Виды День / Неделя / Месяц / Год / Предстоящие, локальные календари с цветами,
/// двойной клик по дню создаёт событие.
class CalendarPage extends StatefulWidget {
  final Store store;
  const CalendarPage({super.key, required this.store});

  @override
  State<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends State<CalendarPage> {
  static const _weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  String _fmt(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final store = widget.store;
    final selected = DateTime.tryParse(store.selectedCalendarDate) ?? DateTime.now();
    final visibleIds = store.calendars.where((c) => c.visible).map((c) => c.id).toSet();
    final visibleEvents = store.events.where((e) => visibleIds.contains(e.calendarId)).toList();
    final calColor = {for (final c in store.calendars) c.id: Color(c.colorHex)};

    return Row(
      children: [
        if (MediaQuery.of(context).size.width >= 760)
          Container(
            width: 205,
            decoration: BoxDecoration(
              color: pal.sidebar,
              border: Border(right: BorderSide(color: pal.divider)),
            ),
            child: ListView(
              padding: const EdgeInsets.all(10),
              children: [
                Text('Календари', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: pal.text)),
                const SizedBox(height: 8),
                for (final c in store.calendars)
                  CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: c.visible,
                    title: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(color: Color(c.colorHex), shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(c.name, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5))),
                      ],
                    ),
                    onChanged: (_) => store.toggleCalendarVisible(c.id),
                  ),
              ],
            ),
          ),
        Expanded(
          child: Container(
            color: pal.panel,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      OutlinedButton(
                        onPressed: () => store.setSelectedCalendarDate(_fmt(DateTime.now())),
                        child: const Text('Сегодня'),
                      ),
                      SegmentedButton<String>(
                        showSelectedIcon: false,
                        segments: const [
                          ButtonSegment(value: 'day', label: Text('День')),
                          ButtonSegment(value: 'week', label: Text('Неделя')),
                          ButtonSegment(value: 'month', label: Text('Месяц')),
                          ButtonSegment(value: 'upcoming', label: Text('Список')),
                        ],
                        selected: {store.calendarViewMode == 'year' ? 'month' : store.calendarViewMode},
                        onSelectionChanged: (s) => store.setCalendarViewMode(s.first),
                      ),
                      ElevatedButton.icon(
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Событие'),
                        onPressed: () => _openAddEventDialog(context, store.selectedCalendarDate),
                      ),
                    ],
                  ),
                ),
                const Divider(),
                Expanded(
                  child: store.calendarViewMode == 'month'
                      ? _buildMonthGrid(selected, visibleEvents, calColor, pal)
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: visibleEvents.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final ev = visibleEvents[i];
                            final col = calColor[ev.calendarId] ?? pal.accent;
                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: pal.bg,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: pal.divider),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 10,
                                    height: 10,
                                    decoration: BoxDecoration(color: col, shape: BoxShape.circle),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('${ev.date} · ${ev.startTime}–${ev.endTime}',
                                            style: TextStyle(fontSize: 11.5, color: pal.text2)),
                                        Text(ev.title, style: TextStyle(fontWeight: FontWeight.w600, color: pal.text)),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: Icon(Icons.delete_outline, size: 17, color: pal.muted),
                                    onPressed: () => store.deleteEvent(ev.id),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMonthGrid(
    DateTime selected,
    List<CalendarEvent> events,
    Map<String, Color> calColor,
    AppPalette pal,
  ) {
    final first = DateTime(selected.year, selected.month, 1);
    final startWd = (first.weekday + 6) % 7;
    final daysInMonth = DateTime(selected.year, selected.month + 1, 0).day;
    final cells = <DateTime?>[
      for (var i = 0; i < startWd; i++) null,
      for (var d = 1; d <= daysInMonth; d++) DateTime(selected.year, selected.month, d),
    ];

    return Column(
      children: [
        Row(
          children: _weekdays
              .map((w) => Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      color: pal.sidebar,
                      child: Center(child: Text(w, style: TextStyle(fontSize: 12, color: pal.text2))),
                    ),
                  ))
              .toList(),
        ),
        Expanded(
          child: GridView.builder(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1.25,
            ),
            itemCount: cells.length,
            itemBuilder: (_, idx) {
              final dt = cells[idx];
              if (dt == null) return Container(decoration: BoxDecoration(border: Border.all(color: pal.divider, width: 0.5)));
              final dStr = _fmt(dt);
              final dayEvs = events.where((e) => e.date == dStr).toList();
              return GestureDetector(
                onTap: () => widget.store.setSelectedCalendarDate(dStr),
                onDoubleTap: () => _openAddEventDialog(context, dStr),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: dStr == widget.store.selectedCalendarDate ? pal.linkBg : pal.panel,
                    border: Border.all(color: pal.divider, width: 0.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${dt.day}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: pal.text)),
                      const SizedBox(height: 3),
                      for (final ev in dayEvs.take(2))
                        Container(
                          margin: const EdgeInsets.only(bottom: 2),
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: (calColor[ev.calendarId] ?? pal.accent).withOpacity(0.16),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${ev.startTime} ${ev.title}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 10.5, color: pal.text),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _openAddEventDialog(BuildContext context, String dateStr) async {
    final titleCtrl = TextEditingController();
    final startCtrl = TextEditingController(text: '10:00');
    final endCtrl = TextEditingController(text: '11:00');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Новое событие ($dateStr)'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: titleCtrl, autofocus: true, decoration: const InputDecoration(labelText: 'Название')),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: TextField(controller: startCtrl, decoration: const InputDecoration(labelText: 'Начало'))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: endCtrl, decoration: const InputDecoration(labelText: 'Конец'))),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Добавить')),
        ],
      ),
    );
    if (ok == true && titleCtrl.text.trim().isNotEmpty) {
      widget.store.addEvent(
        CalendarEvent(
          id: 'ev-${DateTime.now().millisecondsSinceEpoch}',
          calendarId: widget.store.calendars.first.id,
          title: titleCtrl.text.trim(),
          date: dateStr,
          startTime: startCtrl.text.trim(),
          endTime: endCtrl.text.trim(),
        ),
      );
    }
  }
}
