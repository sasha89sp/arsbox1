import React, { useState } from 'react';
import { Bold, Download, Plus, Trash2 } from 'lucide-react';
import { SpreadsheetData } from '../../types';
import { cellId, colIndexToLetter, evaluateCell } from '../../lib/formulas';

const CELL_COLORS = [
  { label: 'Нет', value: '' },
  { label: 'Индиго', value: '#EEF2FF' },
  { label: 'Янтарь', value: '#FEF3C7' },
  { label: 'Изумруд', value: '#ECFDF5' },
  { label: 'Алый', value: '#FEF2F2' },
];

export const SpreadsheetBlock: React.FC<{
  data: SpreadsheetData;
  readOnly?: boolean;
  onChange: (next: SpreadsheetData) => void;
  onRemoveBlock?: () => void;
}> = ({ data, readOnly, onChange, onRemoveBlock }) => {
  const [selectedCell, setSelectedCell] = useState<string>('A1');
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const activeCell = data.cells[selectedCell] || { value: '' };

  const setCellValue = (key: string, value: string) => {
    onChange({
      ...data,
      cells: {
        ...data.cells,
        [key]: { ...(data.cells[key] || { value: '' }), value },
      },
    });
  };

  const toggleBold = () => {
    if (readOnly) return;
    onChange({
      ...data,
      cells: {
        ...data.cells,
        [selectedCell]: {
          ...(data.cells[selectedCell] || { value: '' }),
          bold: !activeCell.bold,
        },
      },
    });
  };

  const setCellBg = (bg: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      cells: {
        ...data.cells,
        [selectedCell]: {
          ...(data.cells[selectedCell] || { value: '' }),
          bg: bg || undefined,
        },
      },
    });
  };

  const addRow = () => onChange({ ...data, rows: Math.min(50, data.rows + 1) });
  const addCol = () => onChange({ ...data, cols: Math.min(16, data.cols + 1) });

  const exportCsv = () => {
    const lines: string[] = [];
    for (let r = 0; r < data.rows; r++) {
      const rowVals: string[] = [];
      for (let c = 0; c < data.cols; c++) {
        const val = evaluateCell(cellId(r, c), data.cells);
        rowVals.push(`"${val.replace(/"/g, '""')}"`);
      }
      lines.push(rowVals.join(';'));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title || 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] overflow-hidden">
      {/* Spreadsheet Toolbar */}
      <div className="px-3 py-2 border-b border-[var(--divider)] bg-[var(--sidebar)] flex flex-wrap items-center justify-between gap-2">
        <input
          value={data.title}
          disabled={readOnly}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder="Название таблицы"
          className="text-[12.5px] font-semibold text-[var(--text)] bg-transparent outline-none min-w-[140px] flex-1"
        />

        <div className="flex items-center gap-1.5 text-[11.5px]">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={toggleBold}
                title="Жирный шрифт в ячейке"
                className={`p-1 rounded-[6px] border ${
                  activeCell.bold
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--divider)] text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-0.5 px-1">
                {CELL_COLORS.map((col) => (
                  <button
                    key={col.label}
                    type="button"
                    title={`Цвет фона: ${col.label}`}
                    onClick={() => setCellBg(col.value)}
                    className={`w-4 h-4 rounded-[4px] border ${
                      (activeCell.bg || '') === col.value
                        ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                        : 'border-[var(--divider)]'
                    }`}
                    style={{ backgroundColor: col.value || 'var(--panel)' }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={addRow}
                className="px-2 py-1 rounded-[6px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text2)] hover:text-[var(--text)] flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                Строка
              </button>
              <button
                type="button"
                onClick={addCol}
                className="px-2 py-1 rounded-[6px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text2)] hover:text-[var(--text)] flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                Столбец
              </button>
            </>
          )}
          <button
            type="button"
            onClick={exportCsv}
            title="Экспорт в CSV"
            className="p-1 rounded-[6px] border border-[var(--divider)] bg-[var(--panel)] text-[var(--text2)] hover:text-[var(--text)]"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {!readOnly && onRemoveBlock && (
            <button
              type="button"
              onClick={onRemoveBlock}
              title="Удалить блок таблицы"
              className="p-1 rounded-[6px] text-[var(--text2)] hover:text-[var(--error)]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Formula Bar */}
      {!readOnly && (
        <div className="px-3 py-1.5 border-b border-[var(--divider)] flex items-center gap-2 bg-[var(--panel)] text-[12px]">
          <span className="px-1.5 py-0.5 rounded-[5px] bg-[var(--sidebar)] border border-[var(--divider)] font-mono-tabular text-[11px] font-medium text-[var(--text2)] min-w-[38px] text-center">
            {selectedCell}
          </span>
          <span className="text-[var(--muted)] font-mono text-[11px]">fx</span>
          <input
            value={activeCell.value}
            onChange={(e) => setCellValue(selectedCell, e.target.value)}
            placeholder="Значение или формула: =СУММ(B2:B5), =СРЗНАЧ(B2:B5), =B2-C2"
            className="flex-1 bg-transparent font-mono-tabular text-[12px] text-[var(--text)] outline-none"
          />
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[var(--sidebar)]">
              <th className="w-9 border-b border-r border-[var(--divider)] py-1 text-[10.5px] font-mono-tabular text-[var(--muted)] font-normal" />
              {Array.from({ length: data.cols }, (_, c) => (
                <th
                  key={c}
                  className="min-w-[100px] border-b border-r last:border-r-0 border-[var(--divider)] py-1 text-[11px] font-mono-tabular text-[var(--muted)] font-medium"
                >
                  {colIndexToLetter(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: data.rows }, (_, r) => (
              <tr key={r}>
                <td className="border-b border-r border-[var(--divider)] bg-[var(--sidebar)] text-center text-[10.5px] font-mono-tabular text-[var(--muted)] py-1 select-none">
                  {r + 1}
                </td>
                {Array.from({ length: data.cols }, (_, c) => {
                  const id = cellId(r, c);
                  const cell = data.cells[id];
                  const isSel = selectedCell === id;
                  const isEd = editingCell === id && !readOnly;
                  const displayVal = evaluateCell(id, data.cells);
                  const isNumeric = displayVal !== '' && /^-?\d+([.,]\d+)?$/.test(displayVal);
                  return (
                    <td
                      key={id}
                      onClick={() => setSelectedCell(id)}
                      onDoubleClick={() => !readOnly && setEditingCell(id)}
                      style={{
                        backgroundColor: cell?.bg
                          ? `color-mix(in srgb, ${cell.bg} 78%, var(--panel))`
                          : undefined,
                      }}
                      className={`border-b border-r last:border-r-0 border-[var(--divider)] p-0 relative ${
                        isSel && !readOnly ? 'ring-1.5 ring-inset ring-[var(--accent)] z-10' : ''
                      }`}
                    >
                      {isEd ? (
                        <input
                          autoFocus
                          value={cell?.value ?? ''}
                          onChange={(e) => setCellValue(id, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          className="w-full h-full px-2 py-1.5 bg-[var(--panel)] text-[var(--text)] font-mono-tabular text-[12px] outline-none"
                        />
                      ) : (
                        <div
                          className={`px-2 py-1.5 min-h-[28px] truncate text-[var(--text)] ${
                            cell?.bold ? 'font-semibold' : ''
                          } ${isNumeric ? 'text-right font-mono-tabular' : 'text-left'}`}
                        >
                          {displayVal}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
