import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { ensureSchema, sql } from "@/lib/db";

export async function POST(req: Request) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await sql`delete from votes returning id`;
  await sql`update voters set has_voted = false, voted_at = null`;
  await audit("VOTES_RESET", `${deleted.length} suara dihapus & status pemilih direset`, "admin", clientIp(req.headers));
  return NextResponse.json({ ok: true, deleted: deleted.length });
}
