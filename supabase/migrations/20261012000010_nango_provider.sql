-- Nango as a social provider (connections tagged per Postory user; Postory publishes and schedules).
alter table public.social_accounts drop constraint if exists social_accounts_provider_check;
alter table public.social_accounts
  add constraint social_accounts_provider_check check (provider = any (array['letmepost', 'publora', 'postiz', 'nango']));

alter table public.social_workspaces drop constraint if exists social_workspaces_provider_check;
alter table public.social_workspaces
  add constraint social_workspaces_provider_check check (provider = any (array['letmepost', 'publora', 'postiz', 'nango']));
