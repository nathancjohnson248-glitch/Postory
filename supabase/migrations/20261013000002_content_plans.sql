-- The AI content planner's output. Written by the server only; users read their own.
create table if not exists public.content_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  horizon_days integer not null check (horizon_days in (7, 14)),
  plan jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists content_plans_user_idx on public.content_plans (user_id, created_at desc);
alter table public.content_plans enable row level security;
revoke all on public.content_plans from anon, authenticated;
grant select on public.content_plans to authenticated;
create policy "Users read their own plans" on public.content_plans for select to authenticated using (user_id = (select auth.uid()));
