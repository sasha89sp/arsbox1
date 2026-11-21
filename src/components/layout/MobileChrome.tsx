import React, { useState } from 'react';
import {
  Calendar,
  FileText,
  KeyRound,
  LayoutGrid,
  Lock,
  Menu,
  Mic,
  Monitor,
  Moon,
  RefreshCw,
  Settings,
  Star,
  Sun,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { ModuleId } from '../../types';

const MODULE_TITLES: Record<ModuleId, string> = {
  notes: 'Заметки и таблицы',
  passwords: 'Пароли',
  calendar: 'Календарь',
  shared: 'Общая папка',
  voice: 'Диктовка',
  dock: 'Док',
  settings: 'Настройки',
};

export const MobileChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeProfile,
    activeModule,
    setActiveModule,
    settings,
    updateSettings,
    syncState,
    triggerSync,
    setSelectedFolderFilter,
    lockProfile,
    notes,
  } = useAppStore();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const navCandidates: { id: Exclude<ModuleId, 'settings'>; label: string; icon: React.ReactNode }[] = [
    { id: 'notes', label: 'Заметки', icon: <FileText className="w-4 h-4" /> },
    { id: 'calendar', label: 'Календарь', icon: <Calendar className="w-4 h-4" /> },
    { id: 'passwords', label: 'Пароли', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'shared', label: 'Общее', icon: <Users className="w-4 h-4" /> },
    { id: 'voice', label: 'Голос', icon: <Mic className="w-4 h-4" /> },
    { id: 'dock', label: 'Док', icon: <LayoutGrid className="w-4 h-4" /> },
  ];

  const enabledNav = navCandidates.filter((n) => settings.enabledModules[n.id]);
  const bottomNavItems = enabledNav.slice(0, 5);

  const allTags = Array.from(
    new Set(notes.filter((n) => !n.isTrashed).flatMap((n) => n.tags))
  ).slice(0, 6);

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">
      {/* AppBar */}
      <header className="h-12 px-3 flex items-center justify-between border-b border-[var(--divider)] bg-[var(--panel)] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть меню"
            className="p-2 -ml-1 rounded-[8px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-[15px] font-semibold text-[var(--text)] truncate">
            {MODULE_TITLES[activeModule]}
          </span>
        </div>

        <button
          type="button"
          onClick={triggerSync}
          aria-label={syncState.isSyncing ? 'Остановить синхронизацию' : 'Синхронизировать'}
          className="px-2.5 py-1.5 rounded-[8px] flex items-center gap-1.5 text-[12px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${syncState.isSyncing ? 'animate-spin text-[var(--accent)]' : ''}`} />
          <span>{syncState.isSyncing ? 'Стоп' : 'Синхр.'}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>

      {/* Bottom NavigationBar (up to 5 items) */}
      {settings.mobileNavMode !== 'hidden' && (
        <nav className="h-14 px-1 flex items-center justify-around border-t border-[var(--divider)] bg-[var(--panel)] shrink-0">
          {bottomNavItems.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`flex-1 py-1.5 rounded-[8px] flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                  active ? 'text-[var(--accent)] font-medium' : 'text-[var(--text2)]'
                }`}
              >
                {item.icon}
                <span className="truncate max-w-[68px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-[var(--sidebar)] border-r border-[var(--divider)] flex flex-col z-10 shadow-xl">
            <div className="p-4 border-b border-[var(--divider)] flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-semibold text-[15px] shrink-0"
                  style={{ backgroundColor: activeProfile.avatarColor }}
                >
                  {activeProfile.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--text)] truncate">
                    {activeProfile.name}
                  </div>
                  <div className="text-[11.5px] text-[var(--text2)] truncate">@{activeProfile.login}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-[8px] text-[var(--text2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1">
                <div className="px-2 text-[11px] font-medium text-[var(--muted)]">Модули</div>
                {enabledNav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.id);
                      setDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-[8px] flex items-center gap-3 text-[13.5px] ${
                      activeModule === item.id
                        ? 'bg-[var(--accent)] text-white font-medium'
                        : 'text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {settings.enabledModules.notes && (
                <div className="space-y-1 border-t border-[var(--divider)] pt-3">
                  <div className="px-2 text-[11px] font-medium text-[var(--muted)]">Быстрый доступ</div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('notes');
                      setSelectedFolderFilter('favorites');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-[8px] flex items-center gap-3 text-[13px] text-[var(--text2)] hover:text-[var(--text)]"
                  >
                    <Star className="w-4 h-4" />
                    <span>Избранное</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('notes');
                      setSelectedFolderFilter('trash');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-[8px] flex items-center gap-3 text-[13px] text-[var(--text2)] hover:text-[var(--text)]"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Корзина</span>
                  </button>
                  {allTags.length > 0 && (
                    <div className="px-3 pt-1 flex flex-wrap gap-1.5">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setActiveModule('notes');
                            setSelectedFolderFilter(`tag:${tag}`);
                            setDrawerOpen(false);
                          }}
                          className="text-[12px] flex items-center gap-1 px-1.5 py-0.5 rounded-[5px]"
                          style={{ color: 'var(--tag-fg)', backgroundColor: 'var(--tag-bg)' }}
                        >
                          <Tag className="w-3 h-3" />#{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-[var(--divider)] space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveModule('settings');
                  setDrawerOpen(false);
                }}
                className="w-full px-3 py-2 rounded-[8px] flex items-center gap-3 text-[13px] text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Settings className="w-4 h-4" />
                <span>Настройки</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSettings({ layoutMode: 'desktop' });
                  setDrawerOpen(false);
                }}
                className="w-full px-3 py-2 rounded-[8px] flex items-center gap-3 text-[13px] text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Monitor className="w-4 h-4" />
                <span>Вид: компьютер</span>
              </button>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
                  }
                  className="flex-1 px-3 py-2 rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] flex items-center justify-center gap-2 text-[12.5px] text-[var(--text)]"
                >
                  {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>{settings.theme === 'dark' ? 'Светлая' : 'Тёмная'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    lockProfile();
                  }}
                  className="px-3 py-2 rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--error)]"
                  title="Заблокировать"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
