import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { ensureSchema, sql } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const voterId = Number(id);

  const body = (await req.json().catch(() => ({}))) as { name?: string; nik?: string };
  const name = (body.name || "").trim();
  const nik = (body.nik || "").trim();
  if (!name) return NextResponse.json({ error: "Nama pemilih wajib diisi." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Nama terlalu panjang (maks 100 karakter)." }, { status: 400 });
  if (nik.length > 30) return NextResponse.json({ error: "NIK terlalu panjang (maks 30 karakter)." }, { status: 400 });

  const [voter] = await sql`select id, name from voters where id = ${voterId}`;
  if (!voter) return NextResponse.json({ error: "Pemilih tidak ditemukan." }, { status: 404 });

  const [row] = await sql`update voters set name = ${name}, nik = ${nik} where id = ${voterId}
                          returning id, name, nik, token, has_voted, voted_at, created_at`;
  await audit(
    "VOTER_UPDATED",
    `Data pemilih "${voter.name}" diubah menjadi "${row.name}" (#${voterId})`,
    "admin",
    clientIp(req.headers)
  );
  return NextResponse.json(row);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const voterId = Number(id);

  const [voter] = await sql`select id, name, has_voted from voters where id = ${voterId}`;
  if (!voter) return NextResponse.json({ error: "Pemilih tidak ditemukan." }, { status: 404 });
  if (voter.has_voted) {
    return NextResponse.json({ error: "Pemilih sudah mencoblos dan tidak dapat dihapus." }, { status: 409 });
  }

  await sql`delete from voters where id = ${voterId}`;
  await audit("VOTER_DELETED", `Pemilih "${voter.name}" (#${voterId}) dihapus`, "admin", clientIp(req.headers));
  return NextResponse.json({ ok: true });
}
