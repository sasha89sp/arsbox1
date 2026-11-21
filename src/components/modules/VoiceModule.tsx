import React, { useEffect, useRef, useState } from 'react';
import { Copy, FilePlus, Mic, Square, Trash2 } from 'lucide-react';
import { useAppStore } from '../../context/AppStore';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const VoiceModule: React.FC = () => {
  const { voiceHistory, addVoiceRecord, deleteVoiceRecord, createNote, setActiveModule, pushToast } =
    useAppStore();

  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    if (!win.SpeechRecognition && !win.webkitSpeechRecognition) {
      setSpeechSupported(false);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recRef.current?.stop();
    };
  }, []);

  const startDictation = () => {
    const win = window as unknown as Record<string, new () => SpeechRecognitionLike>;
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      setSpeechSupported(false);
      pushToast('Распознавание речи не поддерживается в этом браузере — введите текст вручную', 'warn');
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = 'ru-RU';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let out = '';
        for (let i = 0; i < event.results.length; i++) {
          out += event.results[i][0].transcript + ' ';
        }
        setLiveText(out.trim());
      };
      rec.onerror = (err) => {
        pushToast(`Ошибка микрофона: ${err.error}`, 'error');
        stopDictation();
      };
      rec.onend = () => {
        setIsRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
      recRef.current = rec;
      setLiveText('');
      setElapsedSec(0);
      setIsRecording(true);
      rec.start();
      timerRef.current = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } catch {
      pushToast('Не удалось запустить микрофон', 'error');
    }
  };

  const stopDictation = () => {
    recRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const saveCurrentTranscript = () => {
    if (!liveText.trim()) return;
    addVoiceRecord(liveText.trim(), Math.max(1, elapsedSec), speechSupported ? 'browser-speech' : 'manual');
    navigator.clipboard?.writeText(liveText.trim()).catch(() => {});
    pushToast('Расшифровка сохранена и скопирована в буфер обмена', 'success');
    setLiveText('');
    setElapsedSec(0);
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">Диктовка</h2>
          <p className="text-[13px] text-[var(--text2)] mt-0.5">
            Запись речи с мгновенной расшифровкой, копированием в буфер обмена и сохранением в заметку.
          </p>
        </div>

        <div className="p-5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={isRecording ? stopDictation : startDictation}
              className={`px-5 py-2.5 rounded-[8px] text-white text-[13.5px] font-medium flex items-center gap-2 transition-colors ${
                isRecording
                  ? 'bg-[var(--error)] hover:opacity-90'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
              }`}
            >
              {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
              {isRecording ? 'Остановить запись' : 'Начать диктовку'}
            </button>
            <div className="text-[13px] font-mono-tabular text-[var(--text2)]">
              {isRecording
                ? `Запись: ${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(
                    elapsedSec % 60
                  ).padStart(2, '0')}`
                : speechSupported
                ? 'Язык: Русский (ru-RU)'
                : 'Режим ручного ввода'}
            </div>
          </div>

          <textarea
            rows={4}
            value={liveText}
            onChange={(e) => setLiveText(e.target.value)}
            placeholder="Здесь появится распознанный текст речи (можно также отредактировать перед сохранением)..."
            className="w-full p-3 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!liveText.trim()}
              onClick={() => {
                navigator.clipboard?.writeText(liveText.trim()).catch(() => {});
                pushToast('Текст скопирован в буфер обмена', 'success');
              }}
              className="px-3 py-1.5 rounded-[8px] border border-[var(--divider)] text-[12.5px] text-[var(--text)] disabled:opacity-40 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Копировать
            </button>
            <button
              type="button"
              disabled={!liveText.trim()}
              onClick={saveCurrentTranscript}
              className="px-4 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12.5px] font-medium disabled:opacity-40 hover:bg-[var(--accent-hover)]"
            >
              Сохранить в историю
            </button>
          </div>
        </div>

        {/* History */}
        <div className="space-y-2.5">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            История диктовок ({voiceHistory.length})
          </h3>
          {voiceHistory.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--muted)] rounded-[10px] border border-[var(--divider)] bg-[var(--panel)]">
              История пока пуста
            </div>
          ) : (
            voiceHistory.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-2"
              >
                <div className="flex items-center justify-between text-[11.5px] text-[var(--muted)] font-mono-tabular">
                  <span>
                    {new Date(item.createdAt).toLocaleString('ru-RU')} · {item.durationSec} с
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(item.text).catch(() => {});
                        pushToast('Скопировано в буфер обмена', 'success');
                      }}
                      className="text-[var(--text2)] hover:text-[var(--text)] flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Копировать
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        createNote(null, `Диктовка ${new Date(item.createdAt).toLocaleDateString('ru-RU')}`, item.text);
                        setActiveModule('notes');
                        pushToast('Создана заметка из диктовки', 'success');
                      }}
                      className="text-[var(--accent)] hover:underline flex items-center gap-1"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                      В заметку
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVoiceRecord(item.id)}
                      className="text-[var(--muted)] hover:text-[var(--error)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[13.5px] text-[var(--text)] leading-relaxed m-0">{item.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
