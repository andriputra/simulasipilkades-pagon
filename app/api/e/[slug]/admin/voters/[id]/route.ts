import { adminRoute, json, readJsonBody, HttpError } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { audit, clientIp } from "@/lib/audit";
import { labelsFor, lower } from "@/lib/event";

export const PATCH = adminRoute(async (ev, req, ctx) => {
  const voterId = Number((await ctx.params).id);
  const L = labelsFor(ev.kind);
  const body = await readJsonBody<{ name?: string; nik?: string }>(req);
  const name = (body.name || "").trim();
  const nik = (body.nik || "").trim();
  if (!name) throw new HttpError(400, `Nama ${lower(L.pemilih)} wajib diisi.`);
  if (name.length > 100) throw new HttpError(400, "Nama terlalu panjang (maks 100 karakter).");
  if (nik.length > 30) throw new HttpError(400, "NIK terlalu panjang (maks 30 karakter).");

  const row = await withEvent(ev.id, async (tx) => {
    const [voter] = await tx`select id, name from voters where id = ${voterId}`;
    if (!voter) throw new HttpError(404, `${L.pemilih} tidak ditemukan.`);

    const [updated] = await tx`update voters set name = ${name}, nik = ${nik} where id = ${voterId}
                                returning id, name, nik, token, has_voted, voted_at, created_at`;
    return { before: voter.name, after: updated };
  });

  await audit(
    ev.id,
    "VOTER_UPDATED",
    `Data ${lower(L.pemilih)} "${row.before}" diubah menjadi "${row.after.name}" (#${voterId})`,
    "admin",
    clientIp(req.headers),
  );
  return json(row.after);
});

export const DELETE = adminRoute(async (ev, req, ctx) => {
  const voterId = Number((await ctx.params).id);
  const L = labelsFor(ev.kind);

  const voter = await withEvent(ev.id, async (tx) => {
    const [found] = await tx`select id, name, has_voted from voters where id = ${voterId}`;
    if (!found) throw new HttpError(404, `${L.pemilih} tidak ditemukan.`);
    if (found.has_voted) throw new HttpError(409, `${L.pemilih} sudah ${L.coblosKata} dan tidak dapat dihapus.`);
    await tx`delete from voters where id = ${voterId}`;
    return found;
  });

  await audit(
    ev.id,
    "VOTER_DELETED",
    `${L.pemilih} "${voter.name}" (#${voterId}) dihapus`,
    "admin",
    clientIp(req.headers),
  );
  return json({ ok: true });
});
