-- Postory's own six-digit sign-in codes. Only an HMAC of each code is stored;
-- one live code per address and purpose; server-only (no grants, no policies).
create table if not exists public.email_codes (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  purpose text not null check (purpose in ('verify', 'reset')),
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email_hash, purpose)
);
alter table public.email_codes enable row level security;
revoke all on public.email_codes from anon, authenticated;
