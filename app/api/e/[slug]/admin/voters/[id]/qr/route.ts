import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { adminRoute, HttpError } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { labelsFor } from "@/lib/event";

export const GET = adminRoute(async (ev, _req, ctx) => {
  const voterId = Number((await ctx.params).id);
  const voter = await withEvent(ev.id, async (tx) => {
    const [row] = await tx`select token from voters where id = ${voterId}`;
    return row ?? null;
  });
  if (!voter) throw new HttpError(404, `${labelsFor(ev.kind).pemilih} tidak ditemukan.`);

  const png = await QRCode.toBuffer(voter.token, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
