import { clientIp } from "@/lib/audit";
import { json } from "@/lib/http";
import { platformEventRoute, setDefaultEvent } from "@/lib/platform";

/** Halaman depan / diarahkan ke simulasi ini. */
export const POST = platformEventRoute(async (session, ev, req) => {
  await setDefaultEvent(ev, session.user.username, clientIp(req.headers));
  return json({ ok: true });
});
