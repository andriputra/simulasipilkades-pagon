import LandingHero from "@/components/LandingHero";
import { getEventSettings } from "@/lib/db";
import { EVENT_KIND_LABELS, votingStatus, wibLabel, type EventRow } from "@/lib/event";
import { listEventSummaries } from "@/lib/platform";

export const dynamic = "force-dynamic";

type LandingEvent = {
  slug: string;
  name: string;
  kindLabel: string;
  title1: string;
  title2: string;
  open: boolean;
  statusLabel: string;
  statusReason: string;
  voteMode: "live" | "simulasi";
  window: string;
  voters: number;
  voted: number;
  candidates: number;
  votes: number;
};

/** Halaman depan menjadi etalade platform: papan suara tetap satu klik jauhnya,
 *  tapi pengunjung yang belum tahu alurnya mendapat penjelasan lebih dulu.
 *  Angka yang ditampilkan bersumber dari simulasi yang sedang berjalan. */
export default async function RootPage() {
  const summaries = (await listEventSummaries()).filter((e) => !e.archived_at).slice(0, 6);

  const events: LandingEvent[] = [];
  for (const e of summaries) {
    const settings = await getEventSettings(e.id);
    const state = votingStatus(e as EventRow);
    events.push({
      slug: e.slug,
      name: e.name,
      kindLabel: EVENT_KIND_LABELS[e.kind] || e.kind,
      title1: settings.title_line1 || e.name,
      title2: settings.title_line2 || "",
      open: state.open,
      statusLabel: state.label,
      statusReason: state.reason,
      voteMode: e.vote_mode === "live" ? "live" : "simulasi",
      window: e.closes_at ? `berakhir ${wibLabel(new Date(e.closes_at))}` : e.opens_at ? `mulai ${wibLabel(new Date(e.opens_at))}` : "",
      voters: e.voters,
      voted: e.voted,
      candidates: e.candidates,
      votes: e.votes,
    });
  }

  const featured = events.findIndex((e) => e.slug === summaries.find((s) => s.is_default)?.slug);
  const active = featured >= 0 ? featured : Math.max(0, events.findIndex((e) => e.open));

  return <LandingHero events={events} initialActive={active} />;
}
