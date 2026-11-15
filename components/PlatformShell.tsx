"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    href: "/platform",
    label: "Simulasi",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="6" rx="1" />
        <rect x="3" y="14" width="18" height="6" rx="1" />
        <path d="M7 7h.01M7 17h.01" />
      </>
    ),
  },
  {
    href: "/platform/rekap",
    label: "Rekap Lintas Simulasi",
    icon: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
  },
  {
    href: "/platform/audit",
    label: "Audit Global",
    icon: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  },
  {
    href: "/platform/akun",
    label: "Akun & Sesi",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.9-3.5 13.1-3.5 14 0" />
      </>
    ),
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Kerangka konsol platform: sidebar violet, isi lebar penuh (pola dashboard). */
export default function PlatformShell({ user, children }: { user: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("pilkades_platform_collapsed") === "1");
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("pilkades_platform_collapsed", c ? "0" : "1");
      return !c;
    });
  };

  const logout = async () => {
    await fetch("/api/platform/logout", { method: "POST" });
    router.push("/platform/login");
  };

  const isActive = (href: string) => (href === "/platform" ? pathname === href : pathname.startsWith(href));

  const sidebar = (isMobile: boolean) => (
    <div
      className={`flex h-full flex-col bg-slate-900 text-slate-200 ${collapsed && !isMobile ? "w-16" : "w-72"} transition-all`}
    >
      <div className={`flex items-center gap-3 border-b border-slate-800 px-4 py-4 ${collapsed && !isMobile ? "justify-center" : ""}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-600 text-sm font-extrabold text-white">
          SP
        </span>
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Superadmin Platform</p>
            <p className="truncate text-[11px] text-slate-400">{user}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            title={item.label}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href) ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            } ${collapsed && !isMobile ? "justify-center px-2" : ""}`}
          >
            <Icon>{item.icon}</Icon>
            {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-800 p-2">
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
          <button
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Icon>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </Icon>
          </button>
          <button
            className="hidden rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:block"
            onClick={toggle}
            aria-label="Ciutkan sidebar"
          >
            <Icon>
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </Icon>
          </button>
          <h1 className="truncate text-sm font-bold text-slate-800 md:text-base">
            {NAV.find((n) => isActive(n.href))?.label || "Konsol Platform"}
          </h1>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
