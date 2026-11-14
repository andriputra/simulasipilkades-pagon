"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onScan: (text: string) => void;
};

type CamState = "loading" | "asking" | "live" | "error";

const START_CONFIGS: MediaTrackConstraints[] = [
  { facingMode: { ideal: "environment" } },
  { facingMode: { ideal: "user" } },
  {},
];

function reasonFromError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di ikon kunci/gembok address bar, lalu coba lagi.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "Tidak ada kamera yang terdeteksi di perangkat ini. Gunakan input kode manual di bawah, atau sambungkan kamera lalu coba lagi.";
  }
  if (name === "NotReadableError") {
    return "Kamera sedang dipakai aplikasi lain (Zoom, Meet, OBS, dll). Tutup aplikasi tersebut lalu coba lagi.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Kamera memerlukan koneksi HTTPS. Buka aplikasi lewat alamat https:// lalu coba lagi.";
  }
  return "Kamera tidak dapat dinyalakan. Gunakan input kode manual di bawah, atau tekan coba ulang.";
}

export default function QrScanner({ onScan }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onScan);
  cbRef.current = onScan;
  const [state, setState] = useState<CamState>("loading");
  const [camError, setCamError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const startCamera = useCallback(async () => {
    setState("loading");
    setCamError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!boxRef.current) return;
      const inst = new Html5Qrcode("kiosk-qr-region");
      setState("asking");
      let lastErr: unknown = null;
      for (const cfg of START_CONFIGS) {
        try {
          await inst.start(
            cfg,
            { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
            (text: string) => cbRef.current(text),
            () => {}
          );
          setState("live");
          return;
        } catch (err) {
          lastErr = err;
          try {
            await inst.stop();
          } catch {
            /* instance belum aktif */
          }
        }
      }
      throw lastErr ?? new Error("CameraStartFailed");
    } catch (err) {
      setState("error");
      setCamError(reasonFromError(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    startCamera().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
      const el = document.getElementById("kiosk-qr-region");
      const video = el?.querySelector("video");
      if (video && video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [attempt, startCamera]);

  return (
    <div ref={boxRef} className="relative h-full w-full">
      <div id="kiosk-qr-region" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {(state === "loading" || state === "asking") && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-slate-400">
          {state === "loading" ? "Menyiapkan pemindai…" : "Menyalakan kamera… izinkan akses kamera bila diminta."}
        </div>
      )}
      {state === "error" && camError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-xs leading-relaxed text-amber-300">{camError}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-md border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Coba Ulang Kamera
          </button>
        </div>
      )}
    </div>
  );
}
