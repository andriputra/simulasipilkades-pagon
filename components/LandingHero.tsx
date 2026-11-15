"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export type LandingEvent = {
  slug: string;
  name: string;
  kindLabel: string;
  title1: string;
  title2: string;
  open: boolean;
  statusLabel: string;
  statusReason: string;
  voteMode: "live" | "simulasi";
  window: string;
  voters: number;
  voted: number;
  candidates: number;
  votes: number;
};

type Props = { events: LandingEvent[]; initialActive: number };

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useCountUp(value: number, reduced: boolean) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Tab latar bisa menunda requestAnimationFrame: pastikan angka final tetap tampil.
    const bail = window.setTimeout(() => setShown(value), 1400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(bail);
    };
  }, [value, reduced]);
  return shown;
}

const delay = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties;

export default function LandingHero({ events, initialActive }: Props) {
  const [active, setActive] = useState(initialActive);
  const [highlight, setHighlight] = useState(0);
  const [mounted, setMounted] = useState(false);
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);

  const ev = events[active];
  const shownVotes = useCountUp(ev?.votes ?? 0, reduced);
  const shownVoters = useCountUp(ev?.voters ?? 0, reduced);
  const shownCandidates = useCountUp(ev?.candidates ?? 0, reduced);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-rise]"));
    if (!nodes.length) return;
    // Menyembunyikan dilakukan dari sisi klien: tanpa JavaScript, markup hasil
    // server tetap tampil penuh.
    root.classList.add("rise-on");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    const bail = window.setTimeout(() => nodes.forEach((n) => n.classList.add("is-in")), 1600);
    return () => {
      io.disconnect();
      window.clearTimeout(bail);
    };
  }, []);

  // Kartu suara contoh: pindai berpindah lalu memberi tanda silang, lalu berulang.
  useEffect(() => {
    if (!ev || reduced) return;
    const jumlah = Math.max(1, Math.min(ev.candidates || 4, 4));
    let timer = 0;
    const cycle = () => {
      timer = window.setTimeout(() => {
        setHighlight((h) => (h + 1) % (jumlah + 1));
        cycle();
      }, 1600);
    };
    cycle();
    return () => window.clearTimeout(timer);
  }, [ev, reduced]);

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 11).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const until = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.removeProperty("--ry");
    e.currentTarget.style.removeProperty("--rx");
  };

  const pills = ev ? Array.from({ length: Math.max(Math.min(ev.candidates, 4), 1) }) : [];
  const presence = ev && ev.voters > 0 ? Math.round((ev.voted / ev.voters) * 100) : 0;
  const ring = 2 * Math.PI * 26;

  return (
    <main ref={stage} className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Latar berlapis: grid halus, dua cahaya melayang, dan berkas sapuan. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,#0b2a3f_0%,#020617_58%,#000_100%)]" />
        <div className="grid-pan absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="orb absolute -left-24 top-8 h-[26rem] w-[26rem] rounded-full bg-emerald-500/20 blur-[110px]" />
        <div className="orb orb-slow absolute -right-20 bottom-0 h-[24rem] w-[24rem] rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="beam absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-200/10 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
        <header data-rise className="flex items-center justify-between gap-4 py-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300/90">
            Simulasi Pemilihan Digital
          </span>
          {ev && (
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200">
              <span className={ev.open ? "live-dot h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 rounded-full bg-slate-400"} />
              {ev.statusLabel}
            </span>
          )}
        </header>

        {!ev ? (
          <section data-rise className="flex flex-1 flex-col justify-center py-20">
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Pemilihan digital, dari undangan sampai rekap</h1>
            <p className="mt-5 max-w-xl text-sm text-slate-300 sm:text-base">
              Belum ada simulasi yang dibuat. Masuk ke konsol platform untuk membuat simulasi pertama, lalu halaman ini akan
              menampilkannya otomatis.
            </p>
            <Link href="/platform/login" className="mt-8 inline-flex w-fit rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">
              Buka Konsol Platform
            </Link>
          </section>
        ) : (
          <section key={ev.slug} className="grid flex-1 items-center gap-10 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-10">
            <div>
              <p data-rise style={delay(60)} className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                {ev.kindLabel} · mode {ev.voteMode}
              </p>
              <h1 data-rise style={delay(120)} className="fade-up mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                {ev.title1}
              </h1>
              {ev.title2 && (
                <p data-rise style={delay(200)} className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
                  {ev.title2}
                </p>
              )}

              <div data-rise style={delay(280)} className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={`/e/${ev.slug}`}
                  className="group relative overflow-hidden rounded-lg bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_40px_-8px_rgba(16,185,129,0.8)] transition hover:bg-emerald-400"
                >
                  <span className="relative">Masuk ke Bilik Suara</span>
                  <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-700 group-hover:translate-x-full" />
                </Link>
                <a href="#cara" className="rounded-lg border border-white/15 px-5 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/60 hover:text-white">
                  Cara kerjanya
                </a>
              </div>

              <dl data-rise style={delay(360)} className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
                {[
                  { k: "Calon", v: shownCandidates },
                  { k: "Pemilih terdaftar", v: shownVoters },
                  { k: "Suara masuk", v: shownVotes },
                ].map((s) => (
                  <div key={s.k}>
                    <dd className="text-3xl font-bold tabular-nums text-white sm:text-4xl">{s.v}</dd>
                    <dt className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{s.k}</dt>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="6" />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={ring}
                      strokeDashoffset={mounted ? ring - (ring * presence) / 100 : ring}
                      style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.7,0.2,1)" }}
                    />
                  </svg>
                  <div>
                    <dd className="text-2xl font-bold tabular-nums text-white">{presence}%</dd>
                    <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-400">sudah memilih</dt>
                  </div>
                </div>
              </dl>
            </div>

            {/* Kartu suara contoh: miring mengikuti kursor, pindai berpindah, lalu tercap. */}
            <div data-rise style={delay(200)} className="relative mx-auto w-full max-w-sm" onPointerMove={tilt} onPointerLeave={until}>
              <Link href={`/e/${ev.slug}`} className="tilt-card block">
                <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
                  <span className="tilt-sheen pointer-events-none absolute inset-0 rounded-2xl" />
                  <span className="pointer-events-none absolute -top-2 -left-2 h-8 w-8 rounded-tl border-t-4 border-l-4 border-emerald-400" />
                  <span className="pointer-events-none absolute -top-2 -right-2 h-8 w-8 rounded-tr border-t-4 border-r-4 border-emerald-400" />
                  <span className="pointer-events-none absolute -bottom-2 -left-2 h-8 w-8 rounded-bl border-b-4 border-l-4 border-emerald-400" />
                  <span className="pointer-events-none absolute -bottom-2 -right-2 h-8 w-8 rounded-br border-b-4 border-r-4 border-emerald-400" />
                  <div className="scan-line pointer-events-none absolute left-0 h-0.5 w-full bg-emerald-400/70 shadow-[0_0_12px_2px_rgba(52,211,153,0.6)]" />

                  <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">Surat Suara</p>
                  <p className="mt-1 truncate text-center text-sm font-bold text-white">{ev.name}</p>

                  <ul className="mt-5 space-y-2.5">
                    {pills.map((_, i) => {
                      const picked = highlight === pills.length;
                      const current = i === highlight % pills.length;
                      return (
                        <li
                          key={i}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition duration-500 ${
                            current ? "border-emerald-300/70 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                            {i + 1}
                          </span>
                          <span className="h-2.5 flex-1 rounded-full bg-gradient-to-r from-slate-500/70 to-slate-600/40" />
                          {picked && (
                            <span className="seal-drop flex h-7 w-7 items-center justify-center rounded-full border-2 border-emerald-300 text-emerald-300">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <p className="mt-5 text-center text-[11px] text-slate-400">
                    {ev.window ? `${ev.window} · ` : ""}satu pemilih satu suara
                  </p>
                </div>
              </Link>
            </div>
          </section>
        )}

        {events.length > 1 && (
          <nav data-rise style={delay(420)} className="flex flex-wrap items-center gap-2 border-t border-white/5 py-5">
            <span className="mr-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">Simulasi</span>
            {events.map((e, i) => (
              <button
                key={e.slug}
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active}
                aria-label={`${e.name} — ${e.statusLabel}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  i === active
                    ? "border-emerald-300/70 bg-emerald-400/15 text-emerald-200"
                    : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
                }`}
              >
                {e.name}
                <span className="ml-2 text-[10px] uppercase tracking-wide opacity-70">{e.statusLabel}</span>
              </button>
            ))}
          </nav>
        )}

        <section id="cara" className="scroll-mt-8 border-t border-white/5 py-14">
          <h2 data-rise className="text-lg font-bold text-white sm:text-xl">Tiga langkah sampai suara tercatat</h2>
          <div className="relative mt-8 grid gap-5 sm:grid-cols-3">
            <svg aria-hidden viewBox="0 0 300 8" preserveAspectRatio="none" className="absolute left-0 top-5 hidden h-2 w-full sm:block">
              <path d="M0 4 H300" stroke="rgba(52,211,153,0.35)" strokeWidth="1.5" className="dash-flow" fill="none" />
            </svg>
            {[
              {
                t: "Pindai kode pemilih",
                d: "Kamera membaca QR pada undangan, atau panitia memasukkan kode pemilih secara manual.",
                icon: "M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 12h8",
              },
              {
                t: "Pilih satu calon",
                d: "Surat suara tampil di layar. Satu pilihan, tanpa nama pemilih ikut tersimpan di rekap.",
                icon: "M5 5h14v14H5z M9 12l2 2 4-5",
              },
              {
                t: "Konfirmasi & tercatat",
                d: "Suara masuk rekap seketika, dan setiap aksi meninggalkan jejak di audit log yang bisa diunduh.",
                icon: "M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7z M9 12l2 2 4-4",
              },
            ].map((s, i) => (
              <div key={s.t} data-rise style={delay(120 * i)} className="relative rounded-xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:border-emerald-300/50 hover:bg-white/[0.07]">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.icon} />
                  </svg>
                </span>
                <p className="mt-4 text-sm font-bold text-white">
                  <span className="mr-2 tabular-nums text-emerald-300">{i + 1}.</span>
                  {s.t}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <footer data-rise className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 py-6 text-[11px] text-slate-500">
          <span>{ev ? `Kiosk aktif: /e/${ev.slug} · ${ev.statusReason}` : "Platform simulasi pemilihan"}</span>
          <span className="flex items-center gap-4">
            {ev && (
              <Link href={`/e/${ev.slug}/undangan`} className="transition hover:text-slate-300">
                Halaman Undangan
              </Link>
            )}
            {ev && (
              <Link href={`/e/${ev.slug}/admin/login`} className="transition hover:text-slate-300">
                Masuk Panitia
              </Link>
            )}
            <span>developed by Flexbox Indonesia</span>
          </span>
        </footer>
      </div>
    </main>
  );
}
