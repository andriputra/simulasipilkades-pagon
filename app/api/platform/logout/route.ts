import { PLATFORM_COOKIE, platformCookieOpts } from "@/lib/admin";
import { clientIp } from "@/lib/audit";
import { json } from "@/lib/http";
import { endPlatformSession, getPlatformSession, platformAudit } from "@/lib/platform";

export const POST = async (req: Request) => {
  const ip = clientIp(req.headers);
  const session = await getPlatformSession();
  await endPlatformSession();
  if (session) await platformAudit(session.user.username, "LOGOUT", "Keluar dari konsol platform", null, ip);
  const res = json({ ok: true });
  res.cookies.set(PLATFORM_COOKIE, "", platformCookieOpts(0));
  return res;
};
