"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";

const fieldCls =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-violet-500 focus:outline-none";
const labelCls = "block text-xs font-semibold text-slate-600";

/**
 * Ganti akun panitia yang dipakai masuk ke /e/[slug]/admin.
 * Disimpan sebagai admin_username + admin_password_hash di event_settings —
 * mekanisme yang sama dengan menu Pengaturan di panel panitia, hanya di sini
 * panelnya belum bisa dibuka.
 */
export default function PlatformCredentialsForm({ slug, username, configured }: { slug: string; username: string; configured: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ username, password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/platform/e/${slug}/credentials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan kredensial.");
      toast(data.error || "Gagal menyimpan kredensial.", "error");
      return;
    }
    setForm((f) => ({ ...f, password: "" }));
    toast(configured ? "Kredensial panitia diperbarui." : "Kredensial panitia dibuat.", "success");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Kredensial panitia</h3>
          <p className="mt-1 text-xs text-slate-500">
            {configured ? (
              <>
                Saat ini aktif untuk username <b className="font-mono">{username}</b>.
              </>
            ) : (
              <>
                Belum ada password panitia. Panel <span className="font-mono">/e/{slug}/admin</span> masih ditutup
                dan tombol &quot;Panel&quot; di daftar simulasi akan menolak.
              </>
            )}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {configured ? "SIAP" : "BELUM ADA"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Username panitia
          <input
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "-") }))}
            maxLength={32}
            className={`${fieldCls} font-mono`}
            required
          />
        </label>
        <label className={labelCls}>
          Password baru
          <div className="flex items-center gap-2">
            <input
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="minimal 8 karakter"
              maxLength={100}
              className={fieldCls}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="mt-1 shrink-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {show ? "Sembunyi" : "Lihat"}
            </button>
          </div>
        </label>
      </div>

      {error && <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || form.password.length < 8}
          className="rounded-md bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {busy ? "Menyimpan…" : configured ? "Ganti Kredensial" : "Buat Kredensial"}
        </button>
        <span className="text-[11px] text-slate-500">
          Sesi panitia yang sedang login di browser lain tidak otomatis putus; mereka perlu masuk ulang dengan password baru.
        </span>
      </div>
    </form>
  );
}
