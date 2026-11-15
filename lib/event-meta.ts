/**
 * Nilai enum & aturan slug yang boleh diimpor komponen klien.
 *
 * Sengaja berada di berkas sendiri: lib/event.ts menarik koneksi basis data,
 * sehingga komponen "use client" tidak boleh mengimpornya.
 */

export const EVENT_KINDS = ["pilkades", "pilgub", "pilpres", "bel", "polling"] as const;
export const EVENT_STATUSES = ["draft", "open", "closed", "archived"] as const;
export const EVENT_VOTE_MODES = ["simulasi", "live"] as const;

export const EVENT_KIND_LABELS: Record<string, string> = {
  pilkades: "Pilkades (desa)",
  pilgub: "Pilgub (provinsi)",
  pilpres: "Pilpres",
  bel: "BEM / mahasiswa",
  polling: "Polling umum",
};

export const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  open: "Terbuka",
  closed: "Ditutup",
  archived: "Arsip",
};

export const DEFAULT_TOKEN_PREFIX = "PKD";

/**
 * Sebutan yang dipakai seluruh layar (kiosk, panel, surat) untuk satu jenis
 * pemilihan. Berkas ini aman diimpor komponen klien, jadi nilainya literal.
 */
export type EventLabels = {
  /** Sebutan formal satu kandidat, untuk judul: "Calon Kepala Desa". */
  calon: string;
  /** Sebutan pendek untuk menu dan tombol: "Calon". */
  calonPendek: string;
  /** Sebutan pemilik hak pilih: "Pemilih" / "Peserta". */
  pemilih: string;
  /** Tempat pemungutan: "TPS" / "Bilik Suara" / "Kanal". */
  lokasi: string;
  /** Tombol konfirmasi: "COBLOS" / "PILIH". */
  coblos: string;
  /** Kata kerja berimbuhan untuk dipakai di tengah kalimat: "mencoblos" / "memilih". */
  coblosKata: string;
  /** Judul kecil pada surat undangan. */
  surat: string;
  /** Merek panel panitia. */
  panel: string;
  /** Awalan kode peserta yang dibuat sistem: "PKD" / "PLG". */
  kodePrefix: string;
  /** Contoh kode peserta pada kotak input kiosk — selalu diturunkan dari kodePrefix. */
  contohKode: string;
  /** Contoh nama pada formulir kandidat. */
  contohNama: string;
  /** Dua huruf untuk logo kotak di sidebar panel. */
  monogram: string;
};

/**
 * Nilai yang ditulis per jenis pemilihan. `contohKode` diturunkan dari
 * `kodePrefix` di labelsFor() agar contoh di kiosk tidak melenceng dari
 * format kode asli.
 */
export type EventPreset = Omit<EventLabels, "contohKode">;

const BASE_LABELS: EventPreset = {
  calon: "Calon",
  calonPendek: "Calon",
  pemilih: "Pemilih",
  lokasi: "TPS",
  coblos: "COBLOS",
  coblosKata: "memilih",
  surat: "Undangan Memilih",
  panel: "CMS Simulasi",
  kodePrefix: "SIM",
  contohNama: "Nama kandidat",
  monogram: "SI",
};

export const EVENT_KIND_PRESETS: Record<string, EventPreset> = {
  pilkades: {
    ...BASE_LABELS,
    calon: "Calon Kepala Desa",
    coblosKata: "mencoblos",
    surat: "Undangan Mencoblos",
    panel: "CMS Pilkades",
    kodePrefix: "PKD",
    contohNama: "ADE GUNAWAN, S.T.",
    monogram: "PK",
  },
  pilgub: {
    ...BASE_LABELS,
    calon: "Calon Gubernur",
    coblosKata: "mencoblos",
    surat: "Undangan Mencoblos",
    panel: "CMS Pilgub",
    kodePrefix: "PGU",
    contohNama: "H. SURYADI, M.M.",
    monogram: "PG",
  },
  pilpres: {
    ...BASE_LABELS,
    calon: "Calon Presiden",
    coblosKata: "mencoblos",
    surat: "Undangan Mencoblos",
    panel: "CMS Pilpres",
    kodePrefix: "PPR",
    contohNama: "DR. ANI RAHMA, S.H.",
    monogram: "PP",
  },
  bel: {
    ...BASE_LABELS,
    calon: "Calon Ketua BEM",
    lokasi: "Bilik Suara",
    panel: "CMS Pemilihan Mahasiswa",
    kodePrefix: "BEM",
    contohNama: "RIZKY AMALIA",
    monogram: "BM",
  },
  polling: {
    ...BASE_LABELS,
    calon: "Opsi Pilihan",
    calonPendek: "Opsi",
    pemilih: "Peserta",
    lokasi: "Kanal",
    coblos: "PILIH",
    surat: "Undangan Voting",
    panel: "CMS Polling",
    kodePrefix: "PLG",
    contohNama: "Program Internet Gratis",
    monogram: "PL",
  },
};

export function labelsFor(kind: string | null | undefined): EventLabels {
  const preset = EVENT_KIND_PRESETS[kind || ""] || BASE_LABELS;
  return { ...preset, contohKode: `${preset.kodePrefix}-DEMO-0001` };
}

/**
 * Awalan kode peserta: nilai yang disimpan panitia menang, bila kosong
 * diturunkan dari jenis pemilihan agar kode baru langsung cocok dengan
 * sebutan di layar. Menghindari penulisan baris pengaturan saat event dibuat.
 */
export function tokenPrefixFor(kind: string | null | undefined, configured?: string | null): string {
  const clean = (configured || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean || labelsFor(kind).kodePrefix;
}

/** Label dinormalisasi ke huruf kecil untuk dipakai di tengah kalimat. */
export function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Format slug yang diizinkan juga ditegakkan oleh constraint di tabel events. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}
