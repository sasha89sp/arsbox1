import { SpreadsheetCell } from '../types';

export function colIndexToLetter(idx: number): string {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function letterToColIndex(letters: string): number {
  let result = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function cellId(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { col: letterToColIndex(m[1]), row: parseInt(m[2], 10) - 1 };
}

function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return [rangeStr.trim().toUpperCase()];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [];
  const rMin = Math.min(start.row, end.row);
  const rMax = Math.max(start.row, end.row);
  const cMin = Math.min(start.col, end.col);
  const cMax = Math.max(start.col, end.col);
  const ids: string[] = [];
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      ids.push(cellId(r, c));
    }
  }
  return ids;
}

export function evaluateCell(
  key: string,
  cells: Record<string, SpreadsheetCell>,
  visited: Set<string> = new Set()
): string {
  const raw = cells[key]?.value ?? '';
  if (!raw.startsWith('=')) return raw;
  if (visited.has(key)) return '#ЦИКЛ!';

  const nextVisited = new Set(visited);
  nextVisited.add(key);

  const getNumericVal = (refKey: string): number => {
    const val = evaluateCell(refKey, cells, nextVisited);
    const cleaned = val.replace(/\s+/g, '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  try {
    let expr = raw.slice(1).trim();

    // Handle aggregate functions (English + Cyrillic equivalents)
    const fnRegex =
      /(SUM|СУММ|AVERAGE|СРЗНАЧ|MIN|МИН|MAX|МАКС|COUNT|СЧЁТ|СЧЕТ)\s*\(([^()]+)\)/gi;

    let guard = 0;
    while (fnRegex.test(expr) && guard < 12) {
      guard++;
      expr = expr.replace(fnRegex, (_match, fnName: string, argsStr: string) => {
        const fn = fnName.toUpperCase();
        const items = argsStr.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        const nums: number[] = [];

        for (const item of items) {
          if (item.includes(':')) {
            const expanded = expandRange(item);
            for (const id of expanded) {
              const rawCell = evaluateCell(id, cells, nextVisited);
              if (rawCell.trim() !== '') {
                const n = Number(rawCell.replace(/\s+/g, '').replace(',', '.'));
                if (Number.isFinite(n)) nums.push(n);
              }
            }
          } else if (/^[A-Z]+\d+$/i.test(item)) {
            const rawCell = evaluateCell(item.toUpperCase(), cells, nextVisited);
            if (rawCell.trim() !== '') {
              const n = Number(rawCell.replace(/\s+/g, '').replace(',', '.'));
              if (Number.isFinite(n)) nums.push(n);
            }
          } else {
            const n = Number(item.replace(',', '.'));
            if (Number.isFinite(n)) nums.push(n);
          }
        }

        if (fn === 'SUM' || fn === 'СУММ') {
          return String(nums.reduce((a, b) => a + b, 0));
        }
        if (fn === 'AVERAGE' || fn === 'СРЗНАЧ') {
          return nums.length ? String(nums.reduce((a, b) => a + b, 0) / nums.length) : '0';
        }
        if (fn === 'MIN' || fn === 'МИН') {
          return nums.length ? String(Math.min(...nums)) : '0';
        }
        if (fn === 'MAX' || fn === 'МАКС') {
          return nums.length ? String(Math.max(...nums)) : '0';
        }
        if (fn === 'COUNT' || fn === 'СЧЁТ' || fn === 'СЧЕТ') {
          return String(nums.length);
        }
        return '0';
      });
    }

    // Replace remaining cell references (e.g. A1, B2)
    expr = expr.replace(/\b([A-Z]+\d+)\b/gi, (_m, ref: string) => {
      return String(getNumericVal(ref.toUpperCase()));
    });

    // Safe arithmetic evaluation only (+ - * / ( ) . digits spaces)
    expr = expr.replace(/,/g, '.');
    if (!/^[\d+\-*/().\s]+$/.test(expr)) {
      return '#ОШИБКА';
    }
    const result = Function(`"use strict"; return (${expr});`)();
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return '#ДЕЛ/0!';
    }
    // Round floating point noise cleanly
    const rounded = Math.round(result * 10000) / 10000;
    return String(rounded);
  } catch {
    return '#ОШИБКА';
  }
}
