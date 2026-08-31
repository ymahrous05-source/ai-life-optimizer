-- =====================================================================
-- 002_task_dna_similarity.sql
-- Task DNA: pgvector cosine-similarity search over the user's own
-- completed tasks. Called via supabase.rpc('match_similar_tasks', ...).
-- Run this AFTER 001_schema.sql.
-- =====================================================================

create or replace function public.match_similar_tasks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 5,
  exclude_task_id uuid default null
)
returns table (
  id uuid,
  title text,
  estimated_minutes int,
  actual_minutes int,
  required_energy energy_level,
  similarity float
)
language sql stable
as $$
  select
    t.id,
    t.title,
    t.estimated_minutes,
    t.actual_minutes,
    t.required_energy,
    1 - (t.embedding <=> query_embedding) as similarity
  from public.tasks t
  where t.user_id = match_user_id
    and t.status = 'completed'
    and t.actual_minutes is not null
    and t.embedding is not null
    and (exclude_task_id is null or t.id <> exclude_task_id)
  order by t.embedding <=> query_embedding
  limit match_count;
$$;

-- ivfflat index for fast approximate nearest-neighbor search once the
-- table has enough rows (pgvector recommends building this after some
-- data exists — safe to run anytime, it just won't help much on an
-- empty table yet).
create index if not exists idx_tasks_embedding
  on public.tasks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
