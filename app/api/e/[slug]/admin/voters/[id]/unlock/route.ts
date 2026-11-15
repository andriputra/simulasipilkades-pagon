import { adminRoute, json, HttpError } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { audit, clientIp } from "@/lib/audit";
import { labelsFor } from "@/lib/event";

export const POST = adminRoute(async (ev, req, ctx) => {
  const voterId = Number((await ctx.params).id);
  const L = labelsFor(ev.kind);

  const voter = await withEvent(ev.id, async (tx) => {
    const [found] = await tx`select id, name, has_voted from voters where id = ${voterId}`;
    if (!found) throw new HttpError(404, `${L.pemilih} tidak ditemukan.`);
    if (!found.has_voted) throw new HttpError(409, `${L.pemilih} ini belum ${L.coblosKata}.`);

    await tx`delete from votes where voter_id = ${voterId}`;
    await tx`update voters set has_voted = false, voted_at = null where id = ${voterId}`;
    return found;
  });

  await audit(
    ev.id,
    "VOTER_UNLOCKED",
    `${L.pemilih} "${voter.name}" (#${voterId}) dibuka kuncinya: suara dihapus & kode berlaku kembali`,
    "admin",
    clientIp(req.headers),
  );
  return json({ ok: true });
});
