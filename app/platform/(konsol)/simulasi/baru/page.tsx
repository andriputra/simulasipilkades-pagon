import Link from "next/link";
import PlatformNewEventForm from "@/components/PlatformNewEventForm";

export const dynamic = "force-dynamic";

export default function NewEventPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/platform" className="text-xs font-semibold text-violet-700 hover:underline">
          ← Kembali ke daftar simulasi
        </Link>
        <h2 className="mt-2 text-lg font-bold text-slate-800">Tambah simulasi</h2>
        <p className="text-xs text-slate-500">
          Satu basis data, setiap simulasi terpisahkan oleh ID event. Membuat simulasi tidak menyalin data simulasi lain.
        </p>
      </div>
      <PlatformNewEventForm />
    </div>
  );
}
