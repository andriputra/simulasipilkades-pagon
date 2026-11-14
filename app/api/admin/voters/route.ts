import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { ensureSchema, sql } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export function generateToken(): string {
  return `PKD-${randomBlock(4)}-${randomBlock(4)}`;
}

export async function GET() {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`select id, name, nik, token, has_voted, voted_at, created_at from voters order by id`;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; nik?: string; count?: number };
  const ip = clientIp(req.headers);

  const count = Math.min(Math.max(Number(body.count) || 1, 1), 200);
  const created: { id: number; name: string; token: string }[] = [];

  for (let i = 0; i < count; i++) {
    const name =
      count === 1
        ? (body.name || "").trim()
        : (body.name || "").trim() || `PEMILIH TAMBUHAN ${i + 1}`;
    if (!name) return NextResponse.json({ error: "Nama pemilih wajib diisi." }, { status: 400 });
    const nik = count === 1 ? (body.nik || "").trim() : "";

    for (let attempt = 0; attempt < 5; attempt++) {
      const token = generateToken();
      try {
        const rows = await sql`insert into voters (name, nik, token) values (${name}, ${nik}, ${token})
                               returning id, name, token`;
        created.push(rows[0]);
        break;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "23505" || attempt === 4) throw err;
      }
    }
  }

  await audit(
    "VOTER_CREATED",
    count === 1 ? `Pemilih "${created[0].name}" terdaftar (${created[0].token})` : `${count} pemilih baru dibuat`,
    "admin",
    ip
  );
  return NextResponse.json(created);
}
