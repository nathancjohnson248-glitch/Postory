-- Postory database security check.
-- Runs entirely inside a transaction that is rolled back, so it leaves no data.
-- Run against a project with: psql "$DATABASE_URL" -f supabase/tests/rls_check.sql
-- Every row in the final result must have ok = true.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"full_name":"Alice"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"name":"Bob"}', now(), now());

create temp table results (test text, ok boolean, detail text) on commit drop;
grant all on results to authenticated;

insert into results
select 'profile auto-created', count(*) = 2, string_agg(name, ',')
from public.profiles
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into public.stories (id, user_id, title, source_text)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob story', 'bob secret');
insert into public.social_accounts (id, user_id, platform, external_account_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'x', 'lmp-bob');
insert into public.story_posts (story_id, user_id, platform, content)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'x', 'hi');

insert into results
select 'story_posts user_id forced to story owner', user_id = '22222222-2222-2222-2222-222222222222', user_id::text
from public.story_posts where story_id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into results select 'alice cannot see bob story', count(*) = 0, count(*)::text from public.stories;
insert into results select 'alice cannot see bob posts', count(*) = 0, count(*)::text from public.story_posts;
insert into results select 'alice sees only own profile', count(*) = 1, count(*)::text from public.profiles;
insert into results select 'alice search finds nothing of bob', count(*) = 0, count(*)::text from public.search_stories('secret');

insert into public.stories (title, source_text) values ('Alice story', 'launched');
insert into results
select 'alice insert story default user_id', count(*) = 1, count(*)::text
from public.stories where user_id = '11111111-1111-1111-1111-111111111111';

update public.stories set title = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

reset role;
insert into results
select 'bob story not updated by alice', title = 'Bob story', title
from public.stories where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
begin
  begin
    insert into public.social_accounts (user_id, platform, external_account_id)
    values ('11111111-1111-1111-1111-111111111111', 'x', 'fake');
    insert into results values ('alice cannot forge social account', false, 'insert succeeded');
  exception when others then
    insert into results values ('alice cannot forge social account', true, sqlerrm);
  end;

  begin
    insert into public.subscriptions (user_id, plan, status)
    values ('11111111-1111-1111-1111-111111111111', 'max', 'active');
    insert into results values ('alice cannot forge subscription', false, 'insert succeeded');
  exception when others then
    insert into results values ('alice cannot forge subscription', true, sqlerrm);
  end;

  begin
    perform public.consume_usage('11111111-1111-1111-1111-111111111111', 'ai_generation', 1, 100, now() - interval '30 days');
    insert into results values ('alice cannot call consume_usage', false, 'call succeeded');
  exception when others then
    insert into results values ('alice cannot call consume_usage', true, sqlerrm);
  end;
end $$;

reset role;

do $$
begin
  begin
    insert into public.story_posts (story_id, user_id, platform, social_account_id)
    select id, user_id, 'x', 'bbbbbbbb-0000-0000-0000-000000000001' from public.stories where title = 'Alice story';
    insert into results values ('cross-user social account rejected', false, 'insert succeeded');
  exception when others then
    insert into results values ('cross-user social account rejected', true, sqlerrm);
  end;
end $$;

select public.consume_usage('11111111-1111-1111-1111-111111111111', 'ai_image', 2, 3, now() - interval '1 day');
insert into results
select 'usage over limit denied', not allowed, used::text
from public.consume_usage('11111111-1111-1111-1111-111111111111', 'ai_image', 2, 3, now() - interval '1 day');
insert into results
select 'usage within limit allowed', allowed, used::text
from public.consume_usage('11111111-1111-1111-1111-111111111111', 'ai_image', 1, 3, now() - interval '1 day');

select * from results;

rollback;
