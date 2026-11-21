import 'dart:convert';
import 'dart:math';
import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';

/// Криптография: AES-256-GCM + PBKDF2-HMAC-SHA256 (100 000 итераций)
/// Выполняется в фоновых изолятах через [compute].
class CryptoService {
  static const int pbkdf2Iterations = 100000;
  static const String syncFixedSalt = 'svod-sync-contour-salt-v1';

  static Future<String> encryptJson(
    Map<String, dynamic> data,
    String password, {
    bool useFixedSyncSalt = false,
  }) async {
    return compute(_encryptIsolate, {
      'plain': jsonEncode(data),
      'password': password,
      'fixedSalt': useFixedSyncSalt,
    });
  }

  static Future<Map<String, dynamic>> decryptJson(
    String encryptedJson,
    String password,
  ) async {
    final plain = await compute(_decryptIsolate, {
      'payload': encryptedJson,
      'password': password,
    });
    return jsonDecode(plain) as Map<String, dynamic>;
  }

  static String generateRandomFingerprint() {
    final rnd = Random.secure();
    return List.generate(
      8,
      (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0').toUpperCase(),
    ).join(':');
  }

  static String generatePassword({
    int length = 18,
    bool upper = true,
    bool lower = true,
    bool digits = true,
    bool symbols = true,
    bool excludeSimilar = true,
  }) {
    final similar = RegExp(r'[0Oo1lI|]');
    var u = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var l = 'abcdefghijklmnopqrstuvwxyz';
    var d = '0123456789';
    var s = '!@#\$%^&*()-_=+[]{};:,.?/';
    if (excludeSimilar) {
      u = u.replaceAll(similar, '');
      l = l.replaceAll(similar, '');
      d = d.replaceAll(similar, '');
      s = s.replaceAll(similar, '');
    }
    final pools = <String>[];
    if (upper && u.isNotEmpty) pools.add(u);
    if (lower && l.isNotEmpty) pools.add(l);
    if (digits && d.isNotEmpty) pools.add(d);
    if (symbols && s.isNotEmpty) pools.add(s);
    if (pools.isEmpty) pools.add(l);

    final combined = pools.join();
    final safeLen = length.clamp(6, 64);
    final rnd = Random.secure();
    final chars = <String>[];

    for (final pool in pools) {
      if (chars.length < safeLen) {
        chars.add(pool[rnd.nextInt(pool.length)]);
      }
    }
    while (chars.length < safeLen) {
      chars.add(combined[rnd.nextInt(combined.length)]);
    }
    chars.shuffle(rnd);
    return chars.join();
  }

  static ({String level, String label, int score}) evaluateStrength(String pw) {
    if (pw.isEmpty) return (level: 'weak', label: 'Пустой', score: 0);
    var score = 0;
    if (pw.length >= 8) score += 25;
    if (pw.length >= 12) score += 20;
    if (pw.length >= 16) score += 10;
    if (RegExp(r'[a-zа-я]').hasMatch(pw)) score += 10;
    if (RegExp(r'[A-ZА-Я]').hasMatch(pw)) score += 10;
    if (RegExp(r'\d').hasMatch(pw)) score += 10;
    if (RegExp(r'[^a-zA-Zа-яА-Я0-9]').hasMatch(pw)) score += 15;
    if (RegExp(r'^(1234|qwerty|password|admin|demo)', caseSensitive: false).hasMatch(pw)) {
      score = min(score, 25);
    }
    if (score < 45) return (level: 'weak', label: 'Слабый пароль', score: score);
    if (score < 75) return (level: 'medium', label: 'Средний', score: score);
    return (level: 'strong', label: 'Надёжный', score: min(100, score));
  }
}

Future<String> _encryptIsolate(Map<String, dynamic> args) async {
  final plain = args['plain'] as String;
  final password = args['password'] as String;
  final useFixedSalt = args['fixedSalt'] as bool;

  final rnd = Random.secure();
  final salt = useFixedSalt
      ? utf8.encode(CryptoService.syncFixedSalt)
      : List<int>.generate(16, (_) => rnd.nextInt(256));
  final nonce = List<int>.generate(12, (_) => rnd.nextInt(256));

  final pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: CryptoService.pbkdf2Iterations,
    bits: 256,
  );
  final secretKey = await pbkdf2.deriveKey(
    secretKey: SecretKey(utf8.encode(password)),
    nonce: salt,
  );

  final cipher = AesGcm.with256bits();
  final box = await cipher.encrypt(
    utf8.encode(plain),
    secretKey: secretKey,
    nonce: nonce,
  );

  return jsonEncode({
    'v': 1,
    'alg': 'AES-256-GCM',
    'kdf': 'PBKDF2-SHA256',
    'iter': CryptoService.pbkdf2Iterations,
    'salt': base64Encode(salt),
    'iv': base64Encode(box.nonce),
    'ct': base64Encode(box.cipherText),
    'mac': base64Encode(box.mac.bytes),
  });
}

Future<String> _decryptIsolate(Map<String, dynamic> args) async {
  final payload = args['payload'] as String;
  final password = args['password'] as String;

  final map = jsonDecode(payload) as Map<String, dynamic>;
  if (map['v'] != 1 || map['alg'] != 'AES-256-GCM') {
    throw const FormatException('Неподдерживаемый формат зашифрованного файла');
  }

  final salt = base64Decode(map['salt'] as String);
  final iv = base64Decode(map['iv'] as String);
  final ct = base64Decode(map['ct'] as String);
  final mac = Mac(base64Decode(map['mac'] as String));

  final pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: (map['iter'] as int?) ?? CryptoService.pbkdf2Iterations,
    bits: 256,
  );
  final secretKey = await pbkdf2.deriveKey(
    secretKey: SecretKey(utf8.encode(password)),
    nonce: salt,
  );

  final cipher = AesGcm.with256bits();
  final clearBytes = await cipher.decrypt(
    SecretBox(ct, nonce: iv, mac: mac),
    secretKey: secretKey,
  );
  return utf8.decode(clearBytes);
}
