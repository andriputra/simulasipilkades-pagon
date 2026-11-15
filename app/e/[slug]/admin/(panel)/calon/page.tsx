"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useEventLabels } from "@/components/EventLabels";
import { useToast } from "@/components/Toast";
import { lower } from "@/lib/event-meta";
import { useEventSlug } from "@/lib/use-event-slug";

type Candidate = {
  id: number;
  number: number;
  name: string;
  tagline: string;
  photo_url: string;
  active: boolean;
  votes: number;
};

async function resizeToDataUrl(file: File, maxW: number, quality = 0.85): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  const raw = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.src = raw;
  });
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

const fieldCls = "mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal";

function PhotoPicker({ onChange }: { onChange: (dataUrl: string) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const dataUrl = await resizeToDataUrl(f, 640);
          if (!dataUrl) {
            toast("File harus berupa gambar.", "error");
            return;
          }
          onChange(dataUrl);
          toast("Foto dimuat. Jangan lupa Simpan.", "info");
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Ganti Foto
      </button>
    </>
  );
}

function CandidateCard({ c, onSaved, onDelete }: { c: Candidate; onSaved: () => void; onDelete: (c: Candidate) => void }) {
  const slug = useEventSlug();
  const toast = useToast();
  const L = useEventLabels();
  const [form, setForm] = useState(c);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/e/${slug}/admin/candidates/${form.id}`, {
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
    toast(`${L.calonPendek} nomor ${form.number} tersimpan.`, "success");
    onSaved();
  };

  const locked = c.votes > 0;

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
              className={fieldCls}
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
        Nama {lower(L.calonPendek)}
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={fieldCls} />
      </label>
      <label className="mt-2 block text-[11px] font-semibold text-slate-600">
        Keterangan / visi singkat
        <input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className={fieldCls} />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <PhotoPicker onChange={(photo_url) => setForm((f) => ({ ...f, photo_url }))} />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-blue-700 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <span className={`text-[11px] font-semibold ${locked ? "text-slate-500" : "text-slate-400"}`}>
          {locked ? `${c.votes} suara masuk` : "Belum ada suara"}
        </span>
        <button
          type="button"
          onClick={() => onDelete(c)}
          disabled={locked}
          title={locked ? "Tidak dapat dihapus: masih punya suara. Nonaktifkan saja." : `Hapus ${lower(L.calonPendek)} ini`}
          className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

function AddCandidateModal({ nextNumber, onClose, onCreated }: { nextNumber: number; onClose: () => void; onCreated: () => void }) {
  const slug = useEventSlug();
  const toast = useToast();
  const L = useEventLabels();
  const [name, setName] = useState("");
  const [number, setNumber] = useState(nextNumber);
  const [tagline, setTagline] = useState("");
  const [photo, setPhoto] = useState("/seed/placeholder.svg");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast(`Nama ${lower(L.calonPendek)} wajib diisi.`, "error");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/e/${slug}/admin/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, number, tagline, photo_url: photo, active: true }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(data.error || `Gagal menambah ${lower(L.calonPendek)}.`, "error");
      return;
    }
    toast(`${L.calonPendek} nomor ${data.number} "${data.name}" ditambahkan.`, "success");
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 px-4" role="dialog" aria-modal="true" onClick={onClose}>
      <form onSubmit={submit} className="pop-in w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900">Tambah {L.calon}</h3>
        <p className="mt-1 text-xs text-slate-500">{L.calonPendek} baru langsung tampil di layar kiosk setelah disimpan.</p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
            <label className="block text-[11px] font-semibold text-slate-600">
              Nama {lower(L.calonPendek)}
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={`cth: ${L.contohNama}`} className={fieldCls} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">
              Nomor urut
              <input type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} className={fieldCls} />
            </label>
          </div>
          <label className="block text-[11px] font-semibold text-slate-600">
            Keterangan / visi singkat
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder={`Visi Misi ${L.calon}`} className={fieldCls} />
          </label>
          <div className="flex items-center gap-3">
            <img src={photo} alt={`Foto ${lower(L.calonPendek)}`} className="h-20 w-16 rounded-md border border-slate-200 bg-slate-50 object-cover" />
            <div className="min-w-0">
              <PhotoPicker onChange={setPhoto} />
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                Belum ada foto? Biarkan placeholder, ganti kapan saja.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-blue-700 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
            {busy ? "Menyimpan…" : `Tambah ${L.calonPendek}`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminCandidatesPage() {
  const slug = useEventSlug();
  const toast = useToast();
  const L = useEventLabels();
  const [list, setList] = useState<Candidate[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Candidate | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/e/${slug}/admin/candidates`);
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doDelete = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/e/${slug}/admin/candidates/${toDelete.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setToDelete(null);
    if (!res.ok) {
      toast(data.error || `Gagal menghapus ${lower(L.calonPendek)}.`, "error");
      return;
    }
    toast(`${L.calonPendek} nomor ${toDelete.number} dihapus.`, "success");
    load();
  };

  if (!list) return <p className="text-sm text-slate-500">Memuat data {lower(L.calonPendek)}…</p>;

  const nextNumber = list.reduce((m, c) => Math.max(m, c.number), 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Data {L.calon}</h2>
          <p className="text-xs text-slate-500">
            Ubah nama, nomor urut, dan foto yang tampil di layar kiosk. {L.calonPendek} boleh ditambah atau dihapus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
        >
          + Tambah {L.calonPendek}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((c) => (
          <CandidateCard key={c.id} c={c} onSaved={load} onDelete={setToDelete} />
        ))}
      </div>

      {adding && <AddCandidateModal nextNumber={nextNumber} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); load(); }} />}

      <ConfirmModal
        open={!!toDelete}
        title={`Hapus ${lower(L.calonPendek)}?`}
        message={`${L.calonPendek} nomor ${toDelete?.number ?? ""} "${toDelete?.name ?? ""}" akan dihapus permanen dan tidak muncul lagi di kiosk.`}
        confirmLabel="Hapus"
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
