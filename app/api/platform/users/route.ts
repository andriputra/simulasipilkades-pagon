import { clientIp } from "@/lib/audit";
import { json, readJsonBody } from "@/lib/http";
import { createPlatformUser, platformRoute } from "@/lib/platform";

/** Tambah akun konsol platform (bukan akun panitia). */
export const POST = platformRoute(async (session, req) => {
  const body = await readJsonBody<{ username?: string; name?: string; password?: string }>(req);
  const user = await createPlatformUser(
    { username: body.username || "", name: body.name || "", password: body.password || "" },
    session.user.username,
    clientIp(req.headers),
  );
  return json({ ok: true, id: user.id, username: user.username });
});
