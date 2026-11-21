import React, { useState } from 'react';
import { Activity, History, RefreshCw, Terminal, X } from 'lucide-react';
import { useAppStore } from '../../context/AppStore';

export const DiagHubModal: React.FC = () => {
  const {
    diagOpen,
    setDiagOpen,
    diagProcesses,
    syncHistory,
    diagLogs,
    syncState,
    triggerSync,
  } = useAppStore();

  const [tab, setTab] = useState<'processes' | 'history' | 'logs'>('processes');

  if (!diagOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
      onClick={() => setDiagOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-[540px] max-h-[88vh] rounded-[12px] border border-[var(--divider)] bg-[var(--panel)] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--divider)] flex items-center justify-between gap-3 bg-[var(--sidebar)]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-[14.5px] font-semibold text-[var(--text)]">
              Диагностика (DiagHub)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerSync}
              className="px-2.5 py-1 rounded-[7px] border border-[var(--divider)] bg-[var(--panel)] text-[12px] text-[var(--text)] flex items-center gap-1.5 hover:border-[var(--accent)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
              {syncState.isSyncing ? 'Остановить' : 'Запустить обмен'}
            </button>
            <button
              type="button"
              onClick={() => setDiagOpen(false)}
              className="p-1 rounded-[6px] text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Tabs */}
        <div className="px-4 pt-2 border-b border-[var(--divider)] flex items-center gap-1 bg-[var(--sidebar)]/50 text-[12.5px]">
          <button
            type="button"
            onClick={() => setTab('processes')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              tab === 'processes'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Процессы ({diagProcesses.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              tab === 'history'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            История ({syncHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('logs')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              tab === 'logs'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Журнал ({diagLogs.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 text-[12.5px]">
          {tab === 'processes' &&
            diagProcesses.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-[9px] border border-[var(--divider)] bg-[var(--bg)] space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--text)]">{p.operation}</span>
                  <span className="font-mono-tabular text-[11px] text-[var(--muted)]">
                    {new Date(p.timestamp).toLocaleTimeString('ru-RU')}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--text2)]">{p.detail}</div>
                <div className="text-[11px] font-mono-tabular text-[var(--muted)]">
                  {p.speedKbps ? `Скорость: ${p.speedKbps} КБ/с · ` : ''}
                  {p.bytes ? `Объём: ${(p.bytes / 1024).toFixed(1)} КБ` : ''}
                </div>
              </div>
            ))}

          {tab === 'history' &&
            syncHistory.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-[9px] border border-[var(--divider)] bg-[var(--bg)] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text)] truncate">{h.target}</div>
                  <div className="text-[11.5px] font-mono-tabular text-[var(--text2)] mt-0.5">
                    ↑ {h.uploaded} · ↓ {h.downloaded} · Конфликты: {h.conflicts} · {h.durationMs} мс
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-[11.5px] font-medium"
                    style={{ color: h.result === 'success' ? 'var(--success)' : 'var(--error)' }}
                  >
                    {h.result === 'success' ? 'Успешно' : 'Ошибка'}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[var(--muted)]">
                    {new Date(h.timestamp).toLocaleTimeString('ru-RU')}
                  </div>
                </div>
              </div>
            ))}

          {tab === 'logs' &&
            diagLogs.map((l) => (
              <div
                key={l.id}
                className="px-3 py-2 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] flex items-start gap-2.5 font-mono-tabular text-[11.5px]"
              >
                <span className="text-[var(--muted)] shrink-0">
                  {new Date(l.timestamp).toLocaleTimeString('ru-RU')}
                </span>
                <span
                  className="font-semibold shrink-0 uppercase"
                  style={{
                    color:
                      l.level === 'error'
                        ? 'var(--error)'
                        : l.level === 'warn'
                        ? 'var(--warn)'
                        : 'var(--accent)',
                  }}
                >
                  [{l.source}]
                </span>
                <span className="text-[var(--text)] font-sans">{l.message}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
