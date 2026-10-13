-- Social connections are Nango (OAuth) or Bluesky (app password) only.
-- LetMePost/Publora/Postiz are gone; nothing was ever connected through them
-- on this project, so their per-user workspaces and the unused snapshot table go.

drop table if exists public.social_workspaces;
drop table if exists public.analytics_snapshots;

alter table public.social_accounts drop constraint if exists social_accounts_provider_check;
alter table public.social_accounts
  add constraint social_accounts_provider_check check (provider in ('nango', 'bluesky'));
alter table public.social_accounts alter column provider set default 'nango';

alter table public.story_posts drop column if exists provider_batch_id;
comment on column public.story_posts.idempotency_key is 'Unique per post; kept for audit. Double publishing is prevented by the status compare-and-set.';

-- Secrets Nango can't hold (Bluesky app passwords), AES-256-GCM encrypted by
-- the server. No policies and no grants: only the service role can read it.
create table if not exists public.social_credentials (
  social_account_id uuid primary key references public.social_accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_credentials enable row level security;
revoke all on public.social_credentials from anon, authenticated;
create trigger social_credentials_set_updated_at
  before update on public.social_credentials
  for each row execute function public.set_updated_at();

-- Inbox: comments on posts Postory published, with what's needed to reply.
alter table public.inbox_items add column if not exists story_post_id uuid references public.story_posts (id) on delete set null;
alter table public.inbox_items add column if not exists context jsonb not null default '{}'::jsonb;
alter table public.inbox_items drop constraint if exists inbox_items_reply_status_check;
alter table public.inbox_items
  add constraint inbox_items_reply_status_check check (reply_status in ('none', 'drafted', 'sending', 'sent', 'failed'));
create index if not exists inbox_items_story_post_idx on public.inbox_items (story_post_id);

-- Column-level write access from the browser. Identity, email and anything
-- the AI trusts (story angles) are server-only.
revoke update on public.profiles from authenticated;
grant update (name, avatar_url, timezone, business_name, business_description, business_type, website_url,
  ai_preferences, product_updates, onboarding_step, onboarding_completed, onboarding_completed_at)
  on public.profiles to authenticated;

revoke update on public.stories from authenticated;
grant update (title, status, summary, archived_at) on public.stories to authenticated;
