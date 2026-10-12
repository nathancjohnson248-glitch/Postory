-- Publora joins LetMePost as a social provider: each Postory user gets an
-- isolated Publora managed user (social_workspaces) and their connected
-- accounts are recorded with provider = 'publora'.
alter table public.social_workspaces drop constraint social_workspaces_provider_check;
alter table public.social_workspaces add constraint social_workspaces_provider_check check (provider in ('letmepost', 'publora'));
alter table public.social_accounts drop constraint social_accounts_provider_check;
alter table public.social_accounts add constraint social_accounts_provider_check check (provider in ('letmepost', 'publora'));
