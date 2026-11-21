import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class ThreePaneItem {
  final String id;
  final String title;
  final Widget child;
  final List<Widget>? headerActions;
  final double initialWidth;
  final bool flexible;

  const ThreePaneItem({
    required this.id,
    required this.title,
    required this.child,
    this.headerActions,
    this.initialWidth = 220,
    this.flexible = false,
  });
}

/// Трёхколоночный контейнер (Папки | Список | Редактор/Запись):
/// - тянется мышью за разделители
/// - меняет колонки местами стрелками ←/→ в заголовках
/// - позволяет скрывать и возвращать колонки
class ThreePane extends StatefulWidget {
  final List<ThreePaneItem> panes;
  const ThreePane({super.key, required this.panes});

  @override
  State<ThreePane> createState() => _ThreePaneState();
}

class _ThreePaneState extends State<ThreePane> {
  late List<String> _order;
  final Map<String, double> _widths = {};
  final Set<String> _hidden = {};

  @override
  void initState() {
    super.initState();
    _order = widget.panes.map((p) => p.id).toList();
    for (final p in widget.panes) {
      _widths[p.id] = p.initialWidth;
    }
  }

  void _swap(String id, int dir) {
    final idx = _order.indexOf(id);
    final next = idx + dir;
    if (idx < 0 || next < 0 || next >= _order.length) return;
    setState(() {
      final tmp = _order[idx];
      _order[idx] = _order[next];
      _order[next] = tmp;
    });
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final paneMap = {for (final p in widget.panes) p.id: p};
    final visibleIds = _order.where((id) => !_hidden.contains(id) && paneMap.containsKey(id)).toList();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_hidden.isNotEmpty)
          Container(
            width: 34,
            decoration: BoxDecoration(
              color: pal.sidebar,
              border: Border(right: BorderSide(color: pal.divider)),
            ),
            child: Column(
              children: _hidden.map((id) {
                final title = paneMap[id]?.title ?? id;
                return IconButton(
                  tooltip: 'Показать: $title',
                  icon: Icon(Icons.chevron_right, size: 18, color: pal.text2),
                  onPressed: () => setState(() => _hidden.remove(id)),
                );
              }).toList(),
            ),
          ),
        for (var i = 0; i < visibleIds.length; i++) ...[
          _buildPane(paneMap[visibleIds[i]]!, i, visibleIds.length, pal),
          if (i < visibleIds.length - 1)
            MouseRegion(
              cursor: SystemMouseCursors.resizeColumn,
              child: GestureDetector(
                onHorizontalDragUpdate: (d) {
                  final leftId = visibleIds[i];
                  if (paneMap[leftId]!.flexible) return;
                  setState(() {
                    _widths[leftId] = ((_widths[leftId] ?? 220) + d.delta.dx).clamp(150.0, 440.0);
                  });
                },
                child: Container(width: 4, color: pal.divider.withOpacity(0.85)),
              ),
            ),
        ],
      ],
    );
  }

  Widget _buildPane(ThreePaneItem pane, int index, int total, AppPalette pal) {
    final header = Container(
      height: 36,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: pane.flexible ? pal.panel : pal.sidebar,
        border: Border(bottom: BorderSide(color: pal.divider)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              pane.title,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: pal.text),
            ),
          ),
          if (pane.headerActions != null) ...pane.headerActions!,
          IconButton(
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            tooltip: 'Переместить влево',
            icon: Icon(Icons.arrow_back, size: 14, color: index > 0 ? pal.muted : pal.divider),
            onPressed: index > 0 ? () => _swap(pane.id, -1) : null,
          ),
          IconButton(
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            tooltip: 'Переместить вправо',
            icon: Icon(Icons.arrow_forward, size: 14, color: index < total - 1 ? pal.muted : pal.divider),
            onPressed: index < total - 1 ? () => _swap(pane.id, 1) : null,
          ),
          if (!pane.flexible)
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              tooltip: 'Скрыть колонку',
              icon: Icon(Icons.close, size: 14, color: pal.muted),
              onPressed: () => setState(() => _hidden.add(pane.id)),
            ),
        ],
      ),
    );

    final body = Column(
      children: [
        header,
        Expanded(child: pane.child),
      ],
    );

    if (pane.flexible) {
      return Expanded(child: body);
    }
    return SizedBox(width: _widths[pane.id] ?? pane.initialWidth, child: body);
  }
}
