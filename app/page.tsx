"use client";

import { useCallback, useEffect, useState } from "react";
import QrScanner from "@/components/QrScanner";

type Candidate = { id: number; number: number; name: string; tagline: string; photo_url: string };
type Boot = { status: "open" | "closed"; title_line1: string; title_line2: string; candidates: Candidate[] };
type Step = "scan" | "pilih" | "konfirmasi" | "sukses";

export default function KioskPage() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [step, setStep] = useState<Step>("scan");
  const [ballot, setBallot] = useState<string | null>(null);
  const [voterName, setVoterName] = useState("");
  const [revote, setRevote] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [manual, setManual] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [scannerKey, setScannerKey] = useState(0);

  const loadBoot = useCallback(async () => {
    const res = await fetch("/api/kiosk/bootstrap");
    if (res.ok) setBoot(await res.json());
  }, []);

  useEffect(() => {
    loadBoot();
  }, [loadBoot]);

  const reset = useCallback(() => {
    setStep("scan");
    setBallot(null);
    setVoterName("");
    setRevote(false);
    setSelectedId(null);
    setError(null);
    setManual("");
    setCountdown(10);
    setScannerKey((k) => k + 1);
    loadBoot();
  }, [loadBoot]);

  useEffect(() => {
    if (step !== "sukses") return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step === "sukses" && countdown <= 0) reset();
  }, [step, countdown, reset]);

  const handleCode = useCallback(
    async (code: string) => {
      const clean = code.trim();
      if (!clean) return;
      setError(null);
      const res = await fetch("/api/kiosk/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kode tidak dapat diverifikasi.");
        return;
      }
      setBallot(data.ballot);
      setVoterName(data.voterName);
      setRevote(!!data.revote);
      setSelectedId(null);
      setStep("pilih");
    },
    []
  );

  const confirmVote = async () => {
    if (!ballot || selectedId == null || voting) return;
    setVoting(true);
    setError(null);
    const res = await fetch("/api/kiosk/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ballot, candidateId: selectedId }),
    });
    const data = await res.json().catch(() => ({}));
    setVoting(false);
    if (!res.ok) {
      setError(data.error || "Gagal mencatat pilihan.");
      setStep("pilih");
      return;
    }
    setCountdown(10);
    setStep("sukses");
  };

  if (!boot) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-300 text-sm">
        Memuat aplikasi&hellip;
      </div>
    );
  }

  const selected = boot.candidates.find((c) => c.id === selectedId) || null;

  if (boot.status === "closed" && step === "scan") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4 text-center text-white">
        <h1 className="text-lg font-bold tracking-wide">{boot.title_line1}</h1>
        <p className="mt-1 text-xs text-slate-400">{boot.title_line2}</p>
        <div className="mt-8 max-w-sm rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-5 text-amber-300 text-sm">
          Pemungutan suara sedang <b>ditutup</b>. Silakan hubungi petugas panitia.
        </div>
      </div>
    );
  }

  if (step === "scan") {
    return (
      <div className="flex min-h-dvh flex-col items-center bg-slate-950 px-4 py-8 text-white">
        <header className="text-center">
          <h1 className="text-lg md:text-xl font-bold tracking-wide">{boot.title_line1}</h1>
          <p className="mt-1 text-[11px] md:text-xs text-slate-400">{boot.title_line2}</p>
        </header>

        <div className="relative mt-8 w-full max-w-sm">
          <span className="pointer-events-none absolute -top-2 -left-2 h-8 w-8 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
          <span className="pointer-events-none absolute -top-2 -right-2 h-8 w-8 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
          <span className="pointer-events-none absolute -bottom-2 -left-2 h-8 w-8 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
          <span className="pointer-events-none absolute -bottom-2 -right-2 h-8 w-8 border-b-4 border-r-4 border-emerald-400 rounded-br" />
          <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
            <QrScanner key={scannerKey} onScan={handleCode} />
            <div className="scan-line pointer-events-none absolute left-0 h-0.5 w-full bg-emerald-400/80 shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-slate-400">
          Arahkan kode QR / barcode peserta pencoblosan ke kamera
        </p>

        <form
          className="mt-6 flex w-full max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleCode(manual);
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="atau ketik kode peserta, cth: PKD-DEMO-0001"
            className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
            Verifikasi
          </button>
        </form>

        {error && (
          <div className="fade-up mt-4 w-full max-w-sm rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <p className="mt-auto pt-8 text-[10px] text-slate-600">developed by Flexbox Indonesia</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="bg-slate-900 px-4 py-3 text-center text-white shadow-md">
        <h1 className="text-sm md:text-base font-bold tracking-wide">
          {step === "pilih" || step === "sukses" ? boot.title_line1 : "KONFIRMASI PILIHAN ANDA"}
        </h1>
        <p className="mt-0.5 text-[11px] md:text-xs text-slate-300">
          {step === "pilih" || step === "sukses" ? boot.title_line2 : boot.title_line1}
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-5 md:py-7">
        {step === "pilih" || step === "sukses" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg md:text-xl font-bold text-slate-800">Silakan Pilih Calon Kepala Desa</h2>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600">
                Pemilih: <b className="text-slate-800">{voterName}</b>
              </span>
            </div>

            {revote && step === "pilih" && (
              <div className="mt-3 rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Pemilih ini sudah pernah mencoblos. Pilihan baru akan menggantikan pilihan sebelumnya dan tetap dihitung 1 suara.
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {boot.candidates.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={step === "sukses"}
                    onClick={() => setSelectedId(c.id)}
                    className={`rounded-lg border-2 bg-white p-2.5 md:p-3 text-left shadow-sm transition-all ${
                      isSel ? "border-blue-600 ring-2 ring-blue-600/30" : "border-slate-200 hover:border-blue-400"
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={c.photo_url}
                        alt={c.name}
                        className="aspect-[3/4] w-full rounded-md border border-slate-200 object-cover"
                      />
                      <span className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/85 text-sm font-bold text-white">
                        {c.number}
                      </span>
                      {isSel && (
                        <span className="pop-in absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-center text-sm font-semibold leading-tight text-slate-800">{c.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-center text-[11px] text-slate-500">{c.tagline}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                disabled={!selectedId || step === "sukses"}
                onClick={() => setStep("konfirmasi")}
                className={`w-full rounded-md py-3.5 text-sm font-bold tracking-widest transition-colors ${
                  selectedId
                    ? "bg-blue-700 text-white hover:bg-blue-800"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
                }`}
              >
                KONFIRMASI PILIHAN
              </button>
              <button
                type="button"
                disabled={step === "sukses"}
                onClick={reset}
                className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-700"
              >
                Batalkan &amp; ganti pemilih
              </button>
            </div>
          </>
        ) : (
          <div className="fade-up mx-auto w-full max-w-md rounded-xl bg-white p-6 text-center shadow-md">
            <p className="text-sm text-slate-600">Anda akan memilih calon berikut:</p>
            {selected && (
              <>
                <img
                  src={selected.photo_url}
                  alt={selected.name}
                  className="mx-auto mt-4 aspect-[3/4] w-36 rounded-md border border-slate-200 object-cover"
                />
                <p className="mt-3 text-lg font-bold text-slate-900">
                  {selected.number}. {selected.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{selected.tagline}</p>
              </>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep("pilih")}
                className="rounded-md bg-red-600 py-3 text-sm font-bold tracking-wider text-white hover:bg-red-700"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={confirmVote}
                disabled={voting}
                className="rounded-md bg-blue-700 py-3 text-sm font-bold tracking-wider text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {voting ? "MEMPROSES…" : "YA, COBLOS"}
              </button>
            </div>
            {error && (
              <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        )}
      </main>

      {step === "sukses" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 px-4 backdrop-blur-[2px]">
          <div className="pop-in w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
            <div className="pop-in mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-slate-900">SUKSES!</h2>
            <p className="mt-1 text-sm text-slate-600">Pilihan Anda telah tercatat.</p>
            <p className="mt-1 text-xs text-slate-500">Terima kasih telah menggunakan hak pilih Anda.</p>
            <p className="mt-5 text-[11px] text-slate-400">Kembali ke layar scan dalam {Math.max(countdown, 0)} detik</p>
          </div>
        </div>
      )}
    </div>
  );
}
