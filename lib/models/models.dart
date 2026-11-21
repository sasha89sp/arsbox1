enum AppModuleId {
  notes,
  passwords,
  calendar,
  shared,
  voice,
  dock,
  win,
  settings,
}

enum LayoutMode { auto, desktop, mobile }

enum StatusStripPos { top, bottom, syncOnly, hidden }

class ProfileMeta {
  final String id;
  final String name;
  final String login;
  final int avatarColor;
  final String storageType; // local | webdav | gdrive
  final String storageEndpoint;
  final bool hasPassword;
  final DateTime createdAt;

  ProfileMeta({
    required this.id,
    required this.name,
    required this.login,
    required this.avatarColor,
    required this.storageType,
    required this.storageEndpoint,
    required this.hasPassword,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'login': login,
        'avatarColor': avatarColor,
        'storageType': storageType,
        'storageEndpoint': storageEndpoint,
        'hasPassword': hasPassword,
        'createdAt': createdAt.toIso8601String(),
      };

  factory ProfileMeta.fromJson(Map<String, dynamic> j) => ProfileMeta(
        id: j['id'] as String,
        name: j['name'] as String,
        login: j['login'] as String,
        avatarColor: (j['avatarColor'] as int?) ?? 0xFF4F46E5,
        storageType: (j['storageType'] as String?) ?? 'local',
        storageEndpoint: (j['storageEndpoint'] as String?) ?? 'data/profile.enc',
        hasPassword: (j['hasPassword'] as bool?) ?? false,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
      );
}

class NoteFolder {
  final String id;
  String name;
  String? parentId;

  NoteFolder({required this.id, required this.name, this.parentId});

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'parentId': parentId};

  factory NoteFolder.fromJson(Map<String, dynamic> j) => NoteFolder(
        id: j['id'] as String,
        name: j['name'] as String,
        parentId: j['parentId'] as String?,
      );
}

class SpreadsheetCell {
  String value;
  bool bold;
  int? bgHex;

  SpreadsheetCell({this.value = '', this.bold = false, this.bgHex});

  Map<String, dynamic> toJson() => {'v': value, 'b': bold, 'bg': bgHex};

  factory SpreadsheetCell.fromJson(Map<String, dynamic> j) => SpreadsheetCell(
        value: (j['v'] as String?) ?? '',
        bold: (j['b'] as bool?) ?? false,
        bgHex: j['bg'] as int?,
      );
}

class SpreadsheetBlockData {
  String title;
  int rows;
  int cols;
  Map<String, SpreadsheetCell> cells;

  SpreadsheetBlockData({
    required this.title,
    this.rows = 6,
    this.cols = 4,
    required this.cells,
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        'rows': rows,
        'cols': cols,
        'cells': cells.map((k, v) => MapEntry(k, v.toJson())),
      };

  factory SpreadsheetBlockData.fromJson(Map<String, dynamic> j) {
    final rawCells = (j['cells'] as Map<String, dynamic>?) ?? {};
    return SpreadsheetBlockData(
      title: (j['title'] as String?) ?? 'Таблица',
      rows: (j['rows'] as int?) ?? 6,
      cols: (j['cols'] as int?) ?? 4,
      cells: rawCells.map((k, v) => MapEntry(k, SpreadsheetCell.fromJson(v as Map<String, dynamic>))),
    );
  }
}

class NoteBlock {
  final String id;
  final String type; // markdown | table | code | quote | ics
  String content;
  SpreadsheetBlockData? table;
  String? extra;

  NoteBlock({
    required this.id,
    required this.type,
    this.content = '',
    this.table,
    this.extra,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'content': content,
        'table': table?.toJson(),
        'extra': extra,
      };

  factory NoteBlock.fromJson(Map<String, dynamic> j) => NoteBlock(
        id: j['id'] as String,
        type: j['type'] as String,
        content: (j['content'] as String?) ?? '',
        table: j['table'] != null
            ? SpreadsheetBlockData.fromJson(j['table'] as Map<String, dynamic>)
            : null,
        extra: j['extra'] as String?,
      );
}

class NoteVersion {
  final String id;
  final DateTime savedAt;
  final String title;
  final List<NoteBlock> blocks;

  NoteVersion({
    required this.id,
    required this.savedAt,
    required this.title,
    required this.blocks,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'savedAt': savedAt.toIso8601String(),
        'title': title,
        'blocks': blocks.map((b) => b.toJson()).toList(),
      };

  factory NoteVersion.fromJson(Map<String, dynamic> j) => NoteVersion(
        id: j['id'] as String,
        savedAt: DateTime.tryParse(j['savedAt'] as String? ?? '') ?? DateTime.now(),
        title: (j['title'] as String?) ?? '',
        blocks: ((j['blocks'] as List?) ?? [])
            .map((e) => NoteBlock.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class NoteItem {
  final String id;
  String? folderId;
  String title;
  List<NoteBlock> blocks;
  List<String> tags;
  bool isFavorite;
  bool isPinned;
  bool isTrashed;
  String author;
  DateTime createdAt;
  DateTime updatedAt;
  List<NoteVersion> versions;

  NoteItem({
    required this.id,
    this.folderId,
    required this.title,
    required this.blocks,
    List<String>? tags,
    this.isFavorite = false,
    this.isPinned = false,
    this.isTrashed = false,
    this.author = 'Пользователь',
    required this.createdAt,
    required this.updatedAt,
    List<NoteVersion>? versions,
  })  : tags = tags ?? [],
        versions = versions ?? [];

  Map<String, dynamic> toJson() => {
        'id': id,
        'folderId': folderId,
        'title': title,
        'blocks': blocks.map((b) => b.toJson()).toList(),
        'tags': tags,
        'isFavorite': isFavorite,
        'isPinned': isPinned,
        'isTrashed': isTrashed,
        'author': author,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
        'versions': versions.map((v) => v.toJson()).toList(),
      };

  factory NoteItem.fromJson(Map<String, dynamic> j) => NoteItem(
        id: j['id'] as String,
        folderId: j['folderId'] as String?,
        title: (j['title'] as String?) ?? '',
        blocks: ((j['blocks'] as List?) ?? [])
            .map((e) => NoteBlock.fromJson(e as Map<String, dynamic>))
            .toList(),
        tags: ((j['tags'] as List?) ?? []).cast<String>(),
        isFavorite: (j['isFavorite'] as bool?) ?? false,
        isPinned: (j['isPinned'] as bool?) ?? false,
        isTrashed: (j['isTrashed'] as bool?) ?? false,
        author: (j['author'] as String?) ?? 'Пользователь',
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
        updatedAt: DateTime.tryParse(j['updatedAt'] as String? ?? '') ?? DateTime.now(),
        versions: ((j['versions'] as List?) ?? [])
            .map((e) => NoteVersion.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class CalendarSource {
  final String id;
  String name;
  int colorHex;
  bool visible;
  String? icalUrl;

  CalendarSource({
    required this.id,
    required this.name,
    required this.colorHex,
    this.visible = true,
    this.icalUrl,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'colorHex': colorHex,
        'visible': visible,
        'icalUrl': icalUrl,
      };

  factory CalendarSource.fromJson(Map<String, dynamic> j) => CalendarSource(
        id: j['id'] as String,
        name: j['name'] as String,
        colorHex: (j['colorHex'] as int?) ?? 0xFF4F46E5,
        visible: (j['visible'] as bool?) ?? true,
        icalUrl: j['icalUrl'] as String?,
      );
}

class CalendarEvent {
  final String id;
  String calendarId;
  String title;
  String date; // YYYY-MM-DD
  String startTime; // HH:mm
  String endTime; // HH:mm
  String? location;
  String? description;
  int reminderMinutes;

  CalendarEvent({
    required this.id,
    required this.calendarId,
    required this.title,
    required this.date,
    this.startTime = '10:00',
    this.endTime = '11:00',
    this.location,
    this.description,
    this.reminderMinutes = 15,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'calendarId': calendarId,
        'title': title,
        'date': date,
        'startTime': startTime,
        'endTime': endTime,
        'location': location,
        'description': description,
        'reminderMinutes': reminderMinutes,
      };

  factory CalendarEvent.fromJson(Map<String, dynamic> j) => CalendarEvent(
        id: j['id'] as String,
        calendarId: j['calendarId'] as String,
        title: j['title'] as String,
        date: j['date'] as String,
        startTime: (j['startTime'] as String?) ?? '10:00',
        endTime: (j['endTime'] as String?) ?? '11:00',
        location: j['location'] as String?,
        description: j['description'] as String?,
        reminderMinutes: (j['reminderMinutes'] as int?) ?? 15,
      );
}

// --- Password Vault Models ---
class PassExtraField {
  final String id;
  String label;
  String value;
  bool hidden;

  PassExtraField({
    required this.id,
    required this.label,
    required this.value,
    this.hidden = false,
  });

  Map<String, dynamic> toJson() => {'id': id, 'label': label, 'value': value, 'hidden': hidden};

  factory PassExtraField.fromJson(Map<String, dynamic> j) => PassExtraField(
        id: j['id'] as String,
        label: j['label'] as String,
        value: (j['value'] as String?) ?? '',
        hidden: (j['hidden'] as bool?) ?? false,
      );
}

class PassEntry {
  final String id;
  String? folderId;
  String title;
  String username;
  String password;
  String url;
  String notes;
  List<PassExtraField> extraFields;
  List<Map<String, String>> history; // {password, changedAt}
  bool isFavorite;
  bool isTrashed;
  DateTime createdAt;
  DateTime updatedAt;

  PassEntry({
    required this.id,
    this.folderId,
    required this.title,
    this.username = '',
    this.password = '',
    this.url = '',
    this.notes = '',
    List<PassExtraField>? extraFields,
    List<Map<String, String>>? history,
    this.isFavorite = false,
    this.isTrashed = false,
    required this.createdAt,
    required this.updatedAt,
  })  : extraFields = extraFields ?? [],
        history = history ?? [];

  Map<String, dynamic> toJson() => {
        'id': id,
        'folderId': folderId,
        'title': title,
        'username': username,
        'password': password,
        'url': url,
        'notes': notes,
        'extraFields': extraFields.map((e) => e.toJson()).toList(),
        'history': history,
        'isFavorite': isFavorite,
        'isTrashed': isTrashed,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };

  factory PassEntry.fromJson(Map<String, dynamic> j) => PassEntry(
        id: j['id'] as String,
        folderId: j['folderId'] as String?,
        title: (j['title'] as String?) ?? '',
        username: (j['username'] as String?) ?? '',
        password: (j['password'] as String?) ?? '',
        url: (j['url'] as String?) ?? '',
        notes: (j['notes'] as String?) ?? '',
        extraFields: ((j['extraFields'] as List?) ?? [])
            .map((e) => PassExtraField.fromJson(e as Map<String, dynamic>))
            .toList(),
        history: ((j['history'] as List?) ?? [])
            .map((e) => Map<String, String>.from(e as Map))
            .toList(),
        isFavorite: (j['isFavorite'] as bool?) ?? false,
        isTrashed: (j['isTrashed'] as bool?) ?? false,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
        updatedAt: DateTime.tryParse(j['updatedAt'] as String? ?? '') ?? DateTime.now(),
      );
}

class PassVaultMeta {
  final String id;
  final String name;
  final String hint;
  int failedAttempts;
  DateTime? lockedUntil;
  String encryptedFileName;

  PassVaultMeta({
    required this.id,
    required this.name,
    required this.hint,
    this.failedAttempts = 0,
    this.lockedUntil,
    required this.encryptedFileName,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'hint': hint,
        'failedAttempts': failedAttempts,
        'lockedUntil': lockedUntil?.toIso8601String(),
        'encryptedFileName': encryptedFileName,
      };

  factory PassVaultMeta.fromJson(Map<String, dynamic> j) => PassVaultMeta(
        id: j['id'] as String,
        name: j['name'] as String,
        hint: (j['hint'] as String?) ?? '',
        failedAttempts: (j['failedAttempts'] as int?) ?? 0,
        lockedUntil: DateTime.tryParse(j['lockedUntil'] as String? ?? ''),
        encryptedFileName: j['encryptedFileName'] as String,
      );
}

// --- Shared Group Models ---
class SharedGroup {
  final String id;
  String name;
  String webdavUrl;
  String folderPath;
  String keyFingerprint;
  List<Map<String, String>> members; // {id, name, role, lastOnline}
  List<Map<String, String>> messages; // {id, author, text, createdAt}
  List<Map<String, dynamic>> docs; // {id, title, content, author, comments: []}

  SharedGroup({
    required this.id,
    required this.name,
    required this.webdavUrl,
    required this.folderPath,
    required this.keyFingerprint,
    List<Map<String, String>>? members,
    List<Map<String, String>>? messages,
    List<Map<String, dynamic>>? docs,
  })  : members = members ?? [],
        messages = messages ?? [],
        docs = docs ?? [];

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'webdavUrl': webdavUrl,
        'folderPath': folderPath,
        'keyFingerprint': keyFingerprint,
        'members': members,
        'messages': messages,
        'docs': docs,
      };

  factory SharedGroup.fromJson(Map<String, dynamic> j) => SharedGroup(
        id: j['id'] as String,
        name: j['name'] as String,
        webdavUrl: (j['webdavUrl'] as String?) ?? '',
        folderPath: (j['folderPath'] as String?) ?? '/shared',
        keyFingerprint: (j['keyFingerprint'] as String?) ?? '',
        members: ((j['members'] as List?) ?? [])
            .map((e) => Map<String, String>.from(e as Map))
            .toList(),
        messages: ((j['messages'] as List?) ?? [])
            .map((e) => Map<String, String>.from(e as Map))
            .toList(),
        docs: ((j['docs'] as List?) ?? []).cast<Map<String, dynamic>>(),
      );
}

class AppSettings {
  bool isDark;
  LayoutMode layoutMode;
  double uiScale; // 0.8 - 1.6
  double fontScale; // 0.8 - 1.6
  bool showNotebooksInSidebar;
  bool showSchedulePanel;
  StatusStripPos statusStripPos;
  Map<AppModuleId, bool> enabledModules;
  int clipboardClearSec;
  int passAutoLockMin;
  String syncEndpoint;

  AppSettings({
    this.isDark = false,
    this.layoutMode = LayoutMode.auto,
    this.uiScale = 1.0,
    this.fontScale = 1.0,
    this.showNotebooksInSidebar = true,
    this.showSchedulePanel = true,
    this.statusStripPos = StatusStripPos.bottom,
    Map<AppModuleId, bool>? enabledModules,
    this.clipboardClearSec = 30,
    this.passAutoLockMin = 5,
    this.syncEndpoint = 'https://webdav.yandex.ru/svod-vault/',
  }) : enabledModules = enabledModules ??
            {
              AppModuleId.notes: true,
              AppModuleId.passwords: true,
              AppModuleId.calendar: true,
              AppModuleId.shared: true,
              AppModuleId.voice: true,
              AppModuleId.dock: true,
              AppModuleId.win: true,
            };

  Map<String, dynamic> toJson() => {
        'isDark': isDark,
        'layoutMode': layoutMode.name,
        'uiScale': uiScale,
        'fontScale': fontScale,
        'showNotebooksInSidebar': showNotebooksInSidebar,
        'showSchedulePanel': showSchedulePanel,
        'statusStripPos': statusStripPos.name,
        'enabledModules': enabledModules.map((k, v) => MapEntry(k.name, v)),
        'clipboardClearSec': clipboardClearSec,
        'passAutoLockMin': passAutoLockMin,
        'syncEndpoint': syncEndpoint,
      };

  factory AppSettings.fromJson(Map<String, dynamic> j) {
    final rawMods = (j['enabledModules'] as Map<String, dynamic>?) ?? {};
    final mods = <AppModuleId, bool>{};
    for (final m in AppModuleId.values) {
      if (m == AppModuleId.settings) continue;
      mods[m] = (rawMods[m.name] as bool?) ?? true;
    }
    return AppSettings(
      isDark: (j['isDark'] as bool?) ?? false,
      layoutMode: LayoutMode.values.firstWhere(
        (e) => e.name == j['layoutMode'],
        orElse: () => LayoutMode.auto,
      ),
      uiScale: ((j['uiScale'] as num?) ?? 1.0).toDouble().clamp(0.8, 1.6),
      fontScale: ((j['fontScale'] as num?) ?? 1.0).toDouble().clamp(0.8, 1.6),
      showNotebooksInSidebar: (j['showNotebooksInSidebar'] as bool?) ?? true,
      showSchedulePanel: (j['showSchedulePanel'] as bool?) ?? true,
      statusStripPos: StatusStripPos.values.firstWhere(
        (e) => e.name == j['statusStripPos'],
        orElse: () => StatusStripPos.bottom,
      ),
      enabledModules: mods,
      clipboardClearSec: (j['clipboardClearSec'] as int?) ?? 30,
      passAutoLockMin: (j['passAutoLockMin'] as int?) ?? 5,
      syncEndpoint: (j['syncEndpoint'] as String?) ?? 'https://webdav.yandex.ru/svod-vault/',
    );
  }
}
