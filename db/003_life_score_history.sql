-- =====================================================================
-- 003_life_score_history.sql
-- Daily snapshot of the combined Life Score pulse, used to compute
-- trend (rising/steady/falling) against yesterday's score.
-- Run this AFTER 001_schema.sql.
-- =====================================================================

create table public.life_score_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  recorded_on date not null default current_date,
  score       smallint not null check (score between 0 and 100),
  band        text not null check (band in ('thriving','steady','strained','critical')),
  created_at  timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create index idx_life_score_history_user_date
  on public.life_score_history(user_id, recorded_on desc);

alter table public.life_score_history enable row level security;

create policy "life_score_history_all_own" on public.life_score_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
