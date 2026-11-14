"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";

type Candidate = {
  id: number;
  number: number;
  name: string;
  tagline: string;
  photo_url: string;
  active: boolean;
};

function CandidateCard({ c, onSaved }: { c: Candidate; onSaved: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(c);
  const [saving, setSaving] = useState(false);

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("File harus berupa gambar.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 640;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setForm((f) => ({ ...f, photo_url: dataUrl }));
        toast("Foto dimuat. Jangan lupa Simpan.", "info");
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/candidates/${form.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(data.error || "Gagal menyimpan.", "error");
      return;
    }
    toast(`Calon nomor ${form.number} tersimpan.`, "success");
    onSaved();
  };

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative">
          <img src={form.photo_url} alt={form.name} className="h-28 w-[5.5rem] rounded-md border border-slate-200 object-cover" />
          <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {form.number}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-[11px] font-semibold text-slate-600">
            Nomor urut
            <input
              type="number"
              min={1}
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: Number(e.target.value) }))}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 accent-blue-700"
            />
            Aktif ditampilkan di kiosk
          </label>
        </div>
      </div>

      <label className="mt-3 block text-[11px] font-semibold text-slate-600">
        Nama calon
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal"
        />
      </label>
      <label className="mt-2 block text-[11px] font-semibold text-slate-600">
        Keterangan / visi singkat
        <input
          value={form.tagline}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal"
        />
      </label>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickPhoto(f);
          e.target.value = "";
        }}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Ganti Foto
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-blue-700 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

export default function AdminCandidatesPage() {
  const [list, setList] = useState<Candidate[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/candidates");
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!list) return <p className="text-sm text-slate-500">Memuat data calon…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Data Calon Kepala Desa</h2>
        <p className="text-xs text-slate-500">Ubah nama, nomor urut, dan foto yang tampil di layar kiosk.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((c) => (
          <CandidateCard key={c.id} c={c} onSaved={load} />
        ))}
      </div>
    </div>
  );
}
