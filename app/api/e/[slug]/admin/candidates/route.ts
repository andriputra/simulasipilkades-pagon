import { adminRoute, json, readJsonBody, HttpError } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { audit, clientIp } from "@/lib/audit";
import { normalizeImageData, PLACEHOLDER_PHOTO } from "@/lib/uploads";
import { labelsFor, lower } from "@/lib/event";

export const GET = adminRoute(async (ev) => {
  const rows = await withEvent(ev.id, (tx) =>
    tx`select c.id, c.number, c.name, c.tagline, c.photo_url, c.active, count(v.id)::int as votes
        from candidates c
        left join votes v on v.candidate_id = c.id
        where c.event_id = ${ev.id}
        group by c.id
        order by c.number`,
  );
  return json(rows);
});

export const POST = adminRoute(async (ev, req) => {
  const body = await readJsonBody<{
    name?: string;
    tagline?: string;
    photo_url?: string;
    number?: number;
    active?: boolean;
  }>(req);

  const name = (body.name || "").trim();
  const L = labelsFor(ev.kind);
  if (!name) throw new HttpError(400, `Nama ${lower(L.calonPendek)} wajib diisi.`);
  const photoUrl = normalizeImageData(body.photo_url, PLACEHOLDER_PHOTO, 2_500_000, "foto");
  const tagline = (body.tagline || "").trim();
  const active = body.active !== false;

  const created = await withEvent(ev.id, async (tx) => {
    let number = Number(body.number);
    if (!Number.isInteger(number) || number < 1) {
      const [max] = await tx`select coalesce(max(number), 0)::int as n from candidates`;
      number = max.n + 1;
    }
    const dup = await tx`select id from candidates where number = ${number}`;
    if (dup.length) throw new HttpError(409, `Nomor urut ${number} sudah dipakai ${L.calonPendek.toLowerCase()} lain.`);

    const rows = await tx`insert into candidates (event_id, number, name, tagline, photo_url, active)
        values (${ev.id}, ${number}, ${name}, ${tagline}, ${photoUrl}, ${active})
        returning id, number, name`;
    return rows[0];
  });

  await audit(
    ev.id,
    "CANDIDATE_CREATED",
    `${L.calonPendek} nomor ${created.number} "${name}" ditambahkan`,
    "admin",
    clientIp(req.headers),
  );
  return json({ ...created, votes: 0 });
});
