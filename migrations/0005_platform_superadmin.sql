-- Konsol platform: akun superadmin, sesi yang bisa dicabut, dan jejak audit lintas simulasi.
--
-- Semua perubahan bersifat aditif terhadap data event: tidak ada baris simulasi yang
-- berpindah atau berubah bentuk. Tabel platform di bawah sengaja TANPA event_id dan
-- TANPA row level security karena hanya boleh disentuh kode konsol /platform yang
-- sudah memeriksa sesi superadmin, bukan lewat API publik.

create table if not exists platform_users (
  id serial primary key,
  username text not null unique,
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Sesi disimpan sebagai hash token, bukan token aslinya: bocornya isi tabel ini
-- tidak memberi akses login, dan satu sesi bisa dicabut tanpa mengubah password.
create table if not exists platform_sessions (
  id serial primary key,
  user_id int not null references platform_users(id) on delete cascade,
  token_hash text not null unique,
  ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists platform_sessions_user_idx on platform_sessions (user_id, expires_at desc);

-- Audit konsol: siapa membuat/mengubah/mengarsipkan simulasi, ganti kredensial panitia,
-- dan masuk sebagai panitia. event_id nullable karena banyak aksi lintas event.
create table if not exists platform_audit (
  id serial primary key,
  actor text not null,
  action text not null,
  detail text not null default '',
  event_id int references events(id) on delete set null,
  ip text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_created_idx on platform_audit (id desc);
create index if not exists platform_audit_event_idx on platform_audit (event_id, id desc);

-- ---------------------------------------------------------------------------
-- RLS: diberi jalur baca untuk konsol platform.
--
-- Kebijakan lama hanya mengakui app.event_id, sehingga laporan lintas simulasi
-- (jumlah pemilih/suara per event, audit global) selalu membaca 0 baris. Setiap
-- kebijakan sekarang memakai bentuk:
--   using      : ruang lingkup platform ATAU event yang sedang aktif
--   with check : selalu event yang sedang aktif
-- Artinya superadmin boleh membaca dan menghapus lintas event lewat jalur
-- platform, tetapi tidak bisa menyisipkan baris data ke event mana pun tanpa
-- membuka transaksi event tersebut (withEvent) — jadi alur panitia tidak bisa
-- ditiru dari luar.
-- ---------------------------------------------------------------------------

drop policy if exists event_settings_event_scope on event_settings;
create policy event_settings_event_scope on event_settings
  for all
  using     (current_setting('app.platform_admin', true) = '1'
             or event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

drop policy if exists candidates_event_scope on candidates;
create policy candidates_event_scope on candidates
  for all
  using     (current_setting('app.platform_admin', true) = '1'
             or event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

drop policy if exists voters_event_scope on voters;
create policy voters_event_scope on voters
  for all
  using     (current_setting('app.platform_admin', true) = '1'
             or event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

drop policy if exists votes_event_scope on votes;
create policy votes_event_scope on votes
  for all
  using     (current_setting('app.platform_admin', true) = '1'
             or event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

drop policy if exists audit_logs_event_scope on audit_logs;
create policy audit_logs_event_scope on audit_logs
  for all
  using     (current_setting('app.platform_admin', true) = '1'
             or event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);
