import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const settings = await sql`select key, value from settings`;
  const map: Record<string, string> = {};
  for (const r of settings) map[r.key] = r.value;
  const candidates =
    await sql`select id, number, name, tagline, photo_url from candidates where active = true order by number`;
  return NextResponse.json({
    status: map.election_status === "closed" ? "closed" : "open",
    title_line1: map.title_line1 || "",
    title_line2: map.title_line2 || "",
    candidates,
  });
}
