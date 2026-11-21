import 'package:flutter/material.dart';
import '../../core/crypto_service.dart';
import '../../models/models.dart';
import '../../state/pass_store.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';
import '../widgets/three_pane.dart';

/// Модуль «Пароли» (PassStore):
/// - Стартовый экран: «Войти» и «Создать новое хранилище»
/// - Защита от подбора (10 попыток -> блокировка на 1 минуту)
/// - Генератор паролей, проверка надёжности и повторов, доп. поля, история паролей, корзина
class PasswordsPage extends StatefulWidget {
  final Store store;
  final PassStore passStore;
  final bool isMobile;

  const PasswordsPage({
    super.key,
    required this.store,
    required this.passStore,
    required this.isMobile,
  });

  @override
  State<PasswordsPage> createState() => _PasswordsPageState();
}

class _PasswordsPageState extends State<PasswordsPage> {
  bool _createMode = false;
  String? _selectedVaultId;
  final _loginPwCtrl = TextEditingController();
  bool _remember = false;
  String? _authErr;

  final _newNameCtrl = TextEditingController();
  final _newPw1Ctrl = TextEditingController();
  final _newPw2Ctrl = TextEditingController();
  final _newHintCtrl = TextEditingController();

  String _folderFilter = 'all';
  String? _selectedEntryId;
  bool _showPw = false;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final ps = widget.passStore;

    if (ps.activeVault == null) {
      return _buildStartScreen(pal);
    }

    final visibleEntries = ps.entries.where((e) {
      if (_folderFilter == 'trash') return e.isTrashed;
      if (e.isTrashed) return false;
      if (_folderFilter == 'favorites') return e.isFavorite;
      if (_folderFilter != 'all') return e.folderId == _folderFilter;
      return true;
    }).toList();

    PassEntry? activeEntry;
    if (_selectedEntryId != null) {
      for (final e in ps.entries) {
        if (e.id == _selectedEntryId) activeEntry = e;
      }
    }
    activeEntry ??= visibleEntries.isNotEmpty ? visibleEntries.first : null;

    return ThreePane(
      panes: [
        ThreePaneItem(
          id: 'pfolders',
          title: ps.activeVault!.name,
          initialWidth: 200,
          headerActions: [
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              tooltip: 'Заблокировать хранилище',
              icon: Icon(Icons.lock_outline, size: 16, color: pal.error),
              onPressed: ps.lock,
            ),
          ],
          child: Container(
            color: pal.sidebar,
            child: ListView(
              padding: const EdgeInsets.all(8),
              children: [
                _pFolderTile('all', 'Все записи', Icons.vpn_key_outlined, pal),
                _pFolderTile('favorites', 'Избранное', Icons.star_outline, pal),
                for (final f in ps.folders)
                  _pFolderTile(f['id'] as String, f['name'] as String, Icons.folder_outlined, pal),
                const Divider(),
                _pFolderTile('trash', 'Корзина', Icons.delete_outline, pal),
              ],
            ),
          ),
        ),
        ThreePaneItem(
          id: 'plist',
          title: 'Записи (${visibleEntries.length})',
          initialWidth: 260,
          headerActions: [
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              tooltip: 'Добавить запись',
              icon: Icon(Icons.add, size: 18, color: pal.accent),
              onPressed: () async {
                final created = await ps.addEntry();
                setState(() => _selectedEntryId = created.id);
              },
            ),
          ],
          child: Container(
            color: pal.bg,
            child: ListView.separated(
              padding: const EdgeInsets.all(8),
              itemCount: visibleEntries.length,
              separatorBuilder: (_, __) => const SizedBox(height: 6),
              itemBuilder: (_, i) {
                final e = visibleEntries[i];
                final sel = activeEntry?.id == e.id;
                return InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => setState(() {
                    _selectedEntryId = e.id;
                    _showPw = false;
                  }),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: pal.panel,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: sel ? pal.accent : pal.divider),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.title, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: pal.text)),
                        Text(e.username.isEmpty ? 'Логин не указан' : e.username,
                            style: TextStyle(fontSize: 11.5, color: pal.text2)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        ThreePaneItem(
          id: 'pdetail',
          title: activeEntry?.title ?? 'Карточка записи',
          flexible: true,
          child: activeEntry == null
              ? Center(
                  child: ElevatedButton(
                    onPressed: () async {
                      final created = await ps.addEntry();
                      setState(() => _selectedEntryId = created.id);
                    },
                    child: const Text('Создать запись'),
                  ),
                )
              : _buildEntryDetail(activeEntry, pal),
        ),
      ],
    );
  }

  Widget _pFolderTile(String id, String label, IconData icon, AppPalette pal) {
    final sel = _folderFilter == id;
    return ListTile(
      dense: true,
      visualDensity: VisualDensity.compact,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      selected: sel,
      selectedTileColor: pal.linkBg,
      leading: Icon(icon, size: 16, color: sel ? pal.accent : pal.text2),
      title: Text(label, style: const TextStyle(fontSize: 12.5)),
      onTap: () => setState(() => _folderFilter = id),
    );
  }

  Widget _buildEntryDetail(PassEntry entry, AppPalette pal) {
    final ps = widget.passStore;
    final strength = CryptoService.evaluateStrength(entry.password);
    final reused = ps.countPasswordUsage(entry.password) > 1;

    return Container(
      color: pal.panel,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (strength.level == 'weak' || reused)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: pal.tagBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: pal.warn),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (strength.level == 'weak')
                    Text('Слабый пароль — рекомендуется сгенерировать надёжный.', style: TextStyle(color: pal.warn, fontSize: 12.5)),
                  if (reused)
                    Text('Этот пароль уже используется в другой записи.', style: TextStyle(color: pal.warn, fontSize: 12.5)),
                ],
              ),
            ),
          TextFormField(
            key: ValueKey('pt-${entry.id}'),
            initialValue: entry.title,
            decoration: const InputDecoration(labelText: 'Название'),
            onChanged: (v) => ps.updateEntry(entry.id, (e) => e.title = v),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: ValueKey('pu-${entry.id}'),
                  initialValue: entry.username,
                  decoration: const InputDecoration(labelText: 'Логин'),
                  onChanged: (v) => ps.updateEntry(entry.id, (e) => e.username = v),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Копировать логин',
                icon: const Icon(Icons.copy, size: 18),
                onPressed: () => ps.copyWithAutoClear(entry.username, widget.store.settings.clipboardClearSec),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: ValueKey('pp-${entry.id}-${entry.password.hashCode}'),
                  initialValue: entry.password,
                  obscureText: !_showPw,
                  decoration: InputDecoration(
                    labelText: 'Пароль (${strength.label})',
                  ),
                  onChanged: (v) => ps.updateEntry(entry.id, (e) => e.password = v, recordPasswordHistory: true),
                ),
              ),
              IconButton(
                icon: Icon(_showPw ? Icons.visibility_off : Icons.visibility, size: 18),
                onPressed: () => setState(() => _showPw = !_showPw),
              ),
              IconButton(
                tooltip: 'Копировать пароль',
                icon: const Icon(Icons.copy, size: 18),
                onPressed: () => ps.copyWithAutoClear(entry.password, widget.store.settings.clipboardClearSec),
              ),
              IconButton(
                tooltip: 'Сгенерировать пароль',
                icon: Icon(Icons.refresh, size: 18, color: pal.accent),
                onPressed: () {
                  final pw = CryptoService.generatePassword(length: 20);
                  ps.updateEntry(entry.id, (e) => e.password = pw, recordPasswordHistory: true);
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            key: ValueKey('purl-${entry.id}'),
            initialValue: entry.url,
            decoration: const InputDecoration(labelText: 'Сайт / URL'),
            onChanged: (v) => ps.updateEntry(entry.id, (e) => e.url = v),
          ),
          const SizedBox(height: 12),
          TextFormField(
            key: ValueKey('pn-${entry.id}'),
            initialValue: entry.notes,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Заметка'),
            onChanged: (v) => ps.updateEntry(entry.id, (e) => e.notes = v),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              OutlinedButton.icon(
                icon: Icon(entry.isFavorite ? Icons.star : Icons.star_outline, size: 16),
                label: Text(entry.isFavorite ? 'В избранном' : 'В избранное'),
                onPressed: () => ps.updateEntry(entry.id, (e) => e.isFavorite = !e.isFavorite),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                icon: Icon(Icons.delete_outline, size: 16, color: pal.error),
                label: Text(entry.isTrashed ? 'Удалить навсегда' : 'В корзину', style: TextStyle(color: pal.error)),
                onPressed: () {
                  if (entry.isTrashed) {
                    ps.deletePermanently(entry.id);
                  } else {
                    ps.updateEntry(entry.id, (e) => e.isTrashed = true);
                  }
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStartScreen(AppPalette pal) {
    final ps = widget.passStore;
    if (_selectedVaultId == null && ps.vaults.isNotEmpty) {
      _selectedVaultId = ps.vaults.first.id;
    }

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Хранилище паролей', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: pal.text)),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _createMode
                            ? OutlinedButton(onPressed: () => setState(() => _createMode = false), child: const Text('Войти'))
                            : ElevatedButton(onPressed: () {}, child: const Text('Войти')),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _createMode
                            ? ElevatedButton(onPressed: () {}, child: const Text('Создать новое хранилище'))
                            : OutlinedButton(
                                onPressed: () => setState(() => _createMode = true),
                                child: const Text('Создать новое'),
                              ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (!_createMode) ...[
                    if (ps.vaults.isEmpty) ...[
                      Text('Хранилище не найдено', style: TextStyle(fontWeight: FontWeight.w600, color: pal.text)),
                      const SizedBox(height: 6),
                      Text('Создайте первое зашифрованное хранилище паролей.', style: TextStyle(color: pal.text2, fontSize: 12.5)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => setState(() => _createMode = true),
                        child: const Text('Создать хранилище'),
                      ),
                    ] else ...[
                      DropdownButtonFormField<String>(
                        value: _selectedVaultId,
                        decoration: const InputDecoration(labelText: 'Хранилище'),
                        items: ps.vaults.map((v) => DropdownMenuItem(value: v.id, child: Text(v.name))).toList(),
                        onChanged: (v) => setState(() => _selectedVaultId = v),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _loginPwCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Мастер-пароль'),
                      ),
                      CheckboxListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        title: const Text('Запомнить пароль на этом устройстве', style: TextStyle(fontSize: 12.5)),
                        value: _remember,
                        onChanged: (v) => setState(() => _remember = v ?? false),
                      ),
                      if (_authErr != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(_authErr!, style: TextStyle(color: pal.error, fontSize: 12.5)),
                        ),
                      ElevatedButton(
                        onPressed: () async {
                          if (_selectedVaultId == null) return;
                          final err = await ps.unlockVault(_selectedVaultId!, _loginPwCtrl.text, remember: _remember);
                          if (mounted) {
                            setState(() {
                              _authErr = err;
                              if (err == null) _loginPwCtrl.clear();
                            });
                          }
                        },
                        child: const Text('Открыть хранилище'),
                      ),
                    ],
                  ] else ...[
                    TextField(controller: _newNameCtrl, decoration: const InputDecoration(labelText: 'Имя хранилища')),
                    const SizedBox(height: 10),
                    TextField(controller: _newPw1Ctrl, obscureText: true, decoration: const InputDecoration(labelText: 'Мастер-пароль')),
                    const SizedBox(height: 10),
                    TextField(controller: _newPw2Ctrl, obscureText: true, decoration: const InputDecoration(labelText: 'Повторите пароль')),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _newHintCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Открытая подсказка',
                        helperText: 'Не пишите сам пароль — подсказка хранится открыто',
                      ),
                    ),
                    if (_authErr != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(_authErr!, style: TextStyle(color: pal.error, fontSize: 12.5)),
                      ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () async {
                        if (_newNameCtrl.text.trim().isEmpty || _newPw1Ctrl.text.length < 4) {
                          setState(() => _authErr = 'Укажите имя и пароль (от 4 символов)');
                          return;
                        }
                        if (_newPw1Ctrl.text != _newPw2Ctrl.text) {
                          setState(() => _authErr = 'Пароли не совпадают');
                          return;
                        }
                        await ps.createVault(
                          name: _newNameCtrl.text.trim(),
                          masterPassword: _newPw1Ctrl.text,
                          hint: _newHintCtrl.text.trim(),
                        );
                        setState(() {
                          _authErr = null;
                          _createMode = false;
                        });
                      },
                      child: const Text('Создать'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
