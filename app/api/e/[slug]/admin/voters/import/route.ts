import { adminRoute, json, readJsonBody, HttpError } from "@/lib/http";
import { getEventSettings, withEvent } from "@/lib/db";
import { labelsFor, lower, tokenPrefixFor } from "@/lib/event";
import { audit, clientIp } from "@/lib/audit";
import { generateToken } from "@/lib/tokens";
import { parseCsv, type CsvRow } from "@/lib/csv";

const MAX_ROWS = 5000;
const CHUNK = 200;

type Rejected = { row: number; nama: string; alasan: string };
type Pending = { row: number; name: string; nik: string };

function cell(row: CsvRow, i: number): string {
  return i < 0 ? "" : (row[i] || "").trim().replace(/^'+|"+$/g, "").trim();
}

/**
 * Header opsional: selama ada kolom bernama "nama", posisinya tidak harus kolom
 * pertama — daftar dari Excel/Sistem Informasi Desa biasanya membawa NIK, nama,
 * lalu kolom lain. Tanpa header, kolom 1 = nama dan kolom 2 = NIK.
 */
function mapColumns(rows: CsvRow[]): { nameIdx: number; nikIdx: number; dataFrom: number } {
  const header = (rows[0] || []).map((c) => c.toLowerCase().trim());
  const nameIdx = header.findIndex((c) => c.includes("nama") || c.includes("name"));
  if (nameIdx >= 0) {
    const nikIdx = header.findIndex((c) => c.includes("nik") || c.includes("ktp"));
    return { nameIdx, nikIdx, dataFrom: 1 };
  }
  return { nameIdx: 0, nikIdx: rows[0]?.length > 1 ? 1 : -1, dataFrom: 0 };
}

export const POST = adminRoute(async (ev, req) => {
  const body = await readJsonBody<{ text?: string }>(req);
  const text = String(body.text || "");
  const ip = clientIp(req.headers);
  const L = labelsFor(ev.kind);
  if (!text.trim()) throw new HttpError(400, `Berkas kosong — tidak ada baris ${lower(L.pemilih)} yang bisa dibaca.`);

  const rows = parseCsv(text);
  if (!rows.length) throw new HttpError(400, "Berkas tidak memiliki baris data.");
  if (rows.length - 1 > MAX_ROWS) throw new HttpError(400, `Terlalu banyak baris (maks ${MAX_ROWS.toLocaleString("id-ID")}).`);

  const { nameIdx, nikIdx, dataFrom } = mapColumns(rows);
  const rejected: Rejected[] = [];
  const seenNik = new Map<string, number>();
  const pending: Pending[] = [];

  rows.slice(dataFrom).forEach((row, i) => {
    const line = dataFrom + i + 1;
    const name = cell(row, nameIdx);
    const nik = nikIdx >= 0 ? cell(row, nikIdx).replace(/\s+/g, "") : "";
    if (!name) {
      rejected.push({ row: line, nama: "-", alasan: `Nama ${lower(L.pemilih)} kosong.` });
      return;
    }
    if (name.length > 100) {
      rejected.push({ row: line, nama: name.slice(0, 40), alasan: "Nama terlalu panjang (maks 100 karakter)." });
      return;
    }
    if (nik.length > 30) {
      rejected.push({ row: line, nama: name.slice(0, 40), alasan: "NIK terlalu panjang (maks 30 karakter)." });
      return;
    }
    if (nik) {
      const first = seenNik.get(nik);
      if (first !== undefined) {
        rejected.push({ row: line, nama: name.slice(0, 40), alasan: `NIK sama dengan baris ke-${first} pada berkas ini.` });
        return;
      }
      seenNik.set(nik, line);
    }
    pending.push({ row: line, name, nik });
  });

  if (!pending.length) {
    throw new HttpError(400, rejected[0] ? `Tidak ada baris valid. Contoh: ${rejected[0].alasan}` : "Tidak ada baris valid.");
  }

  const prefix = tokenPrefixFor(ev.kind, (await getEventSettings(ev.id)).token_prefix);
  const imported = await withEvent(ev.id, async (tx) => {
    const takenNik = new Set(
      ((await tx`select nik from voters where nik <> ''`) as unknown as { nik: string }[]).map((r) => r.nik),
    );
    const clean: Pending[] = [];
    for (const item of pending) {
      if (item.nik && takenNik.has(item.nik)) {
        rejected.push({ row: item.row, nama: item.name.slice(0, 40), alasan: "NIK sudah terdaftar di simulasi ini." });
        continue;
      }
      if (item.nik) takenNik.add(item.nik);
      clean.push(item);
    }

    let count = 0;
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK);
      const names = chunk.map((c) => c.name);
      const niks = chunk.map((c) => c.nik);
      let tokens = chunk.map(() => generateToken(prefix));
      for (let attempt = 0; attempt < 3; attempt++) {
        const clash = (await tx`select token from voters where token = any(${tokens}::text[])`) as unknown as { token: string }[];
        if (!clash.length) break;
        if (attempt === 2) throw new HttpError(500, "Gagal membuat kode QR unik. Coba lagi impor.");
        const bad = new Set(clash.map((c) => c.token));
        tokens = tokens.map((t) => (bad.has(t) ? generateToken(prefix) : t));
      }
      await tx`insert into voters (event_id, name, nik, token)
               select ${ev.id}, unnest(${names}::text[]), unnest(${niks}::text[]), unnest(${tokens}::text[])`;
      count += chunk.length;
    }
    return count;
  });

  rejected.sort((a, b) => a.row - b.row);
  await audit(
    ev.id,
    "VOTER_IMPORT",
    `${imported} ${lower(L.pemilih)} diimpor dari CSV, ${rejected.length} baris ditolak`,
    "admin",
    ip,
  );
  return json({ imported, rejected, skipped: rejected.length, totalRows: rows.length - dataFrom });
});
