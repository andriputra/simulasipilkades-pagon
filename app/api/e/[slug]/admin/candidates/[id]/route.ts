import { adminRoute, json, readJsonBody, HttpError } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { audit, clientIp } from "@/lib/audit";
import { normalizeImageData, PLACEHOLDER_PHOTO } from "@/lib/uploads";
import { labelsFor, lower } from "@/lib/event";

export const POST = adminRoute(async (ev, req, ctx) => {
  const candidateId = Number((await ctx.params).id);
  const L = labelsFor(ev.kind);
  const body = await readJsonBody<{
    name?: string;
    tagline?: string;
    photo_url?: string;
    number?: number;
    active?: boolean;
  }>(req);

  const name = (body.name || "").trim();
  if (!name) throw new HttpError(400, `Nama ${lower(L.calonPendek)} wajib diisi.`);
  const number = Number(body.number);
  if (!Number.isInteger(number) || number < 1) throw new HttpError(400, "Nomor urut tidak valid.");
  const photoUrl = normalizeImageData(body.photo_url, PLACEHOLDER_PHOTO, 2_500_000, "foto");

  const updated = await withEvent(ev.id, async (tx) => {
    const dup = await tx`select id from candidates where number = ${number} and id <> ${candidateId}`;
    if (dup.length) throw new HttpError(409, `Nomor urut ${number} sudah dipakai ${L.calonPendek.toLowerCase()} lain.`);

    const rows = await tx`update candidates set
        name = ${name},
        tagline = ${(body.tagline || "").trim()},
        photo_url = ${photoUrl},
        number = ${number},
        active = ${body.active !== false}
      where id = ${candidateId} returning id, name`;
    if (!rows.length) throw new HttpError(404, `${L.calonPendek} tidak ditemukan.`);
    return rows[0];
  });

  await audit(
    ev.id,
    "CANDIDATE_UPDATED",
    `${L.calonPendek} #${number} "${name}" diperbarui`,
    "admin",
    clientIp(req.headers),
  );
  return json(updated);
});

export const DELETE = adminRoute(async (ev, req, ctx) => {
  const candidateId = Number((await ctx.params).id);
  const L = labelsFor(ev.kind);

  const result = await withEvent(ev.id, async (tx) => {
    const [cand] = await tx`select id, number, name from candidates where id = ${candidateId}`;
    if (!cand) throw new HttpError(404, `${L.calonPendek} tidak ditemukan.`);

    const [votes] = await tx`select count(*)::int as n from votes where candidate_id = ${candidateId}`;
    if (votes.n > 0) {
      throw new HttpError(
        409,
        `${L.calonPendek} nomor ${cand.number} masih punya ${votes.n} suara dan tidak dapat dihapus. ` +
          "Nonaktifkan saja agar hilang dari kiosk, atau gunakan Reset Semua Suara di Pengaturan.",
      );
    }

    const [rest] = await tx`select count(*)::int as n from candidates`;
    if (rest.n <= 1) throw new HttpError(409, `Minimal satu ${lower(L.calonPendek)} harus tetap ada.`);

    await tx`delete from candidates where id = ${candidateId}`;
    return cand;
  });

  await audit(
    ev.id,
    "CANDIDATE_DELETED",
    `${L.calonPendek} nomor ${result.number} "${result.name}" dihapus`,
    "admin",
    clientIp(req.headers),
  );
  return json({ ok: true });
});
