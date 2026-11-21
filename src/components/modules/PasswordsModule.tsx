import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  CheckSquare,
  Copy,
  Download,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  History,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import {
  evaluatePasswordStrength,
  generatePassword,
  PasswordGenOptions,
} from '../../lib/crypto';
import {
  PassEntry,
  PassExtraField,
  PassSortConfig,
  PassSortField,
} from '../../types';

const EXTRA_FIELD_PRESETS = ['PIN-код', 'Секретный вопрос', 'Номер карты', 'Своё поле'];

export const PasswordsModule: React.FC = () => {
  const {
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
    copySensitiveText,
    pushToast,
    isMobileView,
  } = useAppStore();

  // Start / Unlock screen state
  const [startMode, setStartMode] = useState<'login' | 'create'>('login');
  const [selectedVaultId, setSelectedVaultId] = useState<string>(passVaults[0]?.id || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberPw, setRememberPw] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  // Create vault form
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPw1, setNewVaultPw1] = useState('');
  const [newVaultPw2, setNewVaultPw2] = useState('');
  const [newVaultHint, setNewVaultHint] = useState('');

  // Vault explorer state
  const [folderFilter, setFolderFilter] = useState<string>('all'); // 'all' | 'favorites' | 'trash' | folderId
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [multiSelectIds, setMultiSelectIds] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genOpts, setGenOpts] = useState<PasswordGenOptions>({
    length: 18,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    excludeSimilar: true,
  });
  const [vaultSettingsOpen, setVaultSettingsOpen] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [mobileDetail, setMobileDetail] = useState(false);

  // Change password / Delete vault form inside vaultSettingsOpen
  const [chgOldPw, setChgOldPw] = useState('');
  const [chgNewPw, setChgNewPw] = useState('');
  const [chgNewHint, setChgNewHint] = useState('');
  const [delConfirmPw, setDelConfirmPw] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedVaultId && passVaults.length > 0) {
      setSelectedVaultId(passVaults[0].id);
    }
  }, [passVaults, selectedVaultId]);

  // Countdown tick if locked out
  const targetVaultMeta = useMemo(
    () => passVaults.find((v) => v.id === (activePassVaultId || selectedVaultId)),
    [passVaults, activePassVaultId, selectedVaultId]
  );

  useEffect(() => {
    if (!targetVaultMeta?.lockedUntil) return;
    const t = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [targetVaultMeta?.lockedUntil]);

  const lockSecondsLeft = targetVaultMeta?.lockedUntil
    ? Math.max(0, Math.ceil((targetVaultMeta.lockedUntil - nowTs) / 1000))
    : 0;

  // Duplicate password map inside unlocked vault
  const passwordUsageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!unlockedPassData) return counts;
    unlockedPassData.entries
      .filter((e) => !e.isTrashed && e.password)
      .forEach((e) => {
        counts[e.password] = (counts[e.password] || 0) + 1;
      });
    return counts;
  }, [unlockedPassData]);

  // Active sort config (folder override or vault default)
  const activeFolderObj = unlockedPassData?.folders.find((f) => f.id === folderFilter);
  const effectiveSort: PassSortConfig = activeFolderObj?.sortOverride ||
    unlockedPassData?.sort || { field: 'title', dir: 'asc', favoritesFirst: true };

  const visibleEntries = useMemo(() => {
    if (!unlockedPassData) return [];
    const q = search.trim().toLowerCase();
    return unlockedPassData.entries
      .filter((e) => {
        if (folderFilter === 'trash') return e.isTrashed;
        if (e.isTrashed) return false;
        if (folderFilter === 'favorites') return e.isFavorite;
        if (folderFilter !== 'all') return e.folderId === folderFilter;
        return true;
      })
      .filter((e) => {
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q) ||
          e.url.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (effectiveSort.favoritesFirst && a.isFavorite !== b.isFavorite) {
          return a.isFavorite ? -1 : 1;
        }
        const dir = effectiveSort.dir === 'asc' ? 1 : -1;
        const field = effectiveSort.field;
        return (a[field] || '').localeCompare(b[field] || '', 'ru') * dir;
      });
  }, [unlockedPassData, folderFilter, search, effectiveSort]);

  const activeEntry = useMemo(
    () =>
      unlockedPassData?.entries.find((e) => e.id === selectedEntryId) ??
      visibleEntries[0] ??
      null,
    [unlockedPassData, selectedEntryId, visibleEntries]
  );

  // Ctrl+A for multi-select inside unlocked vault
  useEffect(() => {
    if (!activePassVaultId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setMultiSelectIds(new Set(visibleEntries.map((x) => x.id)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activePassVaultId, visibleEntries]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaultId || !loginPassword) return;
    setAuthBusy(true);
    setAuthError('');
    const res = await unlockPassVault(selectedVaultId, loginPassword, rememberPw);
    setAuthBusy(false);
    if (!res.ok) {
      setAuthError(res.error || 'Ошибка входа');
    } else {
      setLoginPassword('');
    }
  };

  const handleQuickRememberedUnlock = async () => {
    if (!targetVaultMeta?.rememberedPassword) return;
    setAuthBusy(true);
    const res = await unlockPassVault(targetVaultMeta.id, targetVaultMeta.rememberedPassword, true);
    setAuthBusy(false);
    if (!res.ok) setAuthError(res.error || 'Ошибка входа');
  };

  const handleCreateVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVaultName.trim()) {
      setAuthError('Укажите название хранилища');
      return;
    }
    if (newVaultPw1.length < 4) {
      setAuthError('Мастер-пароль должен содержать минимум 4 символа');
      return;
    }
    if (newVaultPw1 !== newVaultPw2) {
      setAuthError('Пароли не совпадают');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    await createPassVault(newVaultName, newVaultPw1, newVaultHint);
    setAuthBusy(false);
    setNewVaultName('');
    setNewVaultPw1('');
    setNewVaultPw2('');
    setNewVaultHint('');
  };

  // --- LOCKED / START SCREEN ---
  if (!activePassVaultId || !unlockedPassData) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-[var(--bg)] overflow-y-auto">
        <div className="w-full max-w-md rounded-[12px] border border-[var(--divider)] bg-[var(--panel)] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[var(--text)]">Хранилище паролей</h2>
              <p className="text-[12px] text-[var(--text2)]">
                Изолированный контур AES-256-GCM · PBKDF2 100 000
              </p>
            </div>
          </div>

          {/* 2 Primary Buttons on Start Screen */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-[9px] bg-[var(--sidebar)]">
            <button
              type="button"
              onClick={() => {
                setStartMode('login');
                setAuthError('');
              }}
              className={`py-2 rounded-[7px] text-[13px] font-medium transition-colors ${
                startMode === 'login'
                  ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              Войти
            </button>
            <button
              type="button"
              onClick={() => {
                setStartMode('create');
                setAuthError('');
              }}
              className={`py-2 rounded-[7px] text-[13px] font-medium transition-colors ${
                startMode === 'create'
                  ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              Создать новое хранилище
            </button>
          </div>

          {startMode === 'login' ? (
            passVaults.length === 0 ? (
              <div className="py-6 text-center space-y-3">
                <p className="text-[13.5px] font-medium text-[var(--text)]">Хранилище не найдено</p>
                <p className="text-[12.5px] text-[var(--text2)]">
                  Создайте новое зашифрованное хранилище со своим мастер-паролем.
                </p>
                <button
                  type="button"
                  onClick={() => setStartMode('create')}
                  className="px-4 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium"
                >
                  Создать хранилище
                </button>
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                    Хранилище
                  </label>
                  <select
                    value={selectedVaultId}
                    onChange={(e) => {
                      setSelectedVaultId(e.target.value);
                      setAuthError('');
                    }}
                    className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  >
                    {passVaults.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {targetVaultMeta?.hint && (
                  <div className="px-3 py-2 rounded-[8px] bg-[var(--sidebar)] text-[12px] text-[var(--text2)]">
                    Подсказка: <span className="text-[var(--text)]">{targetVaultMeta.hint}</span>
                  </div>
                )}

                {targetVaultMeta?.rememberedPassword && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-[8px] border border-[var(--divider)] bg-[var(--accent-soft)]">
                    <button
                      type="button"
                      onClick={handleQuickRememberedUnlock}
                      className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                    >
                      Войти по сохранённому ключу устройства
                    </button>
                    <button
                      type="button"
                      onClick={() => forgetRememberedPass(targetVaultMeta.id)}
                      className="text-[11.5px] text-[var(--text2)] hover:text-[var(--error)]"
                    >
                      Забыть
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                    Мастер-пароль
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    disabled={lockSecondsLeft > 0}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Введите мастер-пароль..."
                    className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-50"
                  />
                </div>

                <label className="flex items-center gap-2 text-[12.5px] text-[var(--text2)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberPw}
                    onChange={(e) => setRememberPw(e.target.checked)}
                    className="svod-checkbox"
                  />
                  <span>Запомнить пароль на этом устройстве</span>
                </label>

                {lockSecondsLeft > 0 && (
                  <div className="p-2.5 rounded-[8px] bg-red-500/10 text-[var(--error)] text-[12px] font-mono-tabular">
                    Блокировка от подбора: осталось {lockSecondsLeft} сек.
                  </div>
                )}

                {authError && (
                  <div className="p-2.5 rounded-[8px] bg-red-500/10 text-[var(--error)] text-[12px]">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authBusy || lockSecondsLeft > 0 || !loginPassword}
                  className="w-full py-2.5 rounded-[8px] bg-[var(--accent)] text-white text-[13.5px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {authBusy ? 'Расшифровка PBKDF2...' : 'Открыть хранилище'}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleCreateVaultSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                  Название хранилища
                </label>
                <input
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  placeholder="Например: Рабочие ключи"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                  Мастер-пароль
                </label>
                <input
                  type="password"
                  value={newVaultPw1}
                  onChange={(e) => setNewVaultPw1(e.target.value)}
                  placeholder="Минимум 8 символов"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                  Повторите мастер-пароль
                </label>
                <input
                  type="password"
                  value={newVaultPw2}
                  onChange={(e) => setNewVaultPw2(e.target.value)}
                  placeholder="Повторите ввод"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                  Открытая подсказка (не пишите сам пароль!)
                </label>
                <input
                  value={newVaultHint}
                  onChange={(e) => setNewVaultHint(e.target.value)}
                  placeholder="Короткое напоминание для себя"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-[var(--warn)] mt-1">
                  Подсказка хранится в открытом виде — никогда не указывайте в ней сам мастер-пароль.
                </p>
              </div>
              {authError && (
                <div className="p-2.5 rounded-[8px] bg-red-500/10 text-[var(--error)] text-[12px]">
                  {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-2.5 rounded-[8px] bg-[var(--accent)] text-white text-[13.5px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {authBusy ? 'Шифрование...' : 'Создать хранилище'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- UNLOCKED VAULT ACTIONS ---
  const createEntry = () => {
    const now = new Date().toISOString();
    const entry: PassEntry = {
      id: `pe-${Date.now()}`,
      folderId:
        folderFilter !== 'all' && folderFilter !== 'favorites' && folderFilter !== 'trash'
          ? folderFilter
          : null,
      title: 'Новая запись',
      username: '',
      password: generatePassword(genOpts),
      url: '',
      notes: '',
      extraFields: [],
      history: [],
      isFavorite: false,
      isTrashed: false,
      createdAt: now,
      updatedAt: now,
    };
    updatePassVaultData((d) => ({ ...d, entries: [entry, ...d.entries] }));
    setSelectedEntryId(entry.id);
    if (isMobileView) setMobileDetail(true);
  };

  const patchEntry = (id: string, patch: Partial<PassEntry>, recordPwHistory = false) => {
    updatePassVaultData((d) => ({
      ...d,
      entries: d.entries.map((e) => {
        if (e.id !== id) return e;
        const history =
          recordPwHistory && patch.password !== undefined && patch.password !== e.password && e.password
            ? [{ password: e.password, changedAt: new Date().toISOString() }, ...e.history].slice(0, 10)
            : e.history;
        return { ...e, ...patch, history, updatedAt: new Date().toISOString() };
      }),
    }));
  };

  const updateSort = (patch: Partial<PassSortConfig>) => {
    const nextSort = { ...effectiveSort, ...patch };
    updatePassVaultData((d) => {
      if (activeFolderObj) {
        return {
          ...d,
          folders: d.folders.map((f) =>
            f.id === activeFolderObj.id ? { ...f, sortOverride: nextSort } : f
          ),
        };
      }
      return { ...d, sort: nextSort };
    });
  };

  const resetFolderSort = () => {
    if (!activeFolderObj) return;
    updatePassVaultData((d) => ({
      ...d,
      folders: d.folders.map((f) =>
        f.id === activeFolderObj.id ? { ...f, sortOverride: null } : f
      ),
    }));
    pushToast('Сортировка папки сброшена на общую', 'info');
  };

  const toggleMulti = (id: string) => {
    setMultiSelectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batchTrash = () => {
    updatePassVaultData((d) => ({
      ...d,
      entries: d.entries.map((e) => (multiSelectIds.has(e.id) ? { ...e, isTrashed: true } : e)),
    }));
    setMultiSelectIds(new Set());
    pushToast('Выбранные записи перемещены в корзину', 'info');
  };

  const batchRestore = () => {
    updatePassVaultData((d) => ({
      ...d,
      entries: d.entries.map((e) => (multiSelectIds.has(e.id) ? { ...e, isTrashed: false } : e)),
    }));
    setMultiSelectIds(new Set());
    pushToast('Записи восстановлены', 'success');
  };

  const batchDeletePermanent = () => {
    updatePassVaultData((d) => ({
      ...d,
      entries: d.entries.filter((e) => !multiSelectIds.has(e.id)),
    }));
    setMultiSelectIds(new Set());
    pushToast('Записи удалены навсегда', 'warn');
  };

  const batchFavorite = () => {
    updatePassVaultData((d) => ({
      ...d,
      entries: d.entries.map((e) => (multiSelectIds.has(e.id) ? { ...e, isFavorite: true } : e)),
    }));
    setMultiSelectIds(new Set());
    pushToast('Добавлено в избранное', 'success');
  };

  const exportBitwardenJson = () => {
    const payload = {
      encrypted: false,
      folders: unlockedPassData.folders.map((f) => ({ id: f.id, name: f.name })),
      items: unlockedPassData.entries
        .filter((e) => !e.isTrashed)
        .map((e) => ({
          id: e.id,
          folderId: e.folderId,
          name: e.title,
          favorite: e.isFavorite,
          notes: e.notes,
          login: {
            username: e.username,
            password: e.password,
            uris: e.url ? [{ uri: e.url }] : [],
          },
          fields: e.extraFields.map((f) => ({ name: f.label, value: f.value, type: f.hidden ? 1 : 0 })),
        })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetVaultMeta?.name || 'vault'}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Экспорт в Bitwarden JSON выполнен', 'success');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.items)) {
        const imported: PassEntry[] = parsed.items.map((it: Record<string, unknown>, idx: number) => {
          const login = (it.login || {}) as Record<string, unknown>;
          const uris = Array.isArray(login.uris) ? login.uris : [];
          return {
            id: `pe-imp-${Date.now()}-${idx}`,
            folderId: null,
            title: String(it.name || 'Импортированная запись'),
            username: String(login.username || ''),
            password: String(login.password || ''),
            url: String((uris[0] as Record<string, unknown>)?.uri || ''),
            notes: String(it.notes || ''),
            extraFields: [],
            history: [],
            isFavorite: Boolean(it.favorite),
            isTrashed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
        updatePassVaultData((d) => ({ ...d, entries: [...imported, ...d.entries] }));
        pushToast(`Импортировано записей: ${imported.length}`, 'success');
      }
    } catch {
      // Fallback CSV: title,username,password,url
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const imported: PassEntry[] = lines.slice(1).map((line, idx) => {
        const cols = line.split(/[,;]/).map((c) => c.replace(/^"|"$/g, '').trim());
        return {
          id: `pe-csv-${Date.now()}-${idx}`,
          folderId: null,
          title: cols[0] || `Запись ${idx + 1}`,
          username: cols[1] || '',
          password: cols[2] || '',
          url: cols[3] || '',
          notes: cols[4] || '',
          extraFields: [],
          history: [],
          isFavorite: false,
          isTrashed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      if (imported.length > 0) {
        updatePassVaultData((d) => ({ ...d, entries: [...imported, ...d.entries] }));
        pushToast(`Импортировано из CSV: ${imported.length}`, 'success');
      } else {
        pushToast('Не удалось распознать формат файла импорта', 'error');
      }
    }
    e.target.value = '';
  };

  const activeStrength = activeEntry ? evaluatePasswordStrength(activeEntry.password) : null;
  const isDuplicatePw =
    activeEntry && activeEntry.password && (passwordUsageCount[activeEntry.password] || 0) > 1;

  // --- THREE PANE UNLOCKED VAULT ---
  return (
    <div className="h-full flex overflow-hidden bg-[var(--bg)]">
      <input
        ref={importRef}
        type="file"
        accept=".json,.csv"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Pane 1: Vault Folders */}
      {!isMobileView && (
        <div className="w-[205px] h-full flex flex-col bg-[var(--sidebar)] border-r border-[var(--divider)] shrink-0">
          <div className="h-9 px-2.5 border-b border-[var(--divider)] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text)] truncate">
              {targetVaultMeta?.name}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setVaultSettingsOpen(true)}
                title="Параметры хранилища"
                className="p-1 rounded-[5px] text-[var(--text2)] hover:text-[var(--text)]"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={lockPassVault}
                title="Заблокировать хранилище"
                className="p-1 rounded-[5px] text-[var(--text2)] hover:text-[var(--error)]"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-[12.5px]">
            <button
              type="button"
              onClick={() => setFolderFilter('all')}
              className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between ${
                folderFilter === 'all'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <span>Все записи</span>
              <span className="text-[11px] tabular-nums">
                {unlockedPassData.entries.filter((e) => !e.isTrashed).length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFolderFilter('favorites')}
              className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between ${
                folderFilter === 'favorites'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" />
                Избранное
              </span>
              <span className="text-[11px] tabular-nums">
                {unlockedPassData.entries.filter((e) => !e.isTrashed && e.isFavorite).length}
              </span>
            </button>

            <div className="pt-2 flex items-center justify-between px-2">
              <span className="text-[11px] font-medium text-[var(--muted)]">Папки</span>
              <button
                type="button"
                onClick={() => setAddingFolder((v) => !v)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {addingFolder && (
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    const id = `pf-${Date.now()}`;
                    updatePassVaultData((d) => ({
                      ...d,
                      folders: [...d.folders, { id, name: newFolderName.trim(), sortOverride: null }],
                    }));
                    setNewFolderName('');
                    setAddingFolder(false);
                  }
                  if (e.key === 'Escape') setAddingFolder(false);
                }}
                placeholder="Имя папки..."
                className="w-full px-2 py-1 text-[12px] rounded-[7px] border border-[var(--accent)] bg-[var(--panel)] text-[var(--text)] outline-none"
              />
            )}

            {unlockedPassData.folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderFilter(f.id)}
                className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between ${
                  folderFilter === f.id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Folder className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="text-[11px] tabular-nums">
                  {unlockedPassData.entries.filter((e) => !e.isTrashed && e.folderId === f.id).length}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setFolderFilter('trash')}
              className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between mt-2 ${
                folderFilter === 'trash'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                Корзина
              </span>
              <span className="text-[11px] tabular-nums">
                {unlockedPassData.entries.filter((e) => e.isTrashed).length}
              </span>
            </button>
          </div>

          <div className="p-2 border-t border-[var(--divider)] flex items-center gap-1">
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="flex-1 py-1.5 rounded-[7px] border border-[var(--divider)] bg-[var(--panel)] text-[11.5px] text-[var(--text2)] hover:text-[var(--text)] flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3" />
              Импорт
            </button>
            <button
              type="button"
              onClick={exportBitwardenJson}
              className="flex-1 py-1.5 rounded-[7px] border border-[var(--divider)] bg-[var(--panel)] text-[11.5px] text-[var(--text2)] hover:text-[var(--text)] flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3" />
              Экспорт
            </button>
          </div>
        </div>
      )}

      {/* Pane 2: Entry List */}
      {(!isMobileView || !mobileDetail) && (
        <div
          className={`${
            isMobileView ? 'w-full' : 'w-[280px] border-r border-[var(--divider)]'
          } h-full flex flex-col bg-[var(--bg)] shrink-0`}
        >
          <div className="h-9 px-2.5 border-b border-[var(--divider)] flex items-center justify-between gap-1">
            <span className="text-[12px] font-semibold text-[var(--text)]">
              Записи ({visibleEntries.length})
            </span>
            <div className="flex items-center gap-1">
              {isMobileView && (
                <button
                  type="button"
                  onClick={lockPassVault}
                  className="p-1 rounded-[5px] text-[var(--text2)]"
                  title="Заблокировать"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={createEntry}
                className="px-2 py-1 rounded-[6px] bg-[var(--accent)] text-white text-[11.5px] font-medium flex items-center gap-1 hover:bg-[var(--accent-hover)]"
              >
                <Plus className="w-3 h-3" />
                Добавить
              </button>
            </div>
          </div>

          {/* Search + Two-level Sort Controls */}
          <div className="p-2 border-b border-[var(--divider)] space-y-1.5">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по логину, сайту..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-1 min-w-0">
                <ArrowDownUp className="w-3 h-3 text-[var(--muted)] shrink-0" />
                <select
                  value={effectiveSort.field}
                  onChange={(e) => updateSort({ field: e.target.value as PassSortField })}
                  className="bg-transparent text-[var(--text2)] outline-none cursor-pointer"
                >
                  <option value="title">Название</option>
                  <option value="updatedAt">Дата изменения</option>
                  <option value="createdAt">Дата создания</option>
                  <option value="username">Логин</option>
                  <option value="url">Сайт</option>
                </select>
                <button
                  type="button"
                  onClick={() => updateSort({ dir: effectiveSort.dir === 'asc' ? 'desc' : 'asc' })}
                  className="px-1 rounded text-[var(--text2)] hover:text-[var(--text)]"
                >
                  {effectiveSort.dir === 'asc' ? 'А→Я' : 'Я→А'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => updateSort({ favoritesFirst: !effectiveSort.favoritesFirst })}
                title="Избранные сверху"
                className={`px-1.5 py-0.5 rounded ${
                  effectiveSort.favoritesFirst
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--muted)]'
                }`}
              >
                ★ сверху
              </button>
            </div>

            {activeFolderObj?.sortOverride && (
              <button
                type="button"
                onClick={resetFolderSort}
                className="text-[11px] text-[var(--accent)] hover:underline"
              >
                Сбросить: как во всём хранилище
              </button>
            )}
          </div>

          {/* Multi-select batch actions bar */}
          {multiSelectIds.size > 0 && (
            <div className="px-2.5 py-1.5 bg-[var(--accent-soft)] border-b border-[var(--divider)] flex items-center justify-between gap-1 text-[11.5px]">
              <span className="font-medium text-[var(--accent)]">Выбрано: {multiSelectIds.size}</span>
              <div className="flex items-center gap-1.5">
                {folderFilter === 'trash' ? (
                  <>
                    <button type="button" onClick={batchRestore} className="text-[var(--text)] hover:underline">
                      Восстановить
                    </button>
                    <button
                      type="button"
                      onClick={batchDeletePermanent}
                      className="text-[var(--error)] hover:underline"
                    >
                      Удалить
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={batchFavorite} className="text-[var(--text)] hover:underline">
                      ★
                    </button>
                    <button type="button" onClick={batchTrash} className="text-[var(--error)] hover:underline">
                      В корзину
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setMultiSelectIds(new Set())}
                  className="text-[var(--text2)]"
                >
                  Снять
                </button>
              </div>
            </div>
          )}

          {/* Entries */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {visibleEntries.length === 0 ? (
              <div className="py-10 text-center text-[12.5px] text-[var(--muted)]">
                Записей пока нет
              </div>
            ) : (
              visibleEntries.map((entry) => {
                const isSel = activeEntry?.id === entry.id;
                const isChecked = multiSelectIds.has(entry.id);
                const strength = evaluatePasswordStrength(entry.password);
                const dup = entry.password && (passwordUsageCount[entry.password] || 0) > 1;
                return (
                  <div
                    key={entry.id}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        toggleMulti(entry.id);
                      } else {
                        setSelectedEntryId(entry.id);
                        setShowPassword(false);
                        if (isMobileView) setMobileDetail(true);
                      }
                    }}
                    className={`p-2.5 rounded-[10px] border cursor-pointer transition-colors ${
                      isSel
                        ? 'border-[var(--accent)] bg-[var(--panel)]'
                        : 'border-[var(--divider)] bg-[var(--panel)]/70 hover:bg-[var(--panel)]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleMulti(entry.id)}
                        className="svod-checkbox mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[13px] font-semibold text-[var(--text)] truncate">
                            {entry.title || 'Без названия'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {entry.isFavorite && (
                              <Star className="w-3 h-3 text-[var(--warn)] fill-current" />
                            )}
                            {(strength.level === 'weak' || dup) && !entry.isTrashed && (
                              <AlertTriangle className="w-3 h-3 text-[var(--warn)]" />
                            )}
                          </div>
                        </div>
                        <div className="text-[11.5px] text-[var(--text2)] truncate">
                          {entry.username || entry.url || 'Логин не указан'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Pane 3: Entry Detail Card */}
      {(!isMobileView || mobileDetail) && (
        <div className="flex-1 min-w-[280px] h-full flex flex-col bg-[var(--panel)] overflow-hidden">
          {!activeEntry ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-[13.5px] text-[var(--text2)] mb-3">
                Выберите запись или добавьте новую
              </p>
              <button
                type="button"
                onClick={createEntry}
                className="px-4 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium"
              >
                Создать запись
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 max-w-2xl space-y-4">
              {isMobileView && (
                <button
                  type="button"
                  onClick={() => setMobileDetail(false)}
                  className="text-[12.5px] text-[var(--accent)] font-medium"
                >
                  ← К списку записей
                </button>
              )}

              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--divider)]">
                <input
                  value={activeEntry.title}
                  onChange={(e) => patchEntry(activeEntry.id, { title: e.target.value })}
                  className="text-[18px] font-bold text-[var(--text)] bg-transparent outline-none flex-1"
                  placeholder="Название записи"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      patchEntry(activeEntry.id, { isFavorite: !activeEntry.isFavorite })
                    }
                    className={`p-1.5 rounded-[7px] border border-[var(--divider)] ${
                      activeEntry.isFavorite ? 'text-[var(--warn)]' : 'text-[var(--text2)]'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${activeEntry.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  {activeEntry.isTrashed ? (
                    <button
                      type="button"
                      onClick={() => patchEntry(activeEntry.id, { isTrashed: false })}
                      className="px-2.5 py-1.5 rounded-[7px] bg-[var(--accent)] text-white text-[12px]"
                    >
                      Восстановить
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        patchEntry(activeEntry.id, { isTrashed: true });
                        pushToast('Запись перемещена в корзину хранилища', 'info');
                      }}
                      className="p-1.5 rounded-[7px] border border-[var(--divider)] text-[var(--text2)] hover:text-[var(--error)]"
                      title="В корзину"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Security warnings */}
              {(activeStrength?.level === 'weak' || isDuplicatePw) && !activeEntry.isTrashed && (
                <div className="p-3 rounded-[10px] border border-[var(--warn)]/40 bg-[var(--tag-bg)]/50 text-[12.5px] space-y-1">
                  {activeStrength?.level === 'weak' && (
                    <div className="flex items-center gap-2 text-[var(--warn)] font-medium">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      Слабый пароль — рекомендуется сгенерировать более стойкий
                    </div>
                  )}
                  {isDuplicatePw && (
                    <div className="flex items-center gap-2 text-[var(--warn)] font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Этот пароль уже используется в другой записи хранилища
                    </div>
                  )}
                </div>
              )}

              {/* Folder & Login */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] text-[var(--text2)] mb-1">Логин / Email</label>
                  <div className="flex items-center gap-1">
                    <input
                      value={activeEntry.username}
                      onChange={(e) => patchEntry(activeEntry.id, { username: e.target.value })}
                      className="flex-1 px-3 py-1.5 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => copySensitiveText(activeEntry.username, 'Логин')}
                      className="p-2 rounded-[8px] border border-[var(--divider)] text-[var(--text2)] hover:text-[var(--text)]"
                      title="Копировать логин"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] text-[var(--text2)] mb-1">Папка</label>
                  <select
                    value={activeEntry.folderId || ''}
                    onChange={(e) =>
                      patchEntry(activeEntry.id, { folderId: e.target.value || null })
                    }
                    className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  >
                    <option value="">Без папки</option>
                    {unlockedPassData.folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password Field + Strength + Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11.5px] text-[var(--text2)]">Пароль</label>
                  {activeStrength && (
                    <span
                      className="text-[11px] font-medium"
                      style={{
                        color:
                          activeStrength.level === 'strong'
                            ? 'var(--success)'
                            : activeStrength.level === 'medium'
                            ? 'var(--warn)'
                            : 'var(--error)',
                      }}
                    >
                      {activeStrength.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={activeEntry.password}
                    onChange={(e) => patchEntry(activeEntry.id, { password: e.target.value }, true)}
                    className="flex-1 px-3 py-1.5 text-[13px] font-mono-tabular rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-2 rounded-[8px] border border-[var(--divider)] text-[var(--text2)] hover:text-[var(--text)]"
                    title={showPassword ? 'Скрыть' : 'Показать'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copySensitiveText(activeEntry.password, 'Пароль')}
                    className="p-2 rounded-[8px] border border-[var(--divider)] text-[var(--text2)] hover:text-[var(--accent)]"
                    title="Копировать пароль"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenOpen((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-[8px] border text-[12px] font-medium flex items-center gap-1 ${
                      genOpen
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--divider)] text-[var(--text2)] hover:text-[var(--text)]'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Генератор
                  </button>
                </div>

                {genOpen && (
                  <div className="mt-2 p-3 rounded-[10px] border border-[var(--divider)] bg-[var(--sidebar)] space-y-2.5 text-[12px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--text2)]">Длина: <strong className="font-mono-tabular text-[var(--text)]">{genOpts.length}</strong></span>
                      <input
                        type="range"
                        min={6}
                        max={64}
                        value={genOpts.length}
                        onChange={(e) =>
                          setGenOpts((o) => ({ ...o, length: Number(e.target.value) }))
                        }
                        className="flex-1 accent-[var(--accent)]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 text-[var(--text)]">
                      {(
                        [
                          ['upper', 'A–Z'],
                          ['lower', 'a–z'],
                          ['digits', '0–9'],
                          ['symbols', '!@#$'],
                          ['excludeSimilar', 'Без похожих (0 O o 1 l I |)'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={genOpts[key]}
                            onChange={(e) =>
                              setGenOpts((o) => ({ ...o, [key]: e.target.checked }))
                            }
                            className="svod-checkbox"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const pw = generatePassword(genOpts);
                        patchEntry(activeEntry.id, { password: pw }, true);
                        setShowPassword(true);
                      }}
                      className="px-3 py-1.5 rounded-[7px] bg-[var(--accent)] text-white text-[12px] font-medium hover:bg-[var(--accent-hover)]"
                    >
                      Сгенерировать и подставить
                    </button>
                  </div>
                )}
              </div>

              {/* Site URL */}
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Сайт / адрес</label>
                <input
                  value={activeEntry.url}
                  onChange={(e) => patchEntry(activeEntry.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Extra Custom Fields */}
              <div className="space-y-2 pt-2 border-t border-[var(--divider)]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[12px] font-semibold text-[var(--text)]">
                    Дополнительные поля
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {EXTRA_FIELD_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const f: PassExtraField = {
                            id: `ef-${Date.now()}`,
                            label: preset === 'Своё поле' ? 'Новое поле' : preset,
                            value: '',
                            hidden: preset === 'PIN-код' || preset === 'Номер карты',
                          };
                          patchEntry(activeEntry.id, {
                            extraFields: [...activeEntry.extraFields, f],
                          });
                        }}
                        className="px-2 py-0.5 rounded-[6px] border border-[var(--divider)] bg-[var(--sidebar)] text-[11px] text-[var(--text2)] hover:text-[var(--text)]"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {activeEntry.extraFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-1.5">
                    <input
                      value={field.label}
                      onChange={(e) =>
                        patchEntry(activeEntry.id, {
                          extraFields: activeEntry.extraFields.map((x) =>
                            x.id === field.id ? { ...x, label: e.target.value } : x
                          ),
                        })
                      }
                      className="w-36 px-2 py-1.5 text-[12px] rounded-[7px] border border-[var(--divider)] bg-[var(--sidebar)] text-[var(--text)] outline-none"
                    />
                    <input
                      type={field.hidden ? 'password' : 'text'}
                      value={field.value}
                      onChange={(e) =>
                        patchEntry(activeEntry.id, {
                          extraFields: activeEntry.extraFields.map((x) =>
                            x.id === field.id ? { ...x, value: e.target.value } : x
                          ),
                        })
                      }
                      className="flex-1 px-2.5 py-1.5 text-[12.5px] font-mono-tabular rounded-[7px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patchEntry(activeEntry.id, {
                          extraFields: activeEntry.extraFields.map((x) =>
                            x.id === field.id ? { ...x, hidden: !x.hidden } : x
                          ),
                        })
                      }
                      className="p-1.5 text-[var(--text2)] hover:text-[var(--text)]"
                    >
                      {field.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copySensitiveText(field.value, field.label)}
                      className="p-1.5 text-[var(--text2)] hover:text-[var(--accent)]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patchEntry(activeEntry.id, {
                          extraFields: activeEntry.extraFields.filter((x) => x.id !== field.id),
                        })
                      }
                      className="p-1.5 text-[var(--muted)] hover:text-[var(--error)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11.5px] text-[var(--text2)] mb-1">Заметка</label>
                <textarea
                  rows={3}
                  value={activeEntry.notes}
                  onChange={(e) => patchEntry(activeEntry.id, { notes: e.target.value })}
                  placeholder="Дополнительные сведения..."
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Password History */}
              {activeEntry.history.length > 0 && (
                <div className="pt-2 border-t border-[var(--divider)] space-y-1.5">
                  <div className="text-[12px] font-semibold text-[var(--text)] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    История пароля ({activeEntry.history.length})
                  </div>
                  {activeEntry.history.map((h, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--sidebar)] flex items-center justify-between text-[12px]"
                    >
                      <span className="font-mono-tabular text-[var(--text2)]">
                        {new Date(h.changedAt).toLocaleDateString('ru-RU')} · ••••••••
                      </span>
                      <button
                        type="button"
                        onClick={() => patchEntry(activeEntry.id, { password: h.password }, true)}
                        className="text-[var(--accent)] hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Вернуть
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vault Settings Modal (Change master password / Delete vault) */}
      {vaultSettingsOpen && targetVaultMeta && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setVaultSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-[var(--divider)] bg-[var(--panel)] p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[var(--text)]">
                Управление хранилищем «{targetVaultMeta.name}»
              </h3>
              <button
                type="button"
                onClick={() => setVaultSettingsOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {targetVaultMeta.rememberedPassword && (
              <button
                type="button"
                onClick={() => forgetRememberedPass(targetVaultMeta.id)}
                className="w-full py-1.5 rounded-[8px] border border-[var(--divider)] text-[12.5px] text-[var(--text)] hover:bg-[var(--sidebar)]"
              >
                Забыть сохранённый пароль на этом устройстве
              </button>
            )}

            <div className="space-y-2 pt-2 border-t border-[var(--divider)]">
              <div className="text-[12.5px] font-semibold text-[var(--text)]">Смена мастер-пароля</div>
              <input
                type="password"
                value={chgOldPw}
                onChange={(e) => setChgOldPw(e.target.value)}
                placeholder="Текущий мастер-пароль"
                className="w-full px-3 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
              />
              <input
                type="password"
                value={chgNewPw}
                onChange={(e) => setChgNewPw(e.target.value)}
                placeholder="Новый мастер-пароль"
                className="w-full px-3 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
              />
              <input
                value={chgNewHint}
                onChange={(e) => setChgNewHint(e.target.value)}
                placeholder="Новая подсказка"
                className="w-full px-3 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  const res = await changePassVaultMasterPassword(
                    targetVaultMeta.id,
                    chgOldPw,
                    chgNewPw,
                    chgNewHint
                  );
                  if (!res.ok) setSettingsMsg(res.error || 'Ошибка');
                  else {
                    setSettingsMsg('Мастер-пароль обновлён');
                    setChgOldPw('');
                    setChgNewPw('');
                  }
                }}
                className="px-3 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12.5px] font-medium"
              >
                Обновить мастер-пароль
              </button>
            </div>

            <div className="space-y-2 pt-3 border-t border-[var(--divider)]">
              <div className="text-[12.5px] font-semibold text-[var(--error)]">Удаление хранилища</div>
              <input
                type="password"
                value={delConfirmPw}
                onChange={(e) => setDelConfirmPw(e.target.value)}
                placeholder="Подтвердите мастер-паролем"
                className="w-full px-3 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  const res = await deletePassVault(targetVaultMeta.id, delConfirmPw);
                  if (!res.ok) setSettingsMsg(res.error || 'Ошибка');
                  else setVaultSettingsOpen(false);
                }}
                className="px-3 py-1.5 rounded-[8px] border border-[var(--error)] text-[var(--error)] text-[12.5px] font-medium hover:bg-red-500/10"
              >
                Удалить хранилище навсегда
              </button>
            </div>

            {settingsMsg && (
              <div className="text-[12px] text-[var(--text2)]">{settingsMsg}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
