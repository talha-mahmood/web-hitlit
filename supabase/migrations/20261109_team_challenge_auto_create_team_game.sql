-- When a team challenge is accepted, automatically create a real 2-team
-- "game" (the same games/tournament_teams/tournament_team_members system a
-- manually created 2-team regular game uses) so both teams get their own
-- roster card, the existing "only add from my own squad" rules, and the
-- existing auto-approve -> auto-generate-match -> Go To Scorecard/Enter
-- Score Manually pipeline — all of it reused as-is, nothing new built for
-- any of that. This only wires the team-challenge flow into it.

alter table public.team_fixtures
  add column if not exists game_id uuid references public.games(id) on delete set null;

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
  -- Games store a plain local date + wall-clock time (no tz column), same
  -- convention every other screen in this app formats match times in.
  v_local_ts := v_fixture.scheduled_at at time zone 'Asia/Karachi';
  v_required := greatest(coalesce(v_fixture.total_players, 2), 1);

  -- creator_id = the accepting manager: auto_approve_full_team (on
  -- tournament_team_members) only fast-tracks a full team straight to
  -- APPROVED when the acting user matches the game's creator_id, and every
  -- insert below runs under this same accepting session either way.
  insert into public.games (
    creator_id, sport_id, title, description, game_date, start_time, end_time,
    game_type, visibility, number_of_teams, players_per_team, max_players, min_players, custom_venue_name
  ) values (
    auth.uid(), v_fixture.sport_id,
    v_home_name || ' vs ' || v_away_name,
    'Confirmed team challenge match between ' || v_home_name || ' and ' || v_away_name || '.',
    v_local_ts::date, v_local_ts::time, (v_local_ts + interval '2 hours')::time,
    'REGULAR'::public.game_type_type, 'private'::public.game_visibility_type,
    2, v_required, v_required * 2, 2, v_fixture.venue
  ) returning id into v_game_id;

  insert into public.tournament_teams (game_id, name, status, sort_order, filled_by_squad_id)
  values (v_game_id, v_home_name, 'FORMING', 0, v_fixture.home_squad_id)
  returning id into v_home_team_id;
  insert into public.tournament_teams (game_id, name, status, sort_order, filled_by_squad_id)
  values (v_game_id, v_away_name, 'FORMING', 1, v_fixture.away_squad_id)
  returning id into v_away_team_id;

  -- Each team's starting roster: the squad's own active members, owner
  -- first (so they land as captain via the existing claim-on-first-join
  -- trigger), capped at the required headcount — exactly what a manager
  -- filling an empty team slot by hand would produce.
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

-- Internal-only: not granted to `anon`/`authenticated` so it isn't exposed
-- as its own PostgREST RPC — only called from respond_to_team_challenge
-- below, which runs as the owning (superuser) role either way.
revoke all on function public.ensure_team_fixture_game(uuid) from public, anon, authenticated;

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
      if v_fixture_id is not null then perform public.ensure_team_fixture_game(v_fixture_id); end if;
      return v_fixture_id;
    end if;
    if not p_accept and v_challenge.status = 'declined' then return null; end if;
    raise exception 'This challenge has already been answered';
  end if;
  update public.team_challenges set status = case when p_accept then 'accepted' else 'declined' end,
    responded_by = auth.uid(), responded_at = now(), updated_at = now() where id = p_challenge_id;
  if p_accept then
    insert into public.team_fixtures (challenge_id, home_squad_id, away_squad_id, venue, scheduled_at, match_format, sport_id, total_players)
    values (v_challenge.id, v_challenge.sender_squad_id, v_challenge.receiver_squad_id,
      v_challenge.venue, v_challenge.scheduled_at, v_challenge.match_format, v_challenge.sport_id, v_challenge.total_players)
    on conflict (challenge_id) do nothing returning id into v_fixture_id;
    if v_fixture_id is null then select id into v_fixture_id from public.team_fixtures where challenge_id = p_challenge_id; end if;
    perform public.ensure_team_fixture_game(v_fixture_id);
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

-- Live-sync: a squad member becoming active later auto-joins any still-
-- forming team that squad is already filling (if there's an open slot and
-- they're not already on another team in that game) — same effect as the
-- manager running the existing "Add players from group" action, just
-- automatic. Never raises: this fires off the squad_members table, and a
-- brand-new member joining a group must never fail because of this.
create or replace function public.sync_squad_fill_team_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team record;
begin
  if new.status <> 'ACTIVE'::public.squad_member_status_type then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'ACTIVE'::public.squad_member_status_type then
    return new;
  end if;

  for v_team in
    select t.id, t.game_id, g.players_per_team
    from public.tournament_teams t
    join public.games g on g.id = t.game_id
    where t.filled_by_squad_id = new.squad_id
      and t.status = 'FORMING'::public.tournament_team_status_type
      and t.deleted_at is null
  loop
    begin
      if v_team.players_per_team is not null and (
        select count(*) from public.tournament_team_members
        where team_id = v_team.id and status = 'JOINED' and deleted_at is null
      ) >= v_team.players_per_team then
        continue;
      end if;

      if exists (
        select 1 from public.tournament_team_members ttm
        join public.tournament_teams t2 on t2.id = ttm.team_id
        where t2.game_id = v_team.game_id
          and t2.status <> 'REJECTED'::public.tournament_team_status_type
          and ttm.status = 'JOINED'
          and ttm.user_id = new.user_id
      ) then
        continue;
      end if;

      insert into public.tournament_team_members (team_id, user_id, status, joined_at)
      values (v_team.id, new.user_id, 'JOINED', now());
    exception when others then
      -- Never let a roster-sync edge case break the squad_members write
      -- that triggered it.
      continue;
    end;
  end loop;

  return new;
end;
$$;

create trigger squad_members_sync_team_roster
  after insert or update of status on public.squad_members
  for each row execute function public.sync_squad_fill_team_roster();
