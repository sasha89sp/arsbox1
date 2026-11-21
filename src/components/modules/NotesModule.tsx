import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  CalendarPlus,
  CheckSquare,
  Code,
  Download,
  Eye,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Heading1,
  Heading2,
  Highlighter,
  History,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Quote,
  RotateCcw,
  Search,
  Star,
  Strikethrough,
  Table2,
  Tag,
  Trash2,
  Underline,
  Upload,
  X,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { NoteBlock, NoteItem } from '../../types';
import { SpreadsheetBlock } from './SpreadsheetBlock';

type PaneId = 'folders' | 'list' | 'editor';

interface ContextMenuState {
  x: number;
  y: number;
  note: NoteItem;
}

export const NotesModule: React.FC<{
  importInputRef?: React.RefObject<HTMLInputElement | null>;
}> = ({ importInputRef }) => {
  const {
    folders,
    notes,
    selectedNoteId,
    setSelectedNoteId,
    selectedFolderFilter,
    setSelectedFolderFilter,
    createFolder,
    deleteFolder,
    createNote,
    updateNote,
    deleteNoteToTrash,
    restoreNoteFromTrash,
    deleteNotePermanently,
    emptyNotesTrash,
    restoreNoteVersion,
    addCalendarEvent,
    calendars,
    isMobileView,
    pushToast,
  } = useAppStore();

  // ThreePane state: customizable order, widths, collapse
  const [paneOrder, setPaneOrder] = useState<PaneId[]>(['folders', 'list', 'editor']);
  const [collapsedPanes, setCollapsedPanes] = useState<Record<PaneId, boolean>>({
    folders: false,
    list: false,
    editor: false,
  });
  const [paneWidths, setPaneWidths] = useState<{ folders: number; list: number }>({
    folders: 195,
    list: 265,
  });

  // Mobile sub-view
  const [mobileShowEditor, setMobileShowEditor] = useState(false);

  // Search & Editor UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [infoOpen, setInfoOpen] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);
  const fileRef = importInputRef || localFileInputRef;
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    notes
      .filter((n) => !n.isTrashed)
      .forEach((n) => {
        n.tags.forEach((t) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const words = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return notes
      .filter((n) => {
        if (selectedFolderFilter === 'trash') return n.isTrashed;
        if (n.isTrashed) return false;
        if (selectedFolderFilter === 'favorites') return n.isFavorite;
        if (selectedFolderFilter.startsWith('tag:')) {
          const t = selectedFolderFilter.slice(4);
          return n.tags.includes(t);
        }
        if (selectedFolderFilter !== 'all') {
          return n.folderId === selectedFolderFilter;
        }
        return true;
      })
      .filter((n) => {
        if (words.length === 0) return true;
        const haystack = (
          n.title +
          ' ' +
          n.tags.join(' ') +
          ' ' +
          n.blocks
            .map((b) => {
              if (b.type === 'markdown' || b.type === 'code' || b.type === 'quote') return b.content;
              if (b.type === 'voice') return b.transcript;
              if (b.type === 'table')
                return b.data.title + ' ' + Object.values(b.data.cells).map((c) => c.value).join(' ');
              if (b.type === 'ics') return b.events.map((e) => e.summary).join(' ');
              return '';
            })
            .join(' ')
        ).toLowerCase();
        return words.every((w) => haystack.includes(w));
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [notes, selectedFolderFilter, searchQuery]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? filteredNotes[0] ?? null,
    [notes, selectedNoteId, filteredNotes]
  );

  const swapPane = (id: PaneId, dir: -1 | 1) => {
    setPaneOrder((prev) => {
      const idx = prev.indexOf(id);
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const startResize = (pane: 'folders' | 'list', e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = paneWidths[pane];
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      setPaneWidths((prev) => ({
        ...prev,
        [pane]: Math.max(150, Math.min(420, startW + delta)),
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleCreateNoteHere = () => {
    const folderId =
      selectedFolderFilter !== 'all' &&
      selectedFolderFilter !== 'favorites' &&
      selectedFolderFilter !== 'trash' &&
      !selectedFolderFilter.startsWith('tag:')
        ? selectedFolderFilter
        : null;
    createNote(folderId);
    setEditorMode('edit');
    if (isMobileView) setMobileShowEditor(true);
  };

  const updateBlock = (blockId: string, updater: (b: NoteBlock) => NoteBlock) => {
    if (!activeNote) return;
    updateNote(activeNote.id, (n) => ({
      ...n,
      blocks: n.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
    }));
  };

  const removeBlock = (blockId: string) => {
    if (!activeNote) return;
    updateNote(activeNote.id, (n) => {
      const remaining = n.blocks.filter((b) => b.id !== blockId);
      return {
        ...n,
        blocks: remaining.length > 0 ? remaining : [{ id: `b-${Date.now()}`, type: 'markdown', content: '' }],
      };
    });
  };

  const appendBlock = (block: NoteBlock) => {
    if (!activeNote) return;
    updateNote(activeNote.id, (n) => ({
      ...n,
      blocks: [...n.blocks, block],
    }));
  };

  // Markdown formatting helper
  const applyMarkdown = (prefix: string, suffix = '', placeholder = 'текст') => {
    if (!activeNote) return;
    setEditorMode('edit');
    const targetBlock =
      activeNote.blocks.find((b) => b.id === activeBlockId && b.type === 'markdown') ||
      activeNote.blocks.find((b) => b.type === 'markdown');

    if (!targetBlock || targetBlock.type !== 'markdown') {
      appendBlock({ id: `b-${Date.now()}`, type: 'markdown', content: `${prefix}${placeholder}${suffix}` });
      return;
    }

    const ta = activeTextareaRef.current;
    if (ta && activeBlockId === targetBlock.id) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = targetBlock.content.slice(start, end) || placeholder;
      const nextText =
        targetBlock.content.slice(0, start) +
        prefix +
        selected +
        suffix +
        targetBlock.content.slice(end);
      updateBlock(targetBlock.id, (b) => (b.type === 'markdown' ? { ...b, content: nextText } : b));
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
      });
    } else {
      updateBlock(targetBlock.id, (b) =>
        b.type === 'markdown'
          ? { ...b, content: `${b.content}${b.content ? '\n' : ''}${prefix}${placeholder}${suffix}` }
          : b
      );
    }
  };

  // Auto-continue checklists & lists on Enter
  const handleMarkdownKeyDown = (blockId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const ta = e.currentTarget;
    const val = ta.value;
    const pos = ta.selectionStart;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const currentLine = val.slice(lineStart, pos);

    const checkMatch = currentLine.match(/^(\s*-\s+\[[ xX]\]\s+)(.*)$/);
    const bulletMatch = currentLine.match(/^(\s*-\s+)(.*)$/);
    const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

    let insert = '';
    if (checkMatch && checkMatch[2].trim()) {
      insert = '\n' + checkMatch[1].replace(/\[[xX]\]/, '[ ]');
    } else if (bulletMatch && bulletMatch[2].trim() && !checkMatch) {
      insert = '\n' + bulletMatch[1];
    } else if (numMatch && numMatch[3].trim()) {
      insert = `\n${numMatch[1]}${Number(numMatch[2]) + 1}. `;
    }

    if (insert) {
      e.preventDefault();
      const next = val.slice(0, pos) + insert + val.slice(ta.selectionEnd);
      updateBlock(blockId, (b) => (b.type === 'markdown' ? { ...b, content: next } : b));
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = pos + insert.length;
      });
    }
  };

  // Toggle interactive checkbox in Preview mode
  const toggleChecklistLine = (blockId: string, lineIndex: number) => {
    if (!activeNote) return;
    updateBlock(blockId, (b) => {
      if (b.type !== 'markdown') return b;
      const lines = b.content.split('\n');
      const line = lines[lineIndex];
      if (!line) return b;
      if (/-\s+\[ \]/.test(line)) {
        lines[lineIndex] = line.replace(/-\s+\[ \]/, '- [x]');
      } else if (/-\s+\[[xX]\]/.test(line)) {
        lines[lineIndex] = line.replace(/-\s+\[[xX]\]/, '- [ ]');
      }
      return { ...b, content: lines.join('\n') };
    });
  };

  // Export current note to Markdown
  const exportCurrentNoteMd = () => {
    if (!activeNote) return;
    const md = [
      `---`,
      `title: ${activeNote.title}`,
      `tags: [${activeNote.tags.join(', ')}]`,
      `updated: ${activeNote.updatedAt}`,
      `---`,
      '',
      ...activeNote.blocks.map((b) => {
        if (b.type === 'markdown') return b.content;
        if (b.type === 'quote') return `> ${b.content}${b.author ? `\n> — ${b.author}` : ''}`;
        if (b.type === 'code') return `\`\`\`${b.language}\n${b.content}\n\`\`\``;
        if (b.type === 'voice') return `> [Голосовая заметка, ${b.durationSec}с]: ${b.transcript}`;
        if (b.type === 'table') return `\n### Таблица: ${b.data.title}\n`;
        if (b.type === 'ics')
          return b.events.map((ev) => `- Событие: ${ev.dtStart} · ${ev.summary}`).join('\n');
        return '';
      }),
    ].join('\n\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Заметка экспортирована в Markdown', 'success');
  };

  // Import .md / .txt file
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const title = file.name.replace(/\.(md|txt|html)$/i, '');
    createNote(null, title, text);
    pushToast(`Импортирован файл «${file.name}»`, 'success');
    e.target.value = '';
  };

  // Render inline markdown tokens (bold, italic, code, ==highlight==, #tags, [[wiki links]])
  const renderInlineMarkdown = (text: string) => {
    const tokenRegex =
      /(\[\[[^\]]+\]\]|==[^=]+==|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|#[a-zA-Zа-яА-ЯёЁ0-9_-]+)/g;
    const parts = text.split(tokenRegex);
    return parts.map((part, idx) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const targetTitle = part.slice(2, -2);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              const found = notes.find(
                (n) => !n.isTrashed && n.title.toLowerCase() === targetTitle.toLowerCase()
              );
              if (found) {
                setSelectedNoteId(found.id);
              } else {
                createNote(null, targetTitle);
                pushToast(`Создана связанная заметка «${targetTitle}»`, 'info');
              }
            }}
            style={{ backgroundColor: 'var(--link-bg)', color: 'var(--accent)' }}
            className="px-1.5 py-0.5 rounded-[5px] font-medium hover:underline"
          >
            {targetTitle}
          </button>
        );
      }
      if (part.startsWith('==') && part.endsWith('==')) {
        return (
          <mark
            key={idx}
            style={{ backgroundColor: 'var(--tag-bg)', color: 'var(--text)' }}
            className="px-1 rounded-[4px]"
          >
            {part.slice(2, -2)}
          </mark>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded-[5px] bg-[var(--sidebar)] border border-[var(--divider)] font-mono-tabular text-[0.9em]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('~~') && part.endsWith('~~')) {
        return <del key={idx}>{part.slice(2, -2)}</del>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={idx}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('#') && part.length > 1) {
        const tag = part.slice(1).toLowerCase();
        return (
          <button
            key={idx}
            type="button"
            onClick={() => setSelectedFolderFilter(`tag:${tag}`)}
            style={{ color: 'var(--tag-fg)', backgroundColor: 'var(--tag-bg)' }}
            className="px-1.5 py-0.5 rounded-[5px] text-[0.9em] font-medium"
          >
            {part}
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  // --- Pane 1: Folders ---
  const renderFoldersPane = (index: number) => (
    <div
      key="folders"
      style={{ width: isMobileView ? '100%' : paneWidths.folders }}
      className="h-full flex flex-col bg-[var(--sidebar)] shrink-0 overflow-hidden"
    >
      <div className="h-9 px-2.5 border-b border-[var(--divider)] flex items-center justify-between gap-1 shrink-0">
        <span className="text-[12px] font-semibold text-[var(--text)] truncate">Папки</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setAddingFolder((v) => !v)}
            title="Новая папка"
            className="p-1 rounded-[5px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          {!isMobileView && (
            <>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => swapPane('folders', -1)}
                title="Переместить колонку влево"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index === paneOrder.length - 1}
                onClick={() => swapPane('folders', 1)}
                title="Переместить колонку вправо"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setCollapsedPanes((p) => ({ ...p, folders: true }))}
                title="Скрыть колонку"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)]"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {addingFolder && (
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                const f = createFolder(newFolderName.trim());
                setSelectedFolderFilter(f.id);
                setNewFolderName('');
                setAddingFolder(false);
              }
              if (e.key === 'Escape') setAddingFolder(false);
            }}
            placeholder="Имя папки..."
            className="w-full px-2 py-1 text-[12px] rounded-[7px] border border-[var(--accent)] bg-[var(--panel)] text-[var(--text)] outline-none"
          />
        )}

        <div className="space-y-0.5 text-[12.5px]">
          <button
            type="button"
            onClick={() => setSelectedFolderFilter('all')}
            className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between ${
              selectedFolderFilter === 'all'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <FileText className="w-3.5 h-3.5" />
              Все заметки
            </span>
            <span className="text-[11px] tabular-nums">{notes.filter((n) => !n.isTrashed).length}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFolderFilter('favorites')}
            className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between ${
              selectedFolderFilter === 'favorites'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Star className="w-3.5 h-3.5" />
              Избранное
            </span>
            <span className="text-[11px] tabular-nums">
              {notes.filter((n) => !n.isTrashed && n.isFavorite).length}
            </span>
          </button>

          {folders.map((f) => {
            const count = notes.filter((n) => !n.isTrashed && n.folderId === f.id).length;
            return (
              <div key={f.id} className="group flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedFolderFilter(f.id)}
                  className={`flex-1 px-2 py-1.5 rounded-[7px] flex items-center justify-between text-left ${
                    f.parentId ? 'pl-5' : ''
                  } ${
                    selectedFolderFilter === f.id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                      : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <span className="text-[11px] tabular-nums">{count}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteFolder(f.id)}
                  title="Удалить папку"
                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-[var(--error)]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedFolderFilter('trash')}
            className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between ${
              selectedFolderFilter === 'trash'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Trash2 className="w-3.5 h-3.5" />
              Корзина
            </span>
            <span className="text-[11px] tabular-nums">{notes.filter((n) => n.isTrashed).length}</span>
          </button>
        </div>

        {/* Tags Section */}
        {allTags.length > 0 && (
          <div className="pt-2 border-t border-[var(--divider)]">
            <div className="px-2 mb-1.5 text-[11px] font-medium text-[var(--muted)]">Теги</div>
            <div className="space-y-0.5">
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedFolderFilter(`tag:${tag}`)}
                  className={`w-full px-2 py-1 rounded-[6px] flex items-center justify-between text-[12px] ${
                    selectedFolderFilter === `tag:${tag}`
                      ? 'font-medium'
                      : 'text-[var(--text2)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={
                    selectedFolderFilter === `tag:${tag}`
                      ? { backgroundColor: 'var(--tag-bg)', color: 'var(--tag-fg)' }
                      : undefined
                  }
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Tag className="w-3 h-3" style={{ color: 'var(--tag-fg)' }} />
                    #{tag}
                  </span>
                  <span className="text-[11px] tabular-nums opacity-70">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // --- Pane 2: Note List ---
  const renderListPane = (index: number) => (
    <div
      key="list"
      style={{ width: isMobileView ? '100%' : paneWidths.list }}
      className="h-full flex flex-col bg-[var(--bg)] shrink-0 overflow-hidden"
    >
      <div className="h-9 px-2.5 border-b border-[var(--divider)] flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {!isMobileView && collapsedPanes.folders && (
            <button
              type="button"
              onClick={() => setCollapsedPanes((p) => ({ ...p, folders: false }))}
              title="Показать папки"
              className="p-1 rounded-[5px] text-[var(--text2)] hover:text-[var(--text)]"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[12px] font-semibold text-[var(--text)] truncate">
            Список ({filteredNotes.length})
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleCreateNoteHere}
            title="Новая заметка"
            className="p-1 rounded-[5px] text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Импорт .md / .txt"
            className="p-1 rounded-[5px] text-[var(--text2)] hover:text-[var(--text)]"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          {!isMobileView && (
            <>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => swapPane('list', -1)}
                title="Переместить влево"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index === paneOrder.length - 1}
                onClick={() => swapPane('list', 1)}
                title="Переместить вправо"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setCollapsedPanes((p) => ({ ...p, list: true }))}
                title="Скрыть список"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)]"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Multi-word Search Bar */}
      <div className="p-2 border-b border-[var(--divider)]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-2.5 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по словам..."
            className="w-full pl-8 pr-7 py-1.5 text-[12.5px] rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {selectedFolderFilter === 'trash' && filteredNotes.length > 0 && (
        <div className="px-2.5 py-1.5 bg-[var(--sidebar)] border-b border-[var(--divider)] flex items-center justify-between text-[11.5px]">
          <span className="text-[var(--text2)]">Хранятся 30 дней</span>
          <button
            type="button"
            onClick={emptyNotesTrash}
            className="text-[var(--error)] hover:underline font-medium"
          >
            Очистить корзину
          </button>
        </div>
      )}

      {/* Notes Cards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredNotes.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-[12.5px] text-[var(--muted)] mb-3">Заметок не найдено</p>
            {selectedFolderFilter !== 'trash' && (
              <button
                type="button"
                onClick={handleCreateNoteHere}
                className="px-3 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-medium hover:bg-[var(--accent-hover)]"
              >
                Создать заметку
              </button>
            )}
          </div>
        ) : (
          filteredNotes.map((n) => {
            const isSelected = activeNote?.id === n.id;
            const snippet =
              n.blocks
                .map((b) => {
                  if (b.type === 'markdown') return b.content.replace(/[#*`[\]]/g, '');
                  if (b.type === 'table') return `Таблица: ${b.data.title}`;
                  if (b.type === 'ics') return `События: ${b.events.length}`;
                  return '';
                })
                .join(' ')
                .slice(0, 90) || 'Пустая заметка';
            const hasTable = n.blocks.some((b) => b.type === 'table');

            return (
              <div
                key={n.id}
                onClick={() => {
                  setSelectedNoteId(n.id);
                  if (isMobileView) setMobileShowEditor(true);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, note: n });
                }}
                className={`p-2.5 rounded-[10px] border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--panel)]'
                    : 'border-[var(--divider)] bg-[var(--panel)]/70 hover:bg-[var(--panel)]'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 mb-0.5">
                  <div className="text-[13px] font-semibold text-[var(--text)] truncate leading-snug">
                    {n.title || 'Без названия'}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {n.isPinned && <Pin className="w-3 h-3 text-[var(--accent)]" />}
                    {n.isFavorite && <Star className="w-3 h-3 text-[var(--warn)] fill-current" />}
                    {hasTable && <Table2 className="w-3 h-3 text-[var(--text2)]" />}
                  </div>
                </div>
                <p className="text-[11.5px] text-[var(--text2)] line-clamp-2 leading-relaxed mb-1.5">
                  {snippet}
                </p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                  <span className="tabular-nums">
                    {new Date(n.updatedAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {n.tags.length > 0 && (
                    <span className="truncate" style={{ color: 'var(--tag-fg)' }}>
                      {n.tags
                        .slice(0, 2)
                        .map((t) => `#${t}`)
                        .join(' ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // --- Pane 3: Unified Editor ---
  const renderEditorPane = (index: number) => (
    <div key="editor" className="flex-1 min-w-[300px] h-full flex flex-col bg-[var(--panel)] overflow-hidden">
      {/* Editor Header */}
      <div className="h-9 px-3 border-b border-[var(--divider)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {isMobileView && (
            <button
              type="button"
              onClick={() => setMobileShowEditor(false)}
              className="px-2 py-1 rounded-[6px] text-[12px] text-[var(--accent)] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Список
            </button>
          )}
          {!isMobileView && collapsedPanes.list && (
            <button
              type="button"
              onClick={() => setCollapsedPanes((p) => ({ ...p, list: false }))}
              title="Показать список заметок"
              className="p-1 rounded-[5px] text-[var(--text2)] hover:text-[var(--text)]"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit / Preview Segmented Control */}
          <div className="flex items-center p-0.5 rounded-[7px] bg-[var(--sidebar)] text-[11.5px]">
            <button
              type="button"
              onClick={() => setEditorMode('edit')}
              className={`px-2 py-0.5 rounded-[5px] flex items-center gap-1 transition-colors whitespace-nowrap ${
                editorMode === 'edit'
                  ? 'bg-[var(--panel)] text-[var(--text)] font-medium shadow-xs'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Pencil className="w-3 h-3" />
              Правка
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('preview')}
              className={`px-2 py-0.5 rounded-[5px] flex items-center gap-1 transition-colors whitespace-nowrap ${
                editorMode === 'preview'
                  ? 'bg-[var(--panel)] text-[var(--text)] font-medium shadow-xs'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Eye className="w-3 h-3" />
              Просмотр
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {activeNote && (
            <>
              <button
                type="button"
                onClick={() =>
                  updateNote(activeNote.id, (n) => ({ ...n, isFavorite: !n.isFavorite }))
                }
                title="В избранное"
                className={`p-1.5 rounded-[6px] transition-colors ${
                  activeNote.isFavorite
                    ? 'text-[var(--warn)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${activeNote.isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={exportCurrentNoteMd}
                title="Экспорт в Markdown (.md)"
                className="p-1.5 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)]"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                title="Сведения и история версий"
                className={`p-1.5 rounded-[6px] transition-colors ${
                  infoOpen
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {!isMobileView && (
            <>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => swapPane('editor', -1)}
                title="Переместить влево"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index === paneOrder.length - 1}
                onClick={() => swapPane('editor', 1)}
                title="Переместить вправо"
                className="p-1 rounded-[5px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Unified MdToolbar */}
      {activeNote && !activeNote.isTrashed && (
        <div className="px-3 py-1.5 border-b border-[var(--divider)] bg-[var(--sidebar)]/60 flex items-center gap-0.5 overflow-x-auto shrink-0">
          {[
            { icon: <Heading1 className="w-3.5 h-3.5" />, title: 'Заголовок H1', fn: () => applyMarkdown('# ', '', 'Заголовок') },
            { icon: <Heading2 className="w-3.5 h-3.5" />, title: 'Заголовок H2', fn: () => applyMarkdown('## ', '', 'Подзаголовок') },
            { icon: <Bold className="w-3.5 h-3.5" />, title: 'Жирный', fn: () => applyMarkdown('**', '**') },
            { icon: <Italic className="w-3.5 h-3.5" />, title: 'Курсив', fn: () => applyMarkdown('*', '*') },
            { icon: <Strikethrough className="w-3.5 h-3.5" />, title: 'Зачёркнутый', fn: () => applyMarkdown('~~', '~~') },
            { icon: <Underline className="w-3.5 h-3.5" />, title: 'Подчёркнутый', fn: () => applyMarkdown('<u>', '</u>') },
            { icon: <Highlighter className="w-3.5 h-3.5" />, title: 'Выделение ==', fn: () => applyMarkdown('==', '==') },
            { icon: <Code className="w-3.5 h-3.5" />, title: 'Код', fn: () => applyMarkdown('`', '`', 'код') },
            { icon: <Link2 className="w-3.5 h-3.5" />, title: 'Ссылка [[...]]', fn: () => applyMarkdown('[[', ']]', 'Название заметки') },
            { icon: <List className="w-3.5 h-3.5" />, title: 'Маркированный список', fn: () => applyMarkdown('- ', '', 'Пункт') },
            { icon: <ListOrdered className="w-3.5 h-3.5" />, title: 'Нумерованный список', fn: () => applyMarkdown('1. ', '', 'Пункт') },
            { icon: <CheckSquare className="w-3.5 h-3.5" />, title: 'Чек-лист', fn: () => applyMarkdown('- [ ] ', '', 'Задача') },
            { icon: <Minus className="w-3.5 h-3.5" />, title: 'Разделитель', fn: () => applyMarkdown('\n---\n', '', '') },
          ].map((btn, i) => (
            <button
              key={i}
              type="button"
              title={btn.title}
              onClick={btn.fn}
              className="p-1.5 rounded-[6px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
            >
              {btn.icon}
            </button>
          ))}

          <div className="w-px h-4 bg-[var(--divider)] mx-1 shrink-0" />

          <button
            type="button"
            onClick={() =>
              appendBlock({
                id: `b-tbl-${Date.now()}`,
                type: 'table',
                data: {
                  id: `tbl-${Date.now()}`,
                  title: 'Новая таблица',
                  rows: 4,
                  cols: 4,
                  cells: {
                    A1: { value: 'Наименование', bold: true, bg: '#EEF2FF' },
                    B1: { value: 'Кол-во', bold: true, bg: '#EEF2FF' },
                    C1: { value: 'Цена', bold: true, bg: '#EEF2FF' },
                    D1: { value: 'Сумма', bold: true, bg: '#EEF2FF' },
                    D2: { value: '=B2*C2' },
                    A4: { value: 'Итого', bold: true, bg: '#FEF3C7' },
                    D4: { value: '=СУММ(D2:D3)', bold: true, bg: '#FEF3C7' },
                  },
                },
              })
            }
            title="Вставить блок таблицы с формулами"
            className="px-2 py-1 rounded-[6px] text-[11.5px] font-medium text-[var(--text2)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Table2 className="w-3.5 h-3.5" />
            Таблица
          </button>

          <button
            type="button"
            onClick={() =>
              appendBlock({
                id: `b-code-${Date.now()}`,
                type: 'code',
                language: 'text',
                content: '// Фрагмент кода',
              })
            }
            title="Вставить блок кода"
            className="px-2 py-1 rounded-[6px] text-[11.5px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Code className="w-3.5 h-3.5" />
            Код
          </button>

          <button
            type="button"
            onClick={() =>
              appendBlock({
                id: `b-q-${Date.now()}`,
                type: 'quote',
                content: 'Важная цитата или вывод...',
                author: '',
              })
            }
            title="Вставить цитату"
            className="px-2 py-1 rounded-[6px] text-[11.5px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Quote className="w-3.5 h-3.5" />
            Цитата
          </button>

          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              appendBlock({
                id: `b-ics-${Date.now()}`,
                type: 'ics',
                events: [
                  {
                    uid: `ics-${Date.now()}`,
                    summary: 'Новое событие (.ics)',
                    dtStart: `${today}T12:00`,
                    dtEnd: `${today}T13:00`,
                    location: '',
                    description: '',
                  },
                ],
              });
            }}
            title="Вставить календарный блок .ics"
            className="px-2 py-1 rounded-[6px] text-[11.5px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            .ics
          </button>
        </div>
      )}

      {/* Editor Content */}
      {!activeNote ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-[14px] text-[var(--text2)] mb-3">
            Выберите заметку из списка или создайте новую
          </p>
          <button
            type="button"
            onClick={handleCreateNoteHere}
            className="px-4 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            Создать заметку
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto relative">
          {/* Trashed Banner */}
          {activeNote.isTrashed && (
            <div className="px-5 py-2.5 bg-[var(--sidebar)] border-b border-[var(--divider)] flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-[var(--text2)]">Эта заметка находится в корзине.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => restoreNoteFromTrash(activeNote.id)}
                  className="px-3 py-1 rounded-[7px] bg-[var(--accent)] text-white font-medium"
                >
                  Восстановить
                </button>
                <button
                  type="button"
                  onClick={() => deleteNotePermanently(activeNote.id)}
                  className="px-3 py-1 rounded-[7px] border border-[var(--error)] text-[var(--error)] font-medium"
                >
                  Удалить навсегда
                </button>
              </div>
            </div>
          )}

          {/* Info Popover (Metadata & Version History hidden inside ⓘ button) */}
          {infoOpen && (
            <div className="mx-6 mt-4 p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--sidebar)] text-[12.5px] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text)]">Сведения о заметке</span>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  className="text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--text2)]">
                <div>Автор: {activeNote.author}</div>
                <div>
                  Блокнот:{' '}
                  <select
                    value={activeNote.folderId || ''}
                    onChange={(e) =>
                      updateNote(activeNote.id, (n) => ({
                        ...n,
                        folderId: e.target.value || null,
                      }))
                    }
                    className="ml-1 px-1.5 py-0.5 rounded border border-[var(--divider)] bg-[var(--panel)] text-[var(--text)]"
                  >
                    <option value="">Без папки</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tabular-nums">
                  Создана: {new Date(activeNote.createdAt).toLocaleString('ru-RU')}
                </div>
                <div className="tabular-nums">
                  Изменена: {new Date(activeNote.updatedAt).toLocaleString('ru-RU')}
                </div>
              </div>

              <div>
                <div className="text-[11.5px] text-[var(--muted)] mb-1">Теги</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeNote.tags.length === 0 ? (
                    <span className="text-[var(--muted)]">Добавьте #тег прямо в тексте</span>
                  ) : (
                    activeNote.tags.map((t) => (
                      <span
                        key={t}
                        style={{ color: 'var(--tag-fg)', backgroundColor: 'var(--tag-bg)' }}
                        className="px-2 py-0.5 rounded-[6px] text-[11.5px] font-medium"
                      >
                        #{t}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-[var(--divider)] pt-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-[var(--text)] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    История версий ({activeNote.versions.length}/8)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateNote(activeNote.id, (n) => n, true);
                      pushToast('Снимок версии сохранён', 'success');
                    }}
                    className="text-[11.5px] text-[var(--accent)] hover:underline"
                  >
                    Сохранить текущую
                  </button>
                </div>
                {activeNote.versions.length === 0 ? (
                  <div className="text-[11.5px] text-[var(--muted)]">Снимков версий пока нет</div>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {activeNote.versions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between px-2 py-1 rounded-[6px] bg-[var(--panel)] border border-[var(--divider)]"
                      >
                        <span className="truncate text-[11.5px] text-[var(--text2)] tabular-nums">
                          {new Date(v.savedAt).toLocaleString('ru-RU')} · {v.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreNoteVersion(activeNote.id, v.id)}
                          className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1 shrink-0 ml-2"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Откатить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Document Body */}
          <div className="max-w-3xl mx-auto px-6 py-5 space-y-3 scaled-text">
            <input
              value={activeNote.title}
              readOnly={activeNote.isTrashed}
              onChange={(e) => updateNote(activeNote.id, (n) => ({ ...n, title: e.target.value }))}
              placeholder="Заголовок заметки..."
              className="w-full text-[22px] font-bold tracking-tight text-[var(--text)] bg-transparent outline-none pb-2 border-b border-[var(--divider)]"
            />

            {activeNote.blocks.map((block) => {
              if (block.type === 'markdown') {
                if (editorMode === 'edit' && !activeNote.isTrashed) {
                  return (
                    <div key={block.id} className="relative">
                      <textarea
                        ref={(el) => {
                          if (activeBlockId === block.id || !activeBlockId) {
                            activeTextareaRef.current = el;
                          }
                        }}
                        onFocus={() => setActiveBlockId(block.id)}
                        value={block.content}
                        onChange={(e) =>
                          updateBlock(block.id, (b) =>
                            b.type === 'markdown' ? { ...b, content: e.target.value } : b
                          )
                        }
                        onKeyDown={(e) => handleMarkdownKeyDown(block.id, e)}
                        rows={Math.max(5, block.content.split('\n').length + 1)}
                        placeholder="Начните писать Markdown, используйте #теги, [[ссылки]] или - [ ] для задач..."
                        className="w-full resize-y bg-transparent text-[var(--text)] leading-relaxed outline-none font-normal"
                      />
                    </div>
                  );
                }

                // Preview mode with clickable checkboxes, wiki links, tags, headings
                const lines = block.content.split('\n');
                return (
                  <div key={block.id} className="space-y-1.5 leading-relaxed text-[var(--text)]">
                    {lines.map((line, lineIdx) => {
                      if (line.startsWith('### ')) {
                        return (
                          <h3 key={lineIdx} className="text-[16px] font-semibold pt-2">
                            {renderInlineMarkdown(line.slice(4))}
                          </h3>
                        );
                      }
                      if (line.startsWith('## ')) {
                        return (
                          <h2 key={lineIdx} className="text-[18px] font-semibold pt-2">
                            {renderInlineMarkdown(line.slice(3))}
                          </h2>
                        );
                      }
                      if (line.startsWith('# ')) {
                        return (
                          <h1 key={lineIdx} className="text-[20px] font-bold pt-2">
                            {renderInlineMarkdown(line.slice(2))}
                          </h1>
                        );
                      }
                      if (line.trim() === '---') {
                        return <hr key={lineIdx} className="my-3 border-[var(--divider)]" />;
                      }
                      const chkMatch = line.match(/^\s*-\s+\[([ xX])\]\s+(.*)$/);
                      if (chkMatch) {
                        const checked = chkMatch[1].toLowerCase() === 'x';
                        return (
                          <label key={lineIdx} className="flex items-start gap-2.5 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleChecklistLine(block.id, lineIdx)}
                              className="svod-checkbox mt-1"
                            />
                            <span className={checked ? 'line-through text-[var(--muted)]' : ''}>
                              {renderInlineMarkdown(chkMatch[2])}
                            </span>
                          </label>
                        );
                      }
                      const bulMatch = line.match(/^\s*-\s+(.*)$/);
                      if (bulMatch) {
                        return (
                          <div key={lineIdx} className="flex items-start gap-2 pl-2">
                            <span className="text-[var(--muted)]">•</span>
                            <span>{renderInlineMarkdown(bulMatch[1])}</span>
                          </div>
                        );
                      }
                      if (!line.trim()) {
                        return <div key={lineIdx} className="h-2" />;
                      }
                      return <p key={lineIdx}>{renderInlineMarkdown(line)}</p>;
                    })}
                  </div>
                );
              }

              if (block.type === 'table') {
                return (
                  <SpreadsheetBlock
                    key={block.id}
                    data={block.data}
                    readOnly={editorMode === 'preview' || activeNote.isTrashed}
                    onChange={(nextData) =>
                      updateBlock(block.id, (b) => (b.type === 'table' ? { ...b, data: nextData } : b))
                    }
                    onRemoveBlock={() => removeBlock(block.id)}
                  />
                );
              }

              if (block.type === 'code') {
                return (
                  <div
                    key={block.id}
                    className="rounded-[10px] border border-[var(--divider)] bg-[var(--sidebar)] overflow-hidden"
                  >
                    <div className="px-3 py-1 border-b border-[var(--divider)] flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span className="font-mono">{block.language || 'code'}</span>
                      {editorMode === 'edit' && (
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="hover:text-[var(--error)]"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    {editorMode === 'edit' ? (
                      <textarea
                        value={block.content}
                        onChange={(e) =>
                          updateBlock(block.id, (b) =>
                            b.type === 'code' ? { ...b, content: e.target.value } : b
                          )
                        }
                        rows={Math.max(3, block.content.split('\n').length)}
                        className="w-full p-3 bg-transparent font-mono-tabular text-[12.5px] text-[var(--text)] outline-none"
                      />
                    ) : (
                      <pre className="p-3 overflow-x-auto font-mono-tabular text-[12.5px] text-[var(--text)] m-0">
                        {block.content}
                      </pre>
                    )}
                  </div>
                );
              }

              if (block.type === 'quote') {
                return (
                  <div
                    key={block.id}
                    className="p-3.5 rounded-[10px] border border-[var(--divider)] bg-[var(--sidebar)]/70"
                  >
                    {editorMode === 'edit' ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={block.content}
                          onChange={(e) =>
                            updateBlock(block.id, (b) =>
                              b.type === 'quote' ? { ...b, content: e.target.value } : b
                            )
                          }
                          rows={2}
                          className="w-full bg-transparent italic text-[var(--text)] outline-none resize-none"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <input
                            value={block.author || ''}
                            onChange={(e) =>
                              updateBlock(block.id, (b) =>
                                b.type === 'quote' ? { ...b, author: e.target.value } : b
                              )
                            }
                            placeholder="Источник / автор"
                            className="text-[12px] text-[var(--text2)] bg-transparent outline-none flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="text-[11px] text-[var(--muted)] hover:text-[var(--error)]"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="italic text-[var(--text)] m-0">«{block.content}»</p>
                        {block.author && (
                          <div className="text-[12px] text-[var(--text2)] mt-1">— {block.author}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              if (block.type === 'ics') {
                return (
                  <div
                    key={block.id}
                    className="rounded-[10px] border border-[var(--divider)] bg-[var(--sidebar)]/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[12px] font-medium text-[var(--text2)]">
                      <span>Календарь (.ics / VEVENT)</span>
                      {editorMode === 'edit' && (
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="text-[11px] hover:text-[var(--error)]"
                        >
                          Удалить блок
                        </button>
                      )}
                    </div>
                    {block.events.map((ev, evIdx) => (
                      <div
                        key={ev.uid}
                        className="p-2.5 rounded-[8px] border border-[var(--divider)] bg-[var(--panel)] space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--text)]">
                            <span className="font-mono-tabular text-[var(--accent)]">
                              {ev.dtStart.replace('T', ' ')}
                            </span>
                            <span aria-hidden="true">·</span>
                            {editorMode === 'edit' ? (
                              <input
                                value={ev.summary}
                                onChange={(e) =>
                                  updateBlock(block.id, (b) => {
                                    if (b.type !== 'ics') return b;
                                    const copy = [...b.events];
                                    copy[evIdx] = { ...copy[evIdx], summary: e.target.value };
                                    return { ...b, events: copy };
                                  })
                                }
                                className="bg-transparent outline-none border-b border-transparent focus:border-[var(--accent)]"
                              />
                            ) : (
                              <span>{ev.summary}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const [date, startTime] = ev.dtStart.split('T');
                              const [, endTime] = ev.dtEnd.split('T');
                              addCalendarEvent({
                                calendarId: calendars[0]?.id || 'cal-work',
                                title: ev.summary,
                                date: date || new Date().toISOString().slice(0, 10),
                                startTime: startTime || '10:00',
                                endTime: endTime || '11:00',
                                location: ev.location,
                                description: ev.description,
                                reminderMinutes: 15,
                              });
                              pushToast(`«${ev.summary}» добавлено в ваши календари`, 'success');
                            }}
                            className="px-2.5 py-1 rounded-[7px] bg-[var(--accent)] text-white text-[11.5px] font-medium hover:bg-[var(--accent-hover)] whitespace-nowrap"
                          >
                            В мои календари
                          </button>
                        </div>
                        {(ev.location || ev.description) && (
                          <div className="text-[11.5px] text-[var(--text2)]">
                            {[ev.location, ev.description].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Mobile layout: list vs editor toggle
  if (isMobileView) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,.html"
          onChange={handleFileImport}
          className="hidden"
        />
        {mobileShowEditor ? renderEditorPane(2) : renderListPane(1)}
      </div>
    );
  }

  // Desktop ThreePane with resizable dividers
  const visiblePanes = paneOrder.filter((id) => !collapsedPanes[id]);

  return (
    <div
      className="h-full flex overflow-hidden relative"
      onClick={() => contextMenu && setContextMenu(null)}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt,.html"
        onChange={handleFileImport}
        className="hidden"
      />

      {visiblePanes.map((paneId, idx) => {
        const isLast = idx === visiblePanes.length - 1;
        const paneEl =
          paneId === 'folders'
            ? renderFoldersPane(paneOrder.indexOf('folders'))
            : paneId === 'list'
            ? renderListPane(paneOrder.indexOf('list'))
            : renderEditorPane(paneOrder.indexOf('editor'));

        return (
          <React.Fragment key={paneId}>
            {paneEl}
            {!isLast && (
              <div
                onMouseDown={(e) => {
                  if (paneId === 'folders' || paneId === 'list') {
                    startResize(paneId, e);
                  }
                }}
                className="pane-resizer"
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Context Menu for Notes */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-50 min-w-[190px] py-1 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] shadow-xl text-[12.5px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              updateNote(contextMenu.note.id, (n) => ({ ...n, isPinned: !n.isPinned }));
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            {contextMenu.note.isPinned ? 'Открепить' : 'Закрепить сверху'}
          </button>
          <button
            type="button"
            onClick={() => {
              updateNote(contextMenu.note.id, (n) => ({ ...n, isFavorite: !n.isFavorite }));
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            {contextMenu.note.isFavorite ? 'Убрать из избранного' : 'В избранное'}
          </button>
          <button
            type="button"
            onClick={() => {
              createNote(
                contextMenu.note.folderId,
                `${contextMenu.note.title} (копия)`,
                contextMenu.note.blocks[0]?.type === 'markdown'
                  ? contextMenu.note.blocks[0].content
                  : ''
              );
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            Дублировать
          </button>
          <div className="my-1 border-t border-[var(--divider)]" />
          <button
            type="button"
            onClick={() => {
              deleteNoteToTrash(contextMenu.note.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-[var(--error)] hover:bg-red-500/10"
          >
            В корзину
          </button>
        </div>
      )}
    </div>
  );
};
