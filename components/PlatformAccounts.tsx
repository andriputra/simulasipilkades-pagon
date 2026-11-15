"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

type Akun = { id: number; username: string; name: string; created_at: string; last_login_at: string | null; sessions: number };
type Sesi = { id: number; username: string; name: string; ip: string; user_agent: string; last_seen_at: string; expires_at: string };

const fieldCls =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-normal focus:border-violet-500 focus:outline-none";
const labelCls = "block text-[11px] font-semibold text-slate-600";

function waktu(v: string | null): string {
  if (!v) return "-";
  return new Date(v).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Akun konsol + sesi aktif. Sesi bisa dicabut tanpa mengubah password. */
export default function PlatformAccounts({
  me,
  users,
  sessions,
}: {
  me: number;
  users: Akun[];
  sessions: Sesi[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ username: "", name: "", password: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [reset, setReset] = useState<{ id: number; username: string; password: string } | null>(null);
  const [askDelete, setAskDelete] = useState<Akun | null>(null);

  const tambah = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("create");
    const res = await fetch("/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast(data.error || "Gagal membuat akun.", "error");
      return;
    }
    toast(`Akun "${data.username}" dibuat.`, "success");
    setForm({ username: "", name: "", password: "" });
    router.refresh();
  };

  const gantiPassword = async () => {
    if (!reset) return;
    setBusy("reset");
    const res = await fetch(`/api/platform/users/${reset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: reset.password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast(data.error || "Gagal mengganti password.", "error");
      return;
    }
    setReset(null);
    if (data.sendiri) {
      toast("Password Anda diganti. Semua sesi di browser lain sudah dicabut — masuk ulang ya.", "info");
      router.push("/platform/login");
      return;
    }
    toast(`Password diganti; ${data.revoked} sesi dicabut.`, "success");
    router.refresh();
  };

  const hapus = async () => {
    if (!askDelete) return;
    setBusy("delete");
    const res = await fetch(`/api/platform/users/${askDelete.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setAskDelete(null);
    if (!res.ok) {
      toast(data.error || "Gagal menghapus akun.", "error");
      return;
    }
    toast("Akun dihapus beserta sesi aktifnya.", "success");
    router.refresh();
  };

  const cabut = async (id: number) => {
    setBusy(`s${id}`);
    const res = await fetch(`/api/platform/sessions/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast(data.error || "Gagal mencabut sesi.", "error");
      return;
    }
    toast(`Sesi #${id} dicabut.`, "success");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-800">Akun konsol platform</h3>
          <p className="text-xs text-slate-500">
            {users.length} akun. Akun konsol berbeda dari akun panitia: akun konsol mengelola semua simulasi, akun
            panitia hanya satu simulasi.
          </p>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2">Username</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">Masuk terakhir (WIB)</th>
              <th className="px-4 py-2 text-right">Sesi aktif</th>
              <th className="px-5 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-2 font-mono text-xs text-slate-700">
                  {u.username}
                  {u.id === me && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">ANDA</span>}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{u.name || "-"}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{waktu(u.last_login_at)}</td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-slate-700">{u.sessions}</td>
                <td className="whitespace-nowrap px-5 py-2 text-right">
                  <button
                    onClick={() => setReset({ id: u.id, username: u.username, password: "" })}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Ganti Password
                  </button>
                  <button
                    onClick={() => setAskDelete(u)}
                    disabled={u.id === me}
                    title={u.id === me ? "Anda sedang masuk dengan akun ini" : "Hapus akun"}
                    className="ml-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={tambah} className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <label className={`${labelCls} w-40`}>
            Username baru
            <input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "-") }))}
              maxLength={32}
              className={`${fieldCls} font-mono`}
              required
            />
          </label>
          <label className={`${labelCls} w-44`}>
            Nama display
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={60} className={fieldCls} />
          </label>
          <label className={`${labelCls} min-w-[14rem] flex-1`}>
            Password (min. 10 karakter)
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              maxLength={100}
              className={fieldCls}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy === "create"}
            className="rounded-md bg-violet-700 px-3 py-2 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
          >
            {busy === "create" ? "Menyimpan…" : "Tambah Akun"}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-800">Sesi konsol aktif</h3>
          <p className="text-xs text-slate-500">
            {sessions.length} sesi berjalan (maks. 40 terbaru). Cabut sesi laptop/HP yang tidak Anda kenali — password
            tidak perlu diganti.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2">#</th>
              <th className="px-4 py-2">Akun</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Peramban</th>
              <th className="px-4 py-2">Terakhir aktif (WIB)</th>
              <th className="px-4 py-2">Kedaluwarsa (WIB)</th>
              <th className="px-5 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-5 py-2 font-mono text-[11px] text-slate-400">{s.id}</td>
                <td className="px-4 py-2 text-xs text-slate-700">{s.username}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{s.ip || "-"}</td>
                <td className="max-w-[16rem] truncate px-4 py-2 text-[11px] text-slate-500" title={s.user_agent}>
                  {s.user_agent || "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-[11px] text-slate-500">{waktu(s.last_seen_at)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-[11px] text-slate-500">{waktu(s.expires_at)}</td>
                <td className="px-5 py-2 text-right">
                  <button
                    onClick={() => cabut(s.id)}
                    disabled={busy === `s${s.id}`}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busy === `s${s.id}` ? "…" : "Cabut"}
                  </button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-xs text-slate-400">
                  Tidak ada sesi aktif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reset && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 px-4" role="dialog" aria-modal="true">
          <div className="pop-in w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Ganti password “{reset.username}”</h3>
            <p className="mt-2 text-xs text-slate-600">
              Semua sesi akun ini ikut dicabut. Bila Anda mengganti password sendiri, halaman ini akan meminta masuk ulang.
            </p>
            <input
              type="password"
              autoFocus
              value={reset.password}
              onChange={(e) => setReset({ ...reset, password: e.target.value })}
              placeholder="minimal 10 karakter"
              maxLength={100}
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setReset(null)}
                className="rounded-md border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={gantiPassword}
                disabled={busy === "reset" || reset.password.length < 10}
                className="rounded-md bg-violet-700 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {busy === "reset" ? "Menyimpan…" : "Ganti"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(askDelete)}
        title="Hapus akun konsol?"
        message={`Akun ${askDelete?.username ?? ""} dan seluruh sesinya dihapus. Simulasi tidak ikut terhapus.`}
        confirmLabel="Ya, hapus akun"
        onConfirm={hapus}
        onCancel={() => setAskDelete(null)}
      />
    </div>
  );
}
