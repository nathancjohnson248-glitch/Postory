-- Social connections are Zernio (OAuth) or Bluesky (app password).
-- Nango never had a configured integration, so no account rows use it.
alter table public.social_accounts drop constraint if exists social_accounts_provider_check;
update public.social_accounts set status = 'disconnected' where provider = 'nango';
alter table public.social_accounts
  add constraint social_accounts_provider_check check (provider in ('zernio', 'bluesky', 'nango'));
alter table public.social_accounts alter column provider set default 'zernio';
