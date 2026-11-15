import { clientIp } from "@/lib/audit";
import { json, readJsonBody } from "@/lib/http";
import { createEvent, platformRoute, type EventDraft } from "@/lib/platform";

/** Buat simulasi baru. URL (slug) boleh dikosongkan — dibuat dari namanya. */
export const POST = platformRoute(async (session, req) => {
  const body = await readJsonBody<EventDraft & { slug?: string }>(req);
  const ev = await createEvent(body, session.user.username, clientIp(req.headers));
  return json({ ok: true, slug: ev.slug, id: ev.id });
});
