import { NextResponse } from "next/server";
import { adminRoute, json } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { labelsFor, votingStatus } from "@/lib/event";

export const GET = adminRoute(async (ev, req) => {
  const state = votingStatus(ev);
  const data = await withEvent(ev.id, async (tx) => {
    const candidates = await tx`select c.id, c.number, c.name, c.photo_url, count(v.id)::int as votes
                                from candidates c
                                left join votes v on v.candidate_id = c.id
                                group by c.id, c.number, c.name, c.photo_url
                                order by c.number`;

    const totals = await tx`select
        (select count(*)::int from voters) as total_voters,
        (select count(*)::int from voters where has_voted) as voted,
        (select count(*)::int from votes) as total_votes`;

    const recent = await tx`select id, action, detail, created_at from audit_logs
                             where action in ('VOTE_CAST', 'VOTE_UPDATED', 'VOTES_RESET')
                             order by id desc limit 10`;

    return { candidates, totals: totals[0], recent };
  });

  if (new URL(req.url).searchParams.get("csv") === "1") {
    const L = labelsFor(ev.kind);
    const lines = [`Nomor;${L.calonPendek};Jumlah Suara;Persentase`];
    for (const r of data.candidates) {
      const pct = data.totals.total_votes ? ((r.votes / data.totals.total_votes) * 100).toFixed(1) : "0.0";
      lines.push(`${r.number};${r.name.replace(/;/g, ",")};${r.votes};${pct}%`);
    }
    lines.push(`;;Total Suara;${data.totals.total_votes}`);
    lines.push(`;;${L.pemilih} Terdaftar;${data.totals.total_voters}`);
    lines.push(`;;Sudah ${L.coblosKata};${data.totals.voted}`);
    return new NextResponse("" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rekap-${ev.slug}.csv"`,
      },
    });
  }

  return json({
    candidates: data.candidates,
    totals: data.totals,
    event: { slug: ev.slug, name: ev.name, kind: ev.kind },
    status: state.open ? "open" : "closed",
    status_label: state.label,
    status_reason: state.reason,
    vote_mode: ev.vote_mode === "live" ? "live" : "simulasi",
    recent: data.recent,
  });
});
