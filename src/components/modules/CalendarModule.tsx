import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { CalendarEvent, CalendarViewType } from '../../types';
import { addDays, formatIsoDate } from '../../data/seed';
import { exportEventsToIcs, parseIcsEvents } from '../../lib/ics';

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
const CAL_COLORS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#0284C7', '#7C3AED'];

export const CalendarModule: React.FC = () => {
  const {
    calendars,
    events,
    calendarSelectedDate,
    setCalendarSelectedDate,
    calendarView,
    setCalendarView,
    addCalendarSource,
    toggleCalendarVisibility,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    pushToast,
    isMobileView,
  } = useAppStore();

  const [modalEvent, setModalEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [addingCal, setAddingCal] = useState(false);
  const [newCalName, setNewCalName] = useState('');
  const [newCalColor, setNewCalColor] = useState(CAL_COLORS[0]);
  const [newCalIcal, setNewCalIcal] = useState('');
  const icsInputRef = useRef<HTMLInputElement>(null);

  const selectedDateObj = useMemo(
    () => new Date(calendarSelectedDate + 'T00:00:00'),
    [calendarSelectedDate]
  );

  const visibleCalIds = useMemo(
    () => new Set(calendars.filter((c) => c.visible).map((c) => c.id)),
    [calendars]
  );
  const calMap = useMemo(() => {
    const m: Record<string, (typeof calendars)[number]> = {};
    calendars.forEach((c) => (m[c.id] = c));
    return m;
  }, [calendars]);

  const visibleEvents = useMemo(
    () => events.filter((e) => visibleCalIds.has(e.calendarId)),
    [events, visibleCalIds]
  );

  const navigateStep = (dir: -1 | 1) => {
    const d = new Date(selectedDateObj);
    if (calendarView === 'day') d.setDate(d.getDate() + dir);
    else if (calendarView === 'week') d.setDate(d.getDate() + dir * 7);
    else if (calendarView === 'month') d.setMonth(d.getMonth() + dir);
    else if (calendarView === 'year') d.setFullYear(d.getFullYear() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCalendarSelectedDate(formatIsoDate(d));
  };

  const openNewEventModal = (dateStr: string, startTime = '10:00') => {
    setModalEvent({
      calendarId: calendars[0]?.id || 'cal-work',
      title: '',
      date: dateStr,
      startTime,
      endTime: `${String(Math.min(23, Number(startTime.slice(0, 2)) + 1)).padStart(2, '0')}:00`,
      allDay: false,
      location: '',
      description: '',
      reminderMinutes: 15,
    });
  };

  const saveModalEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEvent?.title?.trim() || !modalEvent.date) return;
    if (modalEvent.id) {
      updateCalendarEvent(modalEvent.id, modalEvent);
      pushToast('Событие обновлено', 'success');
    } else {
      addCalendarEvent({
        calendarId: modalEvent.calendarId || calendars[0]?.id || 'cal-work',
        title: modalEvent.title.trim(),
        date: modalEvent.date,
        startTime: modalEvent.startTime || '09:00',
        endTime: modalEvent.endTime || '10:00',
        allDay: modalEvent.allDay,
        location: modalEvent.location,
        description: modalEvent.description,
        reminderMinutes: modalEvent.reminderMinutes ?? 15,
      });
      pushToast('Событие создано', 'success');
    }
    setModalEvent(null);
  };

  const handleExportIcs = () => {
    const ics = exportEventsToIcs(visibleEvents);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svod-calendar-${calendarSelectedDate}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Экспорт календаря в .ics выполнен', 'success');
  };

  const handleImportIcs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseIcsEvents(text, calendars[0]?.id || 'cal-work');
    parsed.forEach((ev) => {
      const { id: _ignore, ...rest } = ev;
      addCalendarEvent(rest);
    });
    pushToast(`Импортировано событий из .ics: ${parsed.length}`, 'success');
    e.target.value = '';
  };

  // Month grid cells
  const monthGrid = useMemo(() => {
    const y = selectedDateObj.getFullYear();
    const m = selectedDateObj.getMonth();
    const first = new Date(y, m, 1);
    const startWd = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { dateStr: string; day: number; inMonth: boolean }[] = [];
    const prevDays = new Date(y, m, 0).getDate();
    for (let i = startWd - 1; i >= 0; i--) {
      const d = new Date(y, m - 1, prevDays - i);
      cells.push({ dateStr: formatIsoDate(d), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateStr: formatIsoDate(new Date(y, m, d)), day: d, inMonth: true });
    }
    while (cells.length < 42) {
      const idx = cells.length - (startWd + daysInMonth) + 1;
      const d = new Date(y, m + 1, idx);
      cells.push({ dateStr: formatIsoDate(d), day: d.getDate(), inMonth: false });
    }
    return cells;
  }, [selectedDateObj]);

  // Week 7 days
  const weekDays = useMemo(() => {
    const wd = (selectedDateObj.getDay() + 6) % 7;
    const mon = addDays(selectedDateObj, -wd);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i);
      return { dateStr: formatIsoDate(d), date: d, label: WEEKDAYS[i] };
    });
  }, [selectedDateObj]);

  const todayStr = formatIsoDate(new Date());

  return (
    <div className="h-full flex overflow-hidden bg-[var(--bg)]">
      <input
        ref={icsInputRef}
        type="file"
        accept=".ics"
        onChange={handleImportIcs}
        className="hidden"
      />

      {/* Left Calendar Sources Panel (Desktop) */}
      {!isMobileView && (
        <div className="w-[210px] h-full border-r border-[var(--divider)] bg-[var(--sidebar)] flex flex-col shrink-0">
          <div className="h-11 px-3 border-b border-[var(--divider)] flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-[var(--text)]">Календари</span>
            <button
              type="button"
              onClick={() => setAddingCal((v) => !v)}
              title="Добавить календарь или подписку iCal"
              className="p-1 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {addingCal && (
              <div className="p-2.5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-2 text-[12px]">
                <input
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                  placeholder="Название календаря"
                  className="w-full px-2 py-1 rounded-[6px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                />
                <input
                  value={newCalIcal}
                  onChange={(e) => setNewCalIcal(e.target.value)}
                  placeholder="webcal:// или .ics (необяз.)"
                  className="w-full px-2 py-1 rounded-[6px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none text-[11px]"
                />
                <div className="flex items-center gap-1.5">
                  {CAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCalColor(c)}
                      className={`w-4 h-4 rounded-full ${
                        newCalColor === c ? 'ring-2 ring-offset-1 ring-[var(--text)]' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newCalName.trim()) return;
                    addCalendarSource(newCalName, newCalColor, newCalIcal || undefined);
                    setNewCalName('');
                    setNewCalIcal('');
                    setAddingCal(false);
                  }}
                  className="w-full py-1 rounded-[6px] bg-[var(--accent)] text-white font-medium"
                >
                  Создать
                </button>
              </div>
            )}

            {calendars.map((c) => (
              <label
                key={c.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-[7px] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-[12.5px]"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={c.visible}
                    onChange={() => toggleCalendarVisibility(c.id)}
                    className="svod-checkbox"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-[var(--text)] truncate">{c.name}</span>
                </span>
                {c.readOnly && <span className="text-[10px] text-[var(--muted)]">iCal</span>}
              </label>
            ))}
          </div>

          <div className="p-2.5 border-t border-[var(--divider)] flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => icsInputRef.current?.click()}
              className="flex-1 py-1.5 rounded-[7px] border border-[var(--divider)] bg-[var(--panel)] text-[11.5px] text-[var(--text2)] hover:text-[var(--text)] flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3" />
              .ics
            </button>
            <button
              type="button"
              onClick={handleExportIcs}
              className="flex-1 py-1.5 rounded-[7px] border border-[var(--divider)] bg-[var(--panel)] text-[11.5px] text-[var(--text2)] hover:text-[var(--text)] flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3" />
              .ics
            </button>
          </div>
        </div>
      )}

      {/* Main Calendar Viewport */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-[var(--panel)]">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-[var(--divider)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarSelectedDate(todayStr)}
              className="px-2.5 py-1 rounded-[7px] border border-[var(--divider)] bg-[var(--bg)] text-[12px] font-medium text-[var(--text)] hover:border-[var(--accent)]"
            >
              Сегодня
            </button>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => navigateStep(-1)}
                className="p-1.5 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigateStep(1)}
                className="p-1.5 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--text)] whitespace-nowrap">
              {calendarView === 'year'
                ? `${selectedDateObj.getFullYear()} год`
                : `${MONTHS[selectedDateObj.getMonth()]} ${selectedDateObj.getFullYear()}`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-[8px] bg-[var(--sidebar)] text-[12px]">
              {(
                [
                  ['day', 'День'],
                  ['week', 'Неделя'],
                  ['month', 'Месяц'],
                  ['year', 'Год'],
                  ['upcoming', 'Предстоящие'],
                ] as [CalendarViewType, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCalendarView(id)}
                  className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors whitespace-nowrap ${
                    calendarView === id
                      ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => openNewEventModal(calendarSelectedDate)}
              className="px-3 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-medium flex items-center gap-1 hover:bg-[var(--accent-hover)] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Событие
            </button>
          </div>
        </div>

        {/* View Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {/* MONTH VIEW */}
          {calendarView === 'month' && (
            <div className="h-full min-h-[480px] flex flex-col">
              <div className="grid grid-cols-7 border-b border-[var(--divider)] bg-[var(--sidebar)]/50">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="py-1.5 text-center text-[11.5px] font-medium text-[var(--text2)]"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-6">
                {monthGrid.map((cell) => {
                  const dayEvs = visibleEvents
                    .filter((e) => e.date === cell.dateStr)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = cell.dateStr === todayStr;
                  const isSel = cell.dateStr === calendarSelectedDate;
                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => setCalendarSelectedDate(cell.dateStr)}
                      onDoubleClick={() => openNewEventModal(cell.dateStr)}
                      className={`border-b border-r border-[var(--divider)] p-1.5 flex flex-col gap-1 overflow-hidden cursor-pointer transition-colors ${
                        isSel ? 'bg-[var(--accent-soft)]/50' : 'hover:bg-[var(--sidebar)]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11.5px] tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday
                              ? 'bg-[var(--accent)] text-white font-semibold'
                              : cell.inMonth
                              ? 'text-[var(--text)] font-medium'
                              : 'text-[var(--muted)] opacity-50'
                          }`}
                        >
                          {cell.day}
                        </span>
                      </div>
                      <div className="space-y-0.5 overflow-y-auto">
                        {dayEvs.slice(0, 3).map((ev) => {
                          const color = calMap[ev.calendarId]?.color || '#4F46E5';
                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalEvent(ev);
                              }}
                              style={{ backgroundColor: `${color}22`, color: 'var(--text)' }}
                              className="px-1.5 py-0.5 rounded-[4px] text-[11px] truncate flex items-center gap-1 hover:brightness-95"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-mono-tabular text-[10px] opacity-75">
                                {ev.startTime}
                              </span>
                              <span className="truncate font-medium">{ev.title}</span>
                            </div>
                          );
                        })}
                        {dayEvs.length > 3 && (
                          <div className="text-[10px] text-[var(--muted)] px-1">
                            +{dayEvs.length - 3} ещё
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW (7 columns) */}
          {calendarView === 'week' && (
            <div className="grid grid-cols-7 min-w-[640px] h-full">
              {weekDays.map((wd) => {
                const dayEvs = visibleEvents
                  .filter((e) => e.date === wd.dateStr)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const isToday = wd.dateStr === todayStr;
                return (
                  <div
                    key={wd.dateStr}
                    onDoubleClick={() => openNewEventModal(wd.dateStr)}
                    className="border-r last:border-r-0 border-[var(--divider)] flex flex-col"
                  >
                    <div
                      onClick={() => setCalendarSelectedDate(wd.dateStr)}
                      className={`p-2 border-b border-[var(--divider)] text-center cursor-pointer ${
                        isToday ? 'bg-[var(--accent-soft)]' : 'bg-[var(--sidebar)]/40'
                      }`}
                    >
                      <div className="text-[11px] text-[var(--text2)]">{wd.label}</div>
                      <div
                        className={`text-[15px] font-semibold tabular-nums ${
                          isToday ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                        }`}
                      >
                        {wd.date.getDate()}
                      </div>
                    </div>
                    <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                      {dayEvs.map((ev) => {
                        const color = calMap[ev.calendarId]?.color || '#4F46E5';
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setModalEvent(ev)}
                            style={{
                              backgroundColor: `${color}18`,
                              borderColor: `${color}55`,
                            }}
                            className="p-2 rounded-[8px] border cursor-pointer hover:brightness-95"
                          >
                            <div className="text-[10.5px] font-mono-tabular text-[var(--text2)]">
                              {ev.startTime}–{ev.endTime}
                            </div>
                            <div className="text-[12px] font-medium text-[var(--text)] leading-snug">
                              {ev.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DAY VIEW */}
          {calendarView === 'day' && (
            <div className="p-5 max-w-2xl mx-auto space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--divider)]">
                <h3 className="text-[16px] font-semibold text-[var(--text)]">
                  {selectedDateObj.toLocaleDateString('ru-RU', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h3>
                <button
                  type="button"
                  onClick={() => openNewEventModal(calendarSelectedDate)}
                  className="text-[12.5px] text-[var(--accent)] hover:underline"
                >
                  + Добавить на этот день
                </button>
              </div>
              {visibleEvents
                .filter((e) => e.date === calendarSelectedDate)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((ev) => {
                  const color = calMap[ev.calendarId]?.color || '#4F46E5';
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setModalEvent(ev)}
                      className="p-3.5 rounded-[10px] border border-[var(--divider)] bg-[var(--bg)] hover:border-[var(--accent)] cursor-pointer flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-[12px] font-mono-tabular text-[var(--text2)]">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span>{ev.allDay ? 'Весь день' : `${ev.startTime} – ${ev.endTime}`}</span>
                          {ev.reminderMinutes !== null && ev.reminderMinutes !== undefined && (
                            <span className="flex items-center gap-0.5 text-[var(--muted)]">
                              <Bell className="w-3 h-3" /> за {ev.reminderMinutes} мин
                            </span>
                          )}
                        </div>
                        <div className="text-[14px] font-semibold text-[var(--text)]">{ev.title}</div>
                        {ev.description && (
                          <div className="text-[12.5px] text-[var(--text2)]">{ev.description}</div>
                        )}
                      </div>
                      <span className="text-[11.5px] text-[var(--muted)] shrink-0">
                        {calMap[ev.calendarId]?.name}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* YEAR VIEW (12 mini-months) */}
          {calendarView === 'year' && (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {MONTHS.map((mName, mIdx) => {
                const year = selectedDateObj.getFullYear();
                const first = new Date(year, mIdx, 1);
                const startWd = (first.getDay() + 6) % 7;
                const days = new Date(year, mIdx + 1, 0).getDate();
                const blanks = Array.from({ length: startWd });
                const dayNums = Array.from({ length: days }, (_, i) => i + 1);
                return (
                  <div
                    key={mName}
                    className="p-3 rounded-[10px] border border-[var(--divider)] bg-[var(--bg)]"
                  >
                    <div className="text-[13px] font-semibold text-[var(--text)] mb-2">{mName}</div>
                    <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-[var(--muted)] mb-1">
                      {WEEKDAYS.map((w) => (
                        <div key={w}>{w}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] tabular-nums">
                      {blanks.map((_, i) => (
                        <div key={`b-${i}`} />
                      ))}
                      {dayNums.map((day) => {
                        const dStr = formatIsoDate(new Date(year, mIdx, day));
                        const hasEv = visibleEvents.some((e) => e.date === dStr);
                        const isToday = dStr === todayStr;
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setCalendarSelectedDate(dStr);
                              setCalendarView('day');
                            }}
                            className={`h-6 rounded-[4px] flex flex-col items-center justify-center ${
                              isToday
                                ? 'bg-[var(--accent)] text-white font-semibold'
                                : hasEv
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                                : 'text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* UPCOMING AGENDA LIST */}
          {calendarView === 'upcoming' && (
            <div className="p-5 max-w-2xl mx-auto space-y-2">
              {visibleEvents
                .filter((e) => e.date >= todayStr)
                .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                .map((ev) => {
                  const color = calMap[ev.calendarId]?.color || '#4F46E5';
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setModalEvent(ev)}
                      className="p-3 rounded-[10px] border border-[var(--divider)] bg-[var(--bg)] hover:border-[var(--accent)] cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-mono-tabular text-[var(--text2)]">
                          {new Date(ev.date + 'T00:00:00').toLocaleDateString('ru-RU', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                          })}
                          {' · '}
                          {ev.startTime}–{ev.endTime}
                        </div>
                        <div className="text-[13.5px] font-semibold text-[var(--text)] truncate">
                          {ev.title}
                        </div>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      {modalEvent && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setModalEvent(null)}
        >
          <form
            onSubmit={saveModalEvent}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[12px] border border-[var(--divider)] bg-[var(--panel)] p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[var(--text)]">
                {modalEvent.id ? 'Редактировать событие' : 'Новое событие'}
              </h3>
              <button
                type="button"
                onClick={() => setModalEvent(null)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              autoFocus
              required
              value={modalEvent.title || ''}
              onChange={(e) => setModalEvent({ ...modalEvent, title: e.target.value })}
              placeholder="Название события"
              className="w-full px-3 py-2 text-[13.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Дата</label>
                <input
                  type="date"
                  required
                  value={modalEvent.date || ''}
                  onChange={(e) => setModalEvent({ ...modalEvent, date: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-[12.5px] font-mono-tabular rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Календарь</label>
                <select
                  value={modalEvent.calendarId || ''}
                  onChange={(e) => setModalEvent({ ...modalEvent, calendarId: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Начало</label>
                <input
                  type="time"
                  value={modalEvent.startTime || '09:00'}
                  onChange={(e) => setModalEvent({ ...modalEvent, startTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-[12.5px] font-mono-tabular rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Окончание</label>
                <input
                  type="time"
                  value={modalEvent.endTime || '10:00'}
                  onChange={(e) => setModalEvent({ ...modalEvent, endTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-[12.5px] font-mono-tabular rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Место</label>
                <input
                  value={modalEvent.location || ''}
                  onChange={(e) => setModalEvent({ ...modalEvent, location: e.target.value })}
                  placeholder="Адрес или ссылка"
                  className="w-full px-2.5 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Напоминание</label>
                <select
                  value={modalEvent.reminderMinutes ?? 15}
                  onChange={(e) =>
                    setModalEvent({ ...modalEvent, reminderMinutes: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                >
                  <option value={0}>В момент события</option>
                  <option value={5}>За 5 минут</option>
                  <option value={15}>За 15 минут</option>
                  <option value={30}>За 30 минут</option>
                  <option value={60}>За 1 час</option>
                </select>
              </div>
            </div>

            <textarea
              rows={2}
              value={modalEvent.description || ''}
              onChange={(e) => setModalEvent({ ...modalEvent, description: e.target.value })}
              placeholder="Описание..."
              className="w-full px-3 py-2 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
            />

            <div className="flex items-center justify-between pt-2">
              {modalEvent.id ? (
                <button
                  type="button"
                  onClick={() => {
                    deleteCalendarEvent(modalEvent.id!);
                    setModalEvent(null);
                    pushToast('Событие удалено', 'info');
                  }}
                  className="px-3 py-1.5 rounded-[8px] text-[var(--error)] hover:bg-red-500/10 text-[12.5px] flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Удалить
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalEvent(null)}
                  className="px-3 py-1.5 rounded-[8px] border border-[var(--divider)] text-[12.5px] text-[var(--text2)]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12.5px] font-medium hover:bg-[var(--accent-hover)]"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
