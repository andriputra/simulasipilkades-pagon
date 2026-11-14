import { NextResponse } from "next/server";
import { audit, clientIp } from "@/lib/audit";
import { verifyToken } from "@/lib/auth";
import { ensureSchema, getSettings, sql } from "@/lib/db";

export async function POST(req: Request) {
  await ensureSchema();
  const body = (await req.json().catch(() => ({}))) as { ballot?: string; candidateId?: number };
  const payload = body.ballot ? verifyToken(body.ballot) : null;
  if (!payload || !payload.startsWith("v")) {
    return NextResponse.json({ error: "Sesi pencoblosan tidak valid atau kedaluwarsa. Scan ulang kode Anda." }, { status: 401 });
  }
  const voterId = Number(payload.slice(1));
  const candidateId = Number(body.candidateId);
  if (!Number.isInteger(voterId) || !Number.isInteger(candidateId)) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const [cand] = await sql`select id from candidates where id = ${candidateId} and active = true`;
  if (!cand) return NextResponse.json({ error: "Calon tidak ditemukan." }, { status: 404 });

  const liveMode = (await getSettings()).vote_mode === "live";

  let isRevote = false;
  try {
    await sql.begin(async (tx) => {
      const [voter] = await tx`select id, has_voted from voters where id = ${voterId} for update`;
      if (!voter) throw new Error("VOTER_NOT_FOUND");
      if (voter.has_voted && liveMode) throw new Error("VOTE_LOCKED");
      isRevote = voter.has_voted;
      if (isRevote) {
        await tx`update votes set candidate_id = ${candidateId}, created_at = now() where voter_id = ${voterId}`;
        await tx`update voters set voted_at = now() where id = ${voterId}`;
      } else {
        await tx`update voters set has_voted = true, voted_at = now() where id = ${voterId}`;
        await tx`insert into votes (voter_id, candidate_id) values (${voterId}, ${candidateId})`;
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "VOTER_NOT_FOUND") {
      return NextResponse.json({ error: "Pemilih tidak ditemukan." }, { status: 404 });
    }
    if (msg === "VOTE_LOCKED") {
      return NextResponse.json(
        { error: "Suara pemilih ini sudah terkunci. Pada mode live, 1 undangan hanya berlaku 1 suara." },
        { status: 409 }
      );
    }
    throw err;
  }

  await audit(
    isRevote ? "VOTE_UPDATED" : "VOTE_CAST",
    `Pemilih #${voterId} ${isRevote ? "memperbarui" : "telah"} mencoblos (pilihan rahasia)`,
    "kiosk",
    clientIp(req.headers)
  );
  return NextResponse.json({ ok: true, revote: isRevote });
}
