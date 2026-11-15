import { adminRoute, json, readJsonBody, HttpError } from "@/lib/http";
import { getEventSettings, withEvent } from "@/lib/db";
import { labelsFor, lower, tokenPrefixFor } from "@/lib/event";
import { audit, clientIp } from "@/lib/audit";
import { generateToken } from "@/lib/tokens";

export const GET = adminRoute(async (ev) => {
  const rows = await withEvent(ev.id, (tx) =>
    tx`select id, name, nik, token, has_voted, voted_at, created_at from voters order by id`,
  );
  return json(rows);
});

export const POST = adminRoute(async (ev, req) => {
  const body = await readJsonBody<{ name?: string; nik?: string; count?: number }>(req);
  const ip = clientIp(req.headers);
  const prefix = tokenPrefixFor(ev.kind, (await getEventSettings(ev.id)).token_prefix);
  const L = labelsFor(ev.kind);

  const count = Math.min(Math.max(Number(body.count) || 1, 1), 200);
  const created: { id: number; name: string; token: string }[] = [];

  for (let i = 0; i < count; i++) {
    const name =
      count === 1
        ? (body.name || "").trim()
        : (body.name || "").trim() || `${L.pemilih.toUpperCase()} TAMBUHAN ${i + 1}`;
    if (!name) throw new HttpError(400, `Nama ${lower(L.pemilih)} wajib diisi.`);
    if (name.length > 100) throw new HttpError(400, "Nama terlalu panjang (maks 100 karakter).");
    const nik = count === 1 ? (body.nik || "").trim().slice(0, 30) : "";

    for (let attempt = 0; attempt < 5; attempt++) {
      const token = generateToken(prefix);
      try {
        const rows = (await withEvent(ev.id, (tx) =>
          tx`insert into voters (event_id, name, nik, token) values (${ev.id}, ${name}, ${nik}, ${token})
              returning id, name, token`,
        )) as unknown as { id: number; name: string; token: string }[];
        created.push(rows[0]);
        break;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "23505" || attempt === 4) throw err;
      }
    }
  }

  await audit(
    ev.id,
    "VOTER_CREATED",
    count === 1
      ? `${L.pemilih} "${created[0].name}" terdaftar (${created[0].token})`
      : `${count} ${lower(L.pemilih)} baru dibuat`,
    "admin",
    ip,
  );
  return json(created);
});
