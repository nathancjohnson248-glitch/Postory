-- Sign-up confirmation and password reset use one-time codes, never links.
-- When Resend is configured Postory generates the code through the Auth
-- admin API and sends the email itself; these objects support that path and
-- are reachable by the service role only (RLS on, no policies, grants revoked).

-- ---------------------------------------------------------------------------
-- Send log, used to throttle code emails per address and per network origin.
-- Stores hashes, not addresses. Rows older than two days are pruned by the app.
-- ---------------------------------------------------------------------------
create table public.auth_email_sends (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text,
  purpose text not null check (purpose in ('signup', 'recovery')),
  created_at timestamptz not null default now()
);

create index auth_email_sends_email_idx on public.auth_email_sends (email_hash, created_at desc);
create index auth_email_sends_ip_idx on public.auth_email_sends (ip_hash, created_at desc);

alter table public.auth_email_sends enable row level security;
revoke all on table public.auth_email_sends from anon, authenticated;
grant select, insert, delete on table public.auth_email_sends to service_role;

-- Atomically decide whether another code email may go out, and record it if
-- so. Limits: one per address per minute, five per address per hour, twenty
-- per origin per hour.
create or replace function public.claim_auth_email_send(p_email_hash text, p_ip_hash text, p_purpose text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
  v_hour_count integer;
  v_ip_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('auth_email_send:' || p_email_hash));

  select max(created_at), count(*) filter (where created_at > now() - interval '1 hour')
    into v_last, v_hour_count
    from public.auth_email_sends
   where email_hash = p_email_hash;

  if v_last is not null and v_last > now() - interval '60 seconds' then
    return query select false, greatest(1, ceil(extract(epoch from (v_last + interval '60 seconds' - now())))::integer);
    return;
  end if;

  if v_hour_count >= 5 then
    return query select false, 3600;
    return;
  end if;

  if p_ip_hash is not null then
    select count(*) into v_ip_count
      from public.auth_email_sends
     where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_ip_count >= 20 then
      return query select false, 3600;
      return;
    end if;
  end if;

  insert into public.auth_email_sends (email_hash, ip_hash, purpose) values (p_email_hash, p_ip_hash, p_purpose);
  return query select true, 0;
end;
$$;

-- Whether an email-and-password account exists for an address, and whether
-- it has been confirmed. Lets the server choose the right code to send
-- without creating accounts as a side effect.
create or replace function public.auth_email_status(p_email text)
returns table (user_id uuid, confirmed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email_confirmed_at is not null
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and u.is_sso_user = false
     and u.deleted_at is null
   limit 1;
$$;

revoke execute on function public.claim_auth_email_send(text, text, text) from public, anon, authenticated;
revoke execute on function public.auth_email_status(text) from public, anon, authenticated;
grant execute on function public.claim_auth_email_send(text, text, text) to service_role;
grant execute on function public.auth_email_status(text) to service_role;
