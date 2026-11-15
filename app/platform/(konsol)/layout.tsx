import { redirect } from "next/navigation";
import PlatformShell from "@/components/PlatformShell";
import { getPlatformSession } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function KonsolLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");
  return <PlatformShell user={session.user.name || session.user.username}>{children}</PlatformShell>;
}
