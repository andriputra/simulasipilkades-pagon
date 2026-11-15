-- Guard isolasi. Setelah ini, query yang lupa memfilter event_id tidak akan
-- "bocor" membaca event lain: kebijakan di bawah membandingkan baris dengan
--app.event_id yang di-set helper withEvent() di dalam transaksi.
--
-- Catatan: superuser tetap menembus RLS. Di Neon, peran aplikasi (pemilik tabel)
-- bukan superuser, dan FORCE ROW LEVEL SECURITY membuat pemilik tabel ikut tunduk.

alter table event_settings enable row level security;
alter table event_settings force  row level security;
create policy event_settings_event_scope on event_settings
  using     (event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

alter table candidates enable row level security;
alter table candidates force  row level security;
create policy candidates_event_scope on candidates
  using     (event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

alter table voters enable row level security;
alter table voters force  row level security;
create policy voters_event_scope on voters
  using     (event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

alter table votes enable row level security;
alter table votes force  row level security;
create policy votes_event_scope on votes
  using     (event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);

alter table audit_logs enable row level security;
alter table audit_logs force  row level security;
create policy audit_logs_event_scope on audit_logs
  using     (event_id = nullif(current_setting('app.event_id', true), '')::int)
  with check (event_id = nullif(current_setting('app.event_id', true), '')::int);
