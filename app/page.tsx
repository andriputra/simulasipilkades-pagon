import { redirect, notFound } from "next/navigation";
import { getDefaultEvent } from "@/lib/event";

export const dynamic = "force-dynamic";

/** Papan suara fisik, banner, dan bookmark panitia menunjuk ke sini, jadi root
 *  selalu diarahkan ke simulasi yang sedang berjalan. */
export default async function RootPage() {
  const ev = await getDefaultEvent();
  if (!ev) notFound();
  redirect(`/e/${ev.slug}`);
}
