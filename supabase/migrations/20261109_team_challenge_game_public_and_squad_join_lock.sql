-- 1) Games auto-created from an accepted team challenge now show up in
-- Explore (visibility='public') per explicit user request, instead of being
-- hidden from everyone but the two teams.
--
-- 2) Making them public exposes a pre-existing gap: tournament_team_members
-- RLS never actually restricted who can self-join a squad-claimed team slot
-- (filled_by_squad_id) to that squad's own members — only the UI steered
-- people toward it. That was moot while these games were private (only the
-- two teams' own members could even see the game), but now that a stranger
-- browsing Explore can open it, "team A can only add players from team A"
-- has to be a real server-side rule, not just a UI convention.

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
  v_required := greatest(coalesce(v_fixture.total_players, 2), 1);

  insert into public.games (
    creator_id, sport_id, title, description, game_date, start_time, end_time,
    game_type, visibility, number_of_teams, players_per_team, max_players, min_players, custom_venue_name
  ) values (
    auth.uid(), v_fixture.sport_id,
    v_home_name || ' vs ' || v_away_name,
    'Confirmed team challenge match between ' || v_home_name || ' and ' || v_away_name || '.',
    v_local_ts::date, v_local_ts::time, (v_local_ts + interval '2 hours')::time,
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

-- A self-join (insert, or the rejoin-via-update path) into a squad-claimed
-- team now has to actually belong to that squad (owner or ACTIVE member) —
-- mirrors the join-button gating added in TournamentTeamsSection so the
-- button never offers something the server would then reject.
alter policy tournament_team_members_insert_self on public.tournament_team_members
with check (
  user_id = auth.uid()
  and status = 'JOINED'::public.game_player_status_type
  and (
    not exists (
      select 1 from public.tournament_teams t
      where t.id = team_id and t.filled_by_squad_id is not null
    )
    or exists (
      select 1 from public.tournament_teams t
      join public.squads s on s.id = t.filled_by_squad_id
      where t.id = team_id
        and (
          s.squad_owner_id = auth.uid()
          or exists (
            select 1 from public.squad_members sm
            where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'::public.squad_member_status_type
          )
        )
    )
  )
);

alter policy tournament_team_members_update_self on public.tournament_team_members
with check (
  user_id = auth.uid()
  and (
    status <> 'JOINED'::public.game_player_status_type
    or not exists (
      select 1 from public.tournament_teams t
      where t.id = team_id and t.filled_by_squad_id is not null
    )
    or exists (
      select 1 from public.tournament_teams t
      join public.squads s on s.id = t.filled_by_squad_id
      where t.id = team_id
        and (
          s.squad_owner_id = auth.uid()
          or exists (
            select 1 from public.squad_members sm
            where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'::public.squad_member_status_type
          )
        )
    )
  )
);
