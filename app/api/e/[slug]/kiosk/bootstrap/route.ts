import { publicRoute, json } from "@/lib/http";
import { getEventSettings, withEvent } from "@/lib/db";
import { votingStatus } from "@/lib/event";

export const GET = publicRoute(async (ev) => {
  const [settings, candidates] = await Promise.all([
    getEventSettings(ev.id),
    withEvent(ev.id, (tx) =>
      tx`select id, number, name, tagline, photo_url from candidates where active = true order by number`,
    ),
  ]);

  const state = votingStatus(ev);
  return json({
    slug: ev.slug,
    kind: ev.kind,
    status: state.open ? "open" : "closed",
    status_label: state.label,
    status_reason: state.reason,
    vote_mode: ev.vote_mode === "live" ? "live" : "simulasi",
    title_line1: settings.title_line1 || ev.name,
    title_line2: settings.title_line2 || "",
    candidates,
  });
});
