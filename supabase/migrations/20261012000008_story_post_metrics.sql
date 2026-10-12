-- Engagement read back from the networks (via the publishing provider), per post.
alter table public.story_posts add column if not exists platform_post_id text;
alter table public.story_posts add column if not exists metrics jsonb;
alter table public.story_posts add column if not exists metrics_synced_at timestamptz;
