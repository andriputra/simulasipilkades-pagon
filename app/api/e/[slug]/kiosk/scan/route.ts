import { publicRoute, json, readJsonBody } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { labelsFor, lower, votingStatus } from "@/lib/event";
import { makeToken } from "@/lib/auth";

export const POST = publicRoute(async (ev, req) => {
  const L = labelsFor(ev.kind);
  const body = await readJsonBody<{ code?: string }>(req);
  const code = (body.code || "").trim().toUpperCase();
  if (!code) return json({ error: "Kode kosong." }, 400);

  const state = votingStatus(ev);
  if (!state.open) return json({ error: `Pemungutan suara sedang ditutup (${state.reason}).` }, 409);

  const [voter] = await withEvent(ev.id, (tx) =>
    tx`select id, name, has_voted from voters where token = ${code}`,
  );
  if (!voter) return json({ error: `Kode ${lower(L.pemilih)} tidak terdaftar.` }, 404);

  if (ev.vote_mode === "live" && voter.has_voted) {
    return json(
      { error: `Undangan ini sudah digunakan untuk ${L.coblosKata}. Pada mode live, 1 undangan berlaku 1 suara.` },
      409,
    );
  }

  return json({
    ballot: makeToken(`v${ev.id}:${voter.id}`, 300),
    voterName: voter.name,
    revote: voter.has_voted,
    mode: ev.vote_mode === "live" ? "live" : "simulasi",
  });
});
