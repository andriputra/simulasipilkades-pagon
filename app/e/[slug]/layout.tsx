import { notFound } from "next/navigation";
import EventLabelsProvider from "@/components/EventLabels";
import { findEventBySlug } from "@/lib/event";

export const dynamic = "force-dynamic";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ev = await findEventBySlug(slug);
  if (!ev) notFound();
  return <EventLabelsProvider kind={ev.kind}>{children}</EventLabelsProvider>;
}
