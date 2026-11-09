-- A challenge scheduled late (e.g. 11 PM) plus the fixed 2-hour match
-- window can run past midnight. end_time/start_time are plain `time` with
-- no date, so that wrapped around to an end_time *earlier* than start_time
-- and tripped games_time_check (the same "late start" case CreateGameScreen
-- already handles by bumping end_date to the next day — see its
-- addMinutesWithOverflow comment — this just applies the same fix here).
create or replace function public.ensure_team_fixture_game(p_fixture_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.team_fixtures%rowtype;
  v_home_name text;
  v_away_name text;
  v_local_ts timestamp;
  v_end_ts timestamp;
  v_required integer;
  v_game_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
begin
  select * into v_fixture from public.team_fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  if v_fixture.game_id is not null then return v_fixture.game_id; end if;

  select name into v_home_name from public.squads where id = v_fixture.home_squad_id;
  select name into v_away_name from public.squads where id = v_fixture.away_squad_id;
  v_local_ts := v_fixture.scheduled_at at time zone 'Asia/Karachi';
  v_end_ts := v_local_ts + interval '2 hours';
  v_required := greatest(coalesce(v_fixture.total_players, 2), 1);

  insert into public.games (
    creator_id, sport_id, title, description, game_date, end_date, start_time, end_time,
    game_type, visibility, number_of_teams, players_per_team, max_players, min_players, custom_venue_name
  ) values (
    auth.uid(), v_fixture.sport_id,
    v_home_name || ' vs ' || v_away_name,
    'Confirmed team challenge match between ' || v_home_name || ' and ' || v_away_name || '.',
    v_local_ts::date,
    case when v_end_ts::date > v_local_ts::date then v_end_ts::date else null end,
    v_local_ts::time, v_end_ts::time,
    'REGULAR'::public.game_type_type, 'public'::public.game_visibility_type,
    2, v_required, v_required * 2, 2, v_fixture.venue
  ) returning id into v_game_id;

  insert into public.tournament_teams (game_id, name, status, sort_order, filled_by_squad_id)
  values (v_game_id, v_home_name, 'FORMING', 0, v_fixture.home_squad_id)
  returning id into v_home_team_id;
  insert into public.tournament_teams (game_id, name, status, sort_order, filled_by_squad_id)
  values (v_game_id, v_away_name, 'FORMING', 1, v_fixture.away_squad_id)
  returning id into v_away_team_id;

  insert into public.tournament_team_members (team_id, user_id, status, joined_at)
  select v_home_team_id, roster.user_id, 'JOINED', now()
  from (
    (select s.squad_owner_id as user_id, timestamptz 'epoch' as ord from public.squads s where s.id = v_fixture.home_squad_id)
    union
    (select sm.user_id, sm.joined_at as ord from public.squad_members sm
     where sm.squad_id = v_fixture.home_squad_id and sm.status = 'ACTIVE'::public.squad_member_status_type
       and sm.user_id <> (select squad_owner_id from public.squads where id = v_fixture.home_squad_id))
    order by ord
    limit v_required
  ) roster;

  insert into public.tournament_team_members (team_id, user_id, status, joined_at)
  select v_away_team_id, roster.user_id, 'JOINED', now()
  from (
    (select s.squad_owner_id as user_id, timestamptz 'epoch' as ord from public.squads s where s.id = v_fixture.away_squad_id)
    union
    (select sm.user_id, sm.joined_at as ord from public.squad_members sm
     where sm.squad_id = v_fixture.away_squad_id and sm.status = 'ACTIVE'::public.squad_member_status_type
       and sm.user_id <> (select squad_owner_id from public.squads where id = v_fixture.away_squad_id))
    order by ord
    limit v_required
  ) roster;

  update public.team_fixtures set game_id = v_game_id, updated_at = now() where id = p_fixture_id;
  return v_game_id;
end;
$$;

revoke all on function public.ensure_team_fixture_game(uuid) from public, anon, authenticated;
