import { adminRoute, json } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { audit, clientIp } from "@/lib/audit";
import { labelsFor, lower } from "@/lib/event";

export const POST = adminRoute(async (ev, req) => {
  const deleted = await withEvent(ev.id, async (tx) => {
    const rows = await tx`delete from votes returning id`;
    await tx`update voters set has_voted = false, voted_at = null`;
    return rows.length;
  });

  const detail = `${deleted} suara dihapus & status ${lower(labelsFor(ev.kind).pemilih)} direset`;
  await audit(ev.id, "VOTES_RESET", detail, "admin", clientIp(req.headers));
  return json({ ok: true, deleted });
});
