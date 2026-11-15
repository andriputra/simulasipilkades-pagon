-- Memindahkan data single-tenant menjadi event pertama (Pilkades Desa Pagon 2026)
-- dan memberi semua tabel data kolom event_id.
--
-- File ini dijalankan sekali (dicatat di schema_migrations) dan seluruhnya berada
-- dalam satu transaksi: kalau ada langkah yang gagal, tidak ada perubahan yang tersisa.

-- 1. Event pertama, nama & status diambil dari tabel settings warisan.
insert into events (slug, name, kind, status, vote_mode, is_default)
select
  'pilkades-pagon-2026',
  coalesce(nullif((select value from settings where key = 'title_line1'), ''), 'Simulasi Pilkades'),
  'pilkades',
  case when (select value from settings where key = 'election_status') = 'closed' then 'closed' else 'open' end,
  case when (select value from settings where key = 'vote_mode') = 'live' then 'live' else 'simulasi' end,
  true
where not exists (select 1 from events where slug = 'pilkades-pagon-2026');

-- 2. Pengaturan per-event ikut pindah; status & mode sudah jadi kolom di events.
insert into event_settings (event_id, key, value)
select e.id, s.key, s.value
from events e cross join settings s
where e.slug = 'pilkades-pagon-2026'
  and s.key not in ('election_status', 'vote_mode')
on conflict (event_id, key) do nothing;

-- 3. Kolom event_id (mulai nullable agar baris lama bisa diisi sebelum dibatasi).
alter table candidates    add column if not exists event_id int;
alter table voters        add column if not exists event_id int;
alter table votes         add column if not exists event_id int;
alter table audit_logs    add column if not exists event_id int;

update candidates set event_id = (select id from events where slug = 'pilkades-pagon-2026') where event_id is null;
update voters     set event_id = (select id from events where slug = 'pilkades-pagon-2026') where event_id is null;
update audit_logs set event_id = (select id from events where slug = 'pilkades-pagon-2026') where event_id is null;
update votes v
  set event_id = vo.event_id
  from voters vo
  where vo.id = v.voter_id and v.event_id is null;
update votes set event_id = (select id from events where slug = 'pilkades-pagon-2026') where event_id is null;

alter table candidates alter column event_id set not null;
alter table voters     alter column event_id set not null;
alter table votes      alter column event_id set not null;
alter table audit_logs alter column event_id set not null;

-- 4. Kunci unik global diganti kunci unik per-event.
alter table candidates drop constraint if exists candidates_number_key;
alter table voters     drop constraint if exists voters_token_key;
drop index if exists votes_voter_uniq;

alter table candidates add constraint candidates_event_number_uniq unique (event_id, number);
alter table voters     add constraint voters_event_token_uniq unique (event_id, token);
alter table votes      add constraint votes_event_voter_uniq unique (event_id, voter_id);

-- 5. Kunci majemuk: suara wajib menunjuk pemilih & calon dari event yang sama.
alter table candidates add constraint candidates_event_id_uniq unique (event_id, id);
alter table voters     add constraint voters_event_id_uniq unique (event_id, id);

alter table votes drop constraint if exists votes_voter_id_fkey;
alter table votes drop constraint if exists votes_candidate_id_fkey;
alter table votes
  add constraint votes_voter_event_fkey foreign key (event_id, voter_id)
    references voters (event_id, id) on delete cascade,
  add constraint votes_candidate_event_fkey foreign key (event_id, candidate_id)
    references candidates (event_id, id) on delete cascade;

-- 6. Indeks pencarian per-event.
create index if not exists candidates_event_idx    on candidates (event_id, number);
create index if not exists voters_event_voted_idx  on voters (event_id, has_voted);
create index if not exists votes_event_candidate_idx on votes (event_id, candidate_id);
create index if not exists audit_logs_event_idx    on audit_logs (event_id, id desc);
alter table audit_logs add constraint audit_logs_event_id_fkey foreign key (event_id) references events(id) on delete cascade;

-- 7. settings jadi milik platform, bukan milik satu desa.
delete from settings
where key in ('title_line1', 'title_line2', 'admin_username', 'admin_password_hash',
              'invite_date', 'invite_time', 'invite_tps', 'invite_address',
              'invite_watermark', 'logo_url');
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'settings')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'platform_settings') then
    alter table settings rename to platform_settings;
  end if;
end $$;

insert into audit_logs (event_id, action, detail, actor)
select (select id from events where slug = 'pilkades-pagon-2026'),
       'MIGRATION_TENANCY',
       'Data single-tenant dipindahkan ke event pilkades-pagon-2026',
       'system'
where not exists (select 1 from audit_logs where action = 'MIGRATION_TENANCY');
