"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useEventLabels } from "@/components/EventLabels";
import { useEventPaths } from "@/lib/use-event-slug";
import type { EventLabels } from "@/lib/event-meta";

const NAV: { href: string; label: string | ((L: EventLabels) => string); icon: React.ReactNode }[] = [
  {
    href: "/admin",
    label: "Dashboard Rekap",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </>
    ),
  },
  {
    href: "/admin/calon",
    label: (L) => `Data ${L.calonPendek}`,
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <circle cx="8" cy="11" r="2" />
        <path d="M5 17c.6-2 5.4-2 6 0M14 9h6M14 13h6" />
      </>
    ),
  },
  {
    href: "/admin/pemilih",
    label: (L) => `${L.pemilih} & QR`,
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
      </>
    ),
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  },
  {
    href: "/admin/pengaturan",
    label: "Pengaturan",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
      </>
    ),
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export default function AdminShell({
  children,
  impersonated = false,
}: {
  children: React.ReactNode;
  /** True bila yang membuka panel adalah sesi konsol superadmin, bukan login panitia. */
  impersonated?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const L = useEventLabels();
  const { slug, pageBase, apiBase, kiosk } = useEventPaths();
  const hrefFor = (path: string) => `${pageBase}${path}`;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("pilkades_sidebar_collapsed") === "1");
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("pilkades_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  };

  const isActive = (path: string) => {
    const href = hrefFor(path);
    return path === "/admin" ? pathname === href : pathname.startsWith(href);
  };

  const activeLabel = NAV.find((n) => isActive(n.href))?.label;

  const logout = async () => {
    await fetch(`${apiBase}/admin/logout`, { method: "POST" });
    if (impersonated) {
      // Sesi konsol ikut memutuskan akses panel, jadi "Keluar" harus menghapus keduanya.
      await fetch("/api/platform/logout", { method: "POST" });
      router.push("/platform/login");
      return;
    }
    router.push(`${pageBase}/admin/login`);
  };

  const sidebar = (isMobile: boolean) => (
    <div className={`flex h-full flex-col bg-slate-900 text-slate-200 ${collapsed && !isMobile ? "w-16" : "w-72"} transition-all`}>
      <div className={`flex items-center gap-3 border-b border-slate-800 px-4 py-4 ${collapsed && !isMobile ? "justify-center" : ""}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-extrabold text-white ${impersonated ? "bg-violet-600" : "bg-blue-600"}`}>
          {L.monogram}
        </span>
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {impersonated ? "Panel Platform" : L.panel}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {impersonated ? `Masuk sebagai panitia: ${slug}` : `Simulasi ${L.calon.toLowerCase()}`}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV.map((item) => {
          const active = isActive(item.href);
          const label = typeof item.label === "function" ? item.label(L) : item.label;
          return (
            <Link
              key={item.href}
              href={hrefFor(item.href)}
              onClick={() => setMobileOpen(false)}
              title={label}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? (impersonated ? "bg-violet-600 text-white" : "bg-blue-600 text-white") : "text-slate-300 hover:bg-slate-800 hover:text-white"
              } ${collapsed && !isMobile ? "justify-center px-2" : ""}`}
            >
              <Icon>{item.icon}</Icon>
              {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-slate-800 p-2">
        {impersonated && (
          <Link
            href="/platform"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-violet-300 hover:bg-violet-500/10 hover:text-violet-200 ${
              collapsed && !isMobile ? "justify-center px-2" : ""
            }`}
            title="Kembali ke konsol platform"
          >
            <Icon>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </Icon>
            {(!collapsed || isMobile) && <span>Kembali ke Konsol</span>}
          </Link>
        )}
        <Link
          href={kiosk}
          target="_blank"
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white ${
            collapsed && !isMobile ? "justify-center px-2" : ""
          }`}
          title="Buka Kiosk"
        >
          <Icon>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
          </Icon>
          {(!collapsed || isMobile) && <span>Buka Kiosk</span>}
        </Link>
        <button
          onClick={logout}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 ${
            collapsed && !isMobile ? "justify-center px-2" : ""
          }`}
          title="Keluar"
        >
          <Icon>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </Icon>
          {(!collapsed || isMobile) && <span>Keluar</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-slate-100">
      <aside className="no-print sticky top-0 hidden h-dvh md:block">{sidebar(false)}</aside>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0">{sidebar(true)}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka menu">
            <Icon>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </Icon>
          </button>
          <button className="hidden rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:block" onClick={toggle} aria-label="Ciutkan sidebar">
            <Icon>
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </Icon>
          </button>
          <h1 className="truncate text-sm font-bold text-slate-800 md:text-base">
            {typeof activeLabel === "function" ? activeLabel(L) : activeLabel || "Admin"}
          </h1>
          {impersonated && (
            <span className="ml-auto shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
              Sedang impersonasi panitia
            </span>
          )}
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
