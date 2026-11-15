import type { Metadata } from "next";
import Landing, { type LandingEvent, type LandingStats } from "@/components/Landing";
import { EVENT_KIND_LABELS, tokenPrefixFor, votingStatus, wibLabel, type EventRow } from "@/lib/event";
import { listEventSummaries } from "@/lib/platform";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FlexElection — Simulasi & Pemungutan Suara Digital",
  description:
    "Platform pemilihan digital dengan rekap seketika: pemindai kode pemilih, satu pemilih satu suara, isolasi data per simulasi, dan audit log yang bisa diunduh.",
};

/**
 * Halaman depan menjadi etalade produk, bukan lagi lompatan otomatis ke papan suara.
 * Angka yang ditampilkan diambil dari simulasi yang benar-benar berjalan, jadi pengunjung
 * melihat bukti alurnya, bukan janji. Simulasi berstatus draf sengaja tidak ditampilkan.
 */
export default async function RootPage() {
  const all = await listEventSummaries();
  const summaries = all.filter((e) => !e.archived_at && e.status !== "draft");

  const events: LandingEvent[] = summaries.map((e) => {
    const state = votingStatus(e as EventRow);
    return {
      slug: e.slug,
      name: e.name,
      kindLabel: EVENT_KIND_LABELS[e.kind] || e.kind,
      modeLabel: e.vote_mode === "live" ? "Langsung" : "Simulasi",
      statusLabel: state.label,
      open: state.open,
      window: e.closes_at ? `berakhir ${wibLabel(new Date(e.closes_at))}` : e.opens_at ? `mulai ${wibLabel(new Date(e.opens_at))}` : "",
      tokenPrefix: tokenPrefixFor(e.kind),
      voters: e.voters,
      voted: e.voted,
      votes: e.votes,
      candidates: e.candidates,
    };
  });

  const stats: LandingStats = {
    events: events.length,
    open: events.filter((e) => e.open).length,
    voters: events.reduce((a, e) => a + e.voters, 0),
    votes: events.reduce((a, e) => a + e.votes, 0),
  };

  const defaultSlug = all.find((e) => e.is_default)?.slug;
  const featured =
    events.find((e) => e.slug === defaultSlug) || events.find((e) => e.open) || events[0] || null;

  return <Landing events={events} stats={stats} featured={featured} />;
}
