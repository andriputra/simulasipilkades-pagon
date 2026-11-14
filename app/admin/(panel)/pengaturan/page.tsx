"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

export default function AdminSettingsPage() {
  const toast = useToast();
  const [title1, setTitle1] = useState("");
  const [title2, setTitle2] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [saving, setSaving] = useState(false);
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
      }
    })();
  }, []);

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
