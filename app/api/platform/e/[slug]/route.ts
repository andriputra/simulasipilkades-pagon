import { clientIp } from "@/lib/audit";
import { labelsFor, toWibInput } from "@/lib/event";
import { json, readJsonBody } from "@/lib/http";
import {
  deleteEventCompletely,
  eventVoterCount,
  platformEventRoute,
  updateEvent,
  type EventDraft,
} from "@/lib/platform";

/** Simpan identitas, status, mode, dan jadwal satu simulasi. */
export const PATCH = platformEventRoute(async (session, ev, req) => {
  const body = await readJsonBody<EventDraft & { slug?: string }>(req);
  const merged: EventDraft & { slug?: string } = {
    name: body.name ?? ev.name,
    kind: body.kind ?? ev.kind,
    status: body.status ?? ev.status,
    vote_mode: body.vote_mode ?? ev.vote_mode,
    opens_at: body.opens_at ?? toWibInput(ev.opens_at),
    closes_at: body.closes_at ?? toWibInput(ev.closes_at),
    slug: body.slug,
  };
  const next = await updateEvent(ev, merged, session.user.username, clientIp(req.headers));
  return json({ ok: true, slug: next.slug });
});

/**
 * Hapus permanen satu simulasi. Diblokir bila masih ada pemilih terdaftar:
 * data hari-H tidak boleh hilang karena satu klik di konsol. Arsip selalu
 * menjadi syarat sebelumnya (status harus 'archived').
 */
export const DELETE = platformEventRoute(async (session, ev, req) => {
  const ip = clientIp(req.headers);
  if (ev.status !== "archived") {
    return json({ error: "Arsipkan dulu simulasi ini sebelum menghapusnya." }, 409);
  }
  const voters = await eventVoterCount(ev.id);
  if (voters > 0) {
    const kata = labelsFor(ev.kind).pemilih.toLowerCase();
    return json({ error: `Masih ada ${voters} ${kata} terdaftar. Hapus data ${kata} di panel terlebih dahulu.` }, 409);
  }
  await deleteEventCompletely(ev, session.user.username, ip);
  return json({ ok: true });
});
