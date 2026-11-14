import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { ensureSchema, sql } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const candidateId = Number(id);
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    tagline?: string;
    photo_url?: string;
    number?: number;
    active?: boolean;
  };

  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nama calon wajib diisi." }, { status: 400 });
  const number = Number(body.number);
  if (!Number.isInteger(number) || number < 1) return NextResponse.json({ error: "Nomor urut tidak valid." }, { status: 400 });
  const photoUrl = (body.photo_url || "").trim() || "/seed/placeholder.svg";
  if (photoUrl.startsWith("data:") && !photoUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Format foto tidak didukung." }, { status: 400 });
  }
  if (photoUrl.length > 2_500_000) {
    return NextResponse.json({ error: "Ukuran foto terlalu besar (maks ~1.8 MB setelah kompresi)." }, { status: 413 });
  }

  const dup = await sql`select id from candidates where number = ${number} and id <> ${candidateId}`;
  if (dup.length) return NextResponse.json({ error: `Nomor urut ${number} sudah dipakai calon lain.` }, { status: 409 });

  const updated = await sql`update candidates set
      name = ${name},
      tagline = ${(body.tagline || "").trim()},
      photo_url = ${photoUrl},
      number = ${number},
      active = ${body.active !== false}
    where id = ${candidateId} returning id, name`;
  if (!updated.length) return NextResponse.json({ error: "Calon tidak ditemukan." }, { status: 404 });

  await audit("CANDIDATE_UPDATED", `Calon #${number} "${name}" diperbarui`, "admin", clientIp(req.headers));
  return NextResponse.json(updated[0]);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const candidateId = Number(id);

  const [cand] = await sql`select id, number, name from candidates where id = ${candidateId}`;
  if (!cand) return NextResponse.json({ error: "Calon tidak ditemukan." }, { status: 404 });

  const [votes] = await sql`select count(*)::int as n from votes where candidate_id = ${candidateId}`;
  if (votes.n > 0) {
    return NextResponse.json(
      {
        error: `Calon nomor ${cand.number} masih punya ${votes.n} suara dan tidak dapat dihapus. Nonaktifkan saja agar hilang dari kiosk, atau gunakan Reset Semua Suara di Pengaturan.`,
      },
      { status: 409 }
    );
  }

  const [rest] = await sql`select count(*)::int as n from candidates`;
  if (rest.n <= 1) {
    return NextResponse.json({ error: "Minimal satu calon harus tetap ada." }, { status: 409 });
  }

  await sql`delete from candidates where id = ${candidateId}`;
  await audit("CANDIDATE_DELETED", `Calon nomor ${cand.number} "${cand.name}" dihapus`, "admin", clientIp(req.headers));
  return NextResponse.json({ ok: true });
}
