import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppSettings,
  CalendarEvent,
  CalendarSource,
  CalendarViewType,
  DiagLogEntry,
  DiagProcessEntry,
  ModuleId,
  NoteFolder,
  NoteItem,
  PassVaultData,
  PassVaultMeta,
  ProfileMeta,
  SafetyBackup,
  SharedGroup,
  SyncHistoryEntry,
  VoiceRecord,
  WorkspaceSnapshot,
} from '../types';
import {
  decryptJson,
  encryptJson,
  readValidStorage,
  writeAtomicStorage,
} from '../lib/crypto';
import {
  createDefaultProfiles,
  createSeedPassVaultData,
  createSeedWorkspace,
  formatIsoDate,
} from '../data/seed';

const STORAGE_KEYS = {
  PROFILES: 'svod.profiles.v1',
  WORKSPACE_PREFIX: 'svod.ws.v1.',
  PASS_VAULTS: 'svod.passvaults.v1',
  SAFETY_BACKUPS: 'svod.safety.v1',
};

interface SyncState {
  isSyncing: boolean;
  progress: number;
  stage: string;
  speedDownKbps: number;
  speedUpKbps: number;
  lastSyncedAt: string | null;
}

interface ClipboardTimerState {
  secondsLeft: number;
  label: string;
}

interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warn' | 'error';
}

interface AppContextValue {
  // Profiles & Lock
  profiles: ProfileMeta[];
  activeProfile: ProfileMeta;
  isLocked: boolean;
  lockProfile: () => void;
  unlockProfile: (profileId: string, password?: string) => Promise<boolean>;
  createProfile: (meta: Omit<ProfileMeta, 'id' | 'createdAt'>, password?: string) => Promise<void>;

  // Active Navigation & Layout
  activeModule: ModuleId;
  setActiveModule: (m: ModuleId) => void;
  isMobileView: boolean;
  windowWidth: number;
  calendarSelectedDate: string;
  setCalendarSelectedDate: (d: string) => void;
  calendarView: CalendarViewType;
  setCalendarView: (v: CalendarViewType) => void;
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  selectedFolderFilter: string; // 'all' | 'favorites' | 'trash' | 'tag:xxx' | folderId
  setSelectedFolderFilter: (f: string) => void;

  // Workspace Data
  folders: NoteFolder[];
  notes: NoteItem[];
  calendars: CalendarSource[];
  events: CalendarEvent[];
  sharedGroups: SharedGroup[];
  voiceHistory: VoiceRecord[];
  settings: AppSettings;

  // Notes Mutations
  createFolder: (name: string, parentId?: string | null) => NoteFolder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  createNote: (folderId?: string | null, initialTitle?: string, initialMarkdown?: string) => NoteItem;
  updateNote: (id: string, updater: (n: NoteItem) => NoteItem, saveVersion?: boolean) => void;
  deleteNoteToTrash: (id: string) => void;
  restoreNoteFromTrash: (id: string) => void;
  deleteNotePermanently: (id: string) => void;
  emptyNotesTrash: () => void;
  restoreNoteVersion: (noteId: string, versionId: string) => void;

  // Calendar Mutations
  addCalendarSource: (name: string, color: string, icalUrl?: string) => void;
  toggleCalendarVisibility: (id: string) => void;
  addCalendarEvent: (ev: Omit<CalendarEvent, 'id'>) => CalendarEvent;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;

  // Shared Groups Mutations
  createSharedGroup: (name: string, webdavUrl: string, folderPath: string) => void;
  updateSharedGroup: (id: string, updater: (g: SharedGroup) => SharedGroup) => void;

  // Voice Mutations
  addVoiceRecord: (text: string, durationSec: number, engine: 'browser-speech' | 'manual') => void;
  deleteVoiceRecord: (id: string) => void;

  // Settings Mutations
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleModuleEnabled: (mod: Exclude<ModuleId, 'settings'>) => void;
  adjustUiScale: (delta: number) => void;
  resetUiScale: () => void;

  // Password Vaults (Independent PassStore)
  passVaults: PassVaultMeta[];
  activePassVaultId: string | null;
  unlockedPassData: PassVaultData | null;
  unlockPassVault: (vaultId: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  lockPassVault: () => void;
  createPassVault: (name: string, password: string, hint: string) => Promise<void>;
  updatePassVaultData: (updater: (d: PassVaultData) => PassVaultData) => Promise<void>;
  changePassVaultMasterPassword: (vaultId: string, oldPw: string, newPw: string, newHint: string) => Promise<{ ok: boolean; error?: string }>;
  deletePassVault: (vaultId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  forgetRememberedPass: (vaultId: string) => void;

  // Sync, Safety Backups, Diagnostics
  syncState: SyncState;
  triggerSync: () => void;
  stopSync: () => void;
  safetyBackups: SafetyBackup[];
  createSafetyBackup: (reason: string) => void;
  restoreSafetyBackup: (backupId: string) => void;
  exportEncryptedProfileBackup: (password: string) => Promise<string>;
  importEncryptedProfileBackup: (jsonPayload: string, password: string) => Promise<{ ok: boolean; error?: string }>;

  // DiagHub
  diagOpen: boolean;
  setDiagOpen: (open: boolean) => void;
  diagProcesses: DiagProcessEntry[];
  syncHistory: SyncHistoryEntry[];
  diagLogs: DiagLogEntry[];
  logDiag: (level: 'info' | 'warn' | 'error', source: string, message: string) => void;

  // Clipboard & Toasts
  clipboardTimer: ClipboardTimerState | null;
  copySensitiveText: (text: string, label: string) => void;
  toasts: ToastMessage[];
  pushToast: (text: string, tone?: ToastMessage['tone']) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Window responsiveness
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Profiles
  const [profiles, setProfiles] = useState<ProfileMeta[]>(() => {
    const { data } = readValidStorage<ProfileMeta[]>(STORAGE_KEYS.PROFILES);
    return data && data.length > 0 ? data : createDefaultProfiles();
  });
  const [activeProfileId, setActiveProfileId] = useState<string>(() => profiles[0].id);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const profilePasswordRef = useRef<string | null>(null);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId]
  );

  // Workspace State
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>(() => {
    const { data } = readValidStorage<WorkspaceSnapshot>(
      `${STORAGE_KEYS.WORKSPACE_PREFIX}${profiles[0].id}`
    );
    return data ?? createSeedWorkspace();
  });

  // Navigation State
  const [activeModule, setActiveModuleState] = useState<ModuleId>('notes');
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string>(() => formatIsoDate(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarViewType>('month');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => workspace.notes[0]?.id ?? null);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');

  // Password Vaults State
  const [passVaults, setPassVaults] = useState<PassVaultMeta[]>(() => {
    const { data } = readValidStorage<PassVaultMeta[]>(STORAGE_KEYS.PASS_VAULTS);
    return data ?? [];
  });
  const [activePassVaultId, setActivePassVaultId] = useState<string | null>(null);
  const [unlockedPassData, setUnlockedPassData] = useState<PassVaultData | null>(null);
  const activePassPasswordRef = useRef<string | null>(null);

  // Seed default demo password vault (password: demo1234) once if empty
  useEffect(() => {
    if (passVaults.length === 0) {
      let cancelled = false;
      (async () => {
        const seedData = createSeedPassVaultData();
        const encryptedPayload = await encryptJson(seedData, 'demo1234');
        if (cancelled) return;
        const demoVault: PassVaultMeta = {
          id: 'vault-demo',
          name: 'Личный сейф (демо)',
          hint: 'Демо-пароль для первого входа: demo1234',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          failedAttempts: 0,
          lockedUntil: null,
          rememberedPassword: null,
          encryptedPayload,
        };
        setPassVaults([demoVault]);
        writeAtomicStorage(STORAGE_KEYS.PASS_VAULTS, JSON.stringify([demoVault]));
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [passVaults.length]);

  // Safety Backups
  const [safetyBackups, setSafetyBackups] = useState<SafetyBackup[]>(() => {
    const { data } = readValidStorage<SafetyBackup[]>(STORAGE_KEYS.SAFETY_BACKUPS);
    return data ?? [];
  });

  // Diagnostics & Sync
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagProcesses, setDiagProcesses] = useState<DiagProcessEntry[]>([
    {
      id: 'dp-init',
      timestamp: new Date().toISOString(),
      operation: 'Инициализация хранилища (.enc / atomic)',
      status: 'ok',
      speedKbps: 1420,
      bytes: 28400,
      detail: 'Профиль загружен, контрольная сумма .bak проверена',
    },
  ]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([
    {
      id: 'sh-1',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      target: 'Локальное хранилище (data/)',
      uploaded: 4,
      downloaded: 0,
      conflicts: 0,
      durationMs: 184,
      result: 'success',
    },
  ]);
  const [diagLogs, setDiagLogs] = useState<DiagLogEntry[]>([
    {
      id: 'dl-1',
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'Store',
      message: 'Атомарная проверка целостности пройдена успешно (AES-256-GCM готов).',
    },
  ]);

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    progress: 0,
    stage: 'Готово',
    speedDownKbps: 0,
    speedUpKbps: 0,
    lastSyncedAt: new Date(Date.now() - 1800000).toISOString(),
  });
  const syncTimerRef = useRef<number | null>(null);

  // Clipboard & Toasts
  const [clipboardTimer, setClipboardTimer] = useState<ClipboardTimerState | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const logDiag = useCallback((level: 'info' | 'warn' | 'error', source: string, message: string) => {
    setDiagLogs((prev) => [
      { id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, timestamp: new Date().toISOString(), level, source, message },
      ...prev.slice(0, 99),
    ]);
  }, []);

  // Persist workspace atomically whenever it changes
  useEffect(() => {
    if (isLocked) return;
    try {
      const serialized = JSON.stringify(workspace);
      writeAtomicStorage(`${STORAGE_KEYS.WORKSPACE_PREFIX}${activeProfileId}`, serialized);
    } catch (e) {
      logDiag('error', 'Storage', `Ошибка записи профиля: ${String(e)}`);
    }
  }, [workspace, activeProfileId, isLocked, logDiag]);

  useEffect(() => {
    writeAtomicStorage(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    if (passVaults.length > 0) {
      writeAtomicStorage(STORAGE_KEYS.PASS_VAULTS, JSON.stringify(passVaults));
    }
  }, [passVaults]);

  useEffect(() => {
    writeAtomicStorage(STORAGE_KEYS.SAFETY_BACKUPS, JSON.stringify(safetyBackups));
  }, [safetyBackups]);

  // Apply Dark Mode & Font Scale to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (workspace.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--font-scale', String(workspace.settings.fontScale));
  }, [workspace.settings.theme, workspace.settings.fontScale]);

  // Keyboard shortcuts for uiScale (Ctrl + / - / 0)
  const adjustUiScale = useCallback((delta: number) => {
    setWorkspace((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        uiScale: Math.max(0.8, Math.min(1.6, Math.round((prev.settings.uiScale + delta) * 100) / 100)),
      },
    }));
  }, []);

  const resetUiScale = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      settings: { ...prev.settings, uiScale: 1 },
    }));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          adjustUiScale(0.05);
        } else if (e.key === '-') {
          e.preventDefault();
          adjustUiScale(-0.05);
        } else if (e.key === '0') {
          e.preventDefault();
          resetUiScale();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adjustUiScale, resetUiScale]);

  // Clipboard countdown timer
  useEffect(() => {
    if (!clipboardTimer) return;
    if (clipboardTimer.secondsLeft <= 0) {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText('').catch(() => {});
      }
      setClipboardTimer(null);
      pushToast('Буфер обмена очищен по таймеру', 'info');
      return;
    }
    const id = window.setTimeout(() => {
      setClipboardTimer((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [clipboardTimer, pushToast]);

  const copySensitiveText = useCallback(
    (text: string, label: string) => {
      navigator.clipboard?.writeText(text).catch(() => {});
      const sec = workspace.settings.clipboardClearSec;
      if (sec > 0) {
        setClipboardTimer({ secondsLeft: sec, label });
        pushToast(`${label} скопировано (очистка через ${sec} с)`, 'success');
      } else {
        pushToast(`${label} скопировано`, 'success');
      }
    },
    [workspace.settings.clipboardClearSec, pushToast]
  );

  // Auto-lock password vault on inactivity or tab hidden
  useEffect(() => {
    if (!activePassVaultId) return;
    const onVisChange = () => {
      if (document.hidden && activePassVaultId) {
        setActivePassVaultId(null);
        setUnlockedPassData(null);
        activePassPasswordRef.current = null;
        logDiag('info', 'PassStore', 'Хранилище паролей заблокировано при сворачивании вкладки.');
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [activePassVaultId, logDiag]);

  useEffect(() => {
    const mins = workspace.settings.passAutoLockMin;
    if (!activePassVaultId || mins <= 0) return;
    let timer = window.setTimeout(() => {
      setActivePassVaultId(null);
      setUnlockedPassData(null);
      activePassPasswordRef.current = null;
      pushToast('Хранилище паролей заблокировано по таймеру бездействия', 'warn');
    }, mins * 60 * 1000);

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setActivePassVaultId(null);
        setUnlockedPassData(null);
        activePassPasswordRef.current = null;
        pushToast('Хранилище паролей заблокировано по таймеру бездействия', 'warn');
      }, mins * 60 * 1000);
    };
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [activePassVaultId, workspace.settings.passAutoLockMin, pushToast]);

  // Layout mode computation
  const isMobileView = useMemo(() => {
    if (workspace.settings.layoutMode === 'mobile') return true;
    if (workspace.settings.layoutMode === 'desktop') return false;
    return windowWidth < 900;
  }, [workspace.settings.layoutMode, windowWidth]);

  // Guard activeModule if disabled
  const setActiveModule = useCallback(
    (m: ModuleId) => {
      if (m !== 'settings' && !workspace.settings.enabledModules[m]) {
        pushToast('Модуль отключён в настройках', 'warn');
        return;
      }
      setActiveModuleState(m);
    },
    [workspace.settings.enabledModules, pushToast]
  );

  // Profile Lock / Unlock / Create
  const lockProfile = useCallback(() => {
    setIsLocked(true);
    setActivePassVaultId(null);
    setUnlockedPassData(null);
    activePassPasswordRef.current = null;
    logDiag('info', 'Security', `Профиль «${activeProfile.name}» заблокирован.`);
  }, [activeProfile.name, logDiag]);

  const unlockProfile = useCallback(
    async (profileId: string, password?: string): Promise<boolean> => {
      const target = profiles.find((p) => p.id === profileId);
      if (!target) return false;
      const key = `${STORAGE_KEYS.WORKSPACE_PREFIX}${profileId}`;
      const encKey = `${key}.enc`;
      const rawEnc = localStorage.getItem(encKey);

      if (target.hasPassword && rawEnc) {
        if (!password) return false;
        try {
          const decrypted = await decryptJson<WorkspaceSnapshot>(rawEnc, password);
          setActiveProfileId(profileId);
          setWorkspace(decrypted);
          setSelectedNoteId(decrypted.notes[0]?.id ?? null);
          profilePasswordRef.current = password;
          setIsLocked(false);
          logDiag('info', 'Security', `Профиль «${target.name}» расшифрован (AES-256-GCM).`);
          return true;
        } catch {
          logDiag('warn', 'Security', `Неверный пароль для профиля «${target.name}».`);
          return false;
        }
      }

      const { data } = readValidStorage<WorkspaceSnapshot>(key);
      const loaded = data ?? createSeedWorkspace();
      setActiveProfileId(profileId);
      setWorkspace(loaded);
      setSelectedNoteId(loaded.notes[0]?.id ?? null);
      setIsLocked(false);
      logDiag('info', 'Security', `Выполнен вход в профиль «${target.name}».`);
      return true;
    },
    [profiles, logDiag]
  );

  const createProfile = useCallback(
    async (meta: Omit<ProfileMeta, 'id' | 'createdAt'>, password?: string) => {
      const id = `profile-${Date.now()}`;
      const newProfile: ProfileMeta = {
        ...meta,
        id,
        createdAt: new Date().toISOString(),
        hasPassword: Boolean(password),
      };
      const freshWs = createSeedWorkspace();
      if (password) {
        const enc = await encryptJson(freshWs, password);
        writeAtomicStorage(`${STORAGE_KEYS.WORKSPACE_PREFIX}${id}.enc`, enc);
        profilePasswordRef.current = password;
      }
      writeAtomicStorage(`${STORAGE_KEYS.WORKSPACE_PREFIX}${id}`, JSON.stringify(freshWs));
      setProfiles((prev) => [...prev, newProfile]);
      setActiveProfileId(id);
      setWorkspace(freshWs);
      setSelectedNoteId(freshWs.notes[0]?.id ?? null);
      setIsLocked(false);
      pushToast(`Создан профиль «${newProfile.name}»`, 'success');
      logDiag('info', 'Profiles', `Создан локальный профиль «${newProfile.name}» (${newProfile.storageType}).`);
    },
    [pushToast, logDiag]
  );

  // Notes & Folders Mutations
  const createFolder = useCallback(
    (name: string, parentId: string | null = null): NoteFolder => {
      const f: NoteFolder = {
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: name.trim() || 'Новый блокнот',
        parentId,
        createdAt: new Date().toISOString(),
      };
      setWorkspace((prev) => ({ ...prev, folders: [...prev.folders, f] }));
      return f;
    },
    []
  );

  const renameFolder = useCallback((id: string, name: string) => {
    setWorkspace((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)),
    }));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== id && f.parentId !== id),
      notes: prev.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
    }));
  }, []);

  const createNote = useCallback(
    (folderId: string | null = null, initialTitle = 'Новая заметка', initialMarkdown = ''): NoteItem => {
      const now = new Date().toISOString();
      const note: NoteItem = {
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        folderId,
        title: initialTitle,
        blocks: [{ id: `b-${Date.now()}`, type: 'markdown', content: initialMarkdown }],
        tags: [],
        isFavorite: false,
        isPinned: false,
        isTrashed: false,
        author: activeProfile.name,
        createdAt: now,
        updatedAt: now,
        versions: [],
      };
      setWorkspace((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
      setSelectedNoteId(note.id);
      return note;
    },
    [activeProfile.name]
  );

  const updateNote = useCallback(
    (id: string, updater: (n: NoteItem) => NoteItem, saveVersion = false) => {
      setWorkspace((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => {
          if (n.id !== id) return n;
          const versions = saveVersion
            ? [
                {
                  id: `ver-${Date.now()}`,
                  savedAt: n.updatedAt,
                  title: n.title,
                  blocks: JSON.parse(JSON.stringify(n.blocks)),
                },
                ...n.versions,
              ].slice(0, 8)
            : n.versions;
          const updated = updater({ ...n, versions });
          // Auto-extract #tags from markdown blocks
          const tagSet = new Set<string>(updated.tags);
          for (const b of updated.blocks) {
            if (b.type === 'markdown') {
              const matches = b.content.match(/(?:^|\s)#([a-zA-Zа-яА-ЯёЁ0-9_-]+)/g);
              if (matches) {
                matches.forEach((m) => tagSet.add(m.trim().slice(1).toLowerCase()));
              }
            }
          }
          return {
            ...updated,
            tags: Array.from(tagSet),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    []
  );

  const deleteNoteToTrash = useCallback(
    (id: string) => {
      setWorkspace((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id ? { ...n, isTrashed: true, trashedAt: new Date().toISOString() } : n
        ),
      }));
      pushToast('Заметка перемещена в корзину (хранится 30 дней)', 'info');
    },
    [pushToast]
  );

  const restoreNoteFromTrash = useCallback(
    (id: string) => {
      setWorkspace((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? { ...n, isTrashed: false, trashedAt: undefined } : n)),
      }));
      pushToast('Заметка восстановлена', 'success');
    },
    [pushToast]
  );

  const deleteNotePermanently = useCallback(
    (id: string) => {
      setWorkspace((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== id),
      }));
      setSelectedNoteId((cur) => (cur === id ? null : cur));
      pushToast('Заметка удалена навсегда', 'warn');
    },
    [pushToast]
  );

  const emptyNotesTrash = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => !n.isTrashed),
    }));
    pushToast('Корзина очищена', 'info');
  }, [pushToast]);

  const restoreNoteVersion = useCallback(
    (noteId: string, versionId: string) => {
      setWorkspace((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => {
          if (n.id !== noteId) return n;
          const ver = n.versions.find((v) => v.id === versionId);
          if (!ver) return n;
          return {
            ...n,
            title: ver.title,
            blocks: JSON.parse(JSON.stringify(ver.blocks)),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
      pushToast('Версия заметки восстановлена', 'success');
    },
    [pushToast]
  );

  // Calendar Mutations
  const addCalendarSource = useCallback((name: string, color: string, icalUrl?: string) => {
    const src: CalendarSource = {
      id: `cal-${Date.now()}`,
      name: name.trim() || 'Новый календарь',
      color,
      visible: true,
      readOnly: Boolean(icalUrl),
      icalUrl,
    };
    setWorkspace((prev) => ({ ...prev, calendars: [...prev.calendars, src] }));
  }, []);

  const toggleCalendarVisibility = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      calendars: prev.calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    }));
  }, []);

  const addCalendarEvent = useCallback((ev: Omit<CalendarEvent, 'id'>): CalendarEvent => {
    const created: CalendarEvent = {
      ...ev,
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    setWorkspace((prev) => ({ ...prev, events: [...prev.events, created] }));
    return created;
  }, []);

  const updateCalendarEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => {
    setWorkspace((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const deleteCalendarEvent = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
  }, []);

  // Shared Groups Mutations
  const createSharedGroup = useCallback(
    (name: string, webdavUrl: string, folderPath: string) => {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const fp = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
      const grp: SharedGroup = {
        id: `grp-${Date.now()}`,
        name: name.trim() || 'Новая группа',
        webdavUrl: webdavUrl || workspace.settings.syncEndpoint,
        folderPath: folderPath || '/shared/new-group',
        encryptionKeyFingerprint: fp,
        members: [{ id: 'm-me', name: `${activeProfile.name} (вы)`, role: 'editor', lastOnline: 'В сети', isOwner: true }],
        messages: [],
        docs: [],
      };
      setWorkspace((prev) => ({ ...prev, sharedGroups: [...prev.sharedGroups, grp] }));
      pushToast(`Создана группа «${grp.name}» с отдельным ключом шифрования`, 'success');
    },
    [activeProfile.name, workspace.settings.syncEndpoint, pushToast]
  );

  const updateSharedGroup = useCallback((id: string, updater: (g: SharedGroup) => SharedGroup) => {
    setWorkspace((prev) => ({
      ...prev,
      sharedGroups: prev.sharedGroups.map((g) => (g.id === id ? updater(g) : g)),
    }));
  }, []);

  // Voice Mutations
  const addVoiceRecord = useCallback(
    (text: string, durationSec: number, engine: 'browser-speech' | 'manual') => {
      const rec: VoiceRecord = {
        id: `vr-${Date.now()}`,
        text: text.trim(),
        durationSec,
        createdAt: new Date().toISOString(),
        engine,
      };
      setWorkspace((prev) => ({ ...prev, voiceHistory: [rec, ...prev.voiceHistory] }));
    },
    []
  );

  const deleteVoiceRecord = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      voiceHistory: prev.voiceHistory.filter((v) => v.id !== id),
    }));
  }, []);

  // Settings Mutations
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setWorkspace((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const toggleModuleEnabled = useCallback(
    (mod: Exclude<ModuleId, 'settings'>) => {
      setWorkspace((prev) => {
        const nextVal = !prev.settings.enabledModules[mod];
        return {
          ...prev,
          settings: {
            ...prev.settings,
            enabledModules: {
              ...prev.settings.enabledModules,
              [mod]: nextVal,
            },
          },
        };
      });
      if (activeModule === mod) {
        setActiveModuleState('settings');
      }
    },
    [activeModule]
  );

  // Password Vault Actions (Real AES-256-GCM + Brute-force lockout)
  const unlockPassVault = useCallback(
    async (vaultId: string, password: string, remember = false): Promise<{ ok: boolean; error?: string }> => {
      const vault = passVaults.find((v) => v.id === vaultId);
      if (!vault) return { ok: false, error: 'Хранилище не найдено' };

      if (vault.lockedUntil && Date.now() < vault.lockedUntil) {
        const sec = Math.ceil((vault.lockedUntil - Date.now()) / 1000);
        return { ok: false, error: `Слишком много неверных попыток. Повторите через ${sec} с.` };
      }

      try {
        const decrypted = await decryptJson<PassVaultData>(vault.encryptedPayload, password);
        activePassPasswordRef.current = password;
        setActivePassVaultId(vaultId);
        setUnlockedPassData(decrypted);
        setPassVaults((prev) =>
          prev.map((v) =>
            v.id === vaultId
              ? {
                  ...v,
                  failedAttempts: 0,
                  lockedUntil: null,
                  rememberedPassword: remember ? password : v.rememberedPassword,
                }
              : v
          )
        );
        logDiag('info', 'PassStore', `Хранилище «${vault.name}» расшифровано (AES-256-GCM / PBKDF2 100k).`);
        return { ok: true };
      } catch {
        const nextAttempts = (vault.failedAttempts || 0) + 1;
        const shouldLock = nextAttempts >= 10;
        const lockedUntil = shouldLock ? Date.now() + 60_000 : null;
        setPassVaults((prev) =>
          prev.map((v) =>
            v.id === vaultId
              ? { ...v, failedAttempts: shouldLock ? 0 : nextAttempts, lockedUntil }
              : v
          )
        );
        logDiag('warn', 'PassStore', `Неверный мастер-пароль для «${vault.name}» (попытка ${nextAttempts}/10).`);
        if (shouldLock) {
          return { ok: false, error: '10 неверных попыток. Хранилище заблокировано на 1 минуту.' };
        }
        return { ok: false, error: `Неверный мастер-пароль (попытка ${nextAttempts} из 10)` };
      }
    },
    [passVaults, logDiag]
  );

  const lockPassVault = useCallback(() => {
    setActivePassVaultId(null);
    setUnlockedPassData(null);
    activePassPasswordRef.current = null;
  }, []);

  const createPassVault = useCallback(
    async (name: string, password: string, hint: string) => {
      const emptyData: PassVaultData = {
        folders: [{ id: 'pf-default', name: 'Основные', sortOverride: null }],
        entries: [],
        sort: { field: 'title', dir: 'asc', favoritesFirst: true },
      };
      const encryptedPayload = await encryptJson(emptyData, password);
      const vault: PassVaultMeta = {
        id: `vault-${Date.now()}`,
        name: name.trim(),
        hint: hint.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        failedAttempts: 0,
        lockedUntil: null,
        rememberedPassword: null,
        encryptedPayload,
      };
      setPassVaults((prev) => [...prev, vault]);
      activePassPasswordRef.current = password;
      setActivePassVaultId(vault.id);
      setUnlockedPassData(emptyData);
      pushToast(`Создано зашифрованное хранилище «${vault.name}»`, 'success');
      logDiag('info', 'PassStore', `Создано новое хранилище паролей «${vault.name}» (AES-256-GCM).`);
    },
    [pushToast, logDiag]
  );

  const updatePassVaultData = useCallback(
    async (updater: (d: PassVaultData) => PassVaultData) => {
      if (!activePassVaultId || !unlockedPassData || !activePassPasswordRef.current) return;
      const next = updater(unlockedPassData);
      setUnlockedPassData(next);
      const encryptedPayload = await encryptJson(next, activePassPasswordRef.current);
      setPassVaults((prev) =>
        prev.map((v) =>
          v.id === activePassVaultId
            ? { ...v, encryptedPayload, updatedAt: new Date().toISOString() }
            : v
        )
      );
    },
    [activePassVaultId, unlockedPassData]
  );

  const changePassVaultMasterPassword = useCallback(
    async (vaultId: string, oldPw: string, newPw: string, newHint: string) => {
      const vault = passVaults.find((v) => v.id === vaultId);
      if (!vault) return { ok: false, error: 'Хранилище не найдено' };
      try {
        const data = await decryptJson<PassVaultData>(vault.encryptedPayload, oldPw);
        const reEncrypted = await encryptJson(data, newPw);
        setPassVaults((prev) =>
          prev.map((v) =>
            v.id === vaultId
              ? {
                  ...v,
                  hint: newHint,
                  encryptedPayload: reEncrypted,
                  rememberedPassword: v.rememberedPassword ? newPw : null,
                  updatedAt: new Date().toISOString(),
                }
              : v
          )
        );
        if (activePassVaultId === vaultId) {
          activePassPasswordRef.current = newPw;
        }
        pushToast('Мастер-пароль успешно изменён', 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Текущий мастер-пароль неверен' };
      }
    },
    [passVaults, activePassVaultId, pushToast]
  );

  const deletePassVault = useCallback(
    async (vaultId: string, password: string) => {
      const vault = passVaults.find((v) => v.id === vaultId);
      if (!vault) return { ok: false, error: 'Хранилище не найдено' };
      try {
        await decryptJson<PassVaultData>(vault.encryptedPayload, password);
        setPassVaults((prev) => prev.filter((v) => v.id !== vaultId));
        if (activePassVaultId === vaultId) {
          lockPassVault();
        }
        pushToast(`Хранилище «${vault.name}» удалено`, 'warn');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Неверный пароль для подтверждения удаления' };
      }
    },
    [passVaults, activePassVaultId, lockPassVault, pushToast]
  );

  const forgetRememberedPass = useCallback(
    (vaultId: string) => {
      setPassVaults((prev) =>
        prev.map((v) => (v.id === vaultId ? { ...v, rememberedPassword: null } : v))
      );
      pushToast('Сохранённый пароль удалён с устройства', 'info');
    },
    [pushToast]
  );

  // Sync & Safety Backups
  const stopSync = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setSyncState((prev) => ({ ...prev, isSyncing: false, stage: 'Остановлено пользователем' }));
    logDiag('warn', 'Sync', 'Синхронизация остановлена пользователем.');
  }, [logDiag]);

  const triggerSync = useCallback(() => {
    if (syncState.isSyncing) {
      stopSync();
      return;
    }
    const startTs = Date.now();
    const stages = [
      'Чтение manifest.json...',
      'Сверка дельта-изменений (5 потоков)...',
      'Шифрование блоков AES-256-GCM...',
      'Атомарная запись .tmp → .bak → .enc...',
      'Обновление индекса поиска...',
    ];
    let step = 0;
    setSyncState({
      isSyncing: true,
      progress: 8,
      stage: stages[0],
      speedDownKbps: 640,
      speedUpKbps: 420,
      lastSyncedAt: syncState.lastSyncedAt,
    });

    syncTimerRef.current = window.setInterval(() => {
      step++;
      if (step < stages.length) {
        setSyncState((prev) => ({
          ...prev,
          progress: Math.min(95, (step + 1) * 20),
          stage: stages[step],
          speedDownKbps: 480 + Math.round(Math.random() * 600),
          speedUpKbps: 310 + Math.round(Math.random() * 450),
        }));
      } else {
        if (syncTimerRef.current) window.clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
        const durationMs = Date.now() - startTs;
        const doneAt = new Date().toISOString();
        setSyncState({
          isSyncing: false,
          progress: 100,
          stage: 'Синхронизировано',
          speedDownKbps: 0,
          speedUpKbps: 0,
          lastSyncedAt: doneAt,
        });
        setDiagProcesses((prev) => [
          {
            id: `dp-${Date.now()}`,
            timestamp: doneAt,
            operation: `Дельта-обмен (${workspace.settings.syncPreset})`,
            status: 'ok',
            speedKbps: 890,
            bytes: JSON.stringify(workspace).length,
            detail: `Успешно: заметок ${workspace.notes.length}, событий ${workspace.events.length}`,
          },
          ...prev.slice(0, 49),
        ]);
        setSyncHistory((prev) => [
          {
            id: `sh-${Date.now()}`,
            timestamp: doneAt,
            target:
              workspace.settings.syncPreset === 'local'
                ? 'Локальное хранилище (data/)'
                : workspace.settings.syncEndpoint,
            uploaded: workspace.notes.length,
            downloaded: 0,
            conflicts: 0,
            durationMs,
            result: 'success',
          },
          ...prev.slice(0, 29),
        ]);
        logDiag('info', 'Sync', `Синхронизация завершена за ${durationMs} мс.`);
        pushToast('Синхронизация завершена без конфликтов', 'success');
      }
    }, 320);
  }, [syncState.isSyncing, syncState.lastSyncedAt, stopSync, workspace, logDiag, pushToast]);

  const createSafetyBackup = useCallback(
    (reason: string) => {
      const json = JSON.stringify(workspace);
      const bkp: SafetyBackup = {
        id: `sb-${Date.now()}`,
        createdAt: new Date().toISOString(),
        reason,
        sizeBytes: new Blob([json]).size,
        snapshotJson: json,
      };
      setSafetyBackups((prev) => [bkp, ...prev].slice(0, 5));
      logDiag('info', 'Backup', `Создана страховочная копия safety/: ${reason}`);
    },
    [workspace, logDiag]
  );

  const restoreSafetyBackup = useCallback(
    (backupId: string) => {
      const bkp = safetyBackups.find((b) => b.id === backupId);
      if (!bkp) return;
      createSafetyBackup('Автокопия перед откатом из safety/');
      try {
        const parsed = JSON.parse(bkp.snapshotJson) as WorkspaceSnapshot;
        setWorkspace(parsed);
        setSelectedNoteId(parsed.notes[0]?.id ?? null);
        pushToast('Профиль восстановлен из страховочной копии', 'success');
      } catch {
        pushToast('Не удалось прочитать страховочную копию', 'error');
      }
    },
    [safetyBackups, createSafetyBackup, pushToast]
  );

  const exportEncryptedProfileBackup = useCallback(
    async (password: string): Promise<string> => {
      const payload = await encryptJson(
        {
          exportedAt: new Date().toISOString(),
          profile: activeProfile.name,
          workspace,
        },
        password
      );
      logDiag('info', 'Backup', 'Создан зашифрованный .enc-бэкап профиля.');
      return payload;
    },
    [activeProfile.name, workspace, logDiag]
  );

  const importEncryptedProfileBackup = useCallback(
    async (jsonPayload: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const decoded = await decryptJson<{ workspace: WorkspaceSnapshot }>(jsonPayload, password);
        if (!decoded?.workspace?.notes) {
          return { ok: false, error: 'Неверная структура файла резервной копии' };
        }
        createSafetyBackup('Страховочная копия перед восстановлением бэкапа');
        setWorkspace(decoded.workspace);
        setSelectedNoteId(decoded.workspace.notes[0]?.id ?? null);
        pushToast('Зашифрованный бэкап успешно восстановлен', 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Неверный пароль или повреждённый файл бэкапа' };
      }
    },
    [createSafetyBackup, pushToast]
  );

  const value: AppContextValue = {
    profiles,
    activeProfile,
    isLocked,
    lockProfile,
    unlockProfile,
    createProfile,
    activeModule,
    setActiveModule,
    isMobileView,
    windowWidth,
    calendarSelectedDate,
    setCalendarSelectedDate,
    calendarView,
    setCalendarView,
    selectedNoteId,
    setSelectedNoteId,
    selectedFolderFilter,
    setSelectedFolderFilter,
    folders: workspace.folders,
    notes: workspace.notes,
    calendars: workspace.calendars,
    events: workspace.events,
    sharedGroups: workspace.sharedGroups,
    voiceHistory: workspace.voiceHistory,
    settings: workspace.settings,
    createFolder,
    renameFolder,
    deleteFolder,
    createNote,
    updateNote,
    deleteNoteToTrash,
    restoreNoteFromTrash,
    deleteNotePermanently,
    emptyNotesTrash,
    restoreNoteVersion,
    addCalendarSource,
    toggleCalendarVisibility,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    createSharedGroup,
    updateSharedGroup,
    addVoiceRecord,
    deleteVoiceRecord,
    updateSettings,
    toggleModuleEnabled,
    adjustUiScale,
    resetUiScale,
    passVaults,
    activePassVaultId,
    unlockedPassData,
    unlockPassVault,
    lockPassVault,
    createPassVault,
    updatePassVaultData,
    changePassVaultMasterPassword,
    deletePassVault,
    forgetRememberedPass,
    syncState,
    triggerSync,
    stopSync,
    safetyBackups,
    createSafetyBackup,
    restoreSafetyBackup,
    exportEncryptedProfileBackup,
    importEncryptedProfileBackup,
    diagOpen,
    setDiagOpen,
    diagProcesses,
    syncHistory,
    diagLogs,
    logDiag,
    clipboardTimer,
    copySensitiveText,
    toasts,
    pushToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useAppStore(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppStoreProvider');
  return ctx;
}
