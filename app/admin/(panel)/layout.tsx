import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { isAdminAuthed } from "@/lib/admin";
import { ensureSchema } from "@/lib/db";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  if (!(await isAdminAuthed())) redirect("/admin/login");
  return <AdminShell>{children}</AdminShell>;
}
