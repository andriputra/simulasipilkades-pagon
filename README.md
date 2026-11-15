# Platform Simulasi Pemungutan Suara

Aplikasi Next.js untuk menjalankan **banyak simulasi pemilihan dalam satu deployment** — pilkades, pilgub, pilpres, pemilihan BEM, atau polling internal. Setiap simulasi punya URL, data, akun panitia, dan kiosk sendiri; satu konsol superadmin mengelolanya dari atas.

## Peta URL & peran

| URL | Untuk siapa | Fungsi |
| --- | --- | --- |
| `/` | umum | Dialihkan ke simulasi berstatus *halaman depan* (`events.is_default`) |
| `/e/[slug]` | peserta | Kiosk: scan/kenal kode, pilih, konfirmasi |
| `/e/[slug]/admin` | panitia | Panel: opsi, peserta & QR, pengaturan, audit, cetak undangan |
| `/platform` | superadmin | Konsol: buat/ubah/arsipkan/hapus simulasi, kredensial panitia, rekap lintas simulasi, audit & akun |

Tiga lapis penjaga sesi: middleware menolak tanpa cookie konsol (`/platform/*`), `adminRoute()` menuntut sesi panitia milik *event di URL yang sama*, dan kebijakan RLS memastikan query event hanya menyentuh barisnya sendiri.

## Jenis pemilihan & label

`kind` pada event menentukan seluruh kosakata aplikasi — `"Calon Kepala Desa"` vs `"Opsi"`, `"Pemilih"` vs `"Peserta"`, `"mencoblos"` vs `"memilih"`, termasuk prefiks kode QR (`PKD-…`, `PLG-…`). Preset dan helper-nya ada di [lib/event-meta.ts](lib/event-meta.ts) (murni, tanpa basis data) dan dibagikan ke kiosk, panel, undangan, dan API lewat context di [components/EventLabels.tsx](components/EventLabels.tsx).

Prefiks kode boleh ditimpa panitia di Pengaturan; bila kosong, nilai diturunkan dari `kind` saat dibaca, jadi event lama ikut menyesuaikan tanpa migrasi data.

## Isolasi data

Satu basis data, baris dipisah kolom `event_id`. Semua akses per-event wajib lewat `withEvent(eventId, tx => …)` yang mengisi `app.event_id`; jalur konsol lintas simulasi lewat `withPlatform(…)` yang hanya membuka SELECT/DELETE — INSERT/UPDATE tetap butuh konteks event ([lib/db.ts](lib/db.ts)). Kebijakan row-level-security dibuat di [migrations/0004_row_level_security.sql](migrations/0004_row_level_security.sql) dan direvisi di [migrations/0005_platform_superadmin.sql](migrations/0005_platform_superadmin.sql).

Konsekuensi yang sering mengecoh: query ad-hoc `psql` tanpa `set_config('app.event_id', …)` atau `app.platform_admin` akan melihat **nol baris**, bukan error. Itu perilaku yang diharapkan.

## Mode pemungutan & jendela waktu

- **Simulasi** — satu kode boleh dipakai ulang; suara terakhir menimpa, tetap terhitung satu suara per peserta.
- **Live** — suara peserta terkunci setelah mencoblos; scan kedua ditolak.

Status manual (`draft`/`open`/`closed`/`archived`) bisa dipersempit lagi dengan jadwal buka-tutup (`opens_at`/`closes_at`, disimpan sebagai WIB). Kiosk memakai **status efektif**: status manual `open` di luar jadwal tetap menolak suara. Konsol menampilkan keduanya bila berbeda.

## Fitur utama

**Panel panitia** — CRUD opsi (nomor urut unik, foto), peserta satuan atau massal, impor CSV (hingga 5.000 baris; pemisah `,` `;` tab `|` dideteksi otomatis, NIK ganda dalam berkas maupun terhadap basis data ditolak beserta nomor barisnya), ekspor daftar peserta, cetak undangan/QR, audit log berfilter, reset suara.

**Kiosk** — scan kamera atau ketik kode, layar pilih, konfirmasi, dan (mode simulasi) peringatan bahwa pilihan boleh diganti.

**Konsol platform** — buat/ubah simulasi, tentukan halaman depan, ganti kredensial panitia, masuk sebagai panitia (impersonasi) untuk membantu hari-H, arsipkan, hapus permanen (bersyarat peserta nol), **rekap lintas simulasi** ([app/platform/(konsol)/rekap/page.tsx](app/platform/(konsol)/rekap/page.tsx)) plus ekspor CSV gabungan yang ikut filter aktif.

## Menjalankan secara lokal

```bash
npm run localdb      # siapkan Postgres lokal (data di .localdb/)
npm run migrate      # terapkan migrations/0001..0005
npm run db:snapshot  # salin data produksi ke DB lokal (prod -> lokal, satu arah)
npm run dev
```

Akun dev lokal dibuat lewat stdin (password jangan ditulis sebagai argumen agar tidak masuk riwayat shell):

```bash
echo -ne 'rahasia123\n' | npm run admin:password -- <slug-event> [username]   # panel panitia
echo -ne 'rahasia123\n' | npm run superadmin -- <username> [nama tampilan]    # konsol platform
```

Keduanya menolak `DATABASE_URL` jarak jauh kecuali `--allow-remote` ditulis eksplisit. Nilai kredensial DB development ada di [scripts/config.mjs](scripts/config.mjs) — khusus lokal, jangan dipakai di mana pun selain `127.0.0.1`.

`lib/db.ts` menolak `DATABASE_URL` jarak jauh saat `NODE_ENV=development` kecuali `ALLOW_REMOTE_DB=1` ditulis sadar, supaya percobaan lokal tidak pernah menulis ke data klien.

## Variabel lingkungan

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | ya | Postgres tujuan. Mode development dipaksa lokal |
| `SESSION_SECRET` | ya | Penanda token sesi; tanpa ini aplikasi menolak jalan ([lib/auth.ts](lib/auth.ts)) |
| `ALLOW_REMOTE_DB` | tidak | `1` = izinkan development menyentuh DB jarak jauh |
| `TARGET_DATABASE_URL` | tidak | Override tujuan `npm run db:snapshot` |

Berkas `.env.local` (produksi) dan `.env.development.local` (lokal) tidak ikut ke git.

## Cadangan & pemulihan

Kebijakan yang dipilih: **cadangan basis data adalah tugas Neon**, aplikasi tidak membuat berkas cadangan sendiri.

- **Pulihkan produksi** — lakukan dari konsol Neon (backup / point-in-time restore sesuai paket yang dipakai). Tidak ada tombol reset basis data di aplikasi.
- **Salin produksi ke lokal** — `npm run db:snapshot` menarik `settings`, `candidates`, `voters`, `votes`, `audit_logs` dari `DATABASE_URL` di `.env.local` lalu menulisnya ke Postgres lokal sebagai satu simulasi. Arahnya satu arah; skrip menolak tujuan jarak jauh kecuali `--allow-remote-target` ditulis sadar.
- **Sebelum perubahan berisiko** — pastikan backup Neon tersedia, jalankan `db:snapshot`, lalu rehearse migrasi/perubahan di lokal lebih dulu.
- **Ekspor berkala dari dalam aplikasi** — daftar peserta per simulasi (CSV), rekap hasil per simulasi (CSV), dan rekap lintas simulasi (CSV gabungan dari konsol). Cukup untuk arsip laporan harian.

## Catatan rilis

Perubahan skema dibuat bertahap dan bisa dimundur: `0002` tabel event, `0003` backfill `event_id`, `0004` RLS, `0005` superadmin platform. Sebelum menjalankan terhadap basis data produksi, pastikan `SESSION_SECRET` sudah terisi, role aplikasi **tidak** memegang `BYPASSRLS` (kalau ya, RLS hanya formalitas), dan cadangan dibuat lebih dulu.

Verifikasi fitur dilakukan pada build produksi, bukan `next dev`:

```bash
npm run build && npx next start -p 3210
```

## Checklist cutover ke produksi

Semua langkah di bawah mengubah basis data produksi Neon, jadi baru dijalankan atas persetujuan pemilik data. Urutannya disengaja: kredensial dulu, skema belakangan, supaya migrasi terakhir yang berjalan adalah yang paling akhir.

0. **Jangan push ke branch yang auto-deploy** — build baru menuntut `events`/`event_settings`/`platform_users` dan `SESSION_SECRET`; bila host langsung men-deploy branch ini, produksi error sebelum migrasi sempat jalan. Kirim ke branch terpisah (mis. `platform-multi-event`) dan aktifkan preview-only, lalu jadikan satu deployment dengan langkah 1–4 di bawah. Jendela antara migrasi dan deployment juga tidak aman bagi build lama: `0003` mengganti nama `settings` menjadi `platform_settings`, sementara build lama masih membacanya.

1. **Cadangan** — pastikan restore point Neon mencakup sesaat sebelum jendela cutover, lalu `npm run db:snapshot` sebagai salinan kedua di lokal.
2. **`SESSION_SECRET`** — isi di dashboard Neon/Vercel (host) lebih dulu; tanpanya aplikasi menolak jalan.
3. **Role aplikasi non-`BYPASSRLS`** — buat role (mis. `pilkades_app`) dengan `NOBYPASSRLS` + `LOGIN`, grant `usage` pada schema dan `select, insert, update, delete` atas tabel aplikasi serta `usage` atas sequence-nya; pindahkan `DATABASE_URL` ke role ini. Cek: `select rolname, rolbypassrls from pg_roles where rolname = current_role;` harus `f`.
4. **Migrasi** — `npm run migrate -- --allow-remote` (0002 → 0005). Bila ingin berhenti di satu file: `--until 0004_row_level_security.sql`. Bila satu file gagal, transaksi file itu dibatalkan dan `schema_migrations` tidak mencatatnya, jadi perbaikan bisa langsung dijalankan ulang.
5. **Verifikasi angka** — bandingkan sebelum/sesudah: jumlah `voters`, `candidates`, `votes`, baris `events` (harus 1, slug `pilkades-pagon-2026`, `is_default = true`), dan `audit_logs`. Query harus dibuka dengan `select set_config('app.platform_admin','1',false);` agar RLS tidak menampilkan nol baris palsu. Pastikan juga tidak ada baris yatim yang ditulis build lama di antara migrasi dan deployment: `select count(*) from voters where event_id is null;` harus 0 — kalau bukan 0, ulangi `update voters set event_id = (select id from events where slug = 'pilkades-pagon-2026') where event_id is null;` (sama untuk `candidates`, `votes`, `audit_logs`).
6. **Superadmin pertama** — `echo -ne 'rahasia\n' | npm run superadmin -- <username> [nama] --allow-remote`, lalu masuk ke `/platform/login`.
7. **Smoke test** — `/` mengarah ke `/e/pilkades-pagon-2026`; panel panitia login dan halaman Pengaturan menampilkan kop/undangan lama (nilainya sudah pindah ke `event_settings`); kiosk menerima satu suara uji lalu reset lewat panel.
8. **Tabel warisan** — `settings` berganti nama menjadi `platform_settings` dan isinya sudah dipindah; tidak ada lagi kode yang membacanya. Baris sisa seperti `election_status`/`vote_mode` hanya sampah migrasi — biarkan sampai ada keputusan terpisah untuk membersihkannya.

Rollback skema tidak otomatis: kembalikan restore point Neon, atau `git revert` kode lalu deploy build lama. `0003` tidak menyentuh baris pemungutan — `candidates`, `voters`, `votes`, dan `audit_logs` hanya diisi `event_id`; yang dihapus hanyalah baris `settings` yang salinannya sudah masuk `event_settings`.
