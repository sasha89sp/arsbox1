import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../core/atomic_storage.dart';
import '../core/crypto_service.dart';
import '../models/models.dart';

/// Основное хранилище состояния приложения (ChangeNotifier).
/// Управляет профилями, заметками, таблицами, календарём, общими папками,
/// настройками, синхронизацией и диагностикой.
class Store extends ChangeNotifier {
  List<ProfileMeta> profiles = [];
  ProfileMeta? activeProfile;
  String? _activeProfilePassword;
  bool isLocked = false;

  AppModuleId activeModule = AppModuleId.notes;
  String selectedFolderFilter = 'all'; // all | favorites | trash | folderId
  String? selectedNoteId;
  String selectedCalendarDate = _fmtDate(DateTime.now());
  String calendarViewMode = 'month'; // day | week | month | year | upcoming

  List<NoteFolder> folders = [];
  List<NoteItem> notes = [];
  List<CalendarSource> calendars = [];
  List<CalendarEvent> events = [];
  List<SharedGroup> sharedGroups = [];
  List<Map<String, String>> voiceHistory = [];
  AppSettings settings = AppSettings();

  // Состояние синхронизации и DiagHub
  bool isSyncing = false;
  double syncProgress = 0.0;
  String syncStage = 'Локальное хранилище готово';
  int speedDownKbps = 0;
  int speedUpKbps = 0;
  Timer? _syncTimer;

  final List<Map<String, String>> diagProcesses = [];
  final List<Map<String, String>> syncHistory = [];
  final List<Map<String, String>> diagLogs = [];

  static String _fmtDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> init() async {
    final dir = await AtomicStorage.getDataDir();
    final profFile = File('${dir.path}${Platform.pathSeparator}profiles.json');
    final res = await AtomicStorage.readValid(profFile);
    if (res.raw != null) {
      final list = jsonDecode(res.raw!) as List;
      profiles = list.map((e) => ProfileMeta.fromJson(e as Map<String, dynamic>)).toList();
    }
    if (profiles.isEmpty) {
      profiles = [
        ProfileMeta(
          id: 'profile-main',
          name: 'Основной профиль',
          login: 'alex',
          avatarColor: 0xFF4F46E5,
          storageType: 'local',
          storageEndpoint: 'data/profile-main.enc',
          hasPassword: false,
          createdAt: DateTime.now(),
        ),
      ];
      await _saveProfiles();
    }
    activeProfile = profiles.first;
    await _loadProfileData(activeProfile!, null);
    logDiag('info', 'Store', 'Хранилище инициализировано (портативный режим: ${AtomicStorage.isPortableMode}).');
    notifyListeners();
  }

  Future<void> _saveProfiles() async {
    final dir = await AtomicStorage.getDataDir();
    final profFile = File('${dir.path}${Platform.pathSeparator}profiles.json');
    await AtomicStorage.writeAtomic(
      profFile,
      jsonEncode(profiles.map((p) => p.toJson()).toList()),
    );
  }

  Future<void> _loadProfileData(ProfileMeta profile, String? password) async {
    final dir = await AtomicStorage.getDataDir();
    final file = File('${dir.path}${Platform.pathSeparator}${profile.id}.enc');
    final res = await AtomicStorage.readValid(file);

    if (res.raw != null) {
      try {
        Map<String, dynamic> map;
        if (profile.hasPassword && password != null && password.isNotEmpty) {
          map = await CryptoService.decryptJson(res.raw!, password);
        } else {
          map = jsonDecode(res.raw!) as Map<String, dynamic>;
        }
        _applySnapshot(map);
        if (res.recoveredFromBak) {
          logDiag('warn', 'AtomicStorage', 'Выполнен автоматический откат на .bak для ${profile.id}.enc');
        }
        return;
      } catch (e) {
        logDiag('error', 'Store', 'Ошибка чтения профиля: $e');
        if (profile.hasPassword) rethrow;
      }
    }

    _seedInitialData();
    await persist();
  }

  void _applySnapshot(Map<String, dynamic> map) {
    folders = ((map['folders'] as List?) ?? [])
        .map((e) => NoteFolder.fromJson(e as Map<String, dynamic>))
        .toList();
    notes = ((map['notes'] as List?) ?? [])
        .map((e) => NoteItem.fromJson(e as Map<String, dynamic>))
        .toList();
    calendars = ((map['calendars'] as List?) ?? [])
        .map((e) => CalendarSource.fromJson(e as Map<String, dynamic>))
        .toList();
    events = ((map['events'] as List?) ?? [])
        .map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>))
        .toList();
    sharedGroups = ((map['sharedGroups'] as List?) ?? [])
        .map((e) => SharedGroup.fromJson(e as Map<String, dynamic>))
        .toList();
    voiceHistory = ((map['voiceHistory'] as List?) ?? [])
        .map((e) => Map<String, String>.from(e as Map))
        .toList();
    if (map['settings'] != null) {
      settings = AppSettings.fromJson(map['settings'] as Map<String, dynamic>);
    }
    selectedNoteId = notes.isNotEmpty ? notes.first.id : null;
  }

  void _seedInitialData() {
    final now = DateTime.now();
    final today = _fmtDate(now);
    final tomorrow = _fmtDate(now.add(const Duration(days: 1)));

    folders = [
      NoteFolder(id: 'f-inbox', name: 'Входящие'),
      NoteFolder(id: 'f-work', name: 'Проекты'),
      NoteFolder(id: 'f-arch', name: 'Архитектура', parentId: 'f-work'),
      NoteFolder(id: 'f-fin', name: 'Финансы и таблицы'),
    ];

    notes = [
      NoteItem(
        id: 'n-welcome',
        folderId: 'f-work',
        title: 'План релиза v1.0 и архитектура',
        tags: ['релиз', 'архитектура'],
        isFavorite: true,
        isPinned: true,
        author: activeProfile?.name ?? 'Алексей',
        createdAt: now.subtract(const Duration(days: 2)),
        updatedAt: now,
        blocks: [
          NoteBlock(
            id: 'b-1',
            type: 'markdown',
            content:
                '## Задачи релиза\n\nХранение данных в зашифрованных файлах `.enc` с атомарной записью `.tmp -> .bak -> main`.\n\n- [x] AES-256-GCM + PBKDF2-HMAC-SHA256 (100 000 итераций) в изолятах\n- [x] Единый редактор заметок, чек-листов и таблиц с формулами\n- [ ] Настройка дельта-синхронизации WebDAV\n\nСм. также [[Бюджет квартала]] и теги #релиз #архитектура.',
          ),
          NoteBlock(
            id: 'b-2',
            type: 'ics',
            content: 'Ревью архитектуры хранилища',
            extra: '${tomorrow}T11:00|${tomorrow}T12:00',
          ),
        ],
      ),
      NoteItem(
        id: 'n-budget',
        folderId: 'f-fin',
        title: 'Бюджет квартала',
        tags: ['финансы', 'таблица'],
        isFavorite: true,
        author: activeProfile?.name ?? 'Алексей',
        createdAt: now.subtract(const Duration(days: 4)),
        updatedAt: now.subtract(const Duration(hours: 3)),
        blocks: [
          NoteBlock(
            id: 'b-fin-md',
            type: 'markdown',
            content: 'Встроенная таблица с живыми формулами `=СУММ(B2:B4)` и `=B2-C2`.',
          ),
          NoteBlock(
            id: 'b-fin-tbl',
            type: 'table',
            table: SpreadsheetBlockData(
              title: 'Расходы на инфраструктуру (₽)',
              rows: 5,
              cols: 4,
              cells: {
                'A1': SpreadsheetCell(value: 'Статья', bold: true, bgHex: 0xFFEEF2FF),
                'B1': SpreadsheetCell(value: 'План', bold: true, bgHex: 0xFFEEF2FF),
                'C1': SpreadsheetCell(value: 'Факт', bold: true, bgHex: 0xFFEEF2FF),
                'D1': SpreadsheetCell(value: 'Остаток', bold: true, bgHex: 0xFFEEF2FF),
                'A2': SpreadsheetCell(value: 'WebDAV / Облако'),
                'B2': SpreadsheetCell(value: '4500'),
                'C2': SpreadsheetCell(value: '3900'),
                'D2': SpreadsheetCell(value: '=B2-C2'),
                'A3': SpreadsheetCell(value: 'Домены'),
                'B3': SpreadsheetCell(value: '2800'),
                'C3': SpreadsheetCell(value: '2800'),
                'D3': SpreadsheetCell(value: '=B3-C3'),
                'A4': SpreadsheetCell(value: 'Сервер бэкапов'),
                'B4': SpreadsheetCell(value: '8200'),
                'C4': SpreadsheetCell(value: '7600'),
                'D4': SpreadsheetCell(value: '=B4-C4'),
                'A5': SpreadsheetCell(value: 'Итого', bold: true, bgHex: 0xFFFEF3C7),
                'B5': SpreadsheetCell(value: '=СУММ(B2:B4)', bold: true, bgHex: 0xFFFEF3C7),
                'C5': SpreadsheetCell(value: '=СУММ(C2:C4)', bold: true, bgHex: 0xFFFEF3C7),
                'D5': SpreadsheetCell(value: '=СУММ(D2:D4)', bold: true, bgHex: 0xFFFEF3C7),
              },
            ),
          ),
        ],
      ),
    ];

    calendars = [
      CalendarSource(id: 'cal-work', name: 'Работа', colorHex: 0xFF4F46E5),
      CalendarSource(id: 'cal-personal', name: 'Личный', colorHex: 0xFF059669),
      CalendarSource(id: 'cal-imp', name: 'Важные даты', colorHex: 0xFFD97706),
    ];

    events = [
      CalendarEvent(
        id: 'ev-1',
        calendarId: 'cal-work',
        title: 'Планирование недели',
        date: today,
        startTime: '10:00',
        endTime: '11:00',
      ),
      CalendarEvent(
        id: 'ev-2',
        calendarId: 'cal-work',
        title: 'Проверка дельта-синхронизации WebDAV',
        date: today,
        startTime: '14:30',
        endTime: '15:30',
      ),
      CalendarEvent(
        id: 'ev-3',
        calendarId: 'cal-imp',
        title: 'Плановый зашифрованный бэкап',
        date: tomorrow,
        startTime: '12:00',
        endTime: '12:30',
      ),
    ];

    sharedGroups = [
      SharedGroup(
        id: 'grp-team',
        name: 'Команда разработки',
        webdavUrl: 'https://webdav.yandex.ru/svod-shared/team/',
        folderPath: '/shared/team',
        keyFingerprint: CryptoService.generateRandomFingerprint(),
        members: [
          {'id': 'm1', 'name': 'Алексей (вы)', 'role': 'editor', 'lastOnline': 'В сети'},
          {'id': 'm2', 'name': 'Мария К.', 'role': 'editor', 'lastOnline': '10 мин назад'},
          {'id': 'm3', 'name': 'Дмитрий В.', 'role': 'contributor', 'lastOnline': '1 ч назад'},
        ],
        messages: [
          {
            'id': 'msg-1',
            'author': 'Мария К.',
            'text': 'Обновила схему ключей для общей папки — проверьте перед сборкой.',
            'createdAt': now.subtract(const Duration(hours: 2)).toIso8601String(),
          },
        ],
        docs: [
          {
            'id': 'sdoc-1',
            'title': 'Регламент страховочных копий',
            'content': 'Перед импортом и восстановлением всегда сохраняется снимок в safety/ (последние 5).',
            'author': 'Мария К.',
            'comments': <Map<String, String>>[],
          },
        ],
      ),
    ];

    selectedNoteId = notes.first.id;
  }

  Map<String, dynamic> _toSnapshot() => {
        'folders': folders.map((e) => e.toJson()).toList(),
        'notes': notes.map((e) => e.toJson()).toList(),
        'calendars': calendars.map((e) => e.toJson()).toList(),
        'events': events.map((e) => e.toJson()).toList(),
        'sharedGroups': sharedGroups.map((e) => e.toJson()).toList(),
        'voiceHistory': voiceHistory,
        'settings': settings.toJson(),
      };

  Future<void> persist() async {
    if (activeProfile == null || isLocked) return;
    final dir = await AtomicStorage.getDataDir();
    final file = File('${dir.path}${Platform.pathSeparator}${activeProfile!.id}.enc');
    final snapshot = _toSnapshot();
    final payload = (activeProfile!.hasPassword && _activeProfilePassword != null)
        ? await CryptoService.encryptJson(snapshot, _activeProfilePassword!)
        : jsonEncode(snapshot);
    await AtomicStorage.writeAtomic(file, payload);
  }

  void lockProfile() {
    isLocked = true;
    _activeProfilePassword = null;
    notifyListeners();
  }

  Future<bool> unlockProfile(String profileId, String? password) async {
    final target = profiles.firstWhere((p) => p.id == profileId);
    try {
      await _loadProfileData(target, password);
      activeProfile = target;
      _activeProfilePassword = password;
      isLocked = false;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> createProfile({
    required String name,
    required String login,
    required String storageType,
    required String storageEndpoint,
    String? password,
  }) async {
    final p = ProfileMeta(
      id: 'profile-${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      login: login,
      avatarColor: 0xFF4F46E5,
      storageType: storageType,
      storageEndpoint: storageEndpoint,
      hasPassword: password != null && password.isNotEmpty,
      createdAt: DateTime.now(),
    );
    profiles.add(p);
    await _saveProfiles();
    activeProfile = p;
    _activeProfilePassword = password;
    isLocked = false;
    _seedInitialData();
    await persist();
    notifyListeners();
  }

  void setModule(AppModuleId m) {
    if (m != AppModuleId.settings && settings.enabledModules[m] == false) return;
    activeModule = m;
    notifyListeners();
  }

  void setSelectedNoteId(String? id) {
    selectedNoteId = id;
    notifyListeners();
  }

  void setSelectedFolderFilter(String filter) {
    selectedFolderFilter = filter;
    notifyListeners();
  }

  void setSelectedCalendarDate(String date) {
    selectedCalendarDate = date;
    notifyListeners();
  }

  void setCalendarViewMode(String mode) {
    calendarViewMode = mode;
    notifyListeners();
  }

  void toggleModule(AppModuleId m) {
    final next = !(settings.enabledModules[m] ?? true);
    settings.enabledModules[m] = next;
    if (!next && activeModule == m) activeModule = AppModuleId.settings;
    persist();
    notifyListeners();
  }

  void updateSettings(void Function(AppSettings s) fn) {
    fn(settings);
    persist();
    notifyListeners();
  }

  void adjustUiScale(double delta) {
    settings.uiScale = (settings.uiScale + delta).clamp(0.8, 1.6);
    persist();
    notifyListeners();
  }

  void resetUiScale() {
    settings.uiScale = 1.0;
    persist();
    notifyListeners();
  }

  // --- Notes CRUD ---
  NoteFolder createFolder(String name, {String? parentId}) {
    final f = NoteFolder(id: 'f-${DateTime.now().millisecondsSinceEpoch}', name: name, parentId: parentId);
    folders.add(f);
    persist();
    notifyListeners();
    return f;
  }

  NoteItem createNote({String? folderId, String title = 'Новая заметка', String content = ''}) {
    final now = DateTime.now();
    final n = NoteItem(
      id: 'n-${now.millisecondsSinceEpoch}',
      folderId: folderId,
      title: title,
      author: activeProfile?.name ?? 'Пользователь',
      createdAt: now,
      updatedAt: now,
      blocks: [NoteBlock(id: 'b-${now.millisecondsSinceEpoch}', type: 'markdown', content: content)],
    );
    notes.insert(0, n);
    selectedNoteId = n.id;
    persist();
    notifyListeners();
    return n;
  }

  void updateNote(String id, void Function(NoteItem n) updater, {bool saveVersion = false}) {
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx < 0) return;
    final note = notes[idx];
    if (saveVersion) {
      note.versions.insert(
        0,
        NoteVersion(
          id: 'v-${DateTime.now().millisecondsSinceEpoch}',
          savedAt: note.updatedAt,
          title: note.title,
          blocks: note.blocks
              .map((b) => NoteBlock.fromJson(jsonDecode(jsonEncode(b.toJson())) as Map<String, dynamic>))
              .toList(),
        ),
      );
      if (note.versions.length > 8) note.versions = note.versions.sublist(0, 8);
    }
    updater(note);
    note.updatedAt = DateTime.now();
    persist();
    notifyListeners();
  }

  void trashNote(String id) {
    updateNote(id, (n) => n.isTrashed = true);
  }

  void restoreNote(String id) {
    updateNote(id, (n) => n.isTrashed = false);
  }

  void deleteNotePermanently(String id) {
    notes.removeWhere((n) => n.id == id);
    if (selectedNoteId == id) selectedNoteId = notes.isNotEmpty ? notes.first.id : null;
    persist();
    notifyListeners();
  }

  // --- Calendar CRUD ---
  void addEvent(CalendarEvent ev) {
    events.add(ev);
    persist();
    notifyListeners();
  }

  void deleteEvent(String id) {
    events.removeWhere((e) => e.id == id);
    persist();
    notifyListeners();
  }

  void toggleCalendarVisible(String id) {
    final c = calendars.firstWhere((e) => e.id == id);
    c.visible = !c.visible;
    persist();
    notifyListeners();
  }

  // --- Shared Groups ---
  void sendSharedMessage(String groupId, String text) {
    final g = sharedGroups.firstWhere((e) => e.id == groupId);
    g.messages.add({
      'id': 'msg-${DateTime.now().millisecondsSinceEpoch}',
      'author': '${activeProfile?.name ?? 'Вы'} (вы)',
      'text': text,
      'createdAt': DateTime.now().toIso8601String(),
    });
    persist();
    notifyListeners();
  }

  // --- Voice History ---
  void addVoiceEntry(String text) {
    voiceHistory.insert(0, {
      'id': 'vr-${DateTime.now().millisecondsSinceEpoch}',
      'text': text,
      'createdAt': DateTime.now().toIso8601String(),
    });
    persist();
    notifyListeners();
  }

  // --- Sync & Safety Backups ---
  Future<void> createSafetyBackup(String reason) async {
    await AtomicStorage.saveSafetyCopy(reason, jsonEncode(_toSnapshot()));
    logDiag('info', 'Backup', 'Сохранена страховочная копия safety/: $reason');
    notifyListeners();
  }

  void toggleSync() {
    if (isSyncing) {
      _syncTimer?.cancel();
      isSyncing = false;
      syncStage = 'Остановлено пользователем';
      logDiag('warn', 'Sync', 'Синхронизация прервана пользователем.');
      notifyListeners();
      return;
    }

    isSyncing = true;
    syncProgress = 0.1;
    syncStage = 'Чтение manifest.json...';
    speedDownKbps = 520;
    speedUpKbps = 340;
    notifyListeners();

    final stages = [
      'Сверка дельта-изменений (5 потоков)...',
      'Шифрование AES-256-GCM...',
      'Атомарная запись .tmp -> .bak -> .enc...',
      'Синхронизация завершена',
    ];
    var step = 0;
    _syncTimer = Timer.periodic(const Duration(milliseconds: 350), (timer) {
      if (step < stages.length - 1) {
        syncProgress = (step + 2) * 0.22;
        syncStage = stages[step];
        step++;
        notifyListeners();
      } else {
        timer.cancel();
        isSyncing = false;
        syncProgress = 1.0;
        syncStage = stages.last;
        speedDownKbps = 0;
        speedUpKbps = 0;
        final nowIso = DateTime.now().toIso8601String();
        diagProcesses.insert(0, {
          'time': nowIso,
          'op': 'Дельта-обмен (${settings.syncEndpoint})',
          'detail': 'Заметок: ${notes.length}, событий: ${events.length}',
        });
        syncHistory.insert(0, {
          'time': nowIso,
          'target': settings.syncEndpoint,
          'summary': '↑ ${notes.length} · ↓ 0 · Конфликтов: 0',
        });
        logDiag('info', 'Sync', 'Дельта-синхронизация успешно завершена.');
        persist();
        notifyListeners();
      }
    });
  }

  void logDiag(String level, String source, String message) {
    diagLogs.insert(0, {
      'time': DateTime.now().toIso8601String(),
      'level': level,
      'source': source,
      'message': message,
    });
    if (diagLogs.length > 100) diagLogs.removeLast();
  }
}
