import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { formatIsoDate } from '../../data/seed';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

type ScheduleMode = 'timeline' | 'day' | 'week';

export const SchedulePanel: React.FC<{ width: number }> = ({ width }) => {
  const {
    calendars,
    events,
    calendarSelectedDate,
    setCalendarSelectedDate,
    setCalendarView,
    setActiveModule,
    addCalendarEvent,
    pushToast,
  } = useAppStore();

  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    const d = new Date(calendarSelectedDate + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('timeline');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickTime, setQuickTime] = useState('15:00');
  const [addingQuick, setAddingQuick] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const t = window.setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);

  const visibleCalIds = useMemo(
    () => new Set(calendars.filter((c) => c.visible).map((c) => c.id)),
    [calendars]
  );
  const calColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    calendars.forEach((c) => (m[c.id] = c.color));
    return m;
  }, [calendars]);

  const visibleEvents = useMemo(
    () => events.filter((e) => visibleCalIds.has(e.calendarId)),
    [events, visibleCalIds]
  );

  const eventDatesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const ev of visibleEvents) {
      if (!map[ev.date]) map[ev.date] = [];
      const col = calColorMap[ev.calendarId] || '#4F46E5';
      if (!map[ev.date].includes(col)) map[ev.date].push(col);
    }
    return map;
  }, [visibleEvents, calColorMap]);

  const monthCells = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { dateStr: string; day: number; inMonth: boolean }[] = [];

    const prevDays = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevDays - i);
      cells.push({ dateStr: formatIsoDate(d), day: d.getDate(), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({ dateStr: formatIsoDate(d), day, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const idx = cells.length - (startWeekday + daysInMonth) + 1;
      const d = new Date(year, month + 1, idx);
      cells.push({ dateStr: formatIsoDate(d), day: d.getDate(), inMonth: false });
    }
    return cells;
  }, [displayMonth]);

  const todayStr = formatIsoDate(new Date());

  const dayEvents = useMemo(
    () =>
      visibleEvents
        .filter((e) => e.date === calendarSelectedDate)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [visibleEvents, calendarSelectedDate]
  );

  const weekEvents = useMemo(() => {
    const base = new Date(calendarSelectedDate + 'T00:00:00');
    const start = new Date(base);
    const wd = (base.getDay() + 6) % 7;
    start.setDate(base.getDate() - wd);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sStr = formatIsoDate(start);
    const eStr = formatIsoDate(end);
    return visibleEvents
      .filter((e) => e.date >= sStr && e.date <= eStr)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
  }, [visibleEvents, calendarSelectedDate]);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const [hh, mm] = quickTime.split(':').map(Number);
    const endH = String(Math.min(23, (hh || 9) + 1)).padStart(2, '0');
    addCalendarEvent({
      calendarId: calendars[0]?.id || 'cal-work',
      title: quickTitle.trim(),
      date: calendarSelectedDate,
      startTime: quickTime,
      endTime: `${endH}:${String(mm || 0).padStart(2, '0')}`,
      reminderMinutes: 15,
    });
    setQuickTitle('');
    setAddingQuick(false);
    pushToast('Событие добавлено в расписание', 'success');
  };

  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 - 22:00
  const HOUR_HEIGHT = 44;

  const parseMinutes = (t: string) => {
    const [h, m] = (t || '09:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  return (
    <aside
      style={{ width }}
      className="h-full flex flex-col bg-[var(--sidebar)] select-none shrink-0 overflow-hidden"
    >
      {/* Top: Mini Month Calendar */}
      <div className="p-3 border-b border-[var(--divider)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-[var(--text)]">
            {MONTHS[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() =>
                setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))
              }
              className="p-1 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))
              }
              className="p-1 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center mb-1">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-[10.5px] font-medium text-[var(--muted)] py-0.5">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {monthCells.map((c) => {
            const isSelected = c.dateStr === calendarSelectedDate;
            const isToday = c.dateStr === todayStr;
            const dots = eventDatesMap[c.dateStr] || [];
            return (
              <button
                key={c.dateStr}
                type="button"
                onClick={() => setCalendarSelectedDate(c.dateStr)}
                className={`h-7 rounded-[6px] flex flex-col items-center justify-center text-[11.5px] tabular-nums transition-colors ${
                  isSelected
                    ? 'bg-[var(--accent)] text-white font-semibold'
                    : isToday
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                    : c.inMonth
                    ? 'text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                    : 'text-[var(--muted)] opacity-55 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>{c.day}</span>
                {dots.length > 0 && (
                  <span className="flex items-center gap-0.5 mt-0.5">
                    {dots.slice(0, 3).map((col, i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isSelected ? '#ffffff' : col }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View jump buttons: Сегодня / Неделя / Месяц / Год */}
        <div className="grid grid-cols-4 gap-1 mt-2.5 pt-2 border-t border-[var(--divider)]">
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setCalendarSelectedDate(formatIsoDate(t));
              setDisplayMonth(new Date(t.getFullYear(), t.getMonth(), 1));
            }}
            className="py-1 rounded-[6px] text-[11px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => {
              setCalendarView('week');
              setActiveModule('calendar');
            }}
            className="py-1 rounded-[6px] text-[11px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
          >
            Неделя
          </button>
          <button
            type="button"
            onClick={() => {
              setCalendarView('month');
              setActiveModule('calendar');
            }}
            className="py-1 rounded-[6px] text-[11px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
          >
            Месяц
          </button>
          <button
            type="button"
            onClick={() => {
              setCalendarView('year');
              setActiveModule('calendar');
            }}
            className="py-1 rounded-[6px] text-[11px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
          >
            Год
          </button>
        </div>
      </div>

      {/* Bottom: Schedule Header & Switcher */}
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-[var(--text)]">Расписание</div>
          <div className="text-[11px] text-[var(--text2)] tabular-nums truncate">
            {new Date(calendarSelectedDate + 'T00:00:00').toLocaleDateString('ru-RU', {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAddingQuick((v) => !v)}
          title="Добавить событие"
          className="p-1.5 rounded-[7px] bg-[var(--panel)] border border-[var(--divider)] text-[var(--text2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="grid grid-cols-3 p-0.5 rounded-[8px] bg-black/5 dark:bg-white/5 text-[11.5px]">
          {(
            [
              { id: 'timeline', label: 'Таймлайн' },
              { id: 'day', label: 'День' },
              { id: 'week', label: 'Неделя' },
            ] as { id: ScheduleMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScheduleMode(tab.id)}
              className={`py-1 rounded-[6px] font-medium transition-colors whitespace-nowrap ${
                scheduleMode === tab.id
                  ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {addingQuick && (
        <form onSubmit={handleQuickAdd} className="mx-3 mb-2 p-2.5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-2">
          <input
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Название события..."
            className="w-full px-2 py-1 text-[12.5px] rounded-[6px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={quickTime}
              onChange={(e) => setQuickTime(e.target.value)}
              className="px-2 py-1 text-[12px] font-mono-tabular rounded-[6px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
            />
            <button
              type="submit"
              className="flex-1 py-1 rounded-[6px] bg-[var(--accent)] text-white text-[12px] font-medium hover:bg-[var(--accent-hover)]"
            >
              Добавить
            </button>
          </div>
        </form>
      )}

      {/* Schedule Body */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {scheduleMode === 'timeline' && (
          <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
            {hours.map((h, idx) => (
              <div
                key={h}
                style={{ top: idx * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                className="absolute left-0 right-0 flex items-start border-t border-[var(--divider)]/70"
              >
                <span className="w-10 text-[10.5px] font-mono-tabular text-[var(--muted)] -mt-1.5 pr-1.5 text-right shrink-0">
                  {String(h).padStart(2, '0')}:00
                </span>
                <div className="flex-1" />
              </div>
            ))}

            {/* Current time red line */}
            {calendarSelectedDate === todayStr &&
              nowMinutes >= 7 * 60 &&
              nowMinutes <= 23 * 60 && (
                <div
                  style={{ top: ((nowMinutes - 7 * 60) / 60) * HOUR_HEIGHT }}
                  className="absolute left-9 right-0 flex items-center z-20 pointer-events-none"
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--error)] -ml-1 shrink-0" />
                  <div className="flex-1 h-[1.5px] bg-[var(--error)]" />
                </div>
              )}

            {/* Events positioned on timeline */}
            {dayEvents.map((ev) => {
              const startM = Math.max(7 * 60, parseMinutes(ev.startTime));
              const endM = Math.max(startM + 30, parseMinutes(ev.endTime));
              const top = ((startM - 7 * 60) / 60) * HOUR_HEIGHT;
              const height = Math.max(26, ((endM - startM) / 60) * HOUR_HEIGHT);
              const color = calColorMap[ev.calendarId] || '#4F46E5';
              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    setCalendarView('day');
                    setActiveModule('calendar');
                  }}
                  style={{
                    top,
                    height,
                    backgroundColor: `${color}18`,
                    borderColor: `${color}55`,
                  }}
                  className="absolute left-11 right-0.5 rounded-[7px] border px-2 py-1 overflow-hidden cursor-pointer hover:brightness-95 transition"
                >
                  <div className="text-[11.5px] font-medium text-[var(--text)] truncate leading-tight">
                    {ev.title}
                  </div>
                  <div className="text-[10px] font-mono-tabular text-[var(--text2)]">
                    {ev.startTime}–{ev.endTime}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {scheduleMode === 'day' && (
          <div className="space-y-1.5">
            {dayEvents.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[var(--muted)]">
                На выбранный день событий нет
              </div>
            ) : (
              dayEvents.map((ev) => {
                const color = calColorMap[ev.calendarId] || '#4F46E5';
                return (
                  <div
                    key={ev.id}
                    onClick={() => {
                      setCalendarView('day');
                      setActiveModule('calendar');
                    }}
                    className="p-2.5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] cursor-pointer hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[11px] font-mono-tabular text-[var(--text2)]">
                        {ev.allDay ? 'Весь день' : `${ev.startTime} – ${ev.endTime}`}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    </div>
                    <div className="text-[12.5px] font-medium text-[var(--text)]">{ev.title}</div>
                    {ev.location && (
                      <div className="text-[11px] text-[var(--muted)] truncate mt-0.5">{ev.location}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {scheduleMode === 'week' && (
          <div className="space-y-1.5">
            {weekEvents.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[var(--muted)]">
                На этой неделе событий нет
              </div>
            ) : (
              weekEvents.map((ev) => {
                const color = calColorMap[ev.calendarId] || '#4F46E5';
                return (
                  <div
                    key={ev.id}
                    onClick={() => {
                      setCalendarSelectedDate(ev.date);
                      setCalendarView('week');
                      setActiveModule('calendar');
                    }}
                    className="p-2.5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] cursor-pointer hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--text2)] mb-0.5">
                      <span className="tabular-nums">
                        {new Date(ev.date + 'T00:00:00').toLocaleDateString('ru-RU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                        {' · '}
                        {ev.startTime}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    </div>
                    <div className="text-[12.5px] font-medium text-[var(--text)] truncate">{ev.title}</div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
