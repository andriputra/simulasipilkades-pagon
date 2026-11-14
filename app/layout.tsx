import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Simulasi Pilkades Digital",
  description: "Simulasi pencoblosan Pemilihan Kepala Desa digital dengan scan QR, rekap suara, dan audit log.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-100 text-slate-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
