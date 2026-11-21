import '../models/models.dart';

/// Движок формул встроенных таблиц:
/// Поддерживает + - * /, SUM/СУММ, AVERAGE/СРЗНАЧ, MIN/МИН, MAX/МАКС, COUNT/СЧЁТ и диапазоны A1:B3.
class FormulaEngine {
  static String colIndexToLetter(int idx) {
    var s = '';
    var n = idx;
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = (n ~/ 26) - 1;
    }
    return s;
  }

  static int letterToColIndex(String letters) {
    var result = 0;
    final upper = letters.toUpperCase();
    for (var i = 0; i < upper.length; i++) {
      result = result * 26 + (upper.codeUnitAt(i) - 64);
    }
    return result - 1;
  }

  static String cellId(int row, int col) => '${colIndexToLetter(col)}${row + 1}';

  static List<String> _expandRange(String rangeStr) {
    final parts = rangeStr.split(':');
    if (parts.length != 2) return [rangeStr.trim().toUpperCase()];
    final m1 = RegExp(r'^([A-Z]+)(\d+)$').firstMatch(parts[0].trim().toUpperCase());
    final m2 = RegExp(r'^([A-Z]+)(\d+)$').firstMatch(parts[1].trim().toUpperCase());
    if (m1 == null || m2 == null) return [];
    final c1 = letterToColIndex(m1.group(1)!);
    final r1 = int.parse(m1.group(2)!) - 1;
    final c2 = letterToColIndex(m2.group(1)!);
    final r2 = int.parse(m2.group(2)!) - 1;
    final ids = <String>[];
    for (var r = (r1 < r2 ? r1 : r2); r <= (r1 > r2 ? r1 : r2); r++) {
      for (var c = (c1 < c2 ? c1 : c2); c <= (c1 > c2 ? c1 : c2); c++) {
        ids.add(cellId(r, c));
      }
    }
    return ids;
  }

  static String evaluate(
    String key,
    Map<String, SpreadsheetCell> cells, [
    Set<String>? visited,
  ]) {
    final raw = cells[key]?.value ?? '';
    if (!raw.startsWith('=')) return raw;
    final seen = {...?visited};
    if (seen.contains(key)) return '#ЦИКЛ!';
    seen.add(key);

    double numVal(String refKey) {
      final v = evaluate(refKey, cells, seen).replaceAll(' ', '').replaceAll(',', '.');
      return double.tryParse(v) ?? 0.0;
    }

    try {
      var expr = raw.substring(1).trim();
      final fnRe = RegExp(
        r'(SUM|СУММ|AVERAGE|СРЗНАЧ|MIN|МИН|MAX|МАКС|COUNT|СЧЁТ|СЧЕТ)\s*\(([^()]+)\)',
        caseSensitive: false,
      );

      var guard = 0;
      while (fnRe.hasMatch(expr) && guard < 12) {
        guard++;
        expr = expr.replaceAllMapped(fnRe, (m) {
          final fn = m.group(1)!.toUpperCase();
          final args = m.group(2)!.split(RegExp(r'[;,]')).map((e) => e.trim()).where((e) => e.isNotEmpty);
          final nums = <double>[];
          for (final item in args) {
            if (item.contains(':')) {
              for (final id in _expandRange(item)) {
                final val = evaluate(id, cells, seen).trim();
                if (val.isNotEmpty) {
                  final parsed = double.tryParse(val.replaceAll(' ', '').replaceAll(',', '.'));
                  if (parsed != null) nums.add(parsed);
                }
              }
            } else if (RegExp(r'^[A-Z]+\d+$', caseSensitive: false).hasMatch(item)) {
              final val = evaluate(item.toUpperCase(), cells, seen).trim();
              if (val.isNotEmpty) {
                final parsed = double.tryParse(val.replaceAll(' ', '').replaceAll(',', '.'));
                if (parsed != null) nums.add(parsed);
              }
            } else {
              final parsed = double.tryParse(item.replaceAll(',', '.'));
              if (parsed != null) nums.add(parsed);
            }
          }
          if (fn == 'SUM' || fn == 'СУММ') {
            return nums.fold<double>(0, (a, b) => a + b).toString();
          }
          if (fn == 'AVERAGE' || fn == 'СРЗНАЧ') {
            return nums.isEmpty ? '0' : (nums.fold<double>(0, (a, b) => a + b) / nums.length).toString();
          }
          if (fn == 'MIN' || fn == 'МИН') {
            return nums.isEmpty ? '0' : nums.reduce((a, b) => a < b ? a : b).toString();
          }
          if (fn == 'MAX' || fn == 'МАКС') {
            return nums.isEmpty ? '0' : nums.reduce((a, b) => a > b ? a : b).toString();
          }
          if (fn == 'COUNT' || fn == 'СЧЁТ' || fn == 'СЧЕТ') {
            return nums.length.toString();
          }
          return '0';
        });
      }

      expr = expr.replaceAllMapped(RegExp(r'\b([A-Z]+\d+)\b', caseSensitive: false), (m) {
        return numVal(m.group(1)!.toUpperCase()).toString();
      });

      final val = _ArithParser(expr.replaceAll(',', '.')).parse();
      if (val.isNaN || val.isInfinite) return '#ДЕЛ/0!';
      final rounded = (val * 10000).round() / 10000;
      return rounded == rounded.roundToDouble() ? rounded.toInt().toString() : rounded.toString();
    } catch (_) {
      return '#ОШИБКА';
    }
  }
}

class _ArithParser {
  final String input;
  int pos = 0;

  _ArithParser(this.input);

  double parse() {
    final result = _parseExpr();
    return result;
  }

  void _skipWs() {
    while (pos < input.length && input[pos] == ' ') {
      pos++;
    }
  }

  double _parseExpr() {
    var left = _parseTerm();
    while (true) {
      _skipWs();
      if (pos < input.length && input[pos] == '+') {
        pos++;
        left += _parseTerm();
      } else if (pos < input.length && input[pos] == '-') {
        pos++;
        left -= _parseTerm();
      } else {
        break;
      }
    }
    return left;
  }

  double _parseTerm() {
    var left = _parseFactor();
    while (true) {
      _skipWs();
      if (pos < input.length && input[pos] == '*') {
        pos++;
        left *= _parseFactor();
      } else if (pos < input.length && input[pos] == '/') {
        pos++;
        final right = _parseFactor();
        left = right == 0 ? double.nan : left / right;
      } else {
        break;
      }
    }
    return left;
  }

  double _parseFactor() {
    _skipWs();
    if (pos < input.length && input[pos] == '-') {
      pos++;
      return -_parseFactor();
    }
    if (pos < input.length && input[pos] == '(') {
      pos++;
      final v = _parseExpr();
      _skipWs();
      if (pos < input.length && input[pos] == ')') pos++;
      return v;
    }
    final start = pos;
    while (pos < input.length && RegExp(r'[\d.]').hasMatch(input[pos])) {
      pos++;
    }
    return double.parse(input.substring(start, pos));
  }
}
