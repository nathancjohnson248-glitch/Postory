-- Onboarding now reaches a first AI-generated story before the trial:
-- about → business → voice → social → story → plan (→ finish, legacy).
alter table public.profiles drop constraint if exists profiles_onboarding_step_check;
alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step in ('about', 'business', 'social', 'voice', 'story', 'plan', 'finish'));
-- The default stays 'business'; the app shows the 'about' step to a profile
-- that has no business type yet, so deploys and migrations can't race.
alter table public.profiles alter column onboarding_step set default 'business';
