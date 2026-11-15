import { clientIp } from "@/lib/audit";
import { json, readJsonBody } from "@/lib/http";
import { platformEventRoute, setEventCredentials } from "@/lib/platform";

/** Ganti akun & password panitia untuk masuk ke /e/[slug]/admin. */
export const PATCH = platformEventRoute(async (session, ev, req) => {
  const body = await readJsonBody<{ username?: string; password?: string }>(req);
  await setEventCredentials(ev, body.username || "", body.password || "", session.user.username, clientIp(req.headers));
  return json({ ok: true });
});
