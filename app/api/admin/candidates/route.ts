import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { ensureSchema, sql } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`select c.id, c.number, c.name, c.tagline, c.photo_url, c.active,
                                count(v.id)::int as votes
                         from candidates c
                         left join votes v on v.candidate_id = c.id
                         group by c.id
                         order by c.number`;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    tagline?: string;
    photo_url?: string;
    number?: number;
    active?: boolean;
  };

  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nama calon wajib diisi." }, { status: 400 });

  let number = Number(body.number);
  if (!Number.isInteger(number) || number < 1) {
    const [max] = await sql`select coalesce(max(number), 0)::int as n from candidates`;
    number = max.n + 1;
  }
  const dup = await sql`select id from candidates where number = ${number}`;
  if (dup.length) return NextResponse.json({ error: `Nomor urut ${number} sudah dipakai calon lain.` }, { status: 409 });

  const photoUrl = (body.photo_url || "").trim() || "/seed/placeholder.svg";
  if (photoUrl.startsWith("data:") && !photoUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Format foto tidak didukung." }, { status: 400 });
  }
  if (photoUrl.length > 2_500_000) {
    return NextResponse.json({ error: "Ukuran foto terlalu besar (maks ~1.8 MB setelah kompresi)." }, { status: 413 });
  }

  const created = await sql`insert into candidates (number, name, tagline, photo_url, active)
      values (${number}, ${name}, ${(body.tagline || "").trim()}, ${photoUrl}, ${body.active !== false})
      returning id, number, name, tagline, photo_url, active`;

  await audit("CANDIDATE_CREATED", `Calon nomor ${number} "${name}" ditambahkan`, "admin", clientIp(req.headers));
  return NextResponse.json({ ...created[0], votes: 0 });
}
