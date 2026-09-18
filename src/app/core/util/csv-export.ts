/** Downloads rows as CSV with a UTF-8 BOM so Excel renders Turkish characters correctly. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (value: string | number): string => {
    const str = String(value);
    return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))];
  const csv = '﻿' + lines.join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
