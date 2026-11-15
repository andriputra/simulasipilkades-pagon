import { clientIp } from "@/lib/audit";
import { HttpError, json, readJsonBody } from "@/lib/http";
import { changePlatformUserPassword, deletePlatformUser, platformRoute } from "@/lib/platform";

export const PATCH = platformRoute(async (session, req, ctx) => {
  const { id } = await ctx.params;
  const body = await readJsonBody<{ password?: string }>(req);
  const result = await changePlatformUserPassword(Number(id), body.password || "", session.user.username, clientIp(req.headers));
  return json({ ok: true, revoked: result.revoked, sendiri: Number(id) === session.user.id });
});

export const DELETE = platformRoute(async (session, req, ctx) => {
  const { id } = await ctx.params;
  const userId = Number(id);
  if (userId === session.user.id) {
    throw new HttpError(409, "Tidak bisa menghapus akun yang sedang dipakai masuk. Buat akun lain dulu, lalu keluar dan hapus dari akun tersebut.");
  }
  await deletePlatformUser(userId, session.user.username, clientIp(req.headers));
  return json({ ok: true });
});
