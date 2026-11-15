import { redirect, notFound } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { isAdminForEvent, isPlatformSessionLive } from "@/lib/admin";
import { findEventBySlug } from "@/lib/event";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ev = await findEventBySlug(slug);
  if (!ev) notFound();
  if (!(await isAdminForEvent(ev.id, ev.slug))) redirect(`/e/${ev.slug}/admin/login`);
  return <AdminShell impersonated={await isPlatformSessionLive()}>{children}</AdminShell>;
}
