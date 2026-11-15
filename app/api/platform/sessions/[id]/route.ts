import { clientIp } from "@/lib/audit";
import { json } from "@/lib/http";
import { platformRoute, revokePlatformSession } from "@/lib/platform";

/** Cabut satu sesi konsol (mis. laptop yang lupa di-logout). */
export const DELETE = platformRoute(async (session, req, ctx) => {
  const { id } = await ctx.params;
  const ok = await revokePlatformSession(Number(id), session.user.username, clientIp(req.headers));
  return json(ok ? { ok: true } : { error: "Sesi sudah berakhir atau tidak ditemukan." }, ok ? 200 : 404);
});
