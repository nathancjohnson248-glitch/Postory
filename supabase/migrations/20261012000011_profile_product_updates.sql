-- Product update emails (new features, changes). On by default, users can opt
-- out in Settings → Notifications. Transactional email ignores this flag.
alter table public.profiles add column if not exists product_updates boolean not null default true;
comment on column public.profiles.product_updates is 'Whether the user gets product update emails. Transactional email is unaffected.';
