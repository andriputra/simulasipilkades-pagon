"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type RecapFilterValues = { kind: string; status: string; cari: string };
const KEYS = ["kind", "status", "cari"] as const;
const EMPTY: RecapFilterValues = { kind: "", status: "", cari: "" };

const labelCls = "block text-[11px] font-semibold text-slate-600";
const fieldCls =
  "mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-700 focus:border-blue-500 focus:outline-none";

/** Filter rekap lintas simulasi: dropdown langsung menerapkan, teks bebas setelah berhenti mengetik. */
export default function PlatformRecapFilters({
  values,
  kindOptions,
  statusOptions,
  exportHref,
}: {
  values: RecapFilterValues;
  kindOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  /** Tautan ekspor ikut membawa filter yang sedang aktif. */
  exportHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState<RecapFilterValues>(values);

  const urlKey = KEYS.map((k) => values[k]).join("|");
  useEffect(() => {
    setForm(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  useEffect(() => {
    if (form.cari === values.cari) return;
    const t = setTimeout(() => push(form), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cari, values.cari]);

  const push = (next: RecapFilterValues) => {
    const params = new URLSearchParams();
    for (const k of KEYS) {
      const v = (next[k] || "").trim();
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const applyNow = (k: keyof RecapFilterValues, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    push(next);
  };

  const isFiltered = KEYS.some((k) => (form[k] || "").trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        push(form);
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <label className={`${labelCls} w-[12rem]`}>
        Jenis pemilihan
        <select value={form.kind} onChange={(e) => applyNow("kind", e.target.value)} className={fieldCls}>
          <option value="">Semua jenis</option>
          {kindOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelCls} w-[10rem]`}>
        Status
        <select value={form.status} onChange={(e) => applyNow("status", e.target.value)} className={fieldCls}>
          <option value="">Semua status</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelCls} min-w-[13rem] max-w-[24rem] flex-1`}>
        Cari simulasi
        <input
          value={form.cari}
          onChange={(e) => setForm((f) => ({ ...f, cari: e.target.value }))}
          placeholder="nama atau URL simulasi"
          maxLength={80}
          className={fieldCls}
        />
      </label>

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
          Terapkan
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            push(EMPTY);
          }}
          disabled={!isFiltered}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reset filter
        </button>
        <a
          href={exportHref}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          Ekspor CSV
        </a>
      </div>
    </form>
  );
}
