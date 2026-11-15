import Link from "next/link";
import { notFound } from "next/navigation";
import PlatformCredentialsForm from "@/components/PlatformCredentialsForm";
import PlatformEventActions from "@/components/PlatformEventActions";
import PlatformEventForm from "@/components/PlatformEventForm";
import { EVENT_KIND_LABELS, EVENT_STATUS_LABELS, findEventBySlug, toWibInput, votingStatus } from "@/lib/event";
import { withEvent } from "@/lib/db";
import { getEventStats, readEventPanelStatus } from "@/lib/platform";

export const dynamic = "force-dynamic";

const ACTION_BADGE: Record<string, string> = {
  VOTE_CAST: "bg-blue-100 text-blue-700",
  VOTE_UPDATED: "bg-indigo-100 text-indigo-700",
  LOGIN_SUCCESS: "bg-emerald-100 text-emerald-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  VOTES_RESET: "bg-red-100 text-red-700",
  PASSWORD_CHANGED: "bg-amber-100 text-amber-700",
};

export default async function PlatformEventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await findEventBySlug(slug);
  if (!ev) notFound();

  const [stats, panel] = await Promise.all([getEventStats(ev.id), readEventPanelStatus(ev)]);
  const recent = await withEvent(ev.id, async (tx) =>
    (await tx`select id, action, detail, actor, ip, created_at from audit_logs order by id desc limit 8`) as unknown as {
      id: number;
      action: string;
      detail: string;
      actor: string;
      ip: string;
      created_at: string;
    }[],
  );

  const efektif = votingStatus(ev);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/platform" className="text-xs font-semibold text-violet-700 hover:underline">
          ← Daftar simulasi
        </Link>
        <h2 className="mt-2 text-lg font-bold text-slate-800">{ev.name}</h2>
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">/e/{ev.slug}</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {EVENT_KIND_LABELS[ev.kind] || ev.kind}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              ev.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
            }`}
          >
            {EVENT_STATUS_LABELS[ev.status] || ev.status}
          </span>
          {efektif.label !== (EVENT_STATUS_LABELS[ev.status] || ev.status) && (
            <span
              title={`${efektif.label}: ${efektif.reason}`}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                efektif.open ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              kiosk: {efektif.label.toLowerCase()}
            </span>
          )}
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {ev.vote_mode === "live" ? "mode live" : "mode simulasi"}
          </span>
          {ev.is_default && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">HALAMAN DEPAN</span>
          )}
        </p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <PlatformEventForm
            ev={{
              slug: ev.slug,
              name: ev.name,
              kind: ev.kind,
              status: ev.status,
              vote_mode: ev.vote_mode,
              opens_at: toWibInput(ev.opens_at),
              closes_at: toWibInput(ev.closes_at),
            }}
          />

          <PlatformCredentialsForm slug={ev.slug} username={panel.username} configured={panel.configured} />

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-800">Aktivitas terakhir simulasi ini</h3>
              <Link href={`/e/${ev.slug}/admin/audit`} className="text-[11px] font-semibold text-violet-700 hover:underline">
                Audit lengkap di panel →
              </Link>
            </div>
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-2 text-[11px] text-slate-400">{fmt(r.created_at)}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_BADGE[r.action] || "bg-slate-100 text-slate-600"}`}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{r.detail}</td>
                    <td className="whitespace-nowrap px-5 py-2 text-right text-[11px] text-slate-400">{r.actor}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-xs text-slate-400">
                      Belum ada aktivitas pada simulasi ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:sticky xl:top-4">
          <PlatformEventActions
            slug={ev.slug}
            name={ev.name}
            kind={ev.kind}
            status={ev.status}
            is_default={ev.is_default}
            voters={stats.voters}
            votes={stats.votes}
          />
        </div>
      </div>
    </div>
  );
}
