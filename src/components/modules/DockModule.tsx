import React, { useState } from 'react';
import {
  Calendar,
  FileText,
  Globe,
  KeyRound,
  LayoutGrid,
  Mic,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { DockEdge, DockShortcut, ModuleId } from '../../types';

export function renderDockIcon(item: DockShortcut, size: number) {
  const iconSize = Math.round(size * 0.46);
  const map: Record<string, React.ReactNode> = {
    notes: <FileText style={{ width: iconSize, height: iconSize }} />,
    calendar: <Calendar style={{ width: iconSize, height: iconSize }} />,
    passwords: <KeyRound style={{ width: iconSize, height: iconSize }} />,
    shared: <Users style={{ width: iconSize, height: iconSize }} />,
    voice: <Mic style={{ width: iconSize, height: iconSize }} />,
    dock: <LayoutGrid style={{ width: iconSize, height: iconSize }} />,
  };
  return item.targetType === 'module' && map[item.target] ? (
    map[item.target]
  ) : (
    <Globe style={{ width: iconSize, height: iconSize }} />
  );
}

export const FloatingDockOverlay: React.FC = () => {
  const { settings, setActiveModule, pushToast } = useAppStore();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dock = settings.dock;
  if (!dock.enabledOverlay) return null;

  const isVertical = dock.edge === 'left' || dock.edge === 'right';
  const posClass =
    dock.edge === 'bottom'
      ? 'bottom-8 left-1/2 -translate-x-1/2'
      : dock.edge === 'top'
      ? 'top-10 left-1/2 -translate-x-1/2'
      : dock.edge === 'left'
      ? 'left-3 top-1/2 -translate-y-1/2'
      : 'right-3 top-1/2 -translate-y-1/2';

  return (
    <div
      style={{ opacity: dock.opacity }}
      className={`fixed z-40 ${posClass} p-2 rounded-[14px] border border-[var(--divider)] bg-[var(--panel)]/90 backdrop-blur-md shadow-xl flex ${
        isVertical ? 'flex-col' : 'flex-row items-end'
      } gap-2`}
      onMouseLeave={() => setHoverIdx(null)}
    >
      {dock.items.map((item, idx) => {
        const dist = hoverIdx === null ? 99 : Math.abs(hoverIdx - idx);
        const scale = !dock.fisheye
          ? 1
          : dist === 0
          ? 1.38
          : dist === 1
          ? 1.16
          : 1;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onMouseEnter={() => setHoverIdx(idx)}
            onClick={() => {
              if (item.targetType === 'module') {
                setActiveModule(item.target as ModuleId);
              } else {
                pushToast(`Ярлык: ${item.label} (${item.target})`, 'info');
              }
            }}
            style={{
              width: dock.iconSize,
              height: dock.iconSize,
              backgroundColor: item.color,
              transform: `scale(${scale})`,
            }}
            className="rounded-[10px] text-white flex items-center justify-center transition-transform duration-150 ease-out shadow-sm cursor-pointer"
          >
            {renderDockIcon(item, dock.iconSize)}
          </button>
        );
      })}
    </div>
  );
};

export const DockModule: React.FC = () => {
  const { settings, updateSettings, setActiveModule } = useAppStore();
  const dock = settings.dock;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newTarget, setNewTarget] = useState('https://');

  const updateDock = (patch: Partial<typeof dock>) => {
    updateSettings({ dock: { ...dock, ...patch } });
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)] p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              Док быстрого запуска (RocketDock)
            </h2>
            <p className="text-[13px] text-[var(--text2)] mt-0.5">
              Панель значков у края экрана с fisheye-увеличением, настройкой размера и прозрачности.
            </p>
          </div>
          <label className="flex items-center gap-2 px-3 py-2 rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={dock.enabledOverlay}
              onChange={(e) => updateDock({ enabledOverlay: e.target.checked })}
              className="svod-checkbox"
            />
            <span>Показать поверх окна</span>
          </label>
        </div>

        {/* Interactive Fisheye Preview */}
        <div className="p-8 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] flex flex-col items-center justify-center min-h-[170px] gap-4">
          <div className="text-[12px] text-[var(--muted)]">
            Наведите курсор на значки для проверки fisheye-эффекта
          </div>
          <div
            style={{ opacity: dock.opacity }}
            onMouseLeave={() => setHoverIdx(null)}
            className="px-4 py-3 rounded-[14px] border border-[var(--divider)] bg-[var(--sidebar)] flex items-end gap-3"
          >
            {dock.items.map((item, idx) => {
              const dist = hoverIdx === null ? 99 : Math.abs(hoverIdx - idx);
              const scale = !dock.fisheye ? 1 : dist === 0 ? 1.42 : dist === 1 ? 1.18 : 1;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onClick={() => {
                    if (item.targetType === 'module') setActiveModule(item.target as ModuleId);
                  }}
                  style={{
                    width: dock.iconSize,
                    height: dock.iconSize,
                    backgroundColor: item.color,
                    transform: `scale(${scale})`,
                  }}
                  className="rounded-[10px] text-white flex items-center justify-center transition-transform duration-150 ease-out"
                  title={item.label}
                >
                  {renderDockIcon(item, dock.iconSize)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="p-5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          <div>
            <label className="block text-[12px] text-[var(--text2)] mb-1.5">Расположение у края</label>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-[8px] bg-[var(--sidebar)] text-[12px]">
              {(
                [
                  ['bottom', 'Снизу'],
                  ['top', 'Сверху'],
                  ['left', 'Слева'],
                  ['right', 'Справа'],
                ] as [DockEdge, string][]
              ).map(([edge, label]) => (
                <button
                  key={edge}
                  type="button"
                  onClick={() => updateDock({ edge })}
                  className={`py-1 rounded-[6px] font-medium ${
                    dock.edge === edge
                      ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text2)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <span className="text-[var(--text)]">Эффект Fisheye при наведении</span>
            <input
              type="checkbox"
              checked={dock.fisheye}
              onChange={(e) => updateDock({ fisheye: e.target.checked })}
              className="svod-checkbox"
            />
          </div>

          <div>
            <div className="flex justify-between text-[12px] text-[var(--text2)] mb-1">
              <span>Размер значков</span>
              <span className="font-mono-tabular text-[var(--text)]">{dock.iconSize} px</span>
            </div>
            <input
              type="range"
              min={36}
              max={64}
              value={dock.iconSize}
              onChange={(e) => updateDock({ iconSize: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="flex justify-between text-[12px] text-[var(--text2)] mb-1">
              <span>Непрозрачность</span>
              <span className="font-mono-tabular text-[var(--text)]">
                {Math.round(dock.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={100}
              value={Math.round(dock.opacity * 100)}
              onChange={(e) => updateDock({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </div>

        {/* Shortcuts list */}
        <div className="p-5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-3">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">Ярлыки панели</h3>
          <div className="space-y-1.5">
            {dock.items.map((item) => (
              <div
                key={item.id}
                className="px-3 py-2 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] flex items-center justify-between text-[13px]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-[var(--text)]">{item.label}</span>
                  <span className="text-[11.5px] text-[var(--muted)] font-mono-tabular">
                    {item.target}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateDock({ items: dock.items.filter((x) => x.id !== item.id) })}
                  className="text-[var(--muted)] hover:text-[var(--error)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Название ярлыка"
              className="flex-1 min-w-[140px] px-3 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
            />
            <input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Путь или ссылка"
              className="flex-1 min-w-[160px] px-3 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!newLabel.trim()) return;
                updateDock({
                  items: [
                    ...dock.items,
                    {
                      id: `dk-${Date.now()}`,
                      label: newLabel.trim(),
                      targetType: 'url',
                      target: newTarget.trim() || '/',
                      color: '#4F46E5',
                    },
                  ],
                });
                setNewLabel('');
              }}
              className="px-3 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12.5px] font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
