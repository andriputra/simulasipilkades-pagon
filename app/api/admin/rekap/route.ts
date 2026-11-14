import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { ensureSchema, sql } from "@/lib/db";

export async function GET(req: Request) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`select c.id, c.number, c.name, c.photo_url, count(v.id)::int as votes
                         from candidates c
                         left join votes v on v.candidate_id = c.id
                         group by c.id, c.number, c.name, c.photo_url
                         order by c.number`;
  const [tot] = await sql`select
      (select count(*)::int from voters) as total_voters,
      (select count(*)::int from voters where has_voted) as voted,
      (select count(*)::int from votes) as total_votes`;

  if (new URL(req.url).searchParams.get("csv") === "1") {
    const lines = ["Nomor;Nama Calon;Jumlah Suara;Persentase"];
    for (const r of rows) {
      const pct = tot.total_votes ? ((r.votes / tot.total_votes) * 100).toFixed(1) : "0.0";
      lines.push(`${r.number};${r.name.replace(/;/g, ",")};${r.votes};${pct}%`);
    }
    lines.push(`;;Total Suara;${tot.total_votes}`);
    lines.push(`;;Pemilih Terdaftar;${tot.total_voters}`);
    lines.push(`;;Sudah Mencoblos;${tot.voted}`);
    return new NextResponse("" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="rekap-pilkades.csv"',
      },
    });
  }

  const settingRows = await sql`select key, value from settings where key in ('election_status', 'vote_mode')`;
  const sm: Record<string, string> = {};
  for (const r of settingRows) sm[r.key] = r.value;
  const recent = await sql`select id, action, detail, created_at from audit_logs
                            where action in ('VOTE_CAST', 'VOTE_UPDATED', 'VOTES_RESET')
                            order by id desc limit 10`;

  return NextResponse.json({
    candidates: rows,
    totals: tot,
    status: sm.election_status === "closed" ? "closed" : "open",
    vote_mode: sm.vote_mode === "live" ? "live" : "simulasi",
    recent,
  });
}
