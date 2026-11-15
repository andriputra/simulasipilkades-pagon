# Runbook cutover — melepas build multi-simulasi di produksi

Berkas ini hasil persiapan 2026-11-15 dan **belum di-commit**. Isinya langkah eksekusi, bukan arsitektur
(arsitektur & alasan desain ada di `README.md`). Semua angka di bawah terukur, bukan taksiran.

## 0. Posisi saat ini (terverifikasi 2026-11-15 ±15:30 WIB)

| Hal | Status |
| --- | --- |
| Kode di `main` (GitHub) | **sudah berisi platform multi-event** — PR #1 dimerge 14:59:57 WIB (`a74bc94` = `5f8baab` + `df361cb`) |
| Build `main` di Vercel | `simulasipilkades-pagon-3jmypuqlo-agusandriputras-projects.vercel.app` — `● Ready`, target production, 46 s |
| Yang aktif di `simulasipilkades-pagon.vercel.app` | build lama `df361cb` — deployment `-bcug8i20d-` memegang alias produksi (hasil rollback 15:1x WIB) |
| Basis data Neon | **belum bermigrasi** — skema warisan: `settings voters votes candidates audit_logs` |
| Env Production | `SESSION_SECRET` + `DATABASE_URL` sudah ada (23 jam lalu) |
| Data produksi | 15 pemilih · 4 calon · 2 suara · 383 audit · `election_status=open` · `vote_mode=simulasi` |
| Aktivitas | masih ada — audit `#426 VOTER_UPDATED` 15:25 WIB |
| Role koneksi Neon | `neondb_owner`, `bypassrls=true` (kebijakan RLS dibuat tapi belum menegasi role ini) |

**Kesimpulan: tidak ada lagi yang perlu di-commit atau di-push untuk kode.** Yang tersisa hanya
menyelaraskan basis data dengan build, dan itu butuh jendela downtime.

## 1. Gladi resik yang sudah dijalankan (DB tiruan lokal, tidak menyentuh produksi)

Kondisi awal ditiru persis: skema dari `migrations/0001` + salinan data produksi (beda kolom: nol).

| Uji | Hasil |
| --- | --- |
| `npm run migrate` (5 berkas) | lolos, **1,4 s** di mesin lokal |
| Hitungan pasca-migrasi | 15 pemilih / 4 calon / 2 suara utuh; audit 383 + 1 `MIGRATION_TENANCY` |
| Baris tanpa `event_id` | 0 di keempat tabel |
| Event hasil | `#1 pilkades-pagon-2026` · Pilkades · open · simulasi · `is_default` |
| `settings` → `event_settings` | 10 kunci pindah, termasuk **`admin_password_hash`** → sandi panel panitia TIDAK perlu direset |
| Sisa di `platform_settings` | hanya `election_status`, `vote_mode` (dipindah jadi kolom `events`) |
| Build produksi (`next start`) vs DB tiruan | `/` → 307 `/e/pilkades-pagon-2026` (200) · `/platform/login` 200 · panel 200 · `/admin/login` 404 |
| Alur kiosk penuh di browser | kode `PKD-DEMO-0002` → pilih calon 3 → konfirmasi → suara tersimpan (`votes`=3, `has_voted`=true, audit `VOTE_CAST` ber-`event_id`) |
| Panel panitia | dashboard: 15 pemilih, 3 suara, partisipasi 20%; pengaturan & kartu undangan menampilkan jadwal produksi apa adanya |
| Konsol platform | daftar simulasi + Rekap Lintas Simulasi + Audit Global terisi data hasil migrasi |
| RLS | tanpa `app.event_id` → 0 baris; dengan `app.event_id=1` → 15; dengan `999` → 0 |

Yang diukur dari laptop ke Neon: **±290 ms per query**, koneksi pertama ±4,5 s → perkiraan durasi
`migrate` produksi **±10–20 s**.

## 2. Yang terjadi pada build lama begitu migrasi commit (blast radius, teruji)

| Perilaku build lama | Hasil setelah migrasi |
| --- | --- |
| baca/ubah `settings` (halaman kiosk, undangan, rekap) | `42P01 relation "settings" does not exist` → 500 |
| kirim suara / tambah pemilih / tulis audit (role BYPASSRLS) | `23502 null value in column "event_id"` → gagal, **tidak ada tulis separuh** |
| baca data | masih jalan (role bypass RLS) |

Jadi jendela migrasi = situs lama error, tanpa risiko data rusak atau suara kembar. Targetkan downtime
pendek: migrate → promote berturut-turut.

## 3. Prasyarat (sebelum jendela)

1. **Cadangan Neon**: konsol Neon → *Restore Project* / buat Restore Point, catat namanya. Tanpa ini tidak
   ada jalan kembali basis data selain menulis ulang manual.
2. Salinan lokal (opsional, tambahan): `npm run db:snapshot` → menulis ke `pilkades_dev` dan **hanya**
   menimpa event `pilkades-pagon-2026`; event uji `uji-rekap-polling` aman.
3. Beri tahu panitia: jangan pakai panel/kiosk pada jendela ini. Lihat aktivitas:
   `node scripts/cutover-status.mjs` (baris `Audit terakhir`).
4. Opsional tapi mematikan risiko suara hilang: tutup pemungutan lewat panel lama (`Status: Ditutup`)
   sesaat sebelum migrate, lalu buka kembali lewat panel baru setelahnya.
5. Pastikan tidak ada push ke `main` selama jendela — `main` sudah berisi kode baru, jadi satu push saja
   langsung memasang build baru di atas basis data lama (persis insiden 15:00 WIB).

## 4. Eksekusi (perintah persis, Git Bash, dari folder repo)

```bash
# 4.1 baseline — catat angkanya
node scripts/cutover-status.mjs

# 4.2 migrasi Neon (satu-satunya langkah yang menulis skema; ±10–20 s)
npm run migrate -- --allow-remote

# 4.3 verifikasi skema & hitungan (harus MULTI-EVENT, "Baris tanpa event_id ... (bersih)")
node scripts/cutover-status.mjs --expect

# 4.4 pasang build main yang sudah Ready (detik, bukan menit)
vercel promote https://simulasipilkades-pagon-3jmypuqlo-agusandriputras-projects.vercel.app

# 4.5 probe publik: / 200 · /platform/login 200 · /e/pilkades-pagon-2026 200 · /admin/login 404
for u in / /platform/login /e/pilkades-pagon-2026 /admin/login; do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' https://simulasipilkades-pagon.vercel.app$u)"
done

# 4.6 buat akun konsol superadmin produksi (sandi dibaca dari stdin, ≥10 karakter)
echo -ne 'SANDI-KONSOL-BARU\n' | npm run superadmin -- andri "Andri Putra" --allow-remote
```

Bila 4.4 gagal/promote tidak tersedia: buka deployment `-3jmypuqlo-` di dashboard Vercel → **Redeploy**,
atau `npm run build && vercel deploy --prebuilt --prod` dari branch ini.

## 5. Verifikasi setelah pasang

Dua hal yang terverifikasi di tiruan dan perlu diketahui lebih dulu:

- Jeda antara 4.4 (promote) dan 4.6 (buat superadmin) **aman**: kiosk dan panel tetap jalan,
  `/platform/login` tampil tapi belum bisa masuk. Tidak ada crash karena tabel `platform_users` kosong.
- Sesi panel buatan build lama **tidak lagi berlaku** setelah cutover: payload token berubah dari
  `admin` menjadi `e<event_id>` (`lib/admin.ts:32`), jadi panitia cukup masuk ulang satu kali. Efek
  sampingnya menguntungkan — cookie produksi yang sempat bocor ikut mati.

- [ ] `https://simulasipilkades-pagon.vercel.app/` melempar ke `/e/pilkades-pagon-2026` dan judul
      "PEMERINTAH DESA PAGON" muncul.
- [ ] Panel panitia `/e/pilkades-pagon-2026/admin/login`: username `admin` + **sandi lama tetap berlaku**
      (hash ikut bermigrasi). Cek Rekap: jumlah suara sama dengan baseline 4.1.
- [ ] `/platform/login` masuk dengan akun 4.6; daftar simulasi menampilkan 1 event dengan hitungan yang sama.
- [ ] Uji suara satu pemilih lewat panel → **Hapus pemilih uji itu** (jangan `reset votes` massal di produksi).
- [ ] `node scripts/cutover-status.mjs` → `events=1`, nol `event_id` null, RLS 5/5.

## 6. Bila harus mundur

| Keadaan | Aksi |
| --- | --- |
| Build baru terpasang tapi ada yang salah, data sudah bermigrasi | `vercel ls` → `vercel rollback <url-deployment-lama>` (build lama kembali jalan; **tapi** tidak bisa menulis lagi karena `settings` sudah hilang — jadi ini hanya darurat tampilan) |
| Migrasi harus dibatalkan total | Neon → restore ke Restore Point 3.1, lalu `vercel rollback` ke build lama |
| Migrasi gagal di tengah | aman: tiap berkas satu transaksi, tidak ada perubahan yang tertinggal; perbaiki pesan error lalu jalankan ulang |

## 7. Setelah cutover (pekerjaan lanjutan, bukan blocker)

1. **Ganti sandi panel panitia** — sesi produksi (`pilkades_admin=…`) sempat tertempel di percakapan:
   `echo -ne 'SANDI-BARU\n' | npm run admin:password -- pilkades-pagon-2026 admin --allow-remote`
2. **Role aplikasi non-BYPASSRLS di Neon** (mis. `pilkades_app`) agar RLS benar-benar mengikat, lalu
   arahkan `DATABASE_URL` Vercel ke role itu. Sebelum ini, isolasi event hanya dijaga kode aplikasi.
3. Bersihkan artefak gladi resik: `drop database pilkades_dryrun` (lokal) dan hapus
   `scripts/_dryrun-*.mjs` bila tidak dipakai lagi.
4. Simulasi kedua tinggal dibuat dari `/platform` — tidak ada lagi langkah skema.
