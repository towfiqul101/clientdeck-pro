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

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) => row.map((cell) => csvEscape(String(cell ?? ""))).join(","))
    .join("\r\n");
}

/**
 * Excel's own CSV parser (used when a .csv is double-clicked, not imported
 * via the Text Import Wizard) auto-detects purely-numeric cells and mangles
 * them — scientific notation for long digit strings (a 10-digit phone
 * becomes "1.57E+09"), stripped leading zeros for things like zip codes.
 * Wrapping the value as ="value" forces Excel to treat it as literal text.
 * Only use this on values we fully control and know are plain digits (zip,
 * ssn_last4) — never on freeform text, since a leading "=" is normally a
 * CSV-injection vector.
 */
export function forceCsvText(value: string): string {
  return `="${value}"`;
}
