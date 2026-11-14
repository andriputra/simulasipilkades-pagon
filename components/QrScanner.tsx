"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onScan: (text: string) => void;
};

type CamState = "loading" | "asking" | "live" | "error";

const VIDEO_CONSTRAINTS: MediaTrackConstraints[] = [
  { facingMode: { ideal: "environment" } },
  { facingMode: { ideal: "user" } },
  {},
];

function reasonFromError(err: unknown): string {
  const text = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).toLowerCase();
  if (text.includes("notreadableerror") || text.includes("could not start video source") || text.includes("trackstarterror")) {
    return "Kamera sedang dipakai aplikasi/tab lain (Zoom, Meet, OBS, atau tab pemindai lainnya). Tutup pemakai tersebut lalu coba lagi.";
  }
  if (text.includes("notfounderror") || text.includes("overconstrainederror") || text.includes("devicesnotfounderror") || text.includes("no camera")) {
    return "Tidak ada kamera yang bisa dipakai perangkat ini. Gunakan input kode manual di bawah, atau sambungkan kamera lalu coba lagi.";
  }
  if (text.includes("notallowederror") || text.includes("permissiondenied") || text.includes("permission denied") || text.includes("securityerror")) {
    return "Akses kamera diblokir. Klik ikon kunci/gembok di address bar → Kamera → Izinkan, lalu muat ulang. Kalau masih gagal, cek Windows Settings → Privacy & security → Camera (izinkan aplikasi desktop & browser mengakses kamera).";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Kamera hanya berjalan di HTTPS. Buka aplikasi lewat alamat https:// lalu coba lagi.";
  }
  return "Kamera tidak dapat dinyalakan. Gunakan input kode manual di bawah, atau tekan coba ulang.";
}

export default function QrScanner({ onScan }: Props) {
  const cbRef = useRef(onScan);
  cbRef.current = onScan;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<CamState>("loading");
  const [mode, setMode] = useState<"native" | "library" | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [camDetail, setCamDetail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const getCamera = useCallback(async (): Promise<MediaStream> => {
    let lastErr: unknown = null;
    const attempts: MediaTrackConstraints[] = [...VIDEO_CONSTRAINTS];
    const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter((d) => d.kind === "videoinput");
    for (const cam of cams) attempts.push({ deviceId: cam.deviceId });
    for (const facingMode of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { ...facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (!lastErr) lastErr = err;
      }
    }
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err) {
      throw lastErr ?? err;
    }
  }, []);

  const scanNative = useCallback(async () => {
    setMode("native");
    setState("asking");
    const stream = await getCamera();
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("VideoElementBelumSiap");
    }
    let running = true;
    stopRef.current = () => {
      running = false;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
    video.srcObject = stream;
    await video.play();
    setState("live");

    const { BarcodeDetector } = window as unknown as {
      BarcodeDetector: new (o?: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
    };
    let detector: { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
    try {
      detector = new BarcodeDetector({ formats: ["qr_code", "data_matrix"] });
    } catch {
      detector = new BarcodeDetector();
    }
    let lastValue = "";
    let lastAt = 0;

    const tick = async () => {
      if (!running) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const found = await detector.detect(video);
          const value = found[0]?.rawValue?.trim();
          const now = Date.now();
          if (value && (value !== lastValue || now - lastAt > 3000)) {
            lastValue = value;
            lastAt = now;
            cbRef.current(value);
          }
        } catch {
          /* frame berikutnya */
        }
      }
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [getCamera]);

  const scanLibrary = useCallback(async () => {
    setMode("library");
    setState("asking");
    const { Html5Qrcode } = await import("html5-qrcode");
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => null);
    const cams = (devices ?? []).filter((d) => d.kind === "videoinput");
    if (devices && cams.length === 0) {
      throw Object.assign(new Error("No camera device"), { name: "NotFoundError" });
    }
    // Html5Qrcode hanya menerima string cameraId, {facingMode:"..."} atau {deviceId:"..."} — bukan {ideal}.
    const configs: (string | MediaTrackConstraints)[] = [
      { facingMode: "environment" },
      { facingMode: "user" },
      ...cams.map((c) => c.deviceId),
    ];
    let firstErr: unknown = null;
    for (const cfg of configs) {
      const host = document.getElementById("kiosk-qr-region");
      if (host) host.innerHTML = "";
      const inst = new Html5Qrcode("kiosk-qr-region");
      try {
        await inst.start(
          cfg,
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text: string) => cbRef.current(String(text).trim()),
          () => {}
        );
        setState("live");
        stopRef.current = () => {
          inst.stop().catch(() => {});
          const el = document.getElementById("kiosk-qr-region");
          if (el) el.innerHTML = "";
        };
        return;
      } catch (err) {
        if (!firstErr) firstErr = err;
        try {
          inst.clear();
        } catch {
          /* instance belum aktif */
        }
      }
    }
    throw firstErr ?? new Error("CameraStartFailed");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hardStop = () => {
      const stop = stopRef.current;
      stopRef.current = null;
      if (stop) stop();
    };
    setState("loading");
    setMode(null);
    setCamError(null);
    setCamDetail(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("MediaDevicesTidakDidukung");
        const hasDetector = typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector === "function";
        if (hasDetector) {
          try {
            await scanNative();
          } catch {
            hardStop();
            await scanLibrary();
          }
        } else {
          await scanLibrary();
        }
        if (cancelled) hardStop();
      } catch (err) {
        if (cancelled) {
          hardStop();
          return;
        }
        setState("error");
        setCamError(reasonFromError(err));
        setCamDetail(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      }
    })();
    return () => {
      cancelled = true;
      hardStop();
    };
  }, [attempt, scanNative, scanLibrary]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover ${mode === "native" && state === "live" ? "" : "pointer-events-none absolute inset-0 opacity-0"}`}
      />
      <div
        id="kiosk-qr-region"
        className={`h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
          mode === "library" && state === "live" ? "" : "pointer-events-none absolute inset-0 opacity-0"
        }`}
      />
      {(state === "loading" || state === "asking") && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-slate-400">
          {state === "loading" ? "Menyiapkan pemindai…" : "Menyalakan kamera… izinkan akses kamera bila diminta."}
        </div>
      )}
      {state === "error" && camError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="max-w-xs text-xs leading-relaxed text-amber-300">{camError}</p>
          {camDetail && <p className="max-w-xs break-words text-[10px] leading-relaxed text-slate-500">{camDetail}</p>}
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
