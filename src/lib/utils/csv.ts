/**
 * Minimal CSV parse/serialize — no dependency needed for our shape (flat
 * rows, no nested structures). Handles quoted fields, embedded commas/
 * newlines inside quotes, and "" as an escaped quote.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  // Final field/row when the file doesn't end with a trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * A cell whose leading "=" is intentional (see forceCsvText) and must NOT be
 * neutralized by the formula guard. Wrapping it in a class rather than using
 * a bare string is what lets toCSV tell "we built this formula on purpose"
 * apart from "a client typed this into a lead form" — the two are
 * indistinguishable as raw strings, which is precisely how CSV injection
 * gets in.
 */
export class RawCsvCell {
  constructor(readonly value: string) {}
}

/**
 * Neutralizes CSV formula injection. Excel/Sheets evaluate any cell whose
 * text begins with =, +, -, @, tab, or CR as a formula — quoting does NOT
 * prevent this, since the quotes are stripped before evaluation. Prefixing a
 * single quote forces the spreadsheet to treat the cell as literal text.
 *
 * This matters because freeform fields (names, emails, addresses) originate
 * from lead-submitted GHL forms — i.e. they are attacker-controlled — and
 * land in a CSV that agency staff open in Excel.
 */
export function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export type CsvCell = string | number | null | undefined | RawCsvCell;

/**
 * Serializes rows to CSV. Every string cell is formula-guarded by default;
 * only an explicit RawCsvCell (from forceCsvText) bypasses the guard. Numbers
 * are exempt — they're our own values, not user text, and guarding them would
 * corrupt legitimate negatives.
 */
export function toCSV(rows: CsvCell[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell instanceof RawCsvCell) return csvEscape(cell.value);
          if (typeof cell === "number") return csvEscape(String(cell));
          return csvEscape(sanitizeCsvCell(String(cell ?? "")));
        })
        .join(",")
    )
    .join("\r\n");
}

/**
 * Excel's own CSV parser (used when a .csv is double-clicked, not imported
 * via the Text Import Wizard) auto-detects purely-numeric cells and mangles
 * them — scientific notation for long digit strings (a 10-digit phone
 * becomes "1.57E+09"), stripped leading zeros for things like zip codes.
 * Wrapping the value as ="value" forces Excel to treat it as literal text.
 *
 * Only use this on values we fully control and know are plain digits (zip,
 * ssn_last4, a formatted phone) — never on freeform text, since a leading "="
 * is a CSV-injection vector. The RawCsvCell return type is what exempts it
 * from toCSV's formula guard, so passing user text through here would
 * deliberately re-open that hole. Digits are enforced here as a backstop.
 */
export function forceCsvText(value: string): RawCsvCell {
  if (!/^[\d\s()+-]+$/.test(value)) {
    // Not the digit-ish value this is meant for — fall back to a guarded
    // cell rather than emitting an unguarded formula.
    return new RawCsvCell(sanitizeCsvCell(value));
  }
  return new RawCsvCell(`="${value}"`);
}
