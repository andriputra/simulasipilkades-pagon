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

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

    // Tab di latar bisa menunda IntersectionObserver. Yang sudah berada di layar
    // ditampilkan tanpa menunggu lagi; yang di bawah garis lipat tetap menunggu scroll
    // supaya efektifnya tidak hilang. Ukuran layar nol = lingkungan terbatas, tampilkan semua.
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
  const kotak = [
    [1, 1],
    [n - 6, 1],
    [1, n - 6],
  ];

  return (
    <svg viewBox={`0 0 ${n} ${n}`} fill="currentColor" aria-hidden className="h-full w-full text-slate-300">
      {modul}
      {kotak.map(([cx, cy]) => (
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

export default function Landing({ events, stats, featured }: Props) {
  const root = useRef<HTMLElement>(null);
  const [drawn, setDrawn] = useState(false);
  useReveal(root);

  useEffect(() => {
    const id = window.setTimeout(() => setDrawn(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  const hadir = featured ? pct(featured.voted, featured.voters) : 0;

  return (
    <main ref={root} className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 selection:bg-emerald-400/25">
      {/* Latar: satu cahaya lembut di kiri atas dan grid halus yang hanya terlihat di separuh atas. */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(115%_85%_at_18%_-12%,#0d2c40_0%,#06101f_46%,#020617_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[70vh] bg-[linear-gradient(rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.22)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(75%_60%_at_50%_0%,#000_10%,transparent_80%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-400/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
                <path d="M9 10V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
                <path d="M10.2 15.2 12 17l3.6-4" />
              </svg>
            </span>
            <span className="text-[15px] font-bold tracking-tight text-white">FlexElection</span>
          </Link>

          {/* Jangkar di halaman ini memakai <a> biasa: tanpa navigasi router, jadi
              halaman dinamis tidak ikut dimuat ulang hanya untuk berpindah bagian. */}
          <nav className="hidden items-center gap-7 text-[13px] text-slate-400 md:flex">
            <a href="#alur" className="transition hover:text-white">
              Alur
            </a>
            <a href="#keamanan" className="transition hover:text-white">
              Keamanan
            </a>
            <a href="#simulasi" className="transition hover:text-white">
              Simulasi berjalan
            </a>
          </nav>

          <Link
            href="/platform/login"
            className="rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-slate-200 transition hover:border-emerald-300/60 hover:text-white"
          >
            Masuk
          </Link>
        </header>

        {/* Hero sengaja tidak diberi animasi masuk: yang pertama dilihat pengunjung harus
            langsung terbaca. Gerakannya cuma angka yang menghitung dan bar yang mengisi. */}
        <section className="grid items-start gap-12 py-10 lg:grid-cols-[1.03fr_0.97fr] lg:py-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/90">
              Simulasi &amp; pemungutan suara digital
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Pemilihan digital yang hasilnya bisa diperiksa ulang.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-300">
              FlexElection memindahkan surat suara ke layar: pemilih memindai kode undangan, memilih satu calon, dan rekap
              beserta catatan auditnya langsung terlihat di layar panitia. Dipakai untuk simulasi Pilkades, pemilihan BEM,
              musyawarah RT, sampai polling internal.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {featured ? (
                <Link
                  href={`/e/${featured.slug}`}
                  className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                >
                  Buka papan suara
                </Link>
              ) : (
                <Link
                  href="/platform/login"
                  className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                >
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

            <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
              Isolasi data per simulasi ditegakkan di basis data · setiap aksi tercatat lengkap dengan waktu dan IP ·
              pemilih tidak perlu memasang aplikasi atau membuat akun.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/[0.08] pt-7 sm:grid-cols-4">
              {[
                { k: "Simulasi dibuat", v: stats.events },
                { k: "Sedang dibuka", v: stats.open },
                { k: "Pemilih terdaftar", v: stats.voters },
                { k: "Suara tercatat", v: stats.votes },
              ].map((s) => (
                <div key={s.k}>
                  <dd className="text-2xl font-bold tabular-nums text-white sm:text-[28px]">
                    <Counter value={s.v} />
                  </dd>
                  <dt className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{s.k}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Satu kartu perangkat: atas tampilan kode pemilih, bawah papan rekap yang angkanya nyata. */}
          <div className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
            {featured ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)]">
                <div className="border-b border-white/[0.07] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Kode pemilih</p>
                      <p className="mt-1 truncate font-mono text-[13px] tracking-widest text-slate-200">
                        {featured.tokenPrefix}-••••-••••
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {featured.modeLabel}
                    </span>
                  </div>

                  <div className="relative mx-auto mt-5 h-32 w-32 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <CodeGlyph seed={featured.slug} />
                    <span className="scan-line absolute left-0 h-px w-full bg-emerald-300/70 shadow-[0_0_10px_1px_rgba(52,211,153,0.55)]" />
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                    Contoh tampilan kode pada halaman undangan. Satu kode hanya dikenali di satu simulasi.
                  </p>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Rekap langsung</p>
                    <StatusChip open={featured.open} label={featured.statusLabel} />
                  </div>

                  <p className="mt-3 truncate text-sm font-bold text-white">{featured.name}</p>

                  <div className="mt-4 flex items-baseline gap-2">
                    <Counter value={featured.votes} className="text-3xl font-bold tabular-nums text-white" />
                    <span className="text-xs text-slate-400">dari {featured.voters.toLocaleString("id-ID")} pemilih</span>
                  </div>

                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400/90 transition-[width] duration-[1100ms] ease-out"
                      style={{ width: drawn ? `${hadir}%` : "0%" }}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4 text-center">
                    {[
                      { k: "Calon", v: featured.candidates },
                      { k: "Sudah memilih", v: featured.voted },
                      { k: "Kehadiran", v: `${hadir}%` },
                    ].map((s) => (
                      <div key={s.k}>
                        <p className="text-sm font-bold tabular-nums text-white">{s.v}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">{s.k}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm font-bold text-white">Belum ada simulasi yang ditampilkan</p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                  Buat simulasi pertama di konsol: tentukan jenis pemilihan, daftar calon, dan unggah daftar pemilih. Papan
                  rekapnya langsung bisa dibuka dari tautan pendek.
                </p>
                <Link href="/platform/login" className="mt-5 inline-flex text-[13px] font-semibold text-emerald-300 hover:text-emerald-200">
                  Buka konsol platform
                </Link>
              </div>
            )}
          </div>
        </section>

        <section id="alur" className="scroll-mt-6 border-t border-white/[0.07] py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 data-rise className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Tiga langkah dari daftar pemilih sampai berkas CSV
            </h2>
            <p data-rise style={delay(80)} className="max-w-sm text-[13px] leading-relaxed text-slate-400">
              Panitia hanya perlu berkas pemilih dan satu perangkat untuk memindai. Tidak ada pemasangan aplikasi di sisi
              pemilih.
            </p>
          </div>

          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {[
              {
                t: "Susun daftar pemilih",
                d: "Impor CSV berisi nama dan NIK, atau tambah satu per satu. Tiap pemilih langsung mendapat kode unik yang bisa dicetak sebagai QR pada undangan.",
              },
              {
                t: "Coblos di layar",
                d: "Kiosk membaca kode, menampilkan surat suara sesuai jenis pemilihan, lalu menyimpan satu pilihan. Kode yang sama tidak bisa dipakai dua kali pada mode langsung.",
              },
              {
                t: "Rekap & serahkan",
                d: "Angka naik seketika di layar panitia. Rekap, daftar pemilih, dan audit log bisa diunduh CSV ketika hasilnya perlu diperiksa atau diumumkan.",
              },
            ].map((s, i) => (
              <li key={s.t} data-rise style={delay(i * 90)} className="border-t border-white/[0.08] pt-5">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                  Langkah {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-base font-bold text-white">{s.t}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="keamanan" className="scroll-mt-6 border-t border-white/[0.07] py-14">
          <h2 data-rise className="max-w-2xl text-xl font-bold tracking-tight text-white sm:text-2xl">
            Yang membuat hasilnya bisa dipertanggungjawabkan
          </h2>
          <div className="mt-9 grid gap-x-14 sm:grid-cols-2">
            {[
              {
                t: "Kunci di tingkat baris",
                d: "Semua baris suara memikul event_id dan kebijakan Row Level Security membatasi tiap koneksi pada satu simulasi. Aplikasi terhubung memakai role basis data tanpa hak bypass.",
              },
              {
                t: "Dua mode pemungutan",
                d: "Mode langsung mengunci satu undangan untuk satu suara dan menolak pemakaian kedua. Mode simulasi membolehkan pengulangan, dan setiap perubahan tercatat sebagai pembaruan suara.",
              },
              {
                t: "Jendela waktu",
                d: "Suara hanya diterima di antara jam buka dan tutup yang diatur panitia. Di luar rentang itu kiosk menolak, termasuk bila halaman dibiarkan terbuka.",
              },
              {
                t: "Jejak audit",
                d: "Suara masuk, perubahan calon, impor pemilih, sampai reset suara dicatat dengan aktor, alamat IP, dan waktunya, lalu bisa diunduh bersama rekap.",
              },
              {
                t: "Pilihan tetap rahasia di layar",
                d: "Kiosk tidak menampilkan nama pemilih di rekap. Yang tersimpan hanya tautan antara kode pemilih dan pilihannya, untuk keperluan pemeriksaan bila hasil digugat.",
              },
              {
                t: "Masuk panitia dibatasi",
                d: "Kata sandi disimpan sebagai hash scrypt dan percobaan login yang gagal berulang dibatasi per alamat, jadi panel tidak bisa ditebak satu per satu.",
              },
            ].map((k, i) => (
              <div key={k.t} data-rise style={delay((i % 2) * 80)} className="border-t border-white/[0.07] py-5">
                <h3 className="text-[14px] font-bold text-white">{k.t}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{k.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="simulasi" className="scroll-mt-6 border-t border-white/[0.07] py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 data-rise className="text-xl font-bold tracking-tight text-white sm:text-2xl">Simulasi yang berjalan</h2>
            <p data-rise style={delay(80)} className="max-w-sm text-[13px] leading-relaxed text-slate-400">
              Angka di bawah ini diambil langsung dari basis data saat halaman dibuka — bukan contoh.
            </p>
          </div>

          {events.length === 0 ? (
            <p data-rise className="mt-8 rounded-xl border border-dashed border-white/15 px-5 py-6 text-[13px] text-slate-400">
              Belum ada simulasi yang dibuka untuk umum.
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {events.map((e) => (
                <li key={e.slug} data-rise className="flex flex-wrap items-center gap-x-6 gap-y-3 py-5">
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
                      <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${pct(e.voted, e.voters)}%` }} />
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

        <section className="border-t border-white/[0.07] py-14">
          <div data-rise className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <div className="max-w-xl">
              <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Punya satu hari pemungutan yang perlu disiapkan?</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                Satu konsol untuk membuat simulasi, mengatur panitia di tiap lokasi, dan membandingkan hasil antar pemilihan
                tanpa mencampur datanya.
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
        </section>

        <footer data-rise className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] py-8 text-[11px] text-slate-500">
          <span>FlexElection · platform simulasi &amp; pemungutan suara digital</span>
          <span className="flex items-center gap-5">
            <Link href="/platform/login" className="transition hover:text-slate-300">
              Konsol
            </Link>
            <a href="https://flexbox.id" target="_blank" rel="noopener noreferrer" className="transition hover:text-slate-300">
              developed by Flexbox Indonesia
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}
