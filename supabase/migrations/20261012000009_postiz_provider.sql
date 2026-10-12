-- Postiz as a social provider. Its channels live in one shared workspace, so
-- the existing unique (provider, external_account_id) is what guarantees a
-- channel belongs to exactly one Postory user.
alter table public.social_accounts drop constraint if exists social_accounts_provider_check;
alter table public.social_accounts
  add constraint social_accounts_provider_check check (provider = any (array['letmepost', 'publora', 'postiz']));

alter table public.social_workspaces drop constraint if exists social_workspaces_provider_check;
alter table public.social_workspaces
  add constraint social_workspaces_provider_check check (provider = any (array['letmepost', 'publora', 'postiz']));
