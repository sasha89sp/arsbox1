export type ModuleId =
  | 'notes'
  | 'passwords'
  | 'calendar'
  | 'shared'
  | 'voice'
  | 'dock'
  | 'settings';

export type ThemeMode = 'light' | 'dark';
export type LayoutMode = 'auto' | 'desktop' | 'mobile';
export type StatusStripPosition = 'top' | 'bottom' | 'sync-only' | 'hidden';
export type MobileNavMode = 'always' | 'hide-on-scroll' | 'hidden';

export interface ProfileMeta {
  id: string;
  name: string;
  login: string;
  avatarColor: string;
  storageType: 'local' | 'webdav' | 'gdrive';
  storageEndpoint?: string;
  createdAt: string;
  hasPassword: boolean;
  passwordHint?: string;
  remembered?: boolean;
}

// --- Notes & Unified Block Model ---
export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface SpreadsheetCell {
  value: string;
  bg?: string;
  fg?: string;
  bold?: boolean;
}

export interface SpreadsheetData {
  id: string;
  title: string;
  rows: number;
  cols: number;
  cells: Record<string, SpreadsheetCell>; // key: "A1", "B2"
}

export interface IcsEventBlockData {
  uid: string;
  summary: string;
  dtStart: string; // YYYY-MM-DDTHH:mm
  dtEnd: string;
  location?: string;
  description?: string;
}

export type NoteBlock =
  | { id: string; type: 'markdown'; content: string }
  | { id: string; type: 'table'; data: SpreadsheetData }
  | { id: string; type: 'code'; language: string; content: string }
  | { id: string; type: 'quote'; content: string; author?: string }
  | { id: string; type: 'voice'; transcript: string; durationSec: number; createdAt: string }
  | { id: string; type: 'ics'; events: IcsEventBlockData[] };

export interface NoteVersion {
  id: string;
  savedAt: string;
  title: string;
  blocks: NoteBlock[];
}

export interface NoteItem {
  id: string;
  folderId: string | null;
  title: string;
  blocks: NoteBlock[];
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  isTrashed: boolean;
  trashedAt?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  versions: NoteVersion[];
}

// --- Password Vault (Independent PassStore) ---
export type PassSortField = 'title' | 'updatedAt' | 'createdAt' | 'username' | 'url';
export type PassSortDir = 'asc' | 'desc';

export interface PassSortConfig {
  field: PassSortField;
  dir: PassSortDir;
  favoritesFirst: boolean;
}

export interface PassExtraField {
  id: string;
  label: string;
  value: string;
  hidden: boolean;
}

export interface PassHistoryEntry {
  password: string;
  changedAt: string;
}

export interface PassFolder {
  id: string;
  name: string;
  sortOverride?: PassSortConfig | null;
}

export interface PassEntry {
  id: string;
  folderId: string | null;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  extraFields: PassExtraField[];
  history: PassHistoryEntry[];
  isFavorite: boolean;
  isTrashed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PassVaultData {
  folders: PassFolder[];
  entries: PassEntry[];
  sort: PassSortConfig;
}

export interface PassVaultMeta {
  id: string;
  name: string;
  hint: string;
  createdAt: string;
  updatedAt: string;
  failedAttempts: number;
  lockedUntil: number | null;
  rememberedPassword?: string | null; // Optional device-remembered secret
  encryptedPayload: string; // JSON of AES-256-GCM EncryptedBlob
}

// --- Calendar & Reminders ---
export type CalendarViewType = 'day' | 'week' | 'month' | 'year' | 'upcoming';

export interface CalendarSource {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  readOnly?: boolean;
  icalUrl?: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  allDay?: boolean;
  location?: string;
  description?: string;
  reminderMinutes?: number | null;
}

// --- Shared Folders & Chat ---
export type SharedRole = 'viewer' | 'contributor' | 'editor';

export interface SharedMember {
  id: string;
  name: string;
  role: SharedRole;
  lastOnline: string;
  isOwner?: boolean;
}

export interface SharedMessage {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SharedComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SharedDoc {
  id: string;
  title: string;
  content: string;
  author: string;
  updatedAt: string;
  comments: SharedComment[];
}

export interface SharedGroup {
  id: string;
  name: string;
  webdavUrl: string;
  folderPath: string;
  encryptionKeyFingerprint: string;
  members: SharedMember[];
  messages: SharedMessage[];
  docs: SharedDoc[];
}

// --- Voice Dictation ---
export interface VoiceRecord {
  id: string;
  text: string;
  durationSec: number;
  createdAt: string;
  engine: 'browser-speech' | 'manual';
}

// --- Dock ---
export type DockEdge = 'bottom' | 'top' | 'left' | 'right';

export interface DockShortcut {
  id: string;
  label: string;
  targetType: 'module' | 'url';
  target: string;
  color: string;
}

export interface DockConfig {
  enabledOverlay: boolean;
  edge: DockEdge;
  iconSize: number; // 36 - 68
  opacity: number; // 0.4 - 1
  fisheye: boolean;
  items: DockShortcut[];
}

// --- Diagnostics & Sync ---
export interface DiagProcessEntry {
  id: string;
  timestamp: string;
  operation: string;
  status: 'ok' | 'running' | 'error';
  speedKbps?: number;
  bytes?: number;
  detail: string;
}

export interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  target: string;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  durationMs: number;
  result: 'success' | 'error';
}

export interface DiagLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

export interface SafetyBackup {
  id: string;
  createdAt: string;
  reason: string;
  sizeBytes: number;
  snapshotJson: string;
}

// --- Settings ---
export interface AppSettings {
  theme: ThemeMode;
  layoutMode: LayoutMode;
  uiScale: number; // 0.8 - 1.6
  fontScale: number; // 0.8 - 1.6
  showNotebooksInSidebar: boolean;
  showSchedulePanel: boolean;
  statusStripPosition: StatusStripPosition;
  mobileNavMode: MobileNavMode;
  enabledModules: Record<Exclude<ModuleId, 'settings'>, boolean>;
  clipboardClearSec: number; // 0 = off, default 30
  passAutoLockMin: number; // 0 = never, default 5
  syncEndpoint: string;
  syncPreset: 'local' | 'yandex' | 'mailru' | 'webdav' | 'gdrive';
  autoSyncOnEdit: boolean;
  dock: DockConfig;
}

export interface WorkspaceSnapshot {
  folders: NoteFolder[];
  notes: NoteItem[];
  calendars: CalendarSource[];
  events: CalendarEvent[];
  sharedGroups: SharedGroup[];
  voiceHistory: VoiceRecord[];
  settings: AppSettings;
}
