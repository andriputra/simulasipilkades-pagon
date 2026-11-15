/**
 * CSV tanpa dependensi: berkas kiriman klien sering berbeda format (Excel Indonesia
 * memisah dengan ";", Excel Inggris dengan ",", salinan dari layar memakai tab),
 * jadi pemisahnya dideteksi dari baris pertama.
 */

export const CSV_BOM = "";

export type CsvRow = string[];

const DELIMITERS = [",", ";", "\t", "|"];

function firstLine(text: string): string {
  const lf = text.indexOf("\n");
  const cr = text.indexOf("\r");
  if (lf < 0 && cr < 0) return text;
  if (lf < 0) return text.slice(0, cr);
  if (cr < 0) return text.slice(0, lf);
  return text.slice(0, Math.min(lf, cr));
}

export function detectDelimiter(text: string): string {
  const line = firstLine(text);
  let best = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Baris RFC-4180: petik ganda "" lolos, pemisah di dalam tanda kutip diabaikan. */
export function parseCsv(text: string): CsvRow[] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delim = detectDelimiter(src);
  const rows: CsvRow[] = [];
  let row: CsvRow = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      quoted = true;
      continue;
    }
    if (ch === delim) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  rows.push(row);

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function needsQuote(value: string, delim: string): boolean {
  return value.includes(delim) || value.includes('"') || value.includes("\n") || value !== value.trim();
}

export function csvCell(value: unknown, delim = ";"): string {
  const text = value === null || value === undefined ? "" : String(value);
  return needsQuote(text, delim) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Default ";" + BOM agar Excel (setelan Indonesia) membuka file tanpa kolom rusak. */
export function toCsv(rows: readonly (readonly unknown[])[], delim = ";"): string {
  const body = rows.map((r) => r.map((c) => csvCell(c, delim)).join(delim)).join("\r\n");
  return CSV_BOM + body + "\r\n";
}
