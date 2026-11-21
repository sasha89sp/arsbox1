import React, { useState } from 'react';
import {
  Calendar,
  FileText,
  Folder,
  FolderPlus,
  KeyRound,
  LayoutGrid,
  Lock,
  Mic,
  Moon,
  RefreshCw,
  Settings,
  Smartphone,
  Star,
  Sun,
  Trash2,
  Users,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { ModuleId } from '../../types';

export const Sidebar: React.FC<{ width: number }> = ({ width }) => {
  const {
    activeProfile,
    activeModule,
    setActiveModule,
    settings,
    updateSettings,
    folders,
    notes,
    selectedFolderFilter,
    setSelectedFolderFilter,
    createFolder,
    lockProfile,
    triggerSync,
    syncState,
  } = useAppStore();

  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const moduleItems: { id: Exclude<ModuleId, 'settings'>; label: string; icon: React.ReactNode }[] = [
    { id: 'notes', label: 'Заметки и таблицы', icon: <FileText className="w-4 h-4" /> },
    { id: 'passwords', label: 'Пароли', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'calendar', label: 'Календарь', icon: <Calendar className="w-4 h-4" /> },
    { id: 'shared', label: 'Общая папка', icon: <Users className="w-4 h-4" /> },
    { id: 'voice', label: 'Диктовка', icon: <Mic className="w-4 h-4" /> },
    { id: 'dock', label: 'Док', icon: <LayoutGrid className="w-4 h-4" /> },
  ];

  const activeNotes = notes.filter((n) => !n.isTrashed);
  const favCount = activeNotes.filter((n) => n.isFavorite).length;
  const trashCount = notes.filter((n) => n.isTrashed).length;

  const submitNewFolder = () => {
    if (newFolderName.trim()) {
      const f = createFolder(newFolderName.trim());
      setActiveModule('notes');
      setSelectedFolderFilter(f.id);
    }
    setNewFolderName('');
    setAddingFolder(false);
  };

  return (
    <aside
      style={{ width }}
      className="h-full flex flex-col bg-[var(--sidebar)] select-none shrink-0 overflow-hidden"
    >
      {/* Profile compact header + sync */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-[var(--divider)]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-[6px] flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
            style={{ backgroundColor: activeProfile.avatarColor }}
          >
            {activeProfile.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[13px] font-medium text-[var(--text)] truncate">
            {activeProfile.name}
          </span>
        </div>
        <button
          type="button"
          onClick={triggerSync}
          title={syncState.isSyncing ? 'Остановить синхронизацию' : 'Синхронизировать'}
          className="p-1.5 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin text-[var(--accent)]' : ''}`} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Optional Notebooks block at top */}
        {settings.showNotebooksInSidebar && settings.enabledModules.notes && (
          <div>
            <div className="px-2 mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-[var(--muted)]">Блокноты</span>
              <button
                type="button"
                onClick={() => setAddingFolder((v) => !v)}
                title="Новый блокнот"
                className="p-0.5 rounded text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {addingFolder && (
              <div className="px-1 mb-1.5">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNewFolder();
                    if (e.key === 'Escape') setAddingFolder(false);
                  }}
                  onBlur={submitNewFolder}
                  placeholder="Название блокнота..."
                  className="w-full px-2 py-1 text-[12px] rounded-[6px] border border-[var(--accent)] bg-[var(--panel)] text-[var(--text)] outline-none"
                />
              </div>
            )}

            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setActiveModule('notes');
                  setSelectedFolderFilter('all');
                }}
                className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between text-[12.5px] transition-colors ${
                  activeModule === 'notes' && selectedFolderFilter === 'all'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Все заметки</span>
                </span>
                <span className="text-[11px] tabular-nums opacity-70">{activeNotes.length}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModule('notes');
                  setSelectedFolderFilter('favorites');
                }}
                className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between text-[12.5px] transition-colors ${
                  activeModule === 'notes' && selectedFolderFilter === 'favorites'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Star className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Избранное</span>
                </span>
                <span className="text-[11px] tabular-nums opacity-70">{favCount}</span>
              </button>

              {folders
                .filter((f) => !f.parentId)
                .map((f) => {
                  const count = activeNotes.filter((n) => n.folderId === f.id).length;
                  const children = folders.filter((c) => c.parentId === f.id);
                  return (
                    <div key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModule('notes');
                          setSelectedFolderFilter(f.id);
                        }}
                        className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between text-[12.5px] transition-colors ${
                          activeModule === 'notes' && selectedFolderFilter === f.id
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                            : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Folder className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <span className="text-[11px] tabular-nums opacity-70">{count}</span>
                      </button>
                      {children.map((ch) => {
                        const cCount = activeNotes.filter((n) => n.folderId === ch.id).length;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => {
                              setActiveModule('notes');
                              setSelectedFolderFilter(ch.id);
                            }}
                            className={`w-full pl-6 pr-2 py-1 rounded-[7px] flex items-center justify-between text-[12px] transition-colors ${
                              activeModule === 'notes' && selectedFolderFilter === ch.id
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Folder className="w-3 h-3 shrink-0" />
                              <span className="truncate">{ch.name}</span>
                            </span>
                            <span className="text-[11px] tabular-nums opacity-70">{cCount}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

              <button
                type="button"
                onClick={() => {
                  setActiveModule('notes');
                  setSelectedFolderFilter('trash');
                }}
                className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between text-[12.5px] transition-colors ${
                  activeModule === 'notes' && selectedFolderFilter === 'trash'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Корзина</span>
                </span>
                {trashCount > 0 && (
                  <span className="text-[11px] tabular-nums opacity-70">{trashCount}</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Active Modules */}
        <div>
          <div className="px-2 mb-1 text-[11px] font-medium text-[var(--muted)]">Модули</div>
          <div className="space-y-0.5">
            {moduleItems
              .filter((m) => settings.enabledModules[m.id])
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModule(m.id)}
                  className={`w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-[13px] transition-colors whitespace-nowrap ${
                    activeModule === m.id
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {m.icon}
                  <span className="truncate">{m.label}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="p-2 border-t border-[var(--divider)] space-y-0.5">
        <button
          type="button"
          onClick={() => setActiveModule('settings')}
          className={`w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-[12.5px] transition-colors ${
            activeModule === 'settings'
              ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
              : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="truncate">Настройки</span>
        </button>

        <div className="flex items-center gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            title={settings.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            className="flex-1 px-2 py-1.5 rounded-[8px] flex items-center justify-center gap-1.5 text-[12px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {settings.theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="truncate">{settings.theme === 'dark' ? 'Светлая' : 'Тёмная'}</span>
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ layoutMode: 'mobile' })}
            title="Переключить на мобильный вид"
            className="px-2 py-1.5 rounded-[8px] flex items-center justify-center gap-1 text-[12px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={lockProfile}
            title="Заблокировать профиль"
            className="px-2 py-1.5 rounded-[8px] flex items-center justify-center text-[var(--text2)] hover:text-[var(--error)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
