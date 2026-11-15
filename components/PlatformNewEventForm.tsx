"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { EVENT_KIND_LABELS, EVENT_KINDS, EVENT_VOTE_MODES, labelsFor, lower } from "@/lib/event-meta";

/** Disamakan dengan slugify() di lib/platform.ts — versi klien untuk saran URL. */
function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const fieldCls =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-violet-500 focus:outline-none";
const labelCls = "block text-xs font-semibold text-slate-600";

export default function PlatformNewEventForm() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<string>("pilkades");
  const [voteMode, setVoteMode] = useState<string>("simulasi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const L = labelsFor(kind);

  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(suggestSlug(v));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/platform/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, kind, status: "draft", vote_mode: voteMode }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Gagal membuat simulasi.");
      toast(data.error || "Gagal membuat simulasi.", "error");
      return;
    }
    toast(`Simulasi dibuat. Lengkapi data ${lower(L.calonPendek)} & ${lower(L.pemilih)} di panel panitia.`, "success");
    router.push(`/platform/e/${data.slug}`);
  };

  return (
    <form onSubmit={submit} className="max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800">Identitas simulasi</h3>
      <p className="mt-1 text-xs text-slate-500">
        Baru dibuat dalam status <b>Draf</b> dan belum menerima suara. Data {lower(L.calonPendek)}, {lower(L.pemilih)}, dan
        pengaturan tampilan diisi oleh panitia di panel <span className="font-mono">/e/…/admin</span>.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={`${labelCls} sm:col-span-2`}>
          Nama simulasi
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="mis. Simulasi Pilkades Desa Sukamaju 2027"
            maxLength={80}
            className={fieldCls}
            required
          />
        </label>

        <label className={labelCls}>
          URL (opsional)
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">/e/</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }}
              placeholder="pilkades-sukamaju-2027"
              maxLength={60}
              className={`${fieldCls} mt-0 font-mono text-xs`}
            />
          </div>
        </label>

        <label className={labelCls}>
          Jenis pemilihan
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={fieldCls}>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {EVENT_KIND_LABELS[k] || k}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] leading-snug text-slate-500">
            Sebutan otomatis: <b>{L.calon}</b> · <b>{L.pemilih}</b> · <b>{L.lokasi}</b> · tombol <b>{L.coblos}</b> ·{" "}
            <b>{L.surat}</b>
          </span>
        </label>

        <label className={`${labelCls} sm:col-span-2`}>
          Mode {L.coblosKata}
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {EVENT_VOTE_MODES.map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  voteMode === m ? "border-violet-500 bg-violet-50 text-slate-800" : "border-slate-300 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="vote_mode"
                  value={m}
                  checked={voteMode === m}
                  onChange={() => setVoteMode(m)}
                  className="mt-0.5"
                />
                <span>
                  <b className="block text-[13px]">{m === "live" ? "Live (pilihan nyata)" : "Simulasi (boleh diulang)"}</b>
                  <span className="text-[11px] text-slate-500">
                    {m === "live"
                      ? `Satu ${lower(L.pemilih)} hanya bisa ${L.coblosKata} sekali; suara terkunci setelah masuk.`
                      : "QR boleh discan berulang, suara terakhir menimpa yang lama."}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
        >
          {busy ? "Menyimpan…" : "Buat Simulasi"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/platform")}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
