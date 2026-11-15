import { redirect } from "next/navigation";
import PlatformLoginForm from "@/components/PlatformLoginForm";
import { getPlatformSession } from "@/lib/platform";

export const dynamic = "force-dynamic";

/**
 * Halaman masuk dibuat sebagai server component karena keputusan "sudah masuk
 * atau belum" butuh pemeriksaan sesi ke basis data. Middleware hanya bisa
 * melihat keberadaan cookie: kalau ia yang memutuskan, cookie basi membuat
 * middleware dan guard konsol saling mengarahkan balik tanpa akhir.
 */
export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getPlatformSession()) {
    const { next } = await searchParams;
    redirect(next?.startsWith("/platform") ? next : "/platform");
  }
  return <PlatformLoginForm />;
}
