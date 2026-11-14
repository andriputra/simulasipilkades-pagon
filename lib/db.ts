import postgres, { type Sql } from "postgres";
import { hashPassword } from "./auth";

const g = globalThis as unknown as { __pilkadesSql?: Sql; __pilkadesInit?: Promise<void> };

export const sql: Sql =
  g.__pilkadesSql ??
  postgres(process.env.DATABASE_URL as string, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") g.__pilkadesSql = sql;

export type Candidate = {
  id: number;
  number: number;
  name: string;
  tagline: string;
  photo_url: string;
  active: boolean;
};

export type Voter = {
  id: number;
  name: string;
  nik: string;
  token: string;
  has_voted: boolean;
  voted_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: number;
  action: string;
  detail: string;
  actor: string;
  ip: string;
  created_at: string;
};

const SCHEMA = `
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
`;

export function ensureSchema(): Promise<void> {
  if (!g.__pilkadesInit) {
    g.__pilkadesInit = (async () => {
      await sql.unsafe(SCHEMA);
      const [s] = await sql`select count(*)::int as n from settings`;
      if (s.n === 0) {
        const defaults: Record<string, string> = {
          title_line1: "PEMERINTAH DESA SUKAMAJU",
          title_line2: "SIMULASI PEMILIHAN KEPALA DESA PERIODE 2026-2032",
          election_status: "open",
          admin_username: "admin",
          admin_password_hash: hashPassword(process.env.ADMIN_PASSWORD || "admin123"),
        };
        for (const [key, value] of Object.entries(defaults)) {
          await sql`insert into settings (key, value) values (${key}, ${value}) on conflict (key) do nothing`;
        }
        const demo: { name: string; token: string }[] = [
          { name: "PEMILIH CONTOH 1", token: "PKD-DEMO-0001" },
          { name: "PEMILIH CONTOH 2", token: "PKD-DEMO-0002" },
          { name: "PEMILIH CONTOH 3", token: "PKD-DEMO-0003" },
          { name: "PEMILIH CONTOH 4", token: "PKD-DEMO-0004" },
          { name: "PEMILIH CONTOH 5", token: "PKD-DEMO-0005" },
        ];
        for (const v of demo) {
          await sql`insert into voters (name, token) values (${v.name}, ${v.token}) on conflict (token) do nothing`;
        }
        await sql`insert into audit_logs (action, detail, actor) values ('SYSTEM_INIT', 'Skema database dibuat & data awal dimuat', 'system')`;
      }
      const [c] = await sql`select count(*)::int as n from candidates`;
      if (c.n === 0) {
        await sql`insert into candidates (number, name, tagline, photo_url) values
          (1, 'CALON KEPALA DESA 1', 'Ganti nama & foto melalui Admin CMS', '/seed/placeholder.svg'),
          (2, 'CALON KEPALA DESA 2', 'Ganti nama & foto melalui Admin CMS', '/seed/placeholder.svg'),
          (3, 'ADE GUNAWAN, S.T.', 'Ganti nama & foto melalui Admin CMS', '/seed/calon-3.jpg'),
          (4, 'CALON KEPALA DESA 4', 'Ganti nama & foto melalui Admin CMS', '/seed/placeholder.svg')`;
      }
    })().catch((err) => {
      g.__pilkadesInit = undefined;
      throw err;
    });
  }
  return g.__pilkadesInit;
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await sql`select key, value from settings`;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`insert into settings (key, value) values (${key}, ${value})
            on conflict (key) do update set value = excluded.value`;
}
