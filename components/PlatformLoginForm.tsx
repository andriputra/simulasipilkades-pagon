"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Form masuk konsol. Sengaja tidak ada akun bawaan maupun petunjuk kredensial:
 * akun dibuat lewat `npm run superadmin -- <username>` dengan password dari stdin.
 */
export default function PlatformLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/platform/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Gagal masuk.");
      return;
    }
    router.push("/platform");
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4">
      <div className="relative w-full max-w-sm">
        <span className="pointer-events-none absolute -top-2 -left-2 h-8 w-8 rounded-tl border-l-4 border-t-4 border-violet-500" />
        <span className="pointer-events-none absolute -top-2 -right-2 h-8 w-8 rounded-tr border-r-4 border-t-4 border-violet-500" />
        <span className="pointer-events-none absolute -bottom-2 -left-2 h-8 w-8 rounded-bl border-b-4 border-l-4 border-violet-500" />
        <span className="pointer-events-none absolute -bottom-2 -right-2 h-8 w-8 rounded-br border-b-4 border-r-4 border-violet-500" />

        <form onSubmit={submit} className="rounded-xl bg-white p-6 shadow-2xl">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-violet-600 text-lg font-extrabold text-white">
              SP
            </span>
            <h1 className="mt-3 text-lg font-bold text-slate-900">Superadmin Platform</h1>
            <p className="mt-1 text-xs text-slate-500">Konsol pengelolaan simulasi pemilihan</p>
          </div>

          <label className="mt-5 block text-xs font-semibold text-slate-600">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-violet-500 focus:outline-none"
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
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-violet-500 focus:outline-none"
              required
            />
          </label>

          {error && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-md bg-violet-700 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
          >
            {loading ? "Memproses…" : "MASUK KONSOL"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-[10px] text-slate-600">
        developed by{" "}
        <a href="https://flexbox.id" target="_blank" rel="noreferrer" className="hover:text-slate-400">
          Flexbox Indonesia
        </a>
      </p>
    </div>
  );
}
