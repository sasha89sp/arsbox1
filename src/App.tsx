import React, { useRef, useState } from 'react';
import { AppStoreProvider, useAppStore } from './context/AppStore';
import { AppMenu } from './components/layout/AppMenu';
import { Sidebar } from './components/layout/Sidebar';
import { SchedulePanel } from './components/layout/SchedulePanel';
import { StatusStrip } from './components/layout/StatusStrip';
import { MobileChrome } from './components/layout/MobileChrome';
import { NotesModule } from './components/modules/NotesModule';
import { PasswordsModule } from './components/modules/PasswordsModule';
import { CalendarModule } from './components/modules/CalendarModule';
import { SharedModule } from './components/modules/SharedModule';
import { VoiceModule } from './components/modules/VoiceModule';
import { DockModule, FloatingDockOverlay } from './components/modules/DockModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { LockScreen } from './components/modals/LockScreen';
import { DiagHubModal } from './components/modals/DiagHubModal';

const WorkspaceShell: React.FC = () => {
  const {
    isLocked,
    activeModule,
    isMobileView,
    windowWidth,
    settings,
    notes,
    selectedNoteId,
    toasts,
    pushToast,
  } = useAppStore();

  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [scheduleWidth, setScheduleWidth] = useState(290);
  const noteImportRef = useRef<HTMLInputElement>(null);

  if (isLocked) {
    return <LockScreen />;
  }

  const startResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.max(170, Math.min(420, startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResizeSchedule = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = scheduleWidth;
    const onMove = (ev: MouseEvent) => {
      setScheduleWidth(Math.max(240, Math.min(560, startW - (ev.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleExportCurrentNote = () => {
    const n = notes.find((x) => x.id === selectedNoteId);
    if (!n) return;
    const md = `# ${n.title}\n\n` + n.blocks.map((b) => (b.type === 'markdown' ? b.content : '')).join('\n\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${n.title || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Заметка экспортирована (.md)', 'success');
  };

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'notes':
        return <NotesModule importInputRef={noteImportRef} />;
      case 'passwords':
        return <PasswordsModule />;
      case 'calendar':
        return <CalendarModule />;
      case 'shared':
        return <SharedModule />;
      case 'voice':
        return <VoiceModule />;
      case 'dock':
        return <DockModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <NotesModule importInputRef={noteImportRef} />;
    }
  };

  const showRightSchedule =
    !isMobileView &&
    settings.showSchedulePanel &&
    settings.enabledModules.calendar &&
    windowWidth >= 980 &&
    activeModule !== 'calendar';

  // Apply uiScale cleanly via CSS zoom (fallback-safe in Chromium/WebKit)
  const scaleStyle: React.CSSProperties =
    settings.uiScale !== 1
      ? ({
          zoom: settings.uiScale,
        } as React.CSSProperties)
      : {};

  return (
    <div style={scaleStyle} className="h-full w-full flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {settings.statusStripPosition === 'top' && <StatusStrip />}

      {isMobileView ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <MobileChrome>{renderActiveModule()}</MobileChrome>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <AppMenu
            onExportCurrentNote={handleExportCurrentNote}
            onImportNote={() => noteImportRef.current?.click()}
          />
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <Sidebar width={sidebarWidth} />
            <div onMouseDown={startResizeSidebar} className="pane-resizer" />

            <main className="flex-1 min-w-0 h-full overflow-hidden">
              {renderActiveModule()}
            </main>

            {showRightSchedule && (
              <>
                <div onMouseDown={startResizeSchedule} className="pane-resizer" />
                <SchedulePanel width={scheduleWidth} />
              </>
            )}
          </div>
        </div>
      )}

      {(settings.statusStripPosition === 'bottom' ||
        settings.statusStripPosition === 'sync-only') && <StatusStrip />}

      <FloatingDockOverlay />
      <DiagHubModal />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-9 right-4 z-50 flex flex-col gap-1.5 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="px-3.5 py-2 rounded-[9px] border border-[var(--divider)] bg-[var(--panel)] text-[12.5px] text-[var(--text)] shadow-lg flex items-center gap-2"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    t.tone === 'success'
                      ? 'var(--success)'
                      : t.tone === 'warn'
                      ? 'var(--warn)'
                      : t.tone === 'error'
                      ? 'var(--error)'
                      : 'var(--accent)',
                }}
              />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppStoreProvider>
      <WorkspaceShell />
    </AppStoreProvider>
  );
}
