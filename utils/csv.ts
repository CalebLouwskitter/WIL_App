// RFC 4180 CSV serializer with spreadsheet formula injection protection.

/**
 * Checks whether a string represents a plain finite number (e.g. "-12.5", "+3").
 * Plain numbers starting with '+' or '-' must not be treated as formula injection.
 */
const isPlainNumber = (val: string): boolean => {
  if (/[\r\n]/.test(val)) return false;
  const trimmed = val.trim();
  if (trimmed === '') return false;
  // Match standard decimal numbers: optional +/-, digits, optional decimal point and digits, optional exponent
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    return false;
  }
  const num = Number(trimmed);
  return Number.isFinite(num);
};

const FORMULA_PREFIXES = ['=', '+', '-', '@'];

/**
 * Formats a single value as an RFC 4180 CSV field.
 * - null / undefined -> empty string
 * - finite numbers -> string representation without quotes
 * - non-finite numbers (NaN, Infinity, -Infinity) -> empty string
 * - strings starting with '=', '+', '-', '@' that are not plain numbers are prefixed with "'"
 * - strings containing '"', ',', '\r', or '\n' are wrapped in double quotes with '"' doubled.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  let str = String(value);

  // Spreadsheet formula injection mitigation:
  // If a string starts with '=', '+', '-', or '@', prefix with a single quote "'"
  // so spreadsheets treat it as literal text rather than an executable formula.
  // Exception: plain numbers formatted as text (like "-12.5" or "+3") are safe and unaltered.
  if (FORMULA_PREFIXES.some((p) => str.startsWith(p))) {
    if (!isPlainNumber(str)) {
      str = `'${str}`;
    }
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Joins an array of values into a single CSV row separated by commas.
 */
export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvField).join(',');
}
