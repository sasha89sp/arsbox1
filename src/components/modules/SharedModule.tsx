import React, { useState } from 'react';
import {
  CalendarPlus,
  Copy,
  FilePlus,
  FileText,
  KeyRound,
  Link2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { SharedRole } from '../../types';
import { formatIsoDate } from '../../data/seed';

const ROLE_LABELS: Record<SharedRole, string> = {
  viewer: 'Только просмотр',
  contributor: 'Свои файлы и комментарии',
  editor: 'Полное редактирование',
};

export const SharedModule: React.FC = () => {
  const {
    sharedGroups,
    activeProfile,
    createSharedGroup,
    updateSharedGroup,
    createNote,
    addCalendarEvent,
    calendars,
    setActiveModule,
    copySensitiveText,
    pushToast,
  } = useAppStore();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(sharedGroups[0]?.id || '');
  const [tab, setTab] = useState<'chat' | 'docs' | 'members'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGrpName, setNewGrpName] = useState('');
  const [newGrpUrl, setNewGrpUrl] = useState('https://webdav.yandex.ru/svod-shared/');
  const [newGrpPath, setNewGrpPath] = useState('/shared/group');

  // Invite builder
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<SharedRole>('contributor');
  const [inviteEncrypted, setInviteEncrypted] = useState(true);
  const [inviteReusable, setInviteReusable] = useState(false);

  // Shared doc creation & comments
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocBody, setNewDocBody] = useState('');
  const [addingDoc, setAddingDoc] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const activeGroup =
    sharedGroups.find((g) => g.id === selectedGroupId) ?? sharedGroups[0] ?? null;

  const generateInviteString = () => {
    if (!activeGroup) return '';
    const token = btoa(
      unescape(
        encodeURIComponent(
          JSON.stringify({
            g: activeGroup.name,
            u: activeGroup.webdavUrl,
            p: activeGroup.folderPath,
            r: inviteRole,
            reusable: inviteReusable,
            fp: activeGroup.encryptionKeyFingerprint,
          })
        )
      )
    );
    return inviteEncrypted ? `svod-enc://${token}` : `svod-open://${activeGroup.folderPath}?role=${inviteRole}`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !chatInput.trim()) return;
    updateSharedGroup(activeGroup.id, (g) => ({
      ...g,
      messages: [
        ...g.messages,
        {
          id: `msg-${Date.now()}`,
          author: `${activeProfile.name} (вы)`,
          text: chatInput.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setChatInput('');
  };

  const convertMessageToNote = (text: string, author: string) => {
    createNote(
      null,
      `Из чата «${activeGroup?.name || 'Группа'}»`,
      `Сообщение от **${author}**:\n\n> ${text}`
    );
    setActiveModule('notes');
    pushToast('Сообщение конвертировано в заметку', 'success');
  };

  const convertMessageToEvent = (text: string) => {
    addCalendarEvent({
      calendarId: calendars[0]?.id || 'cal-work',
      title: text.slice(0, 64),
      date: formatIsoDate(new Date()),
      startTime: '15:00',
      endTime: '16:00',
      description: `Создано из чата «${activeGroup?.name || ''}»: ${text}`,
      reminderMinutes: 15,
    });
    setActiveModule('calendar');
    pushToast('Сообщение добавлено как событие календаря', 'success');
  };

  return (
    <div className="h-full flex overflow-hidden bg-[var(--bg)]">
      {/* Left Groups List */}
      <div className="w-[230px] border-r border-[var(--divider)] bg-[var(--sidebar)] flex flex-col shrink-0 hidden md:flex">
        <div className="h-10 px-3 border-b border-[var(--divider)] flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-[var(--text)]">Общие группы</span>
          <button
            type="button"
            onClick={() => setCreatingGroup((v) => !v)}
            title="Новая группа"
            className="p-1 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {creatingGroup && (
            <div className="p-2.5 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-2 mb-2 text-[12px]">
              <input
                value={newGrpName}
                onChange={(e) => setNewGrpName(e.target.value)}
                placeholder="Название группы"
                className="w-full px-2 py-1 rounded-[6px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
              />
              <input
                value={newGrpUrl}
                onChange={(e) => setNewGrpUrl(e.target.value)}
                placeholder="WebDAV URL"
                className="w-full px-2 py-1 rounded-[6px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none text-[11px]"
              />
              <input
                value={newGrpPath}
                onChange={(e) => setNewGrpPath(e.target.value)}
                placeholder="Папка (/shared/...)"
                className="w-full px-2 py-1 rounded-[6px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none text-[11px]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newGrpName.trim()) return;
                  createSharedGroup(newGrpName, newGrpUrl, newGrpPath);
                  setNewGrpName('');
                  setCreatingGroup(false);
                }}
                className="w-full py-1 rounded-[6px] bg-[var(--accent)] text-white font-medium"
              >
                Создать группу
              </button>
            </div>
          )}

          {sharedGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroupId(g.id)}
              className={`w-full p-2.5 rounded-[9px] text-left border transition-colors ${
                activeGroup?.id === g.id
                  ? 'border-[var(--accent)] bg-[var(--panel)]'
                  : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <div className="text-[13px] font-semibold text-[var(--text)] truncate">{g.name}</div>
              <div className="text-[11px] text-[var(--text2)] truncate mt-0.5">
                {g.members.length} участн. · {g.folderPath}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Group Workspace */}
      {!activeGroup ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--text2)]">
          Создайте общую группу для совместных заметок и чата
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--panel)]">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-[var(--divider)] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold text-[var(--text)] truncate">
                {activeGroup.name}
              </div>
              <div className="text-[11.5px] text-[var(--text2)] font-mono-tabular truncate flex items-center gap-1.5">
                <KeyRound className="w-3 h-3 text-[var(--success)] shrink-0" />
                Ключ: {activeGroup.encryptionKeyFingerprint}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center p-0.5 rounded-[8px] bg-[var(--sidebar)] text-[12px]">
                <button
                  type="button"
                  onClick={() => setTab('chat')}
                  className={`px-2.5 py-1 rounded-[6px] flex items-center gap-1.5 font-medium ${
                    tab === 'chat' ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs' : 'text-[var(--text2)]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Чат
                </button>
                <button
                  type="button"
                  onClick={() => setTab('docs')}
                  className={`px-2.5 py-1 rounded-[6px] flex items-center gap-1.5 font-medium ${
                    tab === 'docs' ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs' : 'text-[var(--text2)]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Заметки ({activeGroup.docs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('members')}
                  className={`px-2.5 py-1 rounded-[6px] flex items-center gap-1.5 font-medium ${
                    tab === 'members' ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs' : 'text-[var(--text2)]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Участники ({activeGroup.members.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="px-3 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-[var(--accent-hover)] whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Приглашение
              </button>
            </div>
          </div>

          {/* CHAT TAB */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeGroup.messages.length === 0 ? (
                  <div className="py-12 text-center text-[13px] text-[var(--muted)]">
                    В зашифрованном чате пока нет сообщений
                  </div>
                ) : (
                  activeGroup.messages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-[10px] border border-[var(--divider)] bg-[var(--bg)] space-y-1.5 max-w-2xl"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="font-semibold text-[var(--text)]">{m.author}</span>
                        <span className="text-[var(--muted)] font-mono-tabular">
                          {new Date(m.createdAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[13.5px] text-[var(--text)] leading-relaxed m-0">{m.text}</p>
                      <div className="flex items-center gap-3 pt-1 text-[11.5px] text-[var(--text2)]">
                        <button
                          type="button"
                          onClick={() => convertMessageToNote(m.text, m.author)}
                          className="flex items-center gap-1 hover:text-[var(--accent)]"
                        >
                          <FilePlus className="w-3 h-3" />В заметку
                        </button>
                        <button
                          type="button"
                          onClick={() => convertMessageToEvent(m.text)}
                          className="flex items-center gap-1 hover:text-[var(--accent)]"
                        >
                          <CalendarPlus className="w-3 h-3" />В календарь
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-[var(--divider)] bg-[var(--sidebar)]/50 flex items-center gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Написать в зашифрованный чат..."
                  className="flex-1 px-3 py-2 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium flex items-center gap-1.5 hover:bg-[var(--accent-hover)]"
                >
                  <Send className="w-3.5 h-3.5" />
                  Отправить
                </button>
              </form>
            </>
          )}

          {/* SHARED DOCS TAB */}
          {tab === 'docs' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[var(--text)]">Общие заметки группы</h3>
                <button
                  type="button"
                  onClick={() => setAddingDoc((v) => !v)}
                  className="px-3 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Новая общая заметка
                </button>
              </div>

              {addingDoc && (
                <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--bg)] space-y-2.5">
                  <input
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="Заголовок документа"
                    className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)] outline-none"
                  />
                  <textarea
                    rows={3}
                    value={newDocBody}
                    onChange={(e) => setNewDocBody(e.target.value)}
                    placeholder="Текст общей заметки..."
                    className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)] outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingDoc(false)}
                      className="px-3 py-1 rounded-[7px] border border-[var(--divider)] text-[12px]"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newDocTitle.trim()) return;
                        updateSharedGroup(activeGroup.id, (g) => ({
                          ...g,
                          docs: [
                            {
                              id: `sdoc-${Date.now()}`,
                              title: newDocTitle.trim(),
                              content: newDocBody.trim(),
                              author: activeProfile.name,
                              updatedAt: new Date().toISOString(),
                              comments: [],
                            },
                            ...g.docs,
                          ],
                        }));
                        setNewDocTitle('');
                        setNewDocBody('');
                        setAddingDoc(false);
                      }}
                      className="px-3 py-1 rounded-[7px] bg-[var(--accent)] text-white text-[12px] font-medium"
                    >
                      Опубликовать
                    </button>
                  </div>
                </div>
              )}

              {activeGroup.docs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--bg)] space-y-3"
                >
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--text)]">{doc.title}</div>
                    <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
                      {doc.author} · {new Date(doc.updatedAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <p className="text-[13.5px] text-[var(--text)] leading-relaxed m-0 whitespace-pre-wrap">
                    {doc.content}
                  </p>

                  {/* Comments */}
                  <div className="pt-2.5 border-t border-[var(--divider)] space-y-2">
                    <div className="text-[12px] font-medium text-[var(--text2)]">
                      Комментарии ({doc.comments.length})
                    </div>
                    {doc.comments.map((c) => (
                      <div
                        key={c.id}
                        className="px-3 py-2 rounded-[8px] bg-[var(--panel)] border border-[var(--divider)] text-[12.5px]"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[var(--muted)] mb-0.5">
                          <span className="font-medium text-[var(--text)]">{c.author}</span>
                          <span className="tabular-nums">
                            {new Date(c.createdAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-[var(--text)]">{c.text}</div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        value={commentInputs[doc.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((p) => ({ ...p, [doc.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (commentInputs[doc.id] || '').trim()) {
                            const txt = commentInputs[doc.id].trim();
                            updateSharedGroup(activeGroup.id, (g) => ({
                              ...g,
                              docs: g.docs.map((d) =>
                                d.id === doc.id
                                  ? {
                                      ...d,
                                      comments: [
                                        ...d.comments,
                                        {
                                          id: `sc-${Date.now()}`,
                                          author: activeProfile.name,
                                          text: txt,
                                          createdAt: new Date().toISOString(),
                                        },
                                      ],
                                    }
                                  : d
                              ),
                            }));
                            setCommentInputs((p) => ({ ...p, [doc.id]: '' }));
                          }
                        }}
                        placeholder="Добавить комментарий и нажать Enter..."
                        className="flex-1 px-2.5 py-1.5 text-[12.5px] rounded-[7px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MEMBERS TAB */}
          {tab === 'members' && (
            <div className="flex-1 overflow-y-auto p-4 max-w-2xl space-y-2.5">
              {activeGroup.members.map((mem) => (
                <div
                  key={mem.id}
                  className="p-3 rounded-[10px] border border-[var(--divider)] bg-[var(--bg)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-[var(--text)]">{mem.name}</div>
                    <div className="text-[11.5px] text-[var(--muted)]">
                      Последний онлайн: {mem.lastOnline}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      disabled={mem.isOwner}
                      value={mem.role}
                      onChange={(e) =>
                        updateSharedGroup(activeGroup.id, (g) => ({
                          ...g,
                          members: g.members.map((x) =>
                            x.id === mem.id ? { ...x, role: e.target.value as SharedRole } : x
                          ),
                        }))
                      }
                      className="px-2 py-1 text-[12px] rounded-[7px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)] outline-none disabled:opacity-60"
                    >
                      {(Object.keys(ROLE_LABELS) as SharedRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    {!mem.isOwner && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSharedGroup(activeGroup.id, (g) => ({
                            ...g,
                            members: g.members.filter((x) => x.id !== mem.id),
                          }))
                        }
                        title="Удалить участника"
                        className="p-1.5 rounded-[7px] text-[var(--muted)] hover:text-[var(--error)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* One-line Invite Modal */}
      {inviteOpen && activeGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-[var(--divider)] bg-[var(--panel)] p-5 space-y-3.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[var(--text)] flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--accent)]" />
                Приглашение одной строкой
              </h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[12px] text-[var(--text2)] mb-1">Права доступа</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as SharedRole)}
                className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
              >
                {(Object.keys(ROLE_LABELS) as SharedRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-[12.5px] text-[var(--text)]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteEncrypted}
                  onChange={(e) => setInviteEncrypted(e.target.checked)}
                  className="svod-checkbox"
                />
                Зашифрованная строка
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteReusable}
                  onChange={(e) => setInviteReusable(e.target.checked)}
                  className="svod-checkbox"
                />
                Многоразовое
              </label>
            </div>

            <div className="p-2.5 rounded-[8px] border border-[var(--divider)] bg-[var(--sidebar)] font-mono-tabular text-[11px] break-all text-[var(--text2)]">
              {generateInviteString()}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  copySensitiveText(generateInviteString(), 'Приглашение');
                  setInviteOpen(false);
                }}
                className="px-4 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12.5px] font-medium flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Скопировать строку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
