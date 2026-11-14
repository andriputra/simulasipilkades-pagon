"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
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
    label: "Data Calon",
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
    label: "Pemilih & QR",
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const sidebar = (isMobile: boolean) => (
    <div className={`flex h-full flex-col bg-slate-900 text-slate-200 ${collapsed && !isMobile ? "w-16" : "w-72"} transition-all`}>
      <div className={`flex items-center gap-3 border-b border-slate-800 px-4 py-4 ${collapsed && !isMobile ? "justify-center" : ""}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-extrabold text-white">
          PK
        </span>
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">CMS Pilkades</p>
            <p className="truncate text-[11px] text-slate-400">Simulasi Pencoblosan Digital</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={item.label}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              } ${collapsed && !isMobile ? "justify-center px-2" : ""}`}
            >
              <Icon>{item.icon}</Icon>
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-slate-800 p-2">
        <Link
          href="/"
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
            {NAV.find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href)))?.label || "Admin"}
          </h1>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
