-- Postory staff with access to the admin area (users, payments, revenue).
-- The owner is identified by a confirmed email in application code; only the
-- owner can add or remove rows here, and only through the service role.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index admin_users_granted_by_idx on public.admin_users (granted_by);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;
grant select, insert, delete on table public.admin_users to service_role;
