"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

export type LandingEvent = {
  slug: string;
  name: string;
  kindLabel: string;
  modeLabel: string;
  statusLabel: string;
  open: boolean;
  window: string;
  tokenPrefix: string;
  voters: number;
  voted: number;
  votes: number;
  candidates: number;
};

export type LandingStats = { events: number; open: number; voters: number; votes: number };

type Props = { events: LandingEvent[]; stats: LandingStats; featured: LandingEvent | null };

const delay = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties;
const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------------------------------------------------------------------------
   Ikon: gambar garis 24×24 buatan sendiri supaya setnya seragam dan tidak
   bergantung pada pustaka ikon eksternal.
--------------------------------------------------------------------------- */

const ICONS = {
  undian: ["M3 6h18v12H3z", "m3.5 7 8.5 6 8.5-6"],
  kumpulan: [
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20",
    "M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M17 11a3 3 0 1 0 0-6",
    "M20 20v-1.6a3.5 3.5 0 0 0-2.4-3.3",
  ],
  pindai: ["M4 8V5h3", "M17 5h3v3", "M20 16v3h-3", "M7 19H4v-3", "M4 12h16"],
  kiosk: ["M4 5h16v11H4z", "M9 21h6", "M12 16v5", "M8.5 10.5 11 13l4.5-5"],
  rekap: ["M4 20h16", "M7 20v-5", "M12 20V9", "M17 20v-8"],
  petir: ["M13 3 6 14h5l-1 7 7-11h-5z"],
  unduh: ["M12 4v10", "M8 11l4 4 4-4", "M4 19h16"],
  lapisan: ["M12 4 4 8l8 4 8-4-8-4z", "M4 12.5 12 16.5l8-4", "M4 17 12 21l8-4"],
  perisai: ["M12 3l7 3.5v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9v-5z", "M9 12l2 2 4-4.5"],
  jam: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3.5 2"],
  kunci: ["M8 11V8a4 4 0 0 1 8 0v3", "M6 11h12v9H6z", "M12 15v2"],
  basis: [
    "M12 7c4.4 0 8-1.1 8-2.5S16.4 2 12 2 4 3.1 4 4.5 7.6 7 12 7z",
    "M4 4.5v15C4 20.9 7.6 22 12 22s8-1.1 8-2.5v-15",
    "M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5",
  ],
  kotak: ["M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z", "M9 10V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5", "M8.5 14.5h7"],
  gedung: ["M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16", "M3 21h18", "M9 8h2", "M13 8h2", "M9 12h2", "M13 12h2"],
  timbang: ["M12 4v16", "M6 8h12", "M6 8 3 14h6z", "M18 8l-3 6h6z"],
  cetakan: ["M7 9V4h10v5", "M5 9h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2", "M7 17H5a1 1 0 0 1-1-1v-5", "M7 14h10v6H7z"],
  tanya: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9.6 9.2A2.5 2.5 0 1 1 13 11.6c-.8.5-1 1.1-1 1.9v.4", "M12 17.2h.01"],
  chevron: ["m6 9 6 6 6-6"],
  setelan: ["M4 7h6", "M14 7h6", "M4 17h10", "M18 17h2", "M12 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z", "M16 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"],
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function BadgeIcon({ name }: { name: IconName }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] text-emerald-300">
      <Icon name={name} className="h-[22px] w-[22px]" />
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Gerak
--------------------------------------------------------------------------- */

/** Unsur [data-rise] baru disembunyikan setelah kelas rise-on dipasang dari klien,
 *  jadi hasil render server tetap terbaca penuh tanpa JavaScript. */
function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-rise]"));
    if (!nodes.length) return;
    el.classList.add("rise-on");

    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((n) => io.observe(n));

    // Tab di latar bisa menunda IntersectionObserver. Yang sudah berada di layar ikut
    // ditampilkan; yang di bawah garis lipat menunggu scroll supaya efektifnya terasa.
    const bail = window.setTimeout(() => {
      const tinggi = window.innerHeight || document.documentElement.clientHeight || 0;
      if (tinggi <= 0) {
        nodes.forEach((n) => n.classList.add("is-in"));
        return;
      }
      nodes.forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.top < tinggi && r.bottom > 0) n.classList.add("is-in");
      });
    }, 700);

    return () => {
      io.disconnect();
      window.clearTimeout(bail);
    };
  }, [root]);
}

function Counter({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced() || !("IntersectionObserver" in window)) {
      setShown(value);
      return;
    }

    let raf = 0;
    let mulai = 0;
    let selesai = false;
    const akhir = () => {
      if (selesai) return;
      selesai = true;
      setShown(value);
    };
    const langkah = (now: number) => {
      if (!mulai) mulai = now;
      const p = Math.min(1, (now - mulai) / 900);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(langkah);
      else selesai = true;
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          raf = requestAnimationFrame(langkah);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    const bail = window.setTimeout(akhir, 2000);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(bail);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString("id-ID")}
    </span>
  );
}

/** Motif kode dua dimensi: hiasan, bukan kode yang bisa dipindai. */
function CodeGlyph({ seed }: { seed: string }) {
  const n = 15;
  let x = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    x ^= seed.charCodeAt(i);
    x = Math.imul(x, 16777619) >>> 0;
  }
  const modul: React.ReactElement[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      const finder = (r < 6 && c < 6) || (r < 6 && c > n - 7) || (r > n - 7 && c < 6);
      if (finder) continue;
      if (((x >>> 8) % 100) < 44) modul.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} />);
    }
  }

  return (
    <svg viewBox={`0 0 ${n} ${n}`} fill="currentColor" aria-hidden className="h-full w-full text-slate-300">
      {modul}
      {[
        [1, 1],
        [n - 6, 1],
        [1, n - 6],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <rect x={cx} y={cy} width={5} height={5} fill="none" stroke="currentColor" strokeWidth={1} />
          <rect x={cx + 1.5} y={cy + 1.5} width={2} height={2} />
        </g>
      ))}
    </svg>
  );
}

function StatusChip({ open, label }: { open: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
      <span className={open ? "live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" : "h-1.5 w-1.5 rounded-full bg-slate-500"} />
      {label}
    </span>
  );
}

function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [buka, setBuka] = useState<number | null>(0);
  return (
    <ul className="mt-8 divide-y divide-white/[0.07] border-y border-white/[0.07]">
      {items.map((it, i) => {
        const aktif = buka === i;
        return (
          <li key={it.q}>
            <button
              type="button"
              onClick={() => setBuka(aktif ? null : i)}
              aria-expanded={aktif}
              className="flex w-full items-center gap-4 py-5 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-emerald-300">
                <Icon name="tanya" className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[14px] font-semibold text-white">{it.q}</span>
              <span className={`text-slate-500 transition-transform duration-300 ${aktif ? "rotate-180 text-emerald-300" : ""}`}>
                <Icon name="chevron" className="h-4 w-4" />
              </span>
            </button>
            {/* Transisi grid-template-rows membuat buka/tutup mulus tanpa melompat. */}
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${aktif ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <p className="pb-5 pl-12 pr-4 text-[13px] leading-relaxed text-slate-400">{it.a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
   Halaman
--------------------------------------------------------------------------- */

export default function Landing({ events, stats, featured }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useReveal(root);

  useEffect(() => {
    const id = window.setTimeout(() => setDrawn(true), 160);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hadir = featured ? pct(featured.voted, featured.voters) : 0;

  return (
    <div ref={root} className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-400/25">
      {/* Latar: satu cahaya lembut di kiri atas, grid halus yang memudar, dan lengkung tipis di kanan. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(115%_85%_at_18%_-12%,#0d2c40_0%,#06101f_46%,#020617_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[78vh] bg-[linear-gradient(rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.2)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(72%_58%_at_50%_0%,#000_8%,transparent_78%)]" />
        <svg viewBox="0 0 600 600" className="absolute -right-24 top-24 h-[34rem] w-[34rem] text-emerald-400/10" fill="none" stroke="currentColor">
          <circle cx="300" cy="300" r="298" />
          <circle cx="300" cy="300" r="228" />
          <circle cx="300" cy="300" r="158" strokeDasharray="3 7" />
        </svg>
      </div>

      <header
        className={`sticky top-0 z-20 transition-[background-color,border-color,backdrop-filter] duration-300 ${
          scrolled ? "border-b border-white/[0.07] bg-slate-950/80 backdrop-blur-md" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-400/30">
              <Icon name="kotak" className="h-5 w-5" />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-white">
              Flex<span className="text-emerald-300">Election</span>
            </span>
          </Link>

          {/* Jangkar memakai <a> biasa supaya halaman dinamis tidak dimuat ulang saat berpindah bagian. */}
          <nav className="hidden items-center gap-7 text-[13px] text-slate-400 md:flex">
            <a href="#keunggulan" className="transition hover:text-white">
              Keunggulan
            </a>
            <a href="#alur" className="transition hover:text-white">
              Alur
            </a>
            <a href="#keamanan" className="transition hover:text-white">
              Keamanan
            </a>
            <a href="#simulasi" className="transition hover:text-white">
              Simulasi berjalan
            </a>
            <a href="#tanya" className="transition hover:text-white">
              Tanya jawab
            </a>
          </nav>

          <Link
            href="/platform/login"
            className="rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-slate-200 transition hover:border-emerald-300/60 hover:text-white"
          >
            Masuk
          </Link>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <section className="grid items-start gap-12 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
          <div>
            <p className="hero-in inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90" style={at(0)}>
              <Icon name="petir" className="h-3.5 w-3.5" />
              Simulasi &amp; pemungutan suara digital
            </p>

            <h1 className="hero-in mt-6 text-[2.1rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.35rem]" style={at(80)}>
              Pemilihan digital yang hasilnya bisa <span className="text-emerald-300">diperiksa ulang</span>.
            </h1>

            <p className="hero-in mt-6 max-w-xl text-[15px] leading-relaxed text-slate-300" style={at(160)}>
              FlexElection memindahkan surat suara ke layar: pemilih memindai kode undangan, memilih satu calon, lalu rekap
              dan catatan auditnya langsung muncul di layar panitia. Satu konsol untuk menjalankan banyak pemilihan — dari
              simulasi Pilkades sampai polling internal — tanpa datanya tercampur.
            </p>

            <div className="hero-in mt-8 flex flex-wrap items-center gap-3" style={at(240)}>
              {featured ? (
                <Link
                  href={`/e/${featured.slug}`}
                  className="group inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                >
                  Buka papan suara
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5">
                    <Icon name="chevron" className="h-4 w-4 -rotate-90" />
                  </span>
                </Link>
              ) : (
                <Link href="/platform/login" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">
                  Buat simulasi pertama
                </Link>
              )}
              <a
                href="#alur"
                className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/60 hover:text-white"
              >
                Lihat alurnya
              </a>
            </div>

            <dl className="hero-in mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/[0.08] pt-7 sm:grid-cols-4" style={at(320)}>
              {[
                { k: "Simulasi dibuat", v: stats.events },
                { k: "Sedang dibuka", v: stats.open },
                { k: "Pemilih terdaftar", v: stats.voters },
                { k: "Suara tercatat", v: stats.votes },
              ].map((s) => (
                <div key={s.k}>
                  <dd className="text-[26px] font-bold tabular-nums text-white sm:text-[30px]">
                    <Counter value={s.v} />
                  </dd>
                  <dt className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{s.k}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Mock antarmuka: bilah alamat, kiosk di kiri, papan rekap di kanan. */}
          <div className="hero-in" style={at(200)}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-[0_50px_140px_-55px_rgba(0,0,0,0.95)]">
              <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                </span>
                <span className="flex-1 truncate rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-slate-400">
                  /e/{featured?.slug ?? "simulasi-anda"}
                </span>
              </div>

              <div className="grid sm:grid-cols-2">
                <div className="border-b border-white/[0.07] p-5 sm:border-b-0 sm:border-r">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Kode pemilih</p>
                      <p className="mt-1 truncate font-mono text-[12px] tracking-widest text-slate-300">
                        {featured?.tokenPrefix ?? "PKD"}-••••-••••
                      </p>
                    </div>
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.05] p-1.5">
                      <CodeGlyph seed={featured?.slug ?? "fleks"} />
                      <span className="scan-line absolute left-0 h-px w-full bg-emerald-300/70 shadow-[0_0_10px_1px_rgba(52,211,153,0.5)]" />
                    </div>
                  </div>

                  <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Surat suara</p>
                  <ul className="mt-2.5 space-y-2">
                    {["Calon 1", "Calon 2", "Calon 3"].map((c, i) => (
                      <li
                        key={c}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                          i === 1 ? "border-emerald-300/60 bg-emerald-400/10" : "border-white/[0.07] bg-white/[0.03]"
                        }`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[12px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span className="text-[12px] font-semibold text-slate-300">{c}</span>
                        {i === 1 && (
                          <span className="ml-auto text-emerald-300">
                            <svg viewBox="0 0 24 24" className="pop-in h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                              <path d="M5 12.5 10 17.5 19 7" />
                            </svg>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-slate-500">satu pemilih satu suara</p>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Papan rekap</p>
                    <StatusChip open={featured?.open ?? false} label={featured?.statusLabel ?? "Dibuka"} />
                  </div>

                  <ul className="mt-4 space-y-3.5">
                    {[
                      { l: "Calon 1", v: 38 },
                      { l: "Calon 2", v: 54 },
                      { l: "Calon 3", v: 8 },
                    ].map((b) => (
                      <li key={b.l}>
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className="text-slate-400">{b.l}</span>
                          <span className="tabular-nums text-slate-500">{b.v}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-[width] duration-[1200ms] ease-out ${b.v === 54 ? "bg-emerald-400" : "bg-slate-500/70"}`}
                            style={{ width: drawn ? `${b.v}%` : "0%" }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>

                  {featured && (
                    <div className="mt-5 border-t border-white/[0.07] pt-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Kehadiran {featured.name}</p>
                      <p className="mt-2 flex items-baseline gap-2">
                        <Counter value={featured.voted} className="text-2xl font-bold tabular-nums text-white" />
                        <span className="text-[12px] text-slate-400">dari {featured.voters.toLocaleString("id-ID")} pemilih · {hadir}%</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <p className="border-t border-white/[0.07] bg-white/[0.02] px-5 py-3 text-[10px] leading-relaxed text-slate-500">
                Contoh tata letak. Perolehan per calon hanya tampil di layar panitia; bagian bawah menampilkan angka
                kehadiran simulasi yang sedang berjalan.
              </p>
            </div>
          </div>
        </section>

        <section id="keunggulan" className="scroll-mt-24 border-t border-white/[0.07] py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 data-rise className="max-w-2xl text-xl font-bold tracking-tight text-white sm:text-2xl">
              Dibuat untuk kondisi lapangan, bukan untuk demo
            </h2>
            <p data-rise style={delay(80)} className="max-w-sm text-[13px] leading-relaxed text-slate-400">
              Pemilih tidak memasang aplikasi dan tidak membuat akun. Panitia cukup menyiapkan berkas daftar pemilih.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { i: "kumpulan" as IconName, t: "Daftar pemilih dari CSV", d: "Unggah nama dan NIK, tiap pemilih langsung mendapat kode unik yang bisa dicetak sebagai QR pada undangan." },
              { i: "pindai" as IconName, t: "Kiosk satu layar penuh", d: "Kamera membaca kode, atau panitia mengetiknya manual bila cahaya tidak membantu. Surat suara mengikuti jenis pemilihan." },
              { i: "petir" as IconName, t: "Rekap bergerak seketika", d: "Tiap suara yang masuk langsung mengubah angka dan bar di layar panitia, tanpa tombol hitung ulang." },
              { i: "unduh" as IconName, t: "Rekap & audit siap unduh", d: "Hasil, daftar pemilih, dan jejak audit keluar sebagai CSV — berkas yang sama dipakai saat hasil perlu diperiksa." },
              { i: "lapisan" as IconName, t: "Banyak pemilihan, satu konsol", d: "Tiap simulasi punya tautan, panitia, dan datanya sendiri. Hasilnya bisa dibandingkan tanpa tercampur." },
              { i: "setelan" as IconName, t: "Sebutan ikut jenis pemilihan", d: "Label calon, pemilih, dan coblos menyesuaikan Pilkades, pemilihan BEM, atau polling sehingga layar terasa milik panitia setempat." },
            ].map((f, i) => (
              <div
                key={f.t}
                data-rise
                style={delay((i % 3) * 80)}
                className="group rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-white/[0.055]"
              >
                <BadgeIcon name={f.i} />
                <h3 className="mt-4 text-[14px] font-bold text-white">{f.t}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{f.d}</p>
              </div>
            ))}
          </div>

          <p data-rise className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-2">
              <Icon name="gedung" className="h-4 w-4 text-slate-400" />
              Desa &amp; BPD
            </span>
            <span className="flex items-center gap-2">
              <Icon name="kumpulan" className="h-4 w-4 text-slate-400" />
              BEM, OSIS, kampus
            </span>
            <span className="flex items-center gap-2">
              <Icon name="kotak" className="h-4 w-4 text-slate-400" />
              Musyawarah RT/RW
            </span>
            <span className="flex items-center gap-2">
              <Icon name="rekap" className="h-4 w-4 text-slate-400" />
              Polling internal kantor
            </span>
            <span className="flex items-center gap-2">
              <Icon name="timbang" className="h-4 w-4 text-slate-400" />
              Latihan pemungutan suara
            </span>
          </p>
        </section>

        <section id="alur" className="scroll-mt-24 border-t border-white/[0.07] py-14">
          <h2 data-rise className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Empat langkah dari berkas CSV sampai berita acara
          </h2>

          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: "cetakan" as IconName, t: "Siapkan panitia & calon", d: "Buat simulasi di konsol, tentukan nomor urut dan nama calon, lalu beri akun panitia untuk tiap lokasi." },
              { i: "undian" as IconName, t: "Cetak undangan ber-QR", d: "Undangan memuat kode satu pemilih. Bisa dibuka lewat tautan atau dicetak untuk dibagikan." },
              { i: "kiosk" as IconName, t: "Coblos di layar", d: "Kode dikenali, surat suara tampil, satu pilihan tersimpan. Kode kedua ditolak pada mode langsung." },
              { i: "unduh" as IconName, t: "Rekap & serahkan", d: "Unduh rekap dan audit log, tutup jadwal, lalu arsipkan simulasi tanpa menghapus datanya." },
            ].map((s, i) => (
              <li key={s.t} data-rise style={delay(i * 80)} className="relative">
                <div className="flex items-center gap-3">
                  <BadgeIcon name={s.i} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                    Langkah {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] font-bold text-white">{s.t}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="keamanan" className="scroll-mt-24 border-t border-white/[0.07] py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 data-rise className="max-w-2xl text-xl font-bold tracking-tight text-white sm:text-2xl">
              Yang membuat hasilnya bisa dipertanggungjawabkan
            </h2>
            <p data-rise style={delay(80)} className="max-w-sm text-[13px] leading-relaxed text-slate-400">
              Bukan janji keamanan umum — ini hal yang memang ditegakkan di aplikasi dan basis datanya.
            </p>
          </div>

          <div className="mt-9 grid gap-x-12 sm:grid-cols-2">
            {[
              { i: "basis" as IconName, t: "Kunci di tingkat baris", d: "Semua baris suara memikul event_id dan kebijakan Row Level Security membatasi tiap koneksi pada satu simulasi. Aplikasi terhubung memakai role basis data tanpa hak bypass." },
              { i: "timbang" as IconName, t: "Dua mode pemungutan", d: "Mode langsung mengunci satu undangan untuk satu suara dan menolak pemakaian kedua. Mode simulasi membolehkan pengulangan, dan setiap perubahan tercatat sebagai pembaruan suara." },
              { i: "jam" as IconName, t: "Jendela waktu", d: "Suara hanya diterima di antara jam buka dan tutup yang diatur panitia. Di luar rentang itu kiosk menolak, termasuk bila halaman dibiarkan terbuka." },
              { i: "perisai" as IconName, t: "Jejak audit", d: "Suara masuk, perubahan calon, impor pemilih, sampai reset suara dicatat dengan aktor, alamat IP, dan waktunya, lalu bisa disaring dan diunduh." },
              { i: "kunci" as IconName, t: "Masuk panitia dibatasi", d: "Kata sandi disimpan sebagai hash scrypt dan percobaan login yang gagal berulang dibatasi per alamat, jadi panel tidak bisa ditebak satu per satu." },
              { i: "kumpulan" as IconName, t: "Rekap tanpa nama pemilih", d: "Layar rekap hanya menampilkan jumlah per calon. Tautan kode pemilih–pilihan tersimpan di basis data untuk pemeriksaan bila hasil digugat." },
            ].map((k, i) => (
              <div key={k.t} data-rise style={delay((i % 2) * 80)} className="flex gap-4 border-t border-white/[0.07] py-5">
                <BadgeIcon name={k.i} />
                <div>
                  <h3 className="text-[14px] font-bold text-white">{k.t}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{k.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="simulasi" className="scroll-mt-24 border-t border-white/[0.07] py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 data-rise className="text-xl font-bold tracking-tight text-white sm:text-2xl">Simulasi yang berjalan</h2>
            <p data-rise style={delay(80)} className="max-w-sm text-[13px] leading-relaxed text-slate-400">
              Angka di bawah diambil langsung dari basis data saat halaman dibuka — bukan contoh. Simulasi berstatus draf
              tidak ditampilkan.
            </p>
          </div>

          {events.length === 0 ? (
            <p data-rise className="mt-8 rounded-xl border border-dashed border-white/15 px-5 py-6 text-[13px] text-slate-400">
              Belum ada simulasi yang dibuka untuk umum.
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {events.map((e) => (
                <li key={e.slug} data-rise className="flex flex-wrap items-center gap-x-6 gap-y-3 py-5 transition-colors duration-300 hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-sm font-bold text-white">{e.name}</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {e.kindLabel} · mode {e.modeLabel.toLowerCase()} · {e.window || "tanpa jendela waktu"}
                    </p>
                  </div>

                  <div className="basis-40">
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="tabular-nums text-slate-300">
                        {e.votes}/{e.voters} suara
                      </span>
                      <span className="tabular-nums text-slate-500">{pct(e.voted, e.voters)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400/80 transition-[width] duration-[1200ms] ease-out"
                        style={{ width: drawn ? `${pct(e.voted, e.voters)}%` : "0%" }}
                      />
                    </div>
                  </div>

                  <StatusChip open={e.open} label={e.statusLabel} />

                  <div className="flex items-center gap-4">
                    <Link
                      href={`/e/${e.slug}`}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-2 text-[12px] font-bold text-emerald-200 transition hover:bg-emerald-400/20"
                    >
                      Buka papan suara
                    </Link>
                    <Link href={`/e/${e.slug}/admin/login`} className="text-[12px] text-slate-400 transition hover:text-white">
                      Panel panitia
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="tanya" className="scroll-mt-24 border-t border-white/[0.07] py-14">
          <h2 data-rise className="text-xl font-bold tracking-tight text-white sm:text-2xl">Pertanyaan yang paling sering muncul</h2>
          <div data-rise style={delay(80)}>
            <Faq
              items={[
                {
                  q: "Pemilih perlu membuat akun atau memasang aplikasi?",
                  a: "Tidak. Yang dibutuhkan hanya kode pada undangan — dipindai lewat kamera peramban atau diketik panitia di layar kiosk. Semua berjalan di halaman web yang sama di tiap perangkat.",
                },
                {
                  q: "Bagaimana kalau satu kode dipakai dua kali?",
                  a: "Pada mode langsung, suara pertama mengunci kode itu dan pemakaian kedua ditolak dengan pesan yang jelas. Pada mode simulasi, pembolehannya disengaja untuk latihan: suara diperbarui dan kejadiannya tercatat sebagai pembaruan, bukan suara baru.",
                },
                {
                  q: "Bisa menjalankan beberapa pemilihan sekaligus?",
                  a: "Bisa. Tiap simulasi punya tautan, panitia, calon, dan jadwal sendiri. Datanya dipisahkan per baris di basis data, jadi angka satu pemilihan tidak mungkin tercampur dengan yang lain.",
                },
                {
                  q: "Kalau listrik atau jaringan putus di tengah pencoblosan?",
                  a: "Suara hanya tercatat setelah server menerimanya, jadi pemilih yang jaringannya terputus tinggal mengulang kodenya. Panitia dapat membuka kembali hak pilih satu pemilih dari panel bila perlu, dan setiap pembukaan kembali tercatat di audit log.",
                },
                {
                  q: "Hasilnya bisa diperiksa ulang oleh pihak lain?",
                  a: "Rekap dan audit log dapat diunduh CSV, lengkap dengan waktu dan alamat IP tiap aksi. Untuk pemeriksaan, tautan antara kode pemilih dan pilihannya tetap tersimpan di basis data meski layar rekap tidak menampilkan nama pemilih.",
                },
              ]}
            />
          </div>
        </section>

        <section className="border-t border-white/[0.07] py-14">
          <div data-rise className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 sm:p-9">
            <svg aria-hidden viewBox="0 0 240 240" className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 text-emerald-400/10" fill="none" stroke="currentColor">
              <circle cx="120" cy="120" r="118" />
              <circle cx="120" cy="120" r="78" strokeDasharray="4 8" />
            </svg>
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Punya satu hari pemungutan yang perlu disiapkan?</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                  Ceritakan jumlah pemilih dan lokasinya. Simulasi pertama bisa dijalankan dari berkas CSV yang sudah Anda
                  punya, lalu dipakai gladi resik sebelum hari-H.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/platform/login" className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">
                  Masuk konsol
                </Link>
                {featured && (
                  <Link
                    href={`/e/${featured.slug}`}
                    className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/60 hover:text-white"
                  >
                    Lihat contoh papan
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer data-rise className="border-t border-white/[0.07] py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-sm">
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-400/30">
                  <Icon name="kotak" className="h-[18px] w-[18px]" />
                </span>
                <span className="text-sm font-bold tracking-tight text-white">
                  Flex<span className="text-emerald-300">Election</span>
                </span>
              </span>
              <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                Platform simulasi dan pemungutan suara digital: kode pemilih, kiosk layar, rekap seketika, dan audit log
                untuk tiap pemilihan yang Anda jalankan.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-14 gap-y-6 text-[12px]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Masuk</p>
                <ul className="mt-3 space-y-2">
                  <li>
                    <Link href="/platform/login" className="text-slate-400 transition hover:text-white">
                      Konsol platform
                    </Link>
                  </li>
                  {featured && (
                    <li>
                      <Link href={`/e/${featured.slug}/admin/login`} className="text-slate-400 transition hover:text-white">
                        Panel panitia
                      </Link>
                    </li>
                  )}
                  {featured && (
                    <li>
                      <Link href={`/e/${featured.slug}`} className="text-slate-400 transition hover:text-white">
                        Layar kiosk
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Halaman ini</p>
                <ul className="mt-3 space-y-2">
                  <li>
                    <a href="#keunggulan" className="text-slate-400 transition hover:text-white">
                      Keunggulan
                    </a>
                  </li>
                  <li>
                    <a href="#keamanan" className="text-slate-400 transition hover:text-white">
                      Keamanan
                    </a>
                  </li>
                  <li>
                    <a href="#tanya" className="text-slate-400 transition hover:text-white">
                      Tanya jawab
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-6 text-[11px] text-slate-500">
            <span>© {new Date().getFullYear()} FlexElection · dibuat untuk pemungutan suara yang rapi dan bisa diperiksa.</span>
            <a href="https://flexbox.id" target="_blank" rel="noopener noreferrer" className="transition hover:text-slate-300">
              developed by Flexbox Indonesia
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
