import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/atomic_storage.dart';
import '../core/crypto_service.dart';
import '../models/models.dart';

/// Независимый контур хранения паролей (PassStore extends ChangeNotifier).
/// Поддерживает множественные хранилища, защиту от подбора (10 попыток -> 1 мин),
/// автоблокировку, автоочистку буфера обмена и двухуровневую сортировку.
class PassStore extends ChangeNotifier {
  static const _secureStorage = FlutterSecureStorage();

  List<PassVaultMeta> vaults = [];
  PassVaultMeta? activeVault;
  String? _activeMasterPassword;

  List<Map<String, dynamic>> folders = []; // {id, name, sortOverride}
  List<PassEntry> entries = [];
  String sortField = 'title'; // title | updatedAt | createdAt | username | url
  bool sortAsc = true;
  bool favoritesFirst = true;

  Timer? _clipboardTimer;
  int clipboardSecondsLeft = 0;

  Future<void> init() async {
    final dir = await AtomicStorage.getDataDir();
    final metaFile = File('${dir.path}${Platform.pathSeparator}pass_vaults.json');
    final res = await AtomicStorage.readValid(metaFile);
    if (res.raw != null) {
      final list = jsonDecode(res.raw!) as List;
      vaults = list.map((e) => PassVaultMeta.fromJson(e as Map<String, dynamic>)).toList();
    }
    notifyListeners();
  }

  Future<void> _saveMeta() async {
    final dir = await AtomicStorage.getDataDir();
    final metaFile = File('${dir.path}${Platform.pathSeparator}pass_vaults.json');
    await AtomicStorage.writeAtomic(
      metaFile,
      jsonEncode(vaults.map((v) => v.toJson()).toList()),
    );
  }

  Future<void> createVault({
    required String name,
    required String masterPassword,
    required String hint,
  }) async {
    final id = 'vault-${DateTime.now().millisecondsSinceEpoch}';
    final fileName = '$id.pass.enc';
    final meta = PassVaultMeta(
      id: id,
      name: name.trim(),
      hint: hint.trim(),
      encryptedFileName: fileName,
    );
    vaults.add(meta);
    activeVault = meta;
    _activeMasterPassword = masterPassword;
    folders = [
      {'id': 'pf-main', 'name': 'Основные', 'sortOverride': null},
    ];
    entries = [];
    await _saveMeta();
    await _persistActiveVault();
    notifyListeners();
  }

  Future<String?> unlockVault(
    String vaultId,
    String password, {
    bool remember = false,
  }) async {
    final meta = vaults.firstWhere((v) => v.id == vaultId);
    if (meta.lockedUntil != null && DateTime.now().isBefore(meta.lockedUntil!)) {
      final sec = meta.lockedUntil!.difference(DateTime.now()).inSeconds + 1;
      return 'Блокировка после 10 неверных попыток. Повторите через $sec с.';
    }

    final dir = await AtomicStorage.getDataDir();
    final file = File('${dir.path}${Platform.pathSeparator}${meta.encryptedFileName}');
    final res = await AtomicStorage.readValid(file);
    if (res.raw == null) return 'Файл хранилища не найден';

    try {
      final data = await CryptoService.decryptJson(res.raw!, password);
      meta.failedAttempts = 0;
      meta.lockedUntil = null;
      await _saveMeta();

      if (remember) {
        try {
          await _secureStorage.write(key: 'svod_pass_${meta.id}', value: password);
        } catch (_) {}
      }

      activeVault = meta;
      _activeMasterPassword = password;
      folders = ((data['folders'] as List?) ?? []).cast<Map<String, dynamic>>();
      entries = ((data['entries'] as List?) ?? [])
          .map((e) => PassEntry.fromJson(e as Map<String, dynamic>))
          .toList();
      sortField = (data['sortField'] as String?) ?? 'title';
      sortAsc = (data['sortAsc'] as bool?) ?? true;
      favoritesFirst = (data['favoritesFirst'] as bool?) ?? true;
      notifyListeners();
      return null;
    } catch (_) {
      meta.failedAttempts += 1;
      if (meta.failedAttempts >= 10) {
        meta.failedAttempts = 0;
        meta.lockedUntil = DateTime.now().add(const Duration(minutes: 1));
        await _saveMeta();
        notifyListeners();
        return '10 неверных попыток. Хранилище заблокировано на 1 минуту.';
      }
      await _saveMeta();
      notifyListeners();
      return 'Неверный мастер-пароль (попытка ${meta.failedAttempts} из 10)';
    }
  }

  Future<String?> getRememberedPassword(String vaultId) async {
    try {
      return await _secureStorage.read(key: 'svod_pass_$vaultId');
    } catch (_) {
      return null;
    }
  }

  Future<void> forgetRememberedPassword(String vaultId) async {
    try {
      await _secureStorage.delete(key: 'svod_pass_$vaultId');
    } catch (_) {}
    notifyListeners();
  }

  void lock() {
    activeVault = null;
    _activeMasterPassword = null;
    entries = [];
    folders = [];
    notifyListeners();
  }

  Future<void> _persistActiveVault() async {
    if (activeVault == null || _activeMasterPassword == null) return;
    final dir = await AtomicStorage.getDataDir();
    final file = File('${dir.path}${Platform.pathSeparator}${activeVault!.encryptedFileName}');
    final payload = await CryptoService.encryptJson(
      {
        'folders': folders,
        'entries': entries.map((e) => e.toJson()).toList(),
        'sortField': sortField,
        'sortAsc': sortAsc,
        'favoritesFirst': favoritesFirst,
      },
      _activeMasterPassword!,
    );
    await AtomicStorage.writeAtomic(file, payload);
  }

  Future<PassEntry> addEntry({String? folderId}) async {
    final now = DateTime.now();
    final entry = PassEntry(
      id: 'pe-${now.millisecondsSinceEpoch}',
      folderId: folderId,
      title: 'Новая запись',
      password: CryptoService.generatePassword(),
      createdAt: now,
      updatedAt: now,
    );
    entries.insert(0, entry);
    await _persistActiveVault();
    notifyListeners();
    return entry;
  }

  Future<void> updateEntry(
    String id,
    void Function(PassEntry e) updater, {
    bool recordPasswordHistory = false,
  }) async {
    final idx = entries.indexWhere((e) => e.id == id);
    if (idx < 0) return;
    final e = entries[idx];
    final oldPw = e.password;
    updater(e);
    if (recordPasswordHistory && oldPw.isNotEmpty && e.password != oldPw) {
      e.history.insert(0, {
        'password': oldPw,
        'changedAt': DateTime.now().toIso8601String(),
      });
    }
    e.updatedAt = DateTime.now();
    await _persistActiveVault();
    notifyListeners();
  }

  Future<void> deletePermanently(String id) async {
    entries.removeWhere((e) => e.id == id);
    await _persistActiveVault();
    notifyListeners();
  }

  Future<void> addFolder(String name) async {
    folders.add({
      'id': 'pf-${DateTime.now().millisecondsSinceEpoch}',
      'name': name.trim(),
      'sortOverride': null,
    });
    await _persistActiveVault();
    notifyListeners();
  }

  int countPasswordUsage(String pw) {
    if (pw.isEmpty) return 0;
    return entries.where((e) => !e.isTrashed && e.password == pw).length;
  }

  Future<void> copyWithAutoClear(String text, int clearSeconds) async {
    await Clipboard.setData(ClipboardData(text: text));
    _clipboardTimer?.cancel();
    if (clearSeconds <= 0) return;
    clipboardSecondsLeft = clearSeconds;
    notifyListeners();
    _clipboardTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      clipboardSecondsLeft -= 1;
      if (clipboardSecondsLeft <= 0) {
        t.cancel();
        Clipboard.setData(const ClipboardData(text: ''));
      }
      notifyListeners();
    });
  }
}
