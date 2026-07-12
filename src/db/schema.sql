-- NeoBot Supabase schema (masterdoc §9).
--
-- Apply this once in the Supabase SQL editor for your project, then set
-- SUPABASE_URL and SUPABASE_KEY in your environment. NeoBot bootstraps config
-- from your .env on first run, after which Supabase becomes the live source of
-- truth for all reads/writes (see docs/DEPLOYMENT.md).
--
-- The app connects with the service role key and does not rely on row-level
-- security in v1; do not expose these tables to anon clients.

-- Singleton-style config for this one-to-one instance.
create table if not exists config (
  id int primary key default 1,
  data jsonb not null,
  updated_at timestamptz default now(),
  constraint singleton check (id = 1)
);

create table if not exists live_state (
  id int primary key default 1,
  status text not null,            -- connected | disconnected | banned | reconnecting | hibernating-wait
  current_activity text,
  last_updated timestamptz default now(),
  data jsonb,                      -- snapshot: sessions, reconnect history, uptime, started_at
  constraint singleton check (id = 1)
);

create table if not exists events (
  id bigserial primary key,
  created_at timestamptz default now(),
  level text not null,             -- info | warn | error
  category text not null,          -- connection | behavior | discord | watchdog | security
  message text not null,
  meta jsonb
);

create table if not exists sessions (
  id bigserial primary key,
  connected_at timestamptz,
  disconnected_at timestamptz,
  disconnect_reason text
);

create table if not exists admin_users (
  id bigserial primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists alert_settings (
  event_key text primary key,      -- e.g. 'connected', 'banned', 'reconnect_failed'
  enabled boolean default true
);

-- Helpful indexes for the dashboard log/session views.
create index if not exists events_created_at_idx on events (created_at desc);
create index if not exists sessions_connected_at_idx on sessions (connected_at desc);
