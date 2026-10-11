-- Postory initial schema
--
-- Ownership model
--   * Every user-owned row carries user_id -> auth.users(id) on delete cascade.
--     Deleting the auth user (explicit account deletion) removes their data.
--     Nothing is deleted when a trial ends, a subscription lapses, or a social
--     account is disconnected.
--   * Tables whose values must never be forged from the browser
--     (social_accounts, subscriptions, story_posts, usage, inbox, analytics)
--     are read-only to the `authenticated` role. The Next.js server writes them
--     with the service role after verifying the session and ownership.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  business_name text,
  business_type text,
  business_description text,
  website_url text,
  timezone text not null default 'UTC',
  onboarding_step text not null default 'business'
    check (onboarding_step in ('business', 'social', 'voice', 'plan', 'finish')),
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  ai_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user. Runs as definer because the
-- signing-up user has no session yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Social: provider workspace mapping, connected accounts, connection attempts
-- ---------------------------------------------------------------------------

-- Maps a Postory user to their isolated workspace (LetMePost profile) at the
-- social provider. Managed server-side only.
create table public.social_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'letmepost' check (provider in ('letmepost')),
  external_profile_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_profile_id)
);

create trigger social_workspaces_set_updated_at
  before update on public.social_workspaces
  for each row execute function public.set_updated_at();

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'letmepost' check (provider in ('letmepost')),
  platform text not null
    check (platform in ('x', 'linkedin', 'instagram', 'facebook', 'threads', 'bluesky', 'pinterest', 'tiktok')),
  display_name text,
  username text,
  profile_image_url text,
  external_account_id text not null,
  status text not null default 'connected'
    check (status in ('connected', 'reconnect_required', 'disconnected', 'error')),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One provider account can belong to exactly one Postory user.
  unique (provider, external_account_id)
);

create index social_accounts_user_status_idx on public.social_accounts (user_id, status);

create trigger social_accounts_set_updated_at
  before update on public.social_accounts
  for each row execute function public.set_updated_at();

create table public.social_connection_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in ('x', 'linkedin', 'instagram', 'facebook', 'threads', 'bluesky', 'pinterest', 'tiktok')),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'expired')),
  -- Provider account ids that already existed when the attempt started, so the
  -- completion step can tell which accounts the user actually just connected.
  accounts_before text[] not null default '{}',
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index social_connection_attempts_user_idx
  on public.social_connection_attempts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Stories and their platform posts
-- ---------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled story' check (char_length(title) <= 200),
  source_text text not null check (char_length(source_text) between 1 and 8000),
  source_type text not null default 'text'
    check (source_type in ('text', 'voice', 'imported', 'manual')),
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'ready', 'archived')),
  summary text,
  angles jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stories_user_created_idx on public.stories (user_id, created_at desc);
create index stories_user_status_idx on public.stories (user_id, status);

create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

create table public.story_posts (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  platform text not null
    check (platform in ('x', 'linkedin', 'instagram', 'facebook', 'threads', 'bluesky', 'pinterest', 'tiktok')),
  content text not null default '' check (char_length(content) <= 70000),
  generated_content text,
  last_edited_by text not null default 'ai' check (last_edited_by in ('ai', 'user')),
  angle text,
  reasoning text,
  media_suggestion text,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'awaiting_review'
    check (status in ('draft', 'awaiting_review', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'rejected')),
  scheduled_for timestamptz,
  published_at timestamptz,
  external_post_id text,
  external_url text,
  provider_batch_id text,
  -- Sent as the provider Idempotency-Key so a retried request can never create
  -- a second external post.
  idempotency_key uuid not null default gen_random_uuid(),
  publish_attempts integer not null default 0,
  error_code text,
  error_message text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index story_posts_story_idx on public.story_posts (story_id);
create index story_posts_user_status_idx on public.story_posts (user_id, status);
create index story_posts_user_scheduled_idx on public.story_posts (user_id, scheduled_for)
  where scheduled_for is not null;
create index story_posts_external_idx on public.story_posts (external_post_id)
  where external_post_id is not null;

create trigger story_posts_set_updated_at
  before update on public.story_posts
  for each row execute function public.set_updated_at();

-- Keep story_posts.user_id equal to the owning story's user and make sure the
-- selected social account belongs to the same user.
create or replace function public.story_posts_enforce_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select s.user_id into v_owner from public.stories s where s.id = new.story_id;
  if v_owner is null then
    raise exception 'story % does not exist', new.story_id using errcode = '23503';
  end if;
  new.user_id := v_owner;

  if new.social_account_id is not null and not exists (
    select 1 from public.social_accounts a
    where a.id = new.social_account_id and a.user_id = v_owner
  ) then
    raise exception 'social account does not belong to the story owner' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger story_posts_enforce_owner
  before insert or update of story_id, social_account_id, user_id on public.story_posts
  for each row execute function public.story_posts_enforce_owner();

-- ---------------------------------------------------------------------------
-- Billing (HandyPay is the source of truth; this mirrors known state)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  provider text not null default 'handypay' check (provider in ('handypay')),
  plan text check (plan in ('solo', 'pro', 'max')),
  status text not null
    check (status in ('pending', 'trialing', 'active', 'past_due', 'canceled', 'expired', 'incomplete')),
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_provider_subscription_idx
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Bookkeeping for HandyPay API calls Postory initiates (checkout sessions,
-- plan changes, cancellations) so a returning browser can be reconciled
-- against the provider. No webhooks are involved.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('checkout', 'sync', 'plan_change', 'cancel')),
  plan text check (plan in ('solo', 'pro', 'max')),
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  provider_reference text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_events_user_idx on public.billing_events (user_id, created_at desc);

create trigger billing_events_set_updated_at
  before update on public.billing_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Business memory
-- ---------------------------------------------------------------------------

create table public.business_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null
    check (category in ('business', 'product', 'audience', 'voice', 'brand', 'milestone', 'facts', 'preferences', 'approved_content')),
  key text not null check (char_length(key) between 1 and 120),
  value text not null check (char_length(value) between 1 and 4000),
  source text not null default 'user'
    check (source in ('onboarding', 'user', 'story', 'ai_suggested')),
  confidence numeric(3, 2) not null default 1.00 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, key)
);

create index business_memory_user_idx on public.business_memory (user_id, category);

create trigger business_memory_set_updated_at
  before update on public.business_memory
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Inbox and analytics (filled only from real provider data)
-- ---------------------------------------------------------------------------

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  platform text not null
    check (platform in ('x', 'linkedin', 'instagram', 'facebook', 'threads', 'bluesky', 'pinterest', 'tiktok')),
  kind text not null check (kind in ('comment', 'reply', 'mention', 'message')),
  category text not null default 'needs_reply'
    check (category in ('needs_reply', 'potential_customer', 'mention', 'replied')),
  author_name text,
  author_handle text,
  content text not null,
  external_id text not null,
  external_url text,
  received_at timestamptz not null default now(),
  reply_draft text,
  reply_status text not null default 'none' check (reply_status in ('none', 'drafted', 'sent', 'failed')),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

create index inbox_items_user_category_idx on public.inbox_items (user_id, category, received_at desc);

create trigger inbox_items_set_updated_at
  before update on public.inbox_items
  for each row execute function public.set_updated_at();

create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete cascade,
  platform text not null
    check (platform in ('x', 'linkedin', 'instagram', 'facebook', 'threads', 'bluesky', 'pinterest', 'tiktok')),
  metric_date date not null,
  followers integer,
  impressions integer,
  engagements integer,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'letmepost',
  created_at timestamptz not null default now(),
  unique (social_account_id, metric_date)
);

create index analytics_snapshots_user_date_idx on public.analytics_snapshots (user_id, metric_date desc);

-- ---------------------------------------------------------------------------
-- Plan usage metering
-- ---------------------------------------------------------------------------

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null check (metric in ('ai_generation', 'ai_conversation', 'ai_image', 'x_credit')),
  -- Negative quantities release a reservation when the metered call failed.
  quantity integer not null check (quantity <> 0),
  created_at timestamptz not null default now()
);

create index usage_events_user_metric_idx on public.usage_events (user_id, metric, created_at desc);

-- Atomically check a limit and record usage. Serialised per user+metric with
-- an advisory lock so parallel requests cannot overshoot the plan limit.
create or replace function public.consume_usage(
  p_user_id uuid,
  p_metric text,
  p_quantity integer,
  p_limit integer,
  p_since timestamptz
)
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  if p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_metric, 0));

  select coalesce(sum(u.quantity), 0)::integer into v_used
  from public.usage_events u
  where u.user_id = p_user_id and u.metric = p_metric and u.created_at >= p_since;

  if p_limit is not null and v_used + p_quantity > p_limit then
    return query select false, v_used;
    return;
  end if;

  insert into public.usage_events (user_id, metric, quantity)
  values (p_user_id, p_metric, p_quantity);

  return query select true, v_used + p_quantity;
end;
$$;

revoke all on function public.consume_usage(uuid, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_usage(uuid, text, integer, integer, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Library search (runs with the caller's privileges, so RLS applies)
-- ---------------------------------------------------------------------------

create or replace function public.search_stories(q text)
returns setof public.stories
language sql
stable
security invoker
set search_path = ''
as $$
  select s.*
  from public.stories s
  where s.user_id = auth.uid()
    and (
      s.title ilike '%' || q || '%'
      or s.source_text ilike '%' || q || '%'
      or exists (
        select 1 from public.story_posts p
        where p.story_id = s.id and p.content ilike '%' || q || '%'
      )
    )
  order by s.updated_at desc
  limit 50;
$$;

revoke all on function public.search_stories(text) from public, anon;
grant execute on function public.search_stories(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.social_workspaces enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_connection_attempts enable row level security;
alter table public.stories enable row level security;
alter table public.story_posts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.business_memory enable row level security;
alter table public.inbox_items enable row level security;
alter table public.analytics_snapshots enable row level security;
alter table public.usage_events enable row level security;

-- Explicit grants: anon gets nothing; authenticated gets only what policies allow.
revoke all on all tables in schema public from anon;

grant select, update on public.profiles to authenticated;
grant select on public.social_workspaces to authenticated;
grant select on public.social_accounts to authenticated;
grant select on public.social_connection_attempts to authenticated;
grant select, insert, update, delete on public.stories to authenticated;
grant select on public.story_posts to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_events to authenticated;
grant select, insert, update, delete on public.business_memory to authenticated;
grant select on public.inbox_items to authenticated;
grant select on public.analytics_snapshots to authenticated;
grant select on public.usage_events to authenticated;

grant all on all tables in schema public to service_role;

-- profiles
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- read-only, owner-scoped tables
create policy "Users can read their own social workspace"
  on public.social_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own social accounts"
  on public.social_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own connection attempts"
  on public.social_connection_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own story posts"
  on public.story_posts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own billing events"
  on public.billing_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own inbox"
  on public.inbox_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own analytics"
  on public.analytics_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own usage"
  on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id);

-- stories: full owner CRUD
create policy "Users can read their own stories"
  on public.stories for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own stories"
  on public.stories for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own stories"
  on public.stories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own stories"
  on public.stories for delete to authenticated
  using ((select auth.uid()) = user_id);

-- business memory: full owner CRUD
create policy "Users can read their own memory"
  on public.business_memory for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own memory"
  on public.business_memory for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own memory"
  on public.business_memory for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own memory"
  on public.business_memory for delete to authenticated
  using ((select auth.uid()) = user_id);
