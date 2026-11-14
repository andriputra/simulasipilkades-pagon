import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { ensureSchema, sql } from "@/lib/db";

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
