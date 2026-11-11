/**
 * Escapes CSV values and prevents spreadsheet formula injection (CSV Injection / CWE-1236).
 * Prepends a single quote if the field starts with =, +, -, @, \t, or \r.
 */
export function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);

  // Formula injection check: if string starts with risky chars, prepend an apostrophe
  const riskyChars = ['=', '+', '-', '@', '\t', '\r'];
  if (riskyChars.some(char => str.startsWith(char))) {
    str = `'${str}`;
  }

  // Escape inner double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function arrayToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(h => escapeCsvField(h)).join(',');
  const rowLines = rows.map(row => row.map(cell => escapeCsvField(cell)).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

