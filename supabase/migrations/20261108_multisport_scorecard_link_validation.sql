-- Keep scorecard linking sport-aware and preserve singles player names: for a
-- singles match the scorecard stores player names, while the fixture stores
-- the registered team names.
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
begin
  if auth.uid() is null then raise exception 'Sign in to start this fixture'; end if;
  select * into v_fixture from public.team_fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_squad_manager(v_fixture.home_squad_id) and not public.is_squad_manager(v_fixture.away_squad_id) then
    raise exception 'Only a team owner or host can start this fixture';
  end if;
  if v_fixture.status <> 'scheduled' or v_fixture.scheduled_at > now() then
    raise exception 'This fixture is not available to start yet';
  end if;

  select lower(name) into v_sport_name from public.sports where id = v_fixture.sport_id;
  v_expected_table := case
    when v_sport_name in ('hard ball','tape ball','outdoor cricket','cricket') then 'cricket_matches'
    when v_sport_name in ('football','padel','tennis','badminton','pickleball') then v_sport_name || '_matches'
    when v_sport_name = 'table tennis' then 'table_tennis_matches'
  end;
  if p_scorecard_table is distinct from v_expected_table then
    raise exception 'Scorecard type does not match the fixture sport';
  end if;

  select name into v_home_name from public.squads where id = v_fixture.home_squad_id;
  select name into v_away_name from public.squads where id = v_fixture.away_squad_id;
  if p_scorecard_table = 'tennis_matches' then
    execute 'select user_id, player_a_name as a, player_b_name as b, play_mode, format as sport_format from public.tennis_matches where id = $1'
      into v_match using p_scorecard_match_id;
  elsif p_scorecard_table = 'cricket_matches' then
    execute 'select user_id, team_a_name as a, team_b_name as b, null::text as play_mode, format as sport_format from public.cricket_matches where id = $1'
      into v_match using p_scorecard_match_id;
  elsif p_scorecard_table in ('padel_matches','badminton_matches','pickleball_matches','table_tennis_matches') then
    execute format('select user_id, team_a_name as a, team_b_name as b, play_mode, null::text as sport_format from public.%I where id = $1', p_scorecard_table)
      into v_match using p_scorecard_match_id;
  else
    execute 'select user_id, team_a_name as a, team_b_name as b, null::text as play_mode, null::text as sport_format from public.football_matches where id = $1'
      into v_match using p_scorecard_match_id;
  end if;
  if not found or v_match.user_id <> auth.uid() then
    raise exception 'The scorecard must belong to the signed-in user';
  end if;
  if v_fixture.match_format in ('SINGLES','DOUBLES') and v_match.play_mode is distinct from v_fixture.match_format then
    raise exception 'Scorecard play mode does not match the confirmed challenge';
  end if;
  if v_sport_name in ('hard ball','tape ball','outdoor cricket','cricket') and v_match.sport_format is distinct from v_fixture.match_format then
    raise exception 'Cricket scorecard format does not match the confirmed challenge';
  end if;
  if v_fixture.match_format <> 'SINGLES' and (v_match.a <> v_home_name or v_match.b <> v_away_name) then
    raise exception 'Scorecard teams do not match this fixture';
  end if;
  if v_fixture.scorecard_match_id is not null and
    (v_fixture.scorecard_match_id <> p_scorecard_match_id or v_fixture.scorecard_table <> p_scorecard_table) then
    raise exception 'A scorecard has already been linked to this fixture';
  end if;

  update public.team_fixtures
  set scorecard_table = p_scorecard_table,
      scorecard_match_id = p_scorecard_match_id,
      football_match_id = case when p_scorecard_table = 'football_matches' then p_scorecard_match_id else football_match_id end,
      updated_at = now()
  where id = p_fixture_id;
end;
$$;
