"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEventLabels } from "@/components/EventLabels";
import { useToast } from "@/components/Toast";
import { useEventPaths } from "@/lib/use-event-slug";

export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const L = useEventLabels();
  const { slug, pageBase, apiBase, kiosk } = useEventPaths();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`${apiBase}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Gagal masuk.");
      toast(data.error || "Gagal masuk.", "error");
      return;
    }
    toast(`Berhasil masuk ke ${L.panel}.`, "success");
    router.push(`${pageBase}/admin`);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4">
      <div className="relative w-full max-w-sm">
        <span className="pointer-events-none absolute -top-2 -left-2 h-8 w-8 rounded-tl border-l-4 border-t-4 border-blue-500" />
        <span className="pointer-events-none absolute -top-2 -right-2 h-8 w-8 rounded-tr border-r-4 border-t-4 border-blue-500" />
        <span className="pointer-events-none absolute -bottom-2 -left-2 h-8 w-8 rounded-bl border-b-4 border-l-4 border-blue-500" />
        <span className="pointer-events-none absolute -bottom-2 -right-2 h-8 w-8 rounded-br border-b-4 border-l-4 border-blue-500" />

        <form onSubmit={submit} className="rounded-xl bg-white p-6 shadow-2xl">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md text-lg font-extrabold text-white bg-blue-600">
              {L.monogram}
            </span>
            <h1 className="mt-3 text-lg font-bold text-slate-900">Admin {L.panel}</h1>
            <p className="mt-1 text-xs text-slate-500">Masuk untuk mengelola data dan hasil simulasi</p>
          </div>

          <label className="mt-5 block text-xs font-semibold text-slate-600">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-blue-500 focus:outline-none"
              required
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-blue-500 focus:outline-none"
              required
            />
          </label>

          {error && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-md bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Memproses…" : "MASUK"}
          </button>

          <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-500">
            <Link href={kiosk} className="hover:text-blue-700 hover:underline">
              Buka halaman kiosk
            </Link>
            <a href="/seed/contoh-qr-penanda-pemilih.pdf" target="_blank" rel="noreferrer" className="hover:text-blue-700 hover:underline">
              Contoh lembar QR
            </a>
          </div>
        </form>
      </div>

      <p className="mt-6 max-w-sm text-center text-[10px] leading-relaxed text-slate-500">
        Akun panitia berlaku per simulasi (<b className="font-mono">{slug}</b>) — diatur panitia di menu Pengaturan,
        atau oleh Superadmin platform.
      </p>
      <p className="mt-2 text-[10px] text-slate-600">
        developed by{" "}
        <a href="https://flexbox.id" target="_blank" rel="noreferrer" className="hover:text-slate-400">
          Flexbox Indonesia
        </a>
      </p>
    </div>
  );
}
