import 'package:flutter/material.dart';
import '../../core/formula_engine.dart';
import '../../models/models.dart';
import '../../state/store.dart';
import '../../theme/app_theme.dart';
import '../widgets/three_pane.dart';

/// Модуль «Заметки и таблицы»:
/// ThreePane (Папки | Список | Единый редактор), Правка/Просмотр, MdToolbar,
/// встроенные таблицы с формулами, кликабельные чек-листы, .ics-блоки и кнопка ⓘ.
class NotesPage extends StatefulWidget {
  final Store store;
  final bool isMobile;

  const NotesPage({super.key, required this.store, required this.isMobile});

  @override
  State<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends State<NotesPage> {
  final _searchCtrl = TextEditingController();
  bool _previewMode = false;
  bool _mobileEditorOpen = false;

  List<NoteItem> get _filteredNotes {
    final store = widget.store;
    final words = _searchCtrl.text.trim().toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    return store.notes.where((n) {
      if (store.selectedFolderFilter == 'trash') return n.isTrashed;
      if (n.isTrashed) return false;
      if (store.selectedFolderFilter == 'favorites') return n.isFavorite;
      if (store.selectedFolderFilter != 'all') return n.folderId == store.selectedFolderFilter;
      return true;
    }).where((n) {
      if (words.isEmpty) return true;
      final hay = '${n.title} ${n.tags.join(' ')} ${n.blocks.map((b) => b.content).join(' ')}'.toLowerCase();
      return words.every(hay.contains);
    }).toList()
      ..sort((a, b) {
        if (a.isPinned != b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.compareTo(a.updatedAt);
      });
  }

  NoteItem? get _activeNote {
    final list = _filteredNotes;
    final id = widget.store.selectedNoteId;
    if (id != null) {
      for (final n in widget.store.notes) {
        if (n.id == id) return n;
      }
    }
    return list.isNotEmpty ? list.first : null;
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final foldersPane = _buildFoldersPane(pal);
    final listPane = _buildListPane(pal);
    final editorPane = _buildEditorPane(pal);

    if (widget.isMobile) {
      return _mobileEditorOpen ? editorPane : listPane;
    }

    return ThreePane(
      panes: [
        ThreePaneItem(
          id: 'folders',
          title: 'Папки',
          initialWidth: 195,
          headerActions: [
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              tooltip: 'Новая папка',
              icon: Icon(Icons.create_new_folder_outlined, size: 16, color: pal.text2),
              onPressed: () => _promptNewFolder(context),
            ),
          ],
          child: foldersPane,
        ),
        ThreePaneItem(
          id: 'list',
          title: 'Список (${_filteredNotes.length})',
          initialWidth: 265,
          headerActions: [
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              tooltip: 'Новая заметка',
              icon: Icon(Icons.note_add_outlined, size: 16, color: pal.accent),
              onPressed: () {
                final f = widget.store.selectedFolderFilter;
                final folderId = (f != 'all' && f != 'favorites' && f != 'trash') ? f : null;
                widget.store.createNote(folderId: folderId);
                setState(() => _previewMode = false);
              },
            ),
          ],
          child: listPane,
        ),
        ThreePaneItem(
          id: 'editor',
          title: _activeNote?.title.isNotEmpty == true ? _activeNote!.title : 'Редактор',
          flexible: true,
          headerActions: [
            TextButton(
              onPressed: () => setState(() => _previewMode = !_previewMode),
              child: Text(_previewMode ? 'Правка' : 'Просмотр', style: const TextStyle(fontSize: 12)),
            ),
            if (_activeNote != null)
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                tooltip: 'Сведения и версии (ⓘ)',
                icon: Icon(Icons.info_outline, size: 16, color: pal.text2),
                onPressed: () => _showNoteInfo(context, _activeNote!),
              ),
          ],
          child: editorPane,
        ),
      ],
    );
  }

  Widget _buildFoldersPane(AppPalette pal) {
    final store = widget.store;
    return Container(
      color: pal.sidebar,
      child: ListView(
        padding: const EdgeInsets.all(8),
        children: [
          _folderTile('all', 'Все заметки', Icons.description_outlined, pal),
          _folderTile('favorites', 'Избранное', Icons.star_outline, pal),
          for (final f in store.folders) _folderTile(f.id, f.name, Icons.folder_outlined, pal),
          const Divider(),
          _folderTile('trash', 'Корзина', Icons.delete_outline, pal),
        ],
      ),
    );
  }

  Widget _folderTile(String id, String title, IconData icon, AppPalette pal) {
    final selected = widget.store.selectedFolderFilter == id;
    return ListTile(
      dense: true,
      visualDensity: VisualDensity.compact,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      selected: selected,
      selectedTileColor: pal.linkBg,
      leading: Icon(icon, size: 16, color: selected ? pal.accent : pal.text2),
      title: Text(title, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
      onTap: () => widget.store.setSelectedFolderFilter(id),
    );
  }

  Widget _buildListPane(AppPalette pal) {
    final items = _filteredNotes;
    return Container(
      color: pal.bg,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search, size: 16),
                hintText: 'Поиск по словам...',
              ),
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? Center(
                    child: ElevatedButton(
                      onPressed: () => widget.store.createNote(),
                      child: const Text('Создать заметку'),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(8),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (_, i) {
                      final n = items[i];
                      final isSel = _activeNote?.id == n.id;
                      return InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () {
                          widget.store.setSelectedNoteId(n.id);
                          if (widget.isMobile) setState(() => _mobileEditorOpen = true);
                        },
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: pal.panel,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: isSel ? pal.accent : pal.divider),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      n.title.isEmpty ? 'Без названия' : n.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: pal.text),
                                    ),
                                  ),
                                  if (n.isPinned) Icon(Icons.push_pin, size: 13, color: pal.accent),
                                  if (n.isFavorite) Icon(Icons.star, size: 13, color: pal.warn),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                n.blocks.map((b) => b.content).join(' '),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 11.5, color: pal.text2),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditorPane(AppPalette pal) {
    final note = _activeNote;
    if (note == null) {
      return Center(child: Text('Выберите заметку', style: TextStyle(color: pal.text2)));
    }

    return Container(
      color: pal.panel,
      child: Column(
        children: [
          if (widget.isMobile)
            Row(
              children: [
                TextButton.icon(
                  onPressed: () => setState(() => _mobileEditorOpen = false),
                  icon: const Icon(Icons.arrow_back, size: 16),
                  label: const Text('Список'),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() => _previewMode = !_previewMode),
                  child: Text(_previewMode ? 'Правка' : 'Просмотр'),
                ),
                IconButton(
                  icon: const Icon(Icons.info_outline, size: 18),
                  onPressed: () => _showNoteInfo(context, note),
                ),
              ],
            ),
          // MdToolbar
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: pal.sidebar,
              border: Border(bottom: BorderSide(color: pal.divider)),
            ),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _tbBtn('H1', () => _appendMarkdown(note, '\n# Заголовок')),
                _tbBtn('B', () => _appendMarkdown(note, ' **жирный**')),
                _tbBtn('I', () => _appendMarkdown(note, ' *курсив*')),
                _tbBtn('==', () => _appendMarkdown(note, ' ==выделение==')),
                _tbBtn('[ ]', () => _appendMarkdown(note, '\n- [ ] Новая задача')),
                _tbBtn('[[ ]]', () => _appendMarkdown(note, ' [[Ссылка]]')),
                const VerticalDivider(width: 16),
                TextButton.icon(
                  onPressed: () {
                    widget.store.updateNote(note.id, (n) {
                      n.blocks.add(
                        NoteBlock(
                          id: 'b-tbl-${DateTime.now().millisecondsSinceEpoch}',
                          type: 'table',
                          table: SpreadsheetBlockData(
                            title: 'Новая таблица',
                            rows: 4,
                            cols: 4,
                            cells: {
                              'A1': SpreadsheetCell(value: 'Наименование', bold: true, bgHex: 0xFFEEF2FF),
                              'B1': SpreadsheetCell(value: 'Кол-во', bold: true, bgHex: 0xFFEEF2FF),
                              'C1': SpreadsheetCell(value: 'Цена', bold: true, bgHex: 0xFFEEF2FF),
                              'D1': SpreadsheetCell(value: 'Сумма', bold: true, bgHex: 0xFFEEF2FF),
                              'D2': SpreadsheetCell(value: '=B2*C2'),
                              'A4': SpreadsheetCell(value: 'Итого', bold: true, bgHex: 0xFFFEF3C7),
                              'D4': SpreadsheetCell(value: '=СУММ(D2:D3)', bold: true, bgHex: 0xFFFEF3C7),
                            },
                          ),
                        ),
                      );
                    });
                  },
                  icon: const Icon(Icons.table_chart_outlined, size: 15),
                  label: const Text('Таблица', style: TextStyle(fontSize: 12)),
                ),
                TextButton.icon(
                  onPressed: () {
                    final today = DateTime.now().toIso8601String().substring(0, 10);
                    widget.store.updateNote(note.id, (n) {
                      n.blocks.add(
                        NoteBlock(
                          id: 'b-ics-${DateTime.now().millisecondsSinceEpoch}',
                          type: 'ics',
                          content: 'Событие из заметки',
                          extra: '${today}T12:00|${today}T13:00',
                        ),
                      );
                    });
                  },
                  icon: const Icon(Icons.event_outlined, size: 15),
                  label: const Text('.ics', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                TextFormField(
                  key: ValueKey('title-${note.id}'),
                  initialValue: note.title,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: pal.text),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    hintText: 'Заголовок заметки...',
                  ),
                  onChanged: (v) => widget.store.updateNote(note.id, (n) => n.title = v),
                ),
                const Divider(),
                const SizedBox(height: 12),
                for (final block in note.blocks) _buildBlock(note, block, pal),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tbBtn(String label, VoidCallback onTap) {
    return TextButton(
      style: TextButton.styleFrom(minimumSize: const Size(32, 32), padding: const EdgeInsets.symmetric(horizontal: 8)),
      onPressed: onTap,
      child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }

  void _appendMarkdown(NoteItem note, String snippet) {
    widget.store.updateNote(note.id, (n) {
      final md = n.blocks.where((b) => b.type == 'markdown').firstOrNull;
      if (md != null) {
        md.content += snippet;
      } else {
        n.blocks.add(NoteBlock(id: 'b-${DateTime.now().millisecondsSinceEpoch}', type: 'markdown', content: snippet));
      }
    });
  }

  Widget _buildBlock(NoteItem note, NoteBlock block, AppPalette pal) {
    if (block.type == 'markdown') {
      if (!_previewMode) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextFormField(
            key: ValueKey('md-${note.id}-${block.id}-${block.content.length}'),
            initialValue: block.content,
            maxLines: null,
            decoration: const InputDecoration(
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              filled: false,
              hintText: 'Текст заметки (Markdown, чек-листы - [ ], #теги, [[ссылки]])...',
            ),
            onChanged: (v) => widget.store.updateNote(note.id, (_) => block.content = v),
          ),
        );
      }

      // Preview with interactive checkboxes
      final lines = block.content.split('\n');
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var idx = 0; idx < lines.length; idx++) _buildPreviewLine(note, block, lines, idx, pal),
          ],
        ),
      );
    }

    if (block.type == 'table' && block.table != null) {
      return _buildSpreadsheetBlock(note, block.table!, pal);
    }

    if (block.type == 'ics') {
      final parts = (block.extra ?? '').split('|');
      final dtStart = parts.isNotEmpty ? parts.first : '2026-01-01T10:00';
      return Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: pal.sidebar,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: pal.divider),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Календарь (.ics / VEVENT)', style: TextStyle(fontSize: 11, color: pal.muted)),
                  const SizedBox(height: 4),
                  Text('${dtStart.replaceAll('T', ' ')} · ${block.content}',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: pal.text)),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () {
                final dtParts = dtStart.split('T');
                widget.store.addEvent(
                  CalendarEvent(
                    id: 'ev-${DateTime.now().millisecondsSinceEpoch}',
                    calendarId: widget.store.calendars.first.id,
                    title: block.content,
                    date: dtParts.first,
                    startTime: dtParts.length > 1 ? dtParts[1] : '10:00',
                    endTime: '11:00',
                  ),
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Событие добавлено в ваши календари')),
                );
              },
              child: const Text('В мои календари', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildPreviewLine(NoteItem note, NoteBlock block, List<String> lines, int idx, AppPalette pal) {
    final line = lines[idx];
    final chk = RegExp(r'^\s*-\s+\[([ xX])\]\s+(.*)$').firstMatch(line);
    if (chk != null) {
      final checked = chk.group(1)!.toLowerCase() == 'x';
      return InkWell(
        onTap: () {
          lines[idx] = checked
              ? line.replaceFirst(RegExp(r'-\s+\[[xX]\]'), '- [ ]')
              : line.replaceFirst(RegExp(r'-\s+\[ \]'), '- [x]');
          widget.store.updateNote(note.id, (_) => block.content = lines.join('\n'));
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: [
              Checkbox(value: checked, onChanged: (_) {}),
              Expanded(
                child: Text(
                  chk.group(2)!,
                  style: TextStyle(
                    decoration: checked ? TextDecoration.lineThrough : null,
                    color: checked ? pal.muted : pal.text,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Text(line, style: TextStyle(color: pal.text, height: 1.5)),
    );
  }

  Widget _buildSpreadsheetBlock(NoteItem note, SpreadsheetBlockData table, AppPalette pal) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: pal.panel,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: pal.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: pal.sidebar,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
              border: Border(bottom: BorderSide(color: pal.divider)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(table.title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: pal.text)),
                ),
                TextButton(
                  onPressed: () => widget.store.updateNote(note.id, (_) => table.rows += 1),
                  child: const Text('+ Строка', style: TextStyle(fontSize: 11.5)),
                ),
                TextButton(
                  onPressed: () => widget.store.updateNote(note.id, (_) => table.cols += 1),
                  child: const Text('+ Столбец', style: TextStyle(fontSize: 11.5)),
                ),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowHeight: 32,
              dataRowMinHeight: 34,
              dataRowMaxHeight: 38,
              columnSpacing: 16,
              columns: [
                const DataColumn(label: Text('#')),
                for (var c = 0; c < table.cols; c++)
                  DataColumn(label: Text(FormulaEngine.colIndexToLetter(c))),
              ],
              rows: [
                for (var r = 0; r < table.rows; r++)
                  DataRow(
                    cells: [
                      DataCell(Text('${r + 1}', style: TextStyle(color: pal.muted, fontSize: 11))),
                      for (var c = 0; c < table.cols; c++)
                        _buildCell(note, table, FormulaEngine.cellId(r, c), pal),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  DataCell _buildCell(NoteItem note, SpreadsheetBlockData table, String id, AppPalette pal) {
    final cell = table.cells[id];
    final val = FormulaEngine.evaluate(id, table.cells);
    return DataCell(
      Text(
        val,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: (cell?.bold ?? false) ? FontWeight.w600 : FontWeight.normal,
          color: pal.text,
        ),
      ),
      onTap: () async {
        final ctrl = TextEditingController(text: cell?.value ?? '');
        final next = await showDialog<String>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text('Ячейка $id'),
            content: TextField(
              controller: ctrl,
              autofocus: true,
              decoration: const InputDecoration(hintText: 'Значение или формула (=СУММ(B2:B4))'),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
              ElevatedButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Сохранить')),
            ],
          ),
        );
        if (next != null) {
          widget.store.updateNote(note.id, (_) {
            table.cells[id] = SpreadsheetCell(
              value: next,
              bold: cell?.bold ?? false,
              bgHex: cell?.bgHex,
            );
          });
        }
      },
    );
  }

  Future<void> _promptNewFolder(BuildContext context) async {
    final ctrl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Новый блокнот'),
        content: TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(hintText: 'Название')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Создать')),
        ],
      ),
    );
    if (name != null && name.trim().isNotEmpty) {
      widget.store.createFolder(name.trim());
    }
  }

  void _showNoteInfo(BuildContext context, NoteItem note) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Сведения о заметке'),
        content: SizedBox(
          width: 380,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Автор: ${note.author}'),
              Text('Создана: ${note.createdAt.toLocal()}'),
              Text('Изменена: ${note.updatedAt.toLocal()}'),
              const SizedBox(height: 10),
              Text('Версий сохранено: ${note.versions.length} из 8', style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Row(
                children: [
                  OutlinedButton(
                    onPressed: () {
                      widget.store.updateNote(note.id, (_) {}, saveVersion: true);
                      Navigator.pop(ctx);
                    },
                    child: const Text('Сохранить снимок'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () {
                      widget.store.trashNote(note.id);
                      Navigator.pop(ctx);
                    },
                    child: const Text('В корзину'),
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Закрыть'))],
      ),
    );
  }
}
