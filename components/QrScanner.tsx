"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onScan: (text: string) => void;
};

export default function QrScanner({ onScan }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onScan);
  cbRef.current = onScan;
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let scanner: { stop: () => Promise<void> } | null = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped || !boxRef.current) return;
      const inst = new Html5Qrcode("kiosk-qr-region");
      scanner = inst;
      try {
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          (text: string) => cbRef.current(text),
          () => {}
        );
      } catch {
        if (!stopped) setCamError("Kamera tidak tersedia / izin ditolak. Gunakan input kode manual di bawah.");
      }
    })();

    return () => {
      stopped = true;
      if (scanner) scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div id="kiosk-qr-region" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {camError && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-amber-300">
          {camError}
        </div>
      )}
    </div>
  );
}
