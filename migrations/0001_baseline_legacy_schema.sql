-- Baseline: skema warisan aplikasi single-tenant (idempotent, jadi aman dijalankan
-- di database produksi yang sudah punya tabel-tabel ini).
create table if not exists settings (
  key text primary key,
  value text not null default ''
);
create table if not exists candidates (
  id serial primary key,
  number int not null unique,
  name text not null,
  tagline text not null default '',
  photo_url text not null default '/seed/placeholder.svg',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists voters (
  id serial primary key,
  name text not null,
  nik text not null default '',
  token text not null unique,
  has_voted boolean not null default false,
  voted_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists votes (
  id serial primary key,
  voter_id int not null references voters(id) on delete cascade,
  candidate_id int not null references candidates(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists votes_voter_uniq on votes(voter_id);
create table if not exists audit_logs (
  id serial primary key,
  action text not null,
  detail text not null default '',
  actor text not null default 'system',
  ip text not null default '',
  created_at timestamptz not null default now()
);
