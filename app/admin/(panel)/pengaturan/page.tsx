"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none";

const btnPrimary =
  "w-full rounded-md bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60 sm:w-auto sm:min-w-[11rem]";
const btnGhost =
  "w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto sm:min-w-[9rem]";

function Icon({ path }: { path: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-400">{hint}</span>}
    </label>
  );
}

function SectionCard({
  icon,
  title,
  desc,
  tone = "blue",
  onSubmit,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  tone?: "blue" | "slate" | "red";
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  const tones = { blue: "bg-blue-50 text-blue-700", slate: "bg-slate-100 text-slate-600", red: "bg-red-100 text-red-600" };
  const className = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5";
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon path={icon} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-tight text-slate-800">{title}</h3>
          {desc && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{desc}</p>}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </>
  );
  return onSubmit ? (
    <form onSubmit={onSubmit} className={className}>
      {body}
    </form>
  ) : (
    <section className={className}>{body}</section>
  );
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [title1, setTitle1] = useState("");
  const [title2, setTitle2] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [mode, setMode] = useState<"simulasi" | "live">("simulasi");
  const [saving, setSaving] = useState(false);
  const [inviteDate, setInviteDate] = useState("");
  const [inviteTime, setInviteTime] = useState("");
  const [inviteTps, setInviteTps] = useState("");
  const [inviteAddress, setInviteAddress] = useState("");
  const [inviteWatermark, setInviteWatermark] = useState("");
  const [logoUrl, setLogoUrl] = useState("/seed/logo-desa.svg");
  const [inviteSaving, setInviteSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const s = await res.json();
          setTitle1(s.title_line1 || "");
          setTitle2(s.title_line2 || "");
          setStatus(s.election_status === "closed" ? "closed" : "open");
          setMode(s.vote_mode === "live" ? "live" : "simulasi");
          setInviteDate(s.invite_date || "Minggu 6 Desember 2026");
          setInviteTime(s.invite_time || "07:00 s/d 13:00 WIB");
          setInviteTps(s.invite_tps || "01 s/d 06");
          setInviteAddress(s.invite_address || "Desa Pagon, Purwadadi");
          setInviteWatermark(s.invite_watermark || "");
          setLogoUrl(s.logo_url || "/seed/logo-desa.svg");
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const pickLogo = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("File harus berupa gambar.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 256;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setLogoUrl(canvas.toDataURL("image/png"));
        toast("Logo dimuat. Jangan lupa Simpan Surat.", "info");
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title_line1: title1, title_line2: title2, election_status: status, vote_mode: mode }),
    });
    setSaving(false);
    if (!res.ok) {
      toast("Gagal menyimpan pengaturan.", "error");
      return;
    }
    toast("Pengaturan tersimpan.", "success");
  };

  const saveInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_date: inviteDate,
        invite_time: inviteTime,
        invite_tps: inviteTps,
        invite_address: inviteAddress,
        invite_watermark: inviteWatermark,
        logo_url: logoUrl,
      }),
    });
    setInviteSaving(false);
    if (!res.ok) {
      toast("Gagal menyimpan pengaturan surat.", "error");
      return;
    }
    toast("Pengaturan surat undangan tersimpan.", "success");
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confPw) {
      toast("Konfirmasi password tidak sama.", "error");
      return;
    }
    setPwBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: curPw, new_password: newPw }),
    });
    const data = await res.json().catch(() => ({}));
    setPwBusy(false);
    if (!res.ok) {
      toast(data.error || "Gagal mengganti password.", "error");
      return;
    }
    setCurPw("");
    setNewPw("");
    setConfPw("");
    toast("Password admin diganti.", "success");
  };

  const resetVotes = async () => {
    setConfirmReset(false);
    const res = await fetch("/api/admin/reset-votes", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast("Gagal mereset suara.", "error");
      return;
    }
    toast(`${data.deleted} suara dihapus, status pemilih direset.`, "success");
  };

  const pageHeader = (
    <div>
      <h2 className="text-lg font-bold text-slate-800">Pengaturan</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Judul layar kiosk, status pemungutan, isi surat undangan, keamanan akun, dan reset data simulasi.
      </p>
    </div>
  );

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {pageHeader}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
          {[2, 1].map((count) => (
            <div key={count} className="space-y-4">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <div className="h-8 w-8 rounded-md bg-slate-200" />
                  <div className="mt-4 space-y-3">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="h-10 rounded-md bg-slate-100" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {pageHeader}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <div className="space-y-4">
          <SectionCard
            title="Identitas & Status Pemungutan"
            desc="Ditampilkan di bagian atas layar kiosk."
            onSubmit={save}
            icon={
              <>
                <path d="M3 21h18M5 21V8l7-5 7 5v13" />
                <path d="M10 21v-5h4v5" />
              </>
            }
          >
            <Field label="Judul baris 1" hint="Nama pemerintah / desa penyelenggara.">
              <input value={title1} onChange={(e) => setTitle1(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Judul baris 2" hint="Keterangan pemilihan, misalnya periode jabatan.">
              <input value={title2} onChange={(e) => setTitle2(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Status pemungutan suara" hint="Menentukan apakah kiosk masih menerima pencoblosan.">
              <select value={status} onChange={(e) => setStatus(e.target.value as "open" | "closed")} className={inputCls}>
                <option value="open">Dibuka — kiosk menerima pencoblosan</option>
                <option value="closed">Ditutup — kiosk menampilkan pengumuman</option>
              </select>
            </Field>
            <div>
              <span className="block text-xs font-semibold text-slate-700">Mode data</span>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Aturan pemakaian kode undangan. Tekan &ldquo;Simpan Pengaturan&rdquo; untuk menerapkan.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["simulasi", "live"] as const).map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      aria-pressed={active}
                      className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? m === "live"
                            ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20"
                            : "border-blue-600 bg-blue-50 ring-2 ring-blue-600/20"
                          : "border-slate-300 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                            active ? "border-current" : "border-slate-400"
                          }`}
                        >
                          {active && <span className={`h-1.5 w-1.5 rounded-full ${m === "live" ? "bg-amber-600" : "bg-blue-700"}`} />}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{m === "live" ? "Live / Data Sebenarnya" : "Simulasi"}</span>
                      </span>
                      <span className="mt-1 block pl-5 text-[11px] leading-snug text-slate-600">
                        {m === "live"
                          ? "1 undangan = 1 suara. Kode yang sudah dicoblos ditolak kiosk dan suara tidak bisa diubah."
                          : "Kode boleh discan berulang, suara terakhir menimpa. Dipakai untuk latihan/demo."}
                      </span>
                    </button>
                  );
                })}
              </div>
              {mode === "live" && (
                <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
                  Pada mode live, pemilih yang sudah tercatat mencoblos langsung terkunci — termasuk suara hasil simulasi
                  sebelumnya. Bila ada yang salah coblos, buka kuncinya lewat tombol <b>Buka Kunci</b> di menu Pemilih &amp; QR.
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Menyimpan…" : "Simpan Pengaturan"}
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Surat Undangan (Lembar Cetak QR)"
            desc="Isi kop surat yang dicetak bersama kode QR pemilih."
            onSubmit={saveInvite}
            icon={
              <>
                <rect x="2.5" y="5" width="19" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Hari / Tanggal">
                <input value={inviteDate} onChange={(e) => setInviteDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Pukul">
                <input value={inviteTime} onChange={(e) => setInviteTime(e.target.value)} className={inputCls} />
              </Field>
              <Field label="TPS">
                <input value={inviteTps} onChange={(e) => setInviteTps(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Alamat">
                <input value={inviteAddress} onChange={(e) => setInviteAddress(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Watermark diagonal" hint="Kosongkan untuk surat tanpa watermark. Contoh: CONTOH.">
              <input
                value={inviteWatermark}
                onChange={(e) => setInviteWatermark(e.target.value)}
                placeholder="CONTOH"
                className={inputCls}
              />
            </Field>
            <div className="flex flex-col gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 sm:flex-row sm:items-center">
              <img
                src={logoUrl}
                alt="Pratinjau logo"
                className="mx-auto h-14 w-14 shrink-0 rounded border border-slate-200 bg-white object-contain p-1 sm:mx-0"
              />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-xs font-semibold text-slate-700">Logo kop surat</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  Format PNG atau JPG. Gambar besar otomatis dikecilkan ke lebar 256px.
                </p>
              </div>
              <button type="button" onClick={() => logoRef.current?.click()} className={btnGhost}>
                Ganti Logo
              </button>
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickLogo(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <a href="/admin/print" target="_blank" rel="noopener noreferrer" className={btnGhost}>
                Pratinjau Surat
              </a>
              <button type="submit" disabled={inviteSaving} className={btnPrimary}>
                {inviteSaving ? "Menyimpan…" : "Simpan Surat"}
              </button>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <SectionCard
            title="Ganti Password Admin"
            desc="Segera ganti password bawaan admin123."
            tone="slate"
            onSubmit={changePw}
            icon={
              <>
                <rect x="4" y="10.5" width="16" height="10" rx="2" />
                <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 14.5v2.5" />
              </>
            }
          >
            <Field label="Password lama">
              <input
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                autoComplete="current-password"
                required
                className={inputCls}
              />
            </Field>
            <Field label="Password baru" hint="Minimal 6 karakter.">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className={inputCls}
              />
            </Field>
            <Field label="Ulangi password baru">
              <input
                type="password"
                value={confPw}
                onChange={(e) => setConfPw(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className={inputCls}
              />
            </Field>
            <button type="submit" disabled={pwBusy} className={btnPrimary}>
              {pwBusy ? "Menyimpan…" : "Ganti Password"}
            </button>
          </SectionCard>

          <section className="rounded-lg border border-red-200 bg-red-50 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600">
                <Icon
                  path={
                    <>
                      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                      <path d="M12 9v4M12 17h.01" />
                    </>
                  }
                />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-tight text-red-700">Zona Berbahaya</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-red-600">
                  Menghapus seluruh suara masuk dan menandai semua pemilih sebagai belum mencoblos. Data pemilih, kode QR,
                  dan calon tetap aman.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="mt-4 w-full rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              Reset Semua Suara
            </button>
          </section>
        </div>
      </div>

      <ConfirmModal
        open={confirmReset}
        title="Reset semua suara?"
        message="Seluruh suara masuk akan dihapus dan semua pemilih ditandai belum mencoblos. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Reset Sekarang"
        onConfirm={resetVotes}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
