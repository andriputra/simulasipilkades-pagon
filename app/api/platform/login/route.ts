import { NextResponse } from "next/server";
import { PLATFORM_COOKIE, platformCookieOpts } from "@/lib/admin";
import { clientIp } from "@/lib/audit";
import { HttpError, json, readJsonBody } from "@/lib/http";
import { loginPlatform } from "@/lib/platform";

export const POST = async (req: Request) => {
  try {
    const body = await readJsonBody<{ username?: string; password?: string }>(req);
    const { token } = await loginPlatform(
      body.username || "",
      body.password || "",
      clientIp(req.headers),
      req.headers.get("user-agent") || "",
    );
    const res = json({ ok: true });
    res.cookies.set(PLATFORM_COOKIE, token, platformCookieOpts());
    return res;
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    throw err;
  }
};
