import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';

/// Правая колонка в стиле NotePlan (ширина 240–560 px при ширине окна >= 980 px):
/// Сверху мини-календарь месяца с точками событий и кнопками видов,
/// снизу «Расписание» (таймлайн с красной линией текущего времени / список дня / список недели).
class SchedulePanel extends StatefulWidget {
  final Store store;
  final double width;

  const SchedulePanel({super.key, required this.store, required this.width});

  @override
  State<SchedulePanel> createState() => _SchedulePanelState();
}

class _SchedulePanelState extends State<SchedulePanel> {
  late DateTime _month;
  String _mode = 'timeline'; // timeline | day | week

  static const _weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  static const _months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month, 1);
  }

  String _fmt(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final store = widget.store;
    final visibleCalIds = store.calendars.where((c) => c.visible).map((c) => c.id).toSet();
    final visibleEvents = store.events.where((e) => visibleCalIds.contains(e.calendarId)).toList();
    final calColor = {for (final c in store.calendars) c.id: Color(c.colorHex)};
    final todayStr = _fmt(DateTime.now());

    final firstDay = DateTime(_month.year, _month.month, 1);
    final startWd = (firstDay.weekday + 6) % 7;
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final cells = <DateTime?>[
      for (var i = 0; i < startWd; i++) null,
      for (var d = 1; d <= daysInMonth; d++) DateTime(_month.year, _month.month, d),
    ];

    final dayEvents = visibleEvents
        .where((e) => e.date == store.selectedCalendarDate)
        .toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));

    return Container(
      width: widget.width,
      color: pal.sidebar,
      child: Column(
        children: [
          // Mini month calendar
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${_months[_month.month - 1]} ${_month.year}',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: pal.text),
                      ),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: Icon(Icons.chevron_left, size: 18, color: pal.text2),
                      onPressed: () => setState(() => _month = DateTime(_month.year, _month.month - 1, 1)),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: Icon(Icons.chevron_right, size: 18, color: pal.text2),
                      onPressed: () => setState(() => _month = DateTime(_month.year, _month.month + 1, 1)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: _weekdays
                      .map((w) => Expanded(
                            child: Center(
                              child: Text(w, style: TextStyle(fontSize: 10.5, color: pal.muted)),
                            ),
                          ))
                      .toList(),
                ),
                const SizedBox(height: 4),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    mainAxisExtent: 28,
                  ),
                  itemCount: cells.length,
                  itemBuilder: (_, idx) {
                    final dt = cells[idx];
                    if (dt == null) return const SizedBox.shrink();
                    final dStr = _fmt(dt);
                    final isSel = dStr == store.selectedCalendarDate;
                    final isToday = dStr == todayStr;
                    final hasEv = visibleEvents.any((e) => e.date == dStr);
                    return InkWell(
                      borderRadius: BorderRadius.circular(6),
                      onTap: () => store.setSelectedCalendarDate(dStr),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSel
                              ? pal.accent
                              : isToday
                                  ? pal.linkBg
                                  : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '${dt.day}',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: isSel || isToday ? FontWeight.w600 : FontWeight.normal,
                                color: isSel ? Colors.white : (isToday ? pal.accent : pal.text),
                              ),
                            ),
                            if (hasEv)
                              Container(
                                width: 4,
                                height: 4,
                                margin: const EdgeInsets.only(top: 1),
                                decoration: BoxDecoration(
                                  color: isSel ? Colors.white : pal.accent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _viewBtn('Сегодня', () {
                      final now = DateTime.now();
                      setState(() => _month = DateTime(now.year, now.month, 1));
                      store.setSelectedCalendarDate(_fmt(now));
                    }, pal),
                    _viewBtn('Неделя', () {
                      store.calendarViewMode = 'week';
                      store.setModule(AppModuleId.calendar);
                    }, pal),
                    _viewBtn('Месяц', () {
                      store.calendarViewMode = 'month';
                      store.setModule(AppModuleId.calendar);
                    }, pal),
                    _viewBtn('Год', () {
                      store.calendarViewMode = 'year';
                      store.setModule(AppModuleId.calendar);
                    }, pal),
                  ],
                ),
              ],
            ),
          ),
          const Divider(),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Расписание · ${store.selectedCalendarDate}',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: pal.text),
                  ),
                ),
                SegmentedButton<String>(
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    textStyle: const TextStyle(fontSize: 11),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                  ),
                  segments: const [
                    ButtonSegment(value: 'timeline', label: Text('Часы')),
                    ButtonSegment(value: 'day', label: Text('День')),
                    ButtonSegment(value: 'week', label: Text('Нед')),
                  ],
                  selected: {_mode},
                  onSelectionChanged: (s) => setState(() => _mode = s.first),
                ),
              ],
            ),
          ),
          Expanded(
            child: _mode == 'timeline'
                ? _buildTimeline(dayEvents, calColor, pal, store.selectedCalendarDate == todayStr)
                : ListView.separated(
                    padding: const EdgeInsets.all(10),
                    itemCount: _mode == 'day' ? dayEvents.length : visibleEvents.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (_, i) {
                      final ev = _mode == 'day' ? dayEvents[i] : visibleEvents[i];
                      final color = calColor[ev.calendarId] ?? pal.accent;
                      return Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: pal.panel,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: pal.divider),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  '${ev.date} · ${ev.startTime}–${ev.endTime}',
                                  style: TextStyle(fontSize: 11, color: pal.text2),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(ev.title, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: pal.text)),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _viewBtn(String label, VoidCallback onTap, AppPalette pal) {
    return InkWell(
      borderRadius: BorderRadius.circular(6),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Text(label, style: TextStyle(fontSize: 11.5, color: pal.text2)),
      ),
    );
  }

  Widget _buildTimeline(
    List<CalendarEvent> dayEvents,
    Map<String, Color> calColor,
    AppPalette pal,
    bool isToday,
  ) {
    const startHour = 7;
    const hourCount = 16;
    const hourHeight = 44.0;
    final now = DateTime.now();
    final nowMin = now.hour * 60 + now.minute;

    int parseMin(String t) {
      final parts = t.split(':');
      return (int.tryParse(parts.first) ?? 9) * 60 + (parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(10, 4, 10, 14),
      child: SizedBox(
        height: hourCount * hourHeight,
        child: Stack(
          children: [
            for (var i = 0; i < hourCount; i++)
              Positioned(
                top: i * hourHeight,
                left: 0,
                right: 0,
                child: Row(
                  children: [
                    SizedBox(
                      width: 38,
                      child: Text(
                        '${(startHour + i).toString().padLeft(2, '0')}:00',
                        style: TextStyle(fontSize: 10.5, color: pal.muted),
                      ),
                    ),
                    Expanded(child: Divider(color: pal.divider)),
                  ],
                ),
              ),
            if (isToday && nowMin >= startHour * 60 && nowMin <= (startHour + hourCount) * 60)
              Positioned(
                top: ((nowMin - startHour * 60) / 60.0) * hourHeight,
                left: 34,
                right: 0,
                child: Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(color: pal.error, shape: BoxShape.circle),
                    ),
                    Expanded(child: Container(height: 1.5, color: pal.error)),
                  ],
                ),
              ),
            for (final ev in dayEvents)
              Positioned(
                top: ((parseMin(ev.startTime).clamp(startHour * 60, 22 * 60) - startHour * 60) / 60.0) *
                    hourHeight,
                left: 44,
                right: 2,
                height: (((parseMin(ev.endTime) - parseMin(ev.startTime)).clamp(30, 360)) / 60.0) *
                    hourHeight,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (calColor[ev.calendarId] ?? pal.accent).withOpacity(0.14),
                    border: Border.all(color: (calColor[ev.calendarId] ?? pal.accent).withOpacity(0.5)),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ev.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: pal.text),
                      ),
                      Text(
                        '${ev.startTime}–${ev.endTime}',
                        style: TextStyle(fontSize: 10, color: pal.text2),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
