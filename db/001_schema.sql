-- =====================================================================
-- AI TIME & LIFE OPTIMIZATION PLATFORM
-- Step 1: Exhaustive Database Schema (PostgreSQL / Supabase)
-- =====================================================================
-- Run this in Supabase SQL editor, or via `supabase db push`.
-- Requires: pgcrypto (uuid), pgvector (for future semantic search on
-- goals/tasks/reflections).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
create type chronotype as enum ('lion', 'bear', 'wolf', 'dolphin');
create type energy_level as enum ('peak', 'high', 'medium', 'low', 'trough');
create type eisenhower_quadrant as enum (
  'urgent_important',       -- Do
  'not_urgent_important',   -- Schedule
  'urgent_not_important',   -- Delegate
  'not_urgent_not_important' -- Eliminate
);
create type abcde_priority as enum ('A', 'B', 'C', 'D', 'E');
create type moscow_priority as enum ('must', 'should', 'could', 'wont');
create type task_status as enum (
  'backlog', 'scheduled', 'in_progress', 'blocked',
  'completed', 'missed', 'cancelled'
);
create type habit_frequency as enum ('daily', 'weekdays', 'weekly', 'custom');
create type focus_session_type as enum (
  'deep_work', 'lockdown', 'co_working', 'nsdr', 'micro_break'
);
create type reflection_mood as enum ('great', 'good', 'neutral', 'low', 'burnt_out');

-- ---------------------------------------------------------------------
-- USERS  (extends Supabase auth.users via 1:1 profile row)
-- ---------------------------------------------------------------------
create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text,
  timezone              text not null default 'UTC',
  chronotype            chronotype default 'bear',
  hourly_rate           numeric(12,2) default 0,          -- for Financial Opportunity Cost Tracker
  cortisol_peak_hour    smallint default 8 check (cortisol_peak_hour between 0 and 23),
  cortisol_trough_hour  smallint default 15 check (cortisol_trough_hour between 0 and 23),
  work_start_time       time default '09:00',
  work_end_time         time default '18:00',
  planning_correction_factor numeric(5,3) default 1.000,  -- Planning Fallacy ML output
  cognitive_load_max    numeric(5,2) default 100,          -- Mental Battery capacity
  onboarding_completed  boolean default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- GOALS  (top-level, decomposed by Gemini into projects/tasks)
-- ---------------------------------------------------------------------
create table public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  title           text not null,
  description     text,
  target_date     date,
  is_reverse_planned boolean default false,   -- Reverse Time Blocking flag
  embedding       vector(768),                -- pgvector semantic search
  status          text default 'active' check (status in ('active','achieved','archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PROJECTS  (mid-level grouping under a goal)
-- ---------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  goal_id     uuid references public.goals(id) on delete set null,
  title       text not null,
  description text,
  color_hex   text default '#6366f1',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TASKS  (core scheduling unit: Eisenhower + ABCDE + MoSCoW + CoD + Energy)
-- ---------------------------------------------------------------------
create table public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  project_id            uuid references public.projects(id) on delete set null,
  goal_id               uuid references public.goals(id) on delete set null,
  parent_task_id        uuid references public.tasks(id) on delete cascade, -- sub-tasks from decomposition

  title                 text not null,
  description           text,

  -- Prioritization frameworks (Section A)
  eisenhower_quadrant   eisenhower_quadrant,
  abcde                 abcde_priority,
  moscow                moscow_priority,
  is_in_1_3_5           boolean default false,    -- 1-3-5 Rule membership
  one_3_5_size          text check (one_3_5_size in ('big','medium','small')),

  -- Cost of Delay / dynamic backlog scoring
  cod_value             numeric(12,2) default 0,   -- $ value lost per unit time delayed
  cod_urgency_profile   text default 'linear' check (cod_urgency_profile in ('linear','fixed_date','expedite','intangible')),
  dynamic_priority_score numeric(10,4) default 0,   -- computed WSJF-style score, refreshed by engine

  -- Time estimation & Planning Fallacy correction
  estimated_minutes     integer not null default 30,
  corrected_minutes     integer,                    -- estimated_minutes * user.planning_correction_factor
  actual_minutes        integer,

  -- Energy / bio-hacking
  required_energy       energy_level default 'medium',
  cognitive_load_cost   numeric(5,2) default 10,     -- drains Mental Battery gauge

  -- Scheduling
  scheduled_start        timestamptz,
  scheduled_end           timestamptz,
  buffer_minutes_before  integer default 0,
  buffer_minutes_after   integer default 5,

  status                task_status not null default 'backlog',
  is_hard_deadline       boolean default false,
  deadline_at            timestamptz,

  embedding             vector(768),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- HABITS  (Micro-Habit Stacking Engine)
-- ---------------------------------------------------------------------
create table public.habits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  title             text not null,
  trigger_task_id   uuid references public.tasks(id) on delete set null, -- "stacked after" routine task
  frequency         habit_frequency not null default 'daily',
  custom_rrule      text,                       -- iCal RRULE for 'custom'
  duration_minutes  integer default 5,
  current_streak    integer default 0,
  longest_streak    integer default 0,
  is_active         boolean default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  completed_on date not null,
  created_at  timestamptz not null default now(),
  unique (habit_id, completed_on)
);

-- ---------------------------------------------------------------------
-- FOCUS SESSIONS  (Focus Lockdown, NSDR, Virtual Co-Working)
-- ---------------------------------------------------------------------
create table public.focus_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  task_id        uuid references public.tasks(id) on delete set null,
  session_type   focus_session_type not null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  planned_minutes integer not null default 25,
  was_interrupted boolean default false,
  co_working_room_id uuid,   -- groups peers in same virtual room
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ENERGY LOGS  (Circadian Rhythm / Cognitive Load Gauge time series)
-- ---------------------------------------------------------------------
create table public.energy_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  logged_at       timestamptz not null default now(),
  energy_level    energy_level not null,
  cognitive_load_remaining numeric(5,2),   -- Mental Battery % at time of log
  source          text default 'manual' check (source in ('manual','inferred','wearable')),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- REFLECTIONS  (AI Daily Reflection & Review Coach)
-- ---------------------------------------------------------------------
create table public.reflections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  reflection_date   date not null default current_date,
  mood              reflection_mood,
  wins              text,
  friction_points   text,
  ai_summary        text,          -- Gemini-generated retrospective
  tasks_completed   integer default 0,
  tasks_missed      integer default 0,
  minutes_lost_to_procrastination integer default 0,
  financial_cost_of_delay numeric(12,2) default 0,  -- Financial Opportunity Cost Tracker rollup
  created_at        timestamptz not null default now(),
  unique (user_id, reflection_date)
);

-- ---------------------------------------------------------------------
-- COMMITMENT CONTRACTS  (Loss Aversion / Social Accountability)
-- ---------------------------------------------------------------------
create table public.commitment_contracts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  task_id           uuid references public.tasks(id) on delete cascade,
  accountability_partner_id uuid references public.users(id) on delete set null,
  stake_description text,          -- e.g. "lose $10 to charity" (Phantom Penalty)
  penalty_hours_lost numeric(6,2) default 0,
  is_fulfilled      boolean,
  due_at            timestamptz not null,
  created_at        timestamptz not null default now()
);

-- =====================================================================
-- INDEXES
-- =====================================================================
create index idx_goals_user            on public.goals(user_id);
create index idx_projects_user         on public.projects(user_id);
create index idx_projects_goal         on public.projects(goal_id);

create index idx_tasks_user            on public.tasks(user_id);
create index idx_tasks_project         on public.tasks(project_id);
create index idx_tasks_goal            on public.tasks(goal_id);
create index idx_tasks_parent          on public.tasks(parent_task_id);
create index idx_tasks_status          on public.tasks(status);
create index idx_tasks_scheduled_start on public.tasks(scheduled_start);
create index idx_tasks_priority_score  on public.tasks(dynamic_priority_score desc);
create index idx_tasks_deadline        on public.tasks(deadline_at) where is_hard_deadline;

create index idx_habits_user           on public.habits(user_id);
create index idx_habit_logs_habit      on public.habit_logs(habit_id);

create index idx_focus_sessions_user   on public.focus_sessions(user_id, started_at desc);
create index idx_energy_logs_user_time on public.energy_logs(user_id, logged_at desc);
create index idx_reflections_user_date on public.reflections(user_id, reflection_date desc);
create index idx_contracts_user        on public.commitment_contracts(user_id);

-- =====================================================================
-- updated_at TRIGGER HELPER
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at    before update on public.users    for each row execute function public.set_updated_at();
create trigger trg_goals_updated_at    before update on public.goals    for each row execute function public.set_updated_at();
create trigger trg_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_tasks_updated_at    before update on public.tasks    for each row execute function public.set_updated_at();
create trigger trg_habits_updated_at   before update on public.habits   for each row execute function public.set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================================
alter table public.users                enable row level security;
alter table public.goals                enable row level security;
alter table public.projects             enable row level security;
alter table public.tasks                enable row level security;
alter table public.habits               enable row level security;
alter table public.habit_logs           enable row level security;
alter table public.focus_sessions       enable row level security;
alter table public.energy_logs          enable row level security;
alter table public.reflections          enable row level security;
alter table public.commitment_contracts enable row level security;

-- Users: can only see/edit their own profile row
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- Generic owner-based policy pattern applied per table
create policy "goals_all_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "projects_all_own" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks_all_own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "habits_all_own" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "habit_logs_all_own" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "focus_sessions_all_own" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "energy_logs_all_own" on public.energy_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reflections_all_own" on public.reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Commitment contracts: owner full access; accountability partner gets read-only
create policy "contracts_owner_all" on public.commitment_contracts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "contracts_partner_read" on public.commitment_contracts
  for select using (auth.uid() = accountability_partner_id);

-- =====================================================================
-- Auto-create a public.users row whenever a new auth.users row appears
-- =====================================================================
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
