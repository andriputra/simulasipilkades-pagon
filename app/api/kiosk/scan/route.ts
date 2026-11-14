import { NextResponse } from "next/server";
import { makeToken } from "@/lib/auth";
import { ensureSchema, getSettings, sql } from "@/lib/db";

export async function POST(req: Request) {
  await ensureSchema();
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (body.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Kode kosong." }, { status: 400 });

  const settings = await getSettings();
  if (settings.election_status === "closed") {
    return NextResponse.json({ error: "Pemungutan suara sedang ditutup." }, { status: 409 });
  }

  const [voter] = await sql`select id, name, has_voted from voters where token = ${code}`;
  if (!voter) return NextResponse.json({ error: "Kode peserta tidak terdaftar." }, { status: 404 });
  if (voter.has_voted) {
    return NextResponse.json({ error: "Pemilih ini sudah menggunakan hak pilihnya." }, { status: 409 });
  }

  return NextResponse.json({ ballot: makeToken(`v${voter.id}`, 300), voterName: voter.name });
}
