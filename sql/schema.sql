-- Project Farmer Keynote Day 2026-07-18 — Scoring System Schema
-- Run in Supabase SQL editor before deploying the app.

create table if not exists sessions (
  slot_key  text primary key,
  email     text not null,
  name      text not null,
  locked_at timestamptz default now()
);
-- Mentor login locks role:mentor under the identifier "mentor".
-- Uniqueness is enforced per slot_key (PK), not per email.

-- Migration from earlier schema (if sessions_email_unique exists):
-- drop index if exists sessions_email_unique;

create table if not exists votes (
  id          serial primary key,
  voter_email text not null,
  voter_name  text not null,
  from_team   text not null,
  to_team_id  int not null,
  points      int not null,
  created_at  timestamptz default now()
);

alter table sessions enable row level security;
alter table votes    enable row level security;
create policy "allow all" on sessions for all using (true) with check (true);
create policy "allow all" on votes    for all using (true) with check (true);

create table if not exists event_state (
  id               int primary key default 1 check (id = 1),
  winner_announced boolean not null default false
);
insert into event_state (id, winner_announced) values (1, false)
  on conflict (id) do nothing;

alter table event_state enable row level security;
create policy "allow all" on event_state for all using (true) with check (true);

alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table event_state;
