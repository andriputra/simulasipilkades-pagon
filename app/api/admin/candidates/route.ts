import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { ensureSchema, sql } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`select id, number, name, tagline, photo_url, active from candidates order by number`;
  return NextResponse.json(rows);
}
