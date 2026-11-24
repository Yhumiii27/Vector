// CSV of the exports (`;` separated, UTF-8 with BOM, as a spreadsheet opens it; a cell a spreadsheet would run as a formula is
// neutralised). Pure.
export function cell(v: unknown): string {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return `﻿${[header.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))].join('\r\n')}\r\n`;
}
