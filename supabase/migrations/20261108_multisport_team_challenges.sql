-- Extend team challenges to every active sport with an in-app scorecard.
-- Backfill the football-only records before making sport_id required.
alter table public.team_challenges
  add column if not exists sport_id uuid references public.sports(id) on delete restrict;
update public.team_challenges c
set sport_id = s.sport_id
from public.squads s
where s.id = c.sender_squad_id and c.sport_id is null;
alter table public.team_challenges alter column sport_id set not null;

alter table public.team_fixtures
  add column if not exists sport_id uuid references public.sports(id) on delete restrict,
  add column if not exists scorecard_table text,
  add column if not exists scorecard_match_id uuid;
update public.team_fixtures f
set sport_id = c.sport_id
from public.team_challenges c
where c.id = f.challenge_id and f.sport_id is null;
alter table public.team_fixtures alter column sport_id set not null;

alter table public.team_challenges drop constraint if exists team_challenges_match_format_check;
alter table public.team_fixtures drop constraint if exists team_fixtures_match_format_check;
alter table public.team_challenges add constraint team_challenges_match_format_check
  check (match_format in (
    '5v5','7v7','11v11','T10','T20','ODI','Club','SINGLES','DOUBLES',
    'BEST_OF_1','BEST_OF_3','BEST_OF_3_MATCH_TIEBREAK'
  ));
alter table public.team_fixtures add constraint team_fixtures_match_format_check
  check (match_format in (
    '5v5','7v7','11v11','T10','T20','ODI','Club','SINGLES','DOUBLES',
    'BEST_OF_1','BEST_OF_3','BEST_OF_3_MATCH_TIEBREAK'
  ));
alter table public.team_fixtures add constraint team_fixtures_scorecard_pair_check
  check ((scorecard_table is null) = (scorecard_match_id is null));
create unique index if not exists team_fixtures_scorecard_match_unique
  on public.team_fixtures (scorecard_table, scorecard_match_id)
  where scorecard_match_id is not null;

create or replace function public.send_team_challenge(
  p_sender_squad_id uuid,
  p_receiver_squad_id uuid,
  p_venue text,
  p_scheduled_at timestamptz,
  p_match_format text,
  p_idempotency_key uuid,
  p_sport_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge_id uuid;
  v_manager record;
  v_sport_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to send a team challenge'; end if;
  if p_sender_squad_id = p_receiver_squad_id then raise exception 'Choose another team'; end if;
  if not public.is_squad_manager(p_sender_squad_id) then raise exception 'Only a team owner or host can send challenges'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then raise exception 'Choose a future match date and time'; end if;
  if p_venue is null or length(btrim(p_venue)) < 2 or length(btrim(p_venue)) > 160 then raise exception 'Enter a valid venue'; end if;
  if p_idempotency_key is null then raise exception 'Missing request key'; end if;

  select lower(name) into v_sport_name from public.sports where id = p_sport_id and deleted_at is null;
  if v_sport_name is null then raise exception 'This sport is not available for challenges'; end if;
  if not exists (
    select 1 from public.squads s
    where s.id = p_sender_squad_id and s.group_type = 'team' and s.deleted_at is null and s.sport_id = p_sport_id
  ) then raise exception 'Choose a team in the selected sport that you manage'; end if;
  if not exists (
    select 1 from public.squads s
    where s.id = p_receiver_squad_id and s.group_type = 'team' and s.deleted_at is null and s.sport_id = p_sport_id
  ) then raise exception 'The opponent must be an active team in the same sport'; end if;

  if not (
    (v_sport_name = 'football' and p_match_format in ('5v5','7v7','11v11'))
    or (v_sport_name in ('hard ball','tape ball','outdoor cricket','cricket') and p_match_format in ('T10','T20','ODI','Club'))
    or (v_sport_name = 'padel' and p_match_format in ('SINGLES','DOUBLES','BEST_OF_1','BEST_OF_3','BEST_OF_3_MATCH_TIEBREAK'))
    or (v_sport_name = 'tennis' and p_match_format in ('SINGLES','DOUBLES','BEST_OF_1','BEST_OF_3'))
    or (v_sport_name in ('badminton','pickleball','table tennis') and p_match_format in ('SINGLES','DOUBLES'))
  ) then raise exception 'This match format is not supported for %', v_sport_name; end if;

  select id into v_challenge_id from public.team_challenges
  where sender_squad_id = p_sender_squad_id and idempotency_key = p_idempotency_key;
  if v_challenge_id is not null then return v_challenge_id; end if;
  select id into v_challenge_id from public.team_challenges
  where sender_squad_id = p_sender_squad_id and receiver_squad_id = p_receiver_squad_id
    and scheduled_at = p_scheduled_at and status = 'pending';
  if v_challenge_id is not null then return v_challenge_id; end if;

  begin
    insert into public.team_challenges (
      sender_squad_id, receiver_squad_id, created_by, venue, scheduled_at,
      match_format, idempotency_key, sport_id
    ) values (
      p_sender_squad_id, p_receiver_squad_id, auth.uid(), btrim(p_venue),
      p_scheduled_at, p_match_format, p_idempotency_key, p_sport_id
    ) returning id into v_challenge_id;
  exception when unique_violation then
    select id into v_challenge_id from public.team_challenges
    where sender_squad_id = p_sender_squad_id and idempotency_key = p_idempotency_key;
    if v_challenge_id is null then
      select id into v_challenge_id from public.team_challenges
      where sender_squad_id = p_sender_squad_id and receiver_squad_id = p_receiver_squad_id
        and scheduled_at = p_scheduled_at and status = 'pending';
    end if;
    if v_challenge_id is null then raise; end if;
    return v_challenge_id;
  end;

  for v_manager in
    select s.squad_owner_id as user_id from public.squads s where s.id = p_receiver_squad_id
    union select sm.user_id from public.squad_members sm where sm.squad_id = p_receiver_squad_id
      and sm.role = 'host'::public.squad_role_type and sm.status = 'ACTIVE'::public.squad_member_status_type
  loop
    perform public.create_notification(v_manager.user_id, 'New team challenge', 'A team has challenged your team to a match.',
      'team_challenge_received', jsonb_build_object('challengeId', v_challenge_id));
  end loop;
  return v_challenge_id;
end;
$$;

create or replace function public.respond_to_team_challenge(p_challenge_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge public.team_challenges%rowtype;
  v_fixture_id uuid;
  v_manager record;
begin
  if auth.uid() is null then raise exception 'Sign in to respond to a challenge'; end if;
  select * into v_challenge from public.team_challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if not public.is_squad_manager(v_challenge.receiver_squad_id) then raise exception 'Only the challenged team owner or host can respond'; end if;
  if v_challenge.status <> 'pending' then
    if p_accept and v_challenge.status = 'accepted' then
      select id into v_fixture_id from public.team_fixtures where challenge_id = p_challenge_id;
      return v_fixture_id;
    end if;
    if not p_accept and v_challenge.status = 'declined' then return null; end if;
    raise exception 'This challenge has already been answered';
  end if;
  update public.team_challenges set status = case when p_accept then 'accepted' else 'declined' end,
    responded_by = auth.uid(), responded_at = now(), updated_at = now() where id = p_challenge_id;
  if p_accept then
    insert into public.team_fixtures (challenge_id, home_squad_id, away_squad_id, venue, scheduled_at, match_format, sport_id)
    values (v_challenge.id, v_challenge.sender_squad_id, v_challenge.receiver_squad_id,
      v_challenge.venue, v_challenge.scheduled_at, v_challenge.match_format, v_challenge.sport_id)
    on conflict (challenge_id) do nothing returning id into v_fixture_id;
    if v_fixture_id is null then select id into v_fixture_id from public.team_fixtures where challenge_id = p_challenge_id; end if;
  end if;
  for v_manager in
    select s.squad_owner_id as user_id from public.squads s where s.id = v_challenge.sender_squad_id
    union select sm.user_id from public.squad_members sm where sm.squad_id = v_challenge.sender_squad_id
      and sm.role = 'host'::public.squad_role_type and sm.status = 'ACTIVE'::public.squad_member_status_type
  loop
    perform public.create_notification(v_manager.user_id,
      case when p_accept then 'Challenge accepted' else 'Challenge declined' end,
      case when p_accept then 'Your match is confirmed.' else 'The other team declined your challenge.' end,
      case when p_accept then 'team_challenge_accepted' else 'team_challenge_declined' end,
      jsonb_build_object('challengeId', v_challenge.id, 'fixtureId', v_fixture_id));
  end loop;
  if p_accept then
    for v_manager in
      select s.squad_owner_id as user_id from public.squads s where s.id = v_challenge.receiver_squad_id
      union select sm.user_id from public.squad_members sm where sm.squad_id = v_challenge.receiver_squad_id
        and sm.role = 'host'::public.squad_role_type and sm.status = 'ACTIVE'::public.squad_member_status_type
    loop
      perform public.create_notification(v_manager.user_id, 'Fixture confirmed', 'Your team match is scheduled.',
        'team_fixture_confirmed', jsonb_build_object('challengeId', v_challenge.id, 'fixtureId', v_fixture_id));
    end loop;
  end if;
  return v_fixture_id;
end;
$$;

create or replace function public.link_team_fixture_scorecard_sport(
  p_fixture_id uuid,
  p_scorecard_match_id uuid,
  p_scorecard_table text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_fixture public.team_fixtures%rowtype;
  v_home_name text;
  v_away_name text;
  v_sport_name text;
  v_expected_table text;
  v_match record;
  v_name_a text;
  v_name_b text;
begin
  if auth.uid() is null then raise exception 'Sign in to start this fixture'; end if;
  select * into v_fixture from public.team_fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_squad_manager(v_fixture.home_squad_id) and not public.is_squad_manager(v_fixture.away_squad_id) then
    raise exception 'Only a team owner or host can start this fixture';
  end if;
  if v_fixture.status <> 'scheduled' or v_fixture.scheduled_at > now() then raise exception 'This fixture is not available to start yet'; end if;
  select lower(name) into v_sport_name from public.sports where id = v_fixture.sport_id;
  v_expected_table := case
    when v_sport_name in ('hard ball','tape ball','outdoor cricket','cricket') then 'cricket_matches'
    when v_sport_name in ('football','padel','tennis','badminton','pickleball') then v_sport_name || '_matches'
    when v_sport_name = 'table tennis' then 'table_tennis_matches'
  end;
  if p_scorecard_table is distinct from v_expected_table then raise exception 'Scorecard type does not match the fixture sport'; end if;
  select name into v_home_name from public.squads where id = v_fixture.home_squad_id;
  select name into v_away_name from public.squads where id = v_fixture.away_squad_id;
  if p_scorecard_table = 'tennis_matches' then
    execute 'select user_id, player_a_name as a, player_b_name as b, status, result_summary from public.tennis_matches where id = $1'
      into v_match using p_scorecard_match_id;
  else
    execute format('select user_id, team_a_name as a, team_b_name as b, status, result_summary from public.%I where id = $1', p_scorecard_table)
      into v_match using p_scorecard_match_id;
  end if;
  if not found or v_match.user_id <> auth.uid() then raise exception 'The scorecard must belong to the signed-in user'; end if;
  v_name_a := v_match.a; v_name_b := v_match.b;
  if v_name_a <> v_home_name or v_name_b <> v_away_name then raise exception 'Scorecard teams do not match this fixture'; end if;
  if v_fixture.scorecard_match_id is not null and (v_fixture.scorecard_match_id <> p_scorecard_match_id or v_fixture.scorecard_table <> p_scorecard_table) then
    raise exception 'A scorecard has already been linked to this fixture';
  end if;
  update public.team_fixtures set scorecard_table = p_scorecard_table, scorecard_match_id = p_scorecard_match_id,
    football_match_id = case when p_scorecard_table = 'football_matches' then p_scorecard_match_id else football_match_id end,
    updated_at = now() where id = p_fixture_id;
end;
$$;

create or replace function public.sync_multisport_team_fixture_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    update public.team_fixtures set status = 'completed', result = new.result_summary, updated_at = now()
    where scorecard_table = tg_table_name and scorecard_match_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists multisport_complete_team_fixture on public.football_matches;
create trigger multisport_complete_team_fixture after update of status on public.football_matches for each row execute function public.sync_multisport_team_fixture_result();
drop trigger if exists multisport_complete_team_fixture on public.cricket_matches;
create trigger multisport_complete_team_fixture after update of status on public.cricket_matches for each row execute function public.sync_multisport_team_fixture_result();
drop trigger if exists multisport_complete_team_fixture on public.padel_matches;
create trigger multisport_complete_team_fixture after update of status on public.padel_matches for each row execute function public.sync_multisport_team_fixture_result();
drop trigger if exists multisport_complete_team_fixture on public.tennis_matches;
create trigger multisport_complete_team_fixture after update of status on public.tennis_matches for each row execute function public.sync_multisport_team_fixture_result();
drop trigger if exists multisport_complete_team_fixture on public.badminton_matches;
create trigger multisport_complete_team_fixture after update of status on public.badminton_matches for each row execute function public.sync_multisport_team_fixture_result();
drop trigger if exists multisport_complete_team_fixture on public.pickleball_matches;
create trigger multisport_complete_team_fixture after update of status on public.pickleball_matches for each row execute function public.sync_multisport_team_fixture_result();
drop trigger if exists multisport_complete_team_fixture on public.table_tennis_matches;
create trigger multisport_complete_team_fixture after update of status on public.table_tennis_matches for each row execute function public.sync_multisport_team_fixture_result();

revoke all on function public.send_team_challenge(uuid,uuid,text,timestamptz,text,uuid,uuid) from public;
revoke all on function public.link_team_fixture_scorecard_sport(uuid,uuid,text) from public;
grant execute on function public.send_team_challenge(uuid,uuid,text,timestamptz,text,uuid,uuid) to authenticated;
grant execute on function public.link_team_fixture_scorecard_sport(uuid,uuid,text) to authenticated;
