import React from 'react';
import { Activity, ArrowDown, ArrowUp, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../context/AppStore';

export const StatusStrip: React.FC = () => {
  const { settings, syncState, setDiagOpen, clipboardTimer } = useAppStore();

  if (settings.statusStripPosition === 'hidden') return null;
  if (settings.statusStripPosition === 'sync-only' && !syncState.isSyncing && !clipboardTimer) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => setDiagOpen(true)}
      title="Открыть окно диагностики (DiagHub)"
      className="w-full h-6 px-3 flex items-center justify-between gap-3 bg-[var(--sidebar)] border-t border-b border-[var(--divider)] text-[11px] text-[var(--text2)] hover:text-[var(--text)] transition-colors shrink-0 select-none text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        {syncState.isSyncing ? (
          <>
            <Activity className="w-3 h-3 text-[var(--accent)] shrink-0" />
            <div className="w-24 h-1.5 rounded-full bg-[var(--divider)] overflow-hidden shrink-0">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-200"
                style={{ width: `${syncState.progress}%` }}
              />
            </div>
            <span className="font-mono-tabular font-medium text-[var(--text)] shrink-0">
              {syncState.progress}%
            </span>
            <span className="truncate">{syncState.stage}</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-3 h-3 text-[var(--success)] shrink-0" />
            <span className="truncate">
              AES-256-GCM · {syncState.stage}
              {syncState.lastSyncedAt
                ? ` (${new Date(syncState.lastSyncedAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })})`
                : ''}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 font-mono-tabular">
        {clipboardTimer && (
          <span className="flex items-center gap-1 text-[var(--warn)]">
            <ClipboardCheck className="w-3 h-3" />
            Буфер очистится: {clipboardTimer.secondsLeft}с
          </span>
        )}
        {syncState.isSyncing && (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <ArrowDown className="w-3 h-3" />
              {syncState.speedDownKbps} КБ/с
            </span>
            <span className="flex items-center gap-0.5">
              <ArrowUp className="w-3 h-3" />
              {syncState.speedUpKbps} КБ/с
            </span>
          </span>
        )}
        <span className="text-[var(--muted)] hidden sm:inline">Диагностика</span>
      </div>
    </button>
  );
};
