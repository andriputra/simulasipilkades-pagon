import { setPanelCookie } from "@/lib/admin";
import { clientIp } from "@/lib/audit";
import { json } from "@/lib/http";
import { allowPanelImpersonation, platformEventRoute } from "@/lib/platform";

/**
 * Masuk ke panel panitia satu simulasi tanpa password panitia. Cookie yang
 * ditulis identik dengan hasil login CMS, jadi halaman panel tidak punya
 * jalur sesi kedua dan aturan RLS event berlaku penuh selama impersonasi.
 */
export const POST = platformEventRoute(async (session, ev, req) => {
  await allowPanelImpersonation(ev, session.user.username, clientIp(req.headers));
  const res = json({ ok: true, redirect: `/e/${ev.slug}/admin` });
  setPanelCookie(res, ev.slug, ev.id);
  return res;
});
