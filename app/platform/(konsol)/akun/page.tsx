import PlatformAccounts from "@/components/PlatformAccounts";
import { getPlatformSession, listPlatformSessions, listPlatformUsers } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function PlatformAccountsPage() {
  const [session, users, sessions] = await Promise.all([getPlatformSession(), listPlatformUsers(), listPlatformSessions(40)]);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Akun &amp; Sesi Konsol</h2>
        <p className="text-xs text-slate-500">
          Yang boleh masuk ke <span className="font-mono">/platform</span> dan browser mana yang masih memegang akses.
          Tidak ada akun bawaan di sini — akun pertama dibuat lewat
          <span className="font-mono"> npm run superadmin -- nama_anda</span>.
        </p>
      </div>
      <PlatformAccounts me={session?.user.id ?? -1} users={users} sessions={sessions} />
    </div>
  );
}
