"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

export default function AdminSettingsPage() {
  const toast = useToast();
  const [title1, setTitle1] = useState("");
  const [title2, setTitle2] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
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
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const s = await res.json();
        setTitle1(s.title_line1 || "");
        setTitle2(s.title_line2 || "");
        setStatus(s.election_status === "closed" ? "closed" : "open");
        setInviteDate(s.invite_date || "Minggu 6 Desember 2026");
        setInviteTime(s.invite_time || "07:00 s/d 13:00 WIB");
        setInviteTps(s.invite_tps || "01 s/d 06");
        setInviteAddress(s.invite_address || "Desa Pagon, Purwadadi");
        setInviteWatermark(s.invite_watermark || "");
        setLogoUrl(s.logo_url || "/seed/logo-desa.svg");
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
        toast("Logo dimuat. Jangan lupa Simpan.", "info");
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title_line1: title1, title_line2: title2, election_status: status }),
    });
    setSaving(false);
    if (!res.ok) {
      toast("Gagal menyimpan pengaturan.", "error");
      return;
    }
    toast("Pengaturan tersimpan.", "success");
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

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Pengaturan</h2>
        <p className="text-xs text-slate-500">Judul layar kiosk, status pemungutan, keamanan akun, dan reset data simulasi.</p>
      </div>

      <form onSubmit={save} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">Identitas &amp; Status Pemungutan</h3>
        <label className="block text-[11px] font-semibold text-slate-600">
          Judul baris 1 (nama pemerintah/desa)
          <input
            value={title1}
            onChange={(e) => setTitle1(e.target.value)}
            className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-[11px] font-semibold text-slate-600">
          Judul baris 2 (keterangan pemilihan)
          <input
            value={title2}
            onChange={(e) => setTitle2(e.target.value)}
            className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-[11px] font-semibold text-slate-600">
          Status pemungutan suara
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "open" | "closed")}
            className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
          >
            <option value="open">Dibuka (kiosk menerima pencoblosan)</option>
            <option value="closed">Ditutup (kiosk menampilkan pengumuman)</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-blue-700 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan Pengaturan"}
        </button>
      </form>

      <form onSubmit={saveInvite} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800">Surat Undangan (Lembar Cetak QR)</h3>
          <img src={logoUrl} alt="Logo" className="h-12 w-auto rounded border border-slate-200 bg-white" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[11px] font-semibold text-slate-600">
            Hari / Tanggal
            <input
              value={inviteDate}
              onChange={(e) => setInviteDate(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-[11px] font-semibold text-slate-600">
            Pukul
            <input
              value={inviteTime}
              onChange={(e) => setInviteTime(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-[11px] font-semibold text-slate-600">
            TPS
            <input
              value={inviteTps}
              onChange={(e) => setInviteTps(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-[11px] font-semibold text-slate-600">
            Alamat
            <input
              value={inviteAddress}
              onChange={(e) => setInviteAddress(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
        </div>
        <label className="block text-[11px] font-semibold text-slate-600">
          Watermark diagonal (kosongkan untuk tanpa watermark, cth: CONTOH)
          <input
            value={inviteWatermark}
            onChange={(e) => setInviteWatermark(e.target.value)}
            placeholder="CONTOH"
            className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className="rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ganti Logo
          </button>
          <button
            type="submit"
            disabled={inviteSaving}
            className="rounded-md bg-blue-700 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {inviteSaving ? "Menyimpan…" : "Simpan Surat"}
          </button>
        </div>
      </form>

      <form onSubmit={changePw} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">Ganti Password Admin</h3>
        <input
          type="password"
          value={curPw}
          onChange={(e) => setCurPw(e.target.value)}
          placeholder="Password lama"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="Password baru (min 6 karakter)"
            required
            minLength={6}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={confPw}
            onChange={(e) => setConfPw(e.target.value)}
            placeholder="Ulangi password baru"
            required
            minLength={6}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pwBusy}
          className="w-full rounded-md bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pwBusy ? "Menyimpan…" : "Ganti Password"}
        </button>
      </form>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-bold text-red-700">Zona Berbahaya</h3>
        <p className="mt-1 text-xs text-red-600">
          Menghapus seluruh suara masuk dan menandai semua pemilih sebagai belum mencoblos. Gunakan untuk mengulang simulasi.
        </p>
        <button
          onClick={() => setConfirmReset(true)}
          className="mt-3 w-full rounded-md bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700"
        >
          Reset Semua Suara
        </button>
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
