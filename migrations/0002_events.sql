-- Platform: satu baris per simulasi pemilihan + pengaturan bebas per event.
create table if not exists events (
  id serial primary key,
  slug text not null unique,
  name text not null,
  kind text not null default 'pilkades',
  status text not null default 'draft',
  vote_mode text not null default 'simulasi',
  opens_at timestamptz,
  closes_at timestamptz,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint events_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  constraint events_status_check check (status in ('draft', 'open', 'closed', 'archived')),
  constraint events_vote_mode_check check (vote_mode in ('simulasi', 'live')),
  constraint events_window_check check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table if not exists event_settings (
  event_id int not null references events(id) on delete cascade,
  key text not null,
  value text not null default '',
  primary key (event_id, key)
);

create index if not exists events_default_idx on events (is_default) where is_default;
