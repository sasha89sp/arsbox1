import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Атомарное файловое хранилище (.enc без SQLite) с откатом на .bak
/// и поддержкой портативного режима Windows (portable.txt рядом с .exe -> data/).
class AtomicStorage {
  static Directory? _cachedRootDir;
  static bool isPortableMode = false;

  /// Определяет корневую папку данных.
  /// На Windows: если рядом с .exe лежит portable.txt — используется data/ рядом с программой.
  static Future<Directory> getDataDir() async {
    if (_cachedRootDir != null) return _cachedRootDir!;

    if (Platform.isWindows) {
      final exeDir = File(Platform.resolvedExecutable).parent;
      final portableMarker = File('${exeDir.path}${Platform.pathSeparator}portable.txt');
      if (await portableMarker.exists()) {
        isPortableMode = true;
        final dataDir = Directory('${exeDir.path}${Platform.pathSeparator}data');
        if (!await dataDir.exists()) {
          await dataDir.create(recursive: true);
        }
        _cachedRootDir = dataDir;
        return dataDir;
      }
    }

    final appDir = await getApplicationSupportDirectory();
    final dataDir = Directory('${appDir.path}${Platform.pathSeparator}svod_data');
    if (!await dataDir.exists()) {
      await dataDir.create(recursive: true);
    }
    _cachedRootDir = dataDir;
    return dataDir;
  }

  /// Строго атомарная запись:
  /// 1) запись во временный файл .tmp с flush()
  /// 2) переименование текущего основного файла в .bak
  /// 3) переименование .tmp в основной файл
  static Future<void> writeAtomic(File target, String content) async {
    final parent = target.parent;
    if (!await parent.exists()) {
      await parent.create(recursive: true);
    }
    final tmp = File('${target.path}.tmp');
    final bak = File('${target.path}.bak');

    final raf = await tmp.open(mode: FileMode.write);
    try {
      await raf.writeString(content, encoding: utf8);
      await raf.flush();
    } finally {
      await raf.close();
    }

    if (await target.exists()) {
      if (await bak.exists()) {
        await bak.delete();
      }
      await target.rename(bak.path);
    }
    await tmp.rename(target.path);
  }

  /// Безопасное чтение JSON-файла с автоматическим откатом на .bak при повреждении.
  static Future<({String? raw, bool recoveredFromBak})> readValid(File target) async {
    if (await target.exists()) {
      try {
        final raw = await target.readAsString(encoding: utf8);
        jsonDecode(raw); // проверка валидности JSON/контейнера
        return (raw: raw, recoveredFromBak: false);
      } catch (_) {
        // Повреждённый основной файл — пробуем .bak
      }
    }

    final bak = File('${target.path}.bak');
    if (await bak.exists()) {
      try {
        final rawBak = await bak.readAsString(encoding: utf8);
        jsonDecode(rawBak);
        await writeAtomic(target, rawBak);
        return (raw: rawBak, recoveredFromBak: true);
      } catch (_) {
        return (raw: null, recoveredFromBak: false);
      }
    }
    return (raw: null, recoveredFromBak: false);
  }

  /// Создание страховочной копии в safety/ (хранятся последние 5).
  static Future<File> saveSafetyCopy(String reason, String content) async {
    final root = await getDataDir();
    final safetyDir = Directory('${root.path}${Platform.pathSeparator}safety');
    if (!await safetyDir.exists()) {
      await safetyDir.create(recursive: true);
    }
    final ts = DateTime.now().millisecondsSinceEpoch;
    final safeTag = reason.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final file = File('${safetyDir.path}${Platform.pathSeparator}safety_${ts}_$safeTag.enc');
    await writeAtomic(file, content);

    final files = safetyDir
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.enc'))
        .toList()
      ..sort((a, b) => b.path.compareTo(a.path));

    if (files.length > 5) {
      for (final old in files.skip(5)) {
        try {
          await old.delete();
        } catch (_) {}
      }
    }
    return file;
  }
}
