import { publicRoute, json, readJsonBody, HttpError } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { clientIp } from "@/lib/audit";
import { labelsFor, lower, votingStatus } from "@/lib/event";

export const POST = publicRoute(async (ev, req) => {
  const state = votingStatus(ev);
  if (!state.open) throw new HttpError(409, `Pemungutan suara sedang ditutup (${state.reason}).`);
  const L = labelsFor(ev.kind);

  const body = await readJsonBody<{ ballot?: string; candidateId?: number }>(req);
  const payload = body.ballot ? verifyToken(body.ballot) : null;
  const prefix = `v${ev.id}:`;
  if (!payload || !payload.startsWith(prefix)) {
    throw new HttpError(401, `Sesi ${lower(L.pemilih)} tidak valid atau kedaluwarsa. Scan ulang kode Anda.`);
  }

  const voterId = Number(payload.slice(prefix.length));
  const candidateId = Number(body.candidateId);
  if (!Number.isInteger(voterId) || !Number.isInteger(candidateId)) {
    throw new HttpError(400, "Data tidak valid.");
  }

  const ip = clientIp(req.headers);
  let isRevote = false;

  await withEvent(ev.id, async (tx) => {
    const [cand] = await tx`select id from candidates where id = ${candidateId} and active = true`;
    if (!cand) throw new HttpError(404, `${L.calonPendek} tidak ditemukan.`);

    const [voter] = await tx`select id, has_voted from voters where id = ${voterId} for update`;
    if (!voter) throw new HttpError(404, `${L.pemilih} tidak ditemukan.`);
    if (voter.has_voted && ev.vote_mode === "live") {
      throw new HttpError(409, `Suara ${lower(L.pemilih)} ini sudah terkunci. Pada mode live, 1 undangan hanya berlaku 1 suara.`);
    }

    isRevote = voter.has_voted;
    if (isRevote) {
      await tx`update votes set candidate_id = ${candidateId}, created_at = now() where voter_id = ${voterId}`;
      await tx`update voters set voted_at = now() where id = ${voterId}`;
    } else {
      await tx`update voters set has_voted = true, voted_at = now() where id = ${voterId}`;
      await tx`insert into votes (event_id, voter_id, candidate_id) values (${ev.id}, ${voterId}, ${candidateId})`;
    }

    const detail = `${L.pemilih} #${voterId} ${isRevote ? "memperbarui suaranya" : `telah ${L.coblosKata}`} (pilihan rahasia)`;
    await tx`insert into audit_logs (event_id, action, detail, actor, ip)
              values (${ev.id}, ${isRevote ? "VOTE_UPDATED" : "VOTE_CAST"},
                      ${detail},
                      'kiosk', ${ip})`;
  });

  return json({ ok: true, revote: isRevote });
});
