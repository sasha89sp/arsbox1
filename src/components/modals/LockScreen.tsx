import React, { useState } from 'react';
import { Cloud, FolderPlus, HardDrive, Lock, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useAppStore } from '../../context/AppStore';

const AVATAR_COLORS = ['#4F46E5', '#059669', '#D97706', '#0284C7', '#7C3AED', '#DC2626'];

export const LockScreen: React.FC = () => {
  const { profiles, activeProfile, unlockProfile, createProfile } = useAppStore();

  const [mode, setMode] = useState<'login' | 'create' | 'wizard'>('login');
  const [selectedId, setSelectedId] = useState(activeProfile.id);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Create local profile state
  const [newName, setNewName] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0]);

  // 3-step storage wizard state
  const [wizStep, setWizStep] = useState<1 | 2 | 3>(1);
  const [wizType, setWizType] = useState<'webdav' | 'gdrive' | 'local'>('webdav');
  const [wizEndpoint, setWizEndpoint] = useState('https://webdav.yandex.ru/svod-vault/');
  const [wizLogin, setWizLogin] = useState('');
  const [wizName, setWizName] = useState('Облачный профиль');
  const [wizPass, setWizPass] = useState('');

  const targetProfile = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ok = await unlockProfile(selectedId, password);
    setBusy(false);
    if (!ok) {
      setError('Неверный пароль профиля');
    } else {
      setPassword('');
    }
  };

  const handleCreateLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLogin.trim()) {
      setError('Укажите имя и логин профиля');
      return;
    }
    setBusy(true);
    setError('');
    await createProfile(
      {
        name: newName.trim(),
        login: newLogin.trim(),
        avatarColor: newColor,
        storageType: 'local',
        storageEndpoint: `data/${newLogin.trim()}.enc`,
        hasPassword: Boolean(newPassword),
        remembered: true,
      },
      newPassword || undefined
    );
    setBusy(false);
  };

  const handleFinishWizard = async () => {
    setBusy(true);
    await createProfile(
      {
        name: wizName.trim() || 'Подключённый профиль',
        login: wizLogin.trim() || 'cloud-user',
        avatarColor: '#059669',
        storageType: wizType,
        storageEndpoint: wizEndpoint,
        hasPassword: Boolean(wizPass),
        remembered: true,
      },
      wizPass || undefined
    );
    setBusy(false);
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-6 bg-[var(--bg)] overflow-y-auto">
      <div className="w-full max-w-md rounded-[12px] border border-[var(--divider)] bg-[var(--panel)] p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[var(--text)]">Вход в «Свод»</h1>
              <p className="text-[12px] text-[var(--text2)]">AES-256-GCM · PBKDF2-HMAC-SHA256</p>
            </div>
          </div>
          {mode !== 'login' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className="p-1.5 rounded-[7px] text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* LOGIN VIEW */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                Профиль
              </label>
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (@{p.login})
                  </option>
                ))}
              </select>
            </div>

            {targetProfile?.hasPassword && (
              <div>
                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">
                  Пароль профиля
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль..."
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-[12.5px] text-[var(--text2)] cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="svod-checkbox"
              />
              <span>Запомнить на этом устройстве</span>
            </label>

            {error && (
              <div className="p-2.5 rounded-[8px] bg-red-500/10 text-[var(--error)] text-[12px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-[8px] bg-[var(--accent)] text-white text-[13.5px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {busy ? 'Расшифровка...' : 'Войти'}
            </button>

            <div className="pt-3 border-t border-[var(--divider)] space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMode('create');
                  setError('');
                }}
                className="w-full py-2 px-3 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[12.5px] font-medium text-[var(--text)] hover:border-[var(--accent)] flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-[var(--accent)]" />
                Создать новый локальный профиль
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('wizard');
                  setWizStep(1);
                  setError('');
                }}
                className="w-full py-2 px-3 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[12.5px] font-medium text-[var(--text)] hover:border-[var(--accent)] flex items-center justify-center gap-2"
              >
                <Cloud className="w-4 h-4 text-[var(--success)]" />
                Подключить хранилище (WebDAV / Google Диск / папка)
              </button>
            </div>
          </form>
        )}

        {/* CREATE LOCAL PROFILE */}
        {mode === 'create' && (
          <form onSubmit={handleCreateLocal} className="space-y-3">
            <div className="text-[14px] font-semibold text-[var(--text)]">
              Новый локальный профиль
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Имя профиля (например: Рабочий)"
              className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            <input
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              placeholder="Логин (латиницей)"
              className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Пароль шифрования AES-256-GCM (необязательно)"
              className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[12px] text-[var(--text2)]">Цвет аватара:</span>
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full ${
                    newColor === c ? 'ring-2 ring-offset-1 ring-[var(--text)]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {error && <div className="text-[12px] text-[var(--error)]">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium"
            >
              Создать и войти
            </button>
          </form>
        )}

        {/* 3-STEP STORAGE CONNECTION WIZARD */}
        {mode === 'wizard' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-[var(--text)]">Подключение хранилища</span>
              <span className="font-mono-tabular text-[var(--muted)]">Шаг {wizStep} из 3</span>
            </div>

            {wizStep === 1 && (
              <div className="space-y-2">
                {(
                  [
                    {
                      id: 'webdav',
                      title: 'WebDAV (Яндекс Диск, Mail.ru, Nextcloud)',
                      icon: <Cloud className="w-4 h-4" />,
                    },
                    {
                      id: 'gdrive',
                      title: 'Google Диск (drive.file)',
                      icon: <ShieldCheck className="w-4 h-4" />,
                    },
                    {
                      id: 'local',
                      title: 'Локальная папка (портативный режим data/)',
                      icon: <HardDrive className="w-4 h-4" />,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setWizType(opt.id)}
                    className={`w-full p-3 rounded-[9px] border text-left flex items-center gap-3 text-[13px] transition-colors ${
                      wizType === opt.id
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                        : 'border-[var(--divider)] bg-[var(--bg)] text-[var(--text)]'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.title}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWizStep(2)}
                  className="w-full mt-2 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium"
                >
                  Далее
                </button>
              </div>
            )}

            {wizStep === 2 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] text-[var(--text2)] mb-1">
                    Адрес хранилища / путь
                  </label>
                  <input
                    value={wizEndpoint}
                    onChange={(e) => setWizEndpoint(e.target.value)}
                    className="w-full px-3 py-2 text-[12.5px] font-mono-tabular rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--text2)] mb-1">
                    Учётная запись / логин
                  </label>
                  <input
                    value={wizLogin}
                    onChange={(e) => setWizLogin(e.target.value)}
                    placeholder="user@example.ru"
                    className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWizStep(1)}
                    className="flex-1 py-2 rounded-[8px] border border-[var(--divider)] text-[13px]"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizStep(3)}
                    className="flex-1 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium"
                  >
                    Далее
                  </button>
                </div>
              </div>
            )}

            {wizStep === 3 && (
              <div className="space-y-3">
                <input
                  value={wizName}
                  onChange={(e) => setWizName(e.target.value)}
                  placeholder="Название профиля"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                />
                <input
                  type="password"
                  value={wizPass}
                  onChange={(e) => setWizPass(e.target.value)}
                  placeholder="Ключ шифрования синхронизации"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWizStep(2)}
                    className="flex-1 py-2 rounded-[8px] border border-[var(--divider)] text-[13px]"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleFinishWizard}
                    className="flex-1 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium flex items-center justify-center gap-1.5"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Подключить
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
