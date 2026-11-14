import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { isAdminAuthed } from "@/lib/admin";
import { ensureSchema, sql } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const [voter] = await sql`select token from voters where id = ${Number(id)}`;
  if (!voter) return NextResponse.json({ error: "Pemilih tidak ditemukan." }, { status: 404 });

  const png = await QRCode.toBuffer(voter.token, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
