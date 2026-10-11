-- Covering indexes for foreign keys flagged by the Supabase performance advisor.
create index if not exists story_posts_social_account_idx
  on public.story_posts (social_account_id)
  where social_account_id is not null;

create index if not exists inbox_items_social_account_idx
  on public.inbox_items (social_account_id)
  where social_account_id is not null;
