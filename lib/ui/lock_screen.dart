import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';

/// Экран входа (LockScreen):
/// - выбор профиля, пароль, «Запомнить», вход по биометрии (LocalAuthentication)
/// - кнопки «Войти», «Создать новый локальный профиль»,
///   «Подключить хранилище (WebDAV / Google Диск / локальная папка)» (3-шаговый мастер)
class LockScreen extends StatefulWidget {
  final Store store;
  const LockScreen({super.key, required this.store});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  final _localAuth = LocalAuthentication();
  final _pwCtrl = TextEditingController();
  final _newNameCtrl = TextEditingController();
  final _newLoginCtrl = TextEditingController();
  final _newPwCtrl = TextEditingController();
  final _wizEndpointCtrl = TextEditingController(text: 'https://webdav.yandex.ru/svod-vault/');

  late String _selectedProfileId;
  bool _remember = true;
  String _mode = 'login'; // login | create | wizard
  int _wizStep = 1;
  String _wizType = 'webdav';
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _selectedProfileId = widget.store.activeProfile?.id ?? widget.store.profiles.first.id;
  }

  Future<void> _tryBiometric() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      if (!canCheck) {
        setState(() => _error = 'Биометрия недоступна на этом устройстве');
        return;
      }
      final ok = await _localAuth.authenticate(
        localizedReason: 'Подтвердите личность для входа в профиль Свод',
      );
      if (ok) {
        await widget.store.unlockProfile(_selectedProfileId, _pwCtrl.text);
      }
    } catch (e) {
      setState(() => _error = 'Ошибка биометрии: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final store = widget.store;
    final target = store.profiles.firstWhere((p) => p.id == _selectedProfileId);

    return Scaffold(
      backgroundColor: pal.bg,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: pal.linkBg,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.lock_outline, color: pal.accent),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Вход в «Свод»', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: pal.text)),
                              Text('AES-256-GCM · PBKDF2 100 000', style: TextStyle(fontSize: 12, color: pal.text2)),
                            ],
                          ),
                        ),
                        if (_mode != 'login')
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () => setState(() {
                              _mode = 'login';
                              _error = null;
                            }),
                          ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (_mode == 'login') ...[
                      DropdownButtonFormField<String>(
                        value: _selectedProfileId,
                        decoration: const InputDecoration(labelText: 'Профиль'),
                        items: store.profiles
                            .map((p) => DropdownMenuItem(value: p.id, child: Text('${p.name} (@${p.login})')))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) setState(() => _selectedProfileId = v);
                        },
                      ),
                      if (target.hasPassword) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: _pwCtrl,
                          obscureText: true,
                          decoration: const InputDecoration(labelText: 'Пароль профиля'),
                        ),
                      ],
                      const SizedBox(height: 8),
                      CheckboxListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        title: const Text('Запомнить на этом устройстве', style: TextStyle(fontSize: 13)),
                        value: _remember,
                        onChanged: (v) => setState(() => _remember = v ?? true),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 8),
                        Text(_error!, style: TextStyle(color: pal.error, fontSize: 12.5)),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _busy
                                  ? null
                                  : () async {
                                      setState(() {
                                        _busy = true;
                                        _error = null;
                                      });
                                      final ok = await store.unlockProfile(_selectedProfileId, _pwCtrl.text);
                                      if (!ok && mounted) {
                                        setState(() {
                                          _busy = false;
                                          _error = 'Неверный пароль профиля';
                                        });
                                      }
                                    },
                              child: Text(_busy ? 'Расшифровка...' : 'Войти'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton(
                            onPressed: _tryBiometric,
                            child: const Icon(Icons.fingerprint, size: 20),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Divider(),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.person_add_outlined, size: 18),
                        label: const Text('Создать новый локальный профиль'),
                        onPressed: () => setState(() => _mode = 'create'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.cloud_outlined, size: 18),
                        label: const Text('Подключить хранилище (WebDAV / Google Диск / папка)'),
                        onPressed: () => setState(() {
                          _mode = 'wizard';
                          _wizStep = 1;
                        }),
                      ),
                    ] else if (_mode == 'create') ...[
                      TextField(controller: _newNameCtrl, decoration: const InputDecoration(labelText: 'Имя профиля')),
                      const SizedBox(height: 10),
                      TextField(controller: _newLoginCtrl, decoration: const InputDecoration(labelText: 'Логин')),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _newPwCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Пароль AES-256-GCM (необязательно)'),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () async {
                          if (_newNameCtrl.text.trim().isEmpty) return;
                          await store.createProfile(
                            name: _newNameCtrl.text.trim(),
                            login: _newLoginCtrl.text.trim().isEmpty ? 'user' : _newLoginCtrl.text.trim(),
                            storageType: 'local',
                            storageEndpoint: 'data/${_newLoginCtrl.text.trim()}.enc',
                            password: _newPwCtrl.text,
                          );
                        },
                        child: const Text('Создать и войти'),
                      ),
                    ] else ...[
                      Text('Шаг $_wizStep из 3 · Подключение хранилища', style: TextStyle(fontWeight: FontWeight.w600, color: pal.text)),
                      const SizedBox(height: 12),
                      if (_wizStep == 1) ...[
                        RadioListTile<String>(
                          title: const Text('WebDAV (Яндекс Диск / Mail.ru)'),
                          value: 'webdav',
                          groupValue: _wizType,
                          onChanged: (v) => setState(() => _wizType = v!),
                        ),
                        RadioListTile<String>(
                          title: const Text('Google Диск (drive.file)'),
                          value: 'gdrive',
                          groupValue: _wizType,
                          onChanged: (v) => setState(() => _wizType = v!),
                        ),
                        RadioListTile<String>(
                          title: const Text('Локальная папка (портативно)'),
                          value: 'local',
                          groupValue: _wizType,
                          onChanged: (v) => setState(() => _wizType = v!),
                        ),
                        ElevatedButton(onPressed: () => setState(() => _wizStep = 2), child: const Text('Далее')),
                      ] else if (_wizStep == 2) ...[
                        TextField(controller: _wizEndpointCtrl, decoration: const InputDecoration(labelText: 'URL / путь хранилища')),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: OutlinedButton(onPressed: () => setState(() => _wizStep = 1), child: const Text('Назад'))),
                            const SizedBox(width: 8),
                            Expanded(child: ElevatedButton(onPressed: () => setState(() => _wizStep = 3), child: const Text('Далее'))),
                          ],
                        ),
                      ] else ...[
                        TextField(controller: _newNameCtrl, decoration: const InputDecoration(labelText: 'Имя профиля')),
                        const SizedBox(height: 10),
                        TextField(controller: _newPwCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Ключ синхронизации')),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: OutlinedButton(onPressed: () => setState(() => _wizStep = 2), child: const Text('Назад'))),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () async {
                                  await store.createProfile(
                                    name: _newNameCtrl.text.trim().isEmpty ? 'Облачный профиль' : _newNameCtrl.text.trim(),
                                    login: 'cloud',
                                    storageType: _wizType,
                                    storageEndpoint: _wizEndpointCtrl.text.trim(),
                                    password: _newPwCtrl.text,
                                  );
                                },
                                child: const Text('Подключить'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
