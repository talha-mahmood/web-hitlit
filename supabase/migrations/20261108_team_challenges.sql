-- Additive team-to-team challenge and fixture support. This does not alter
-- games, tournament teams, or their existing visibility and lifecycle.

create table if not exists public.team_challenges (
  id uuid primary key default gen_random_uuid(),
  sender_squad_id uuid not null references public.squads(id) on delete restrict,
  receiver_squad_id uuid not null references public.squads(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  venue text not null check (length(btrim(venue)) between 2 and 160),
  scheduled_at timestamptz not null,
  match_format text not null check (match_format in ('5v5', '7v7', '11v11')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_challenges_different_teams check (sender_squad_id <> receiver_squad_id),
  constraint team_challenges_idempotency_unique unique (sender_squad_id, idempotency_key)
);

create index if not exists team_challenges_sender_created_idx
  on public.team_challenges (sender_squad_id, created_at desc);
create index if not exists team_challenges_receiver_created_idx
  on public.team_challenges (receiver_squad_id, created_at desc);
create unique index if not exists team_challenges_one_pending_slot_idx
  on public.team_challenges (sender_squad_id, receiver_squad_id, scheduled_at)
  where status = 'pending';

create table if not exists public.team_fixtures (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null unique references public.team_challenges(id) on delete restrict,
  home_squad_id uuid not null references public.squads(id) on delete restrict,
  away_squad_id uuid not null references public.squads(id) on delete restrict,
  venue text not null,
  scheduled_at timestamptz not null,
  match_format text not null check (match_format in ('5v5', '7v7', '11v11')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  result text,
  football_match_id uuid unique references public.football_matches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_fixtures_different_teams check (home_squad_id <> away_squad_id)
);

create index if not exists team_fixtures_home_schedule_idx
  on public.team_fixtures (home_squad_id, scheduled_at desc);
create index if not exists team_fixtures_away_schedule_idx
  on public.team_fixtures (away_squad_id, scheduled_at desc);

create or replace function public.is_squad_manager(p_squad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.squads s
    where s.id = p_squad_id
      and s.deleted_at is null
      and (
        s.squad_owner_id = auth.uid()
        or exists (
          select 1 from public.squad_members sm
          where sm.squad_id = s.id
            and sm.user_id = auth.uid()
            and sm.role = 'host'::public.squad_role_type
            and sm.status = 'ACTIVE'::public.squad_member_status_type
        )
      )
  );
$$;

alter table public.team_challenges enable row level security;
alter table public.team_fixtures enable row level security;

drop policy if exists team_challenges_select_managers on public.team_challenges;
create policy team_challenges_select_managers on public.team_challenges
  for select to authenticated
  using (public.is_squad_manager(sender_squad_id) or public.is_squad_manager(receiver_squad_id));

drop policy if exists team_fixtures_select_participants on public.team_fixtures;
create policy team_fixtures_select_participants on public.team_fixtures
  for select to authenticated
  using (
    public.is_squad_manager(home_squad_id)
    or public.is_squad_manager(away_squad_id)
    or exists (
      select 1 from public.squad_members sm
      where sm.squad_id in (home_squad_id, away_squad_id)
        and sm.user_id = auth.uid()
        and sm.status = 'ACTIVE'::public.squad_member_status_type
    )
  );

create or replace function public.send_team_challenge(
  p_sender_squad_id uuid,
  p_receiver_squad_id uuid,
  p_venue text,
  p_scheduled_at timestamptz,
  p_match_format text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge_id uuid;
  v_manager record;
begin
  if auth.uid() is null then raise exception 'Sign in to send a team challenge'; end if;
  if p_sender_squad_id = p_receiver_squad_id then raise exception 'Choose another team'; end if;
  if not public.is_squad_manager(p_sender_squad_id) then raise exception 'Only a team owner or host can send challenges'; end if;
  if p_match_format not in ('5v5', '7v7', '11v11') then raise exception 'Unsupported match format'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then raise exception 'Choose a future match date and time'; end if;
  if p_venue is null or length(btrim(p_venue)) < 2 or length(btrim(p_venue)) > 160 then raise exception 'Enter a valid venue'; end if;
  if p_idempotency_key is null then raise exception 'Missing request key'; end if;

  if not exists (
    select 1 from public.squads s join public.sports sp on sp.id = s.sport_id
    where s.id = p_sender_squad_id and s.group_type = 'team' and s.deleted_at is null
      and lower(sp.name) = 'football'
  ) then raise exception 'The sender must be an active football team'; end if;
  if not exists (
    select 1 from public.squads s join public.sports sp on sp.id = s.sport_id
    where s.id = p_receiver_squad_id and s.group_type = 'team' and s.deleted_at is null
      and lower(sp.name) = 'football'
  ) then raise exception 'The opponent must be an active football team'; end if;

  select id into v_challenge_id
  from public.team_challenges
  where sender_squad_id = p_sender_squad_id and idempotency_key = p_idempotency_key;
  if v_challenge_id is not null then return v_challenge_id; end if;

  select id into v_challenge_id
  from public.team_challenges
  where sender_squad_id = p_sender_squad_id
    and receiver_squad_id = p_receiver_squad_id
    and scheduled_at = p_scheduled_at
    and status = 'pending';
  if v_challenge_id is not null then return v_challenge_id; end if;

  begin
    insert into public.team_challenges (
      sender_squad_id, receiver_squad_id, created_by, venue, scheduled_at,
      match_format, idempotency_key
    ) values (
      p_sender_squad_id, p_receiver_squad_id, auth.uid(), btrim(p_venue),
      p_scheduled_at, p_match_format, p_idempotency_key
    ) returning id into v_challenge_id;
  exception when unique_violation then
    select id into v_challenge_id from public.team_challenges
    where sender_squad_id = p_sender_squad_id and idempotency_key = p_idempotency_key;
    if v_challenge_id is null then
      select id into v_challenge_id from public.team_challenges
      where sender_squad_id = p_sender_squad_id
        and receiver_squad_id = p_receiver_squad_id
        and scheduled_at = p_scheduled_at
        and status = 'pending';
    end if;
    if v_challenge_id is null then raise; end if;
    return v_challenge_id;
  end;

  for v_manager in
    select s.squad_owner_id as user_id from public.squads s where s.id = p_receiver_squad_id
    union
    select sm.user_id from public.squad_members sm
    where sm.squad_id = p_receiver_squad_id and sm.role = 'host'::public.squad_role_type
      and sm.status = 'ACTIVE'::public.squad_member_status_type
  loop
    perform public.create_notification(
      v_manager.user_id,
      'New team challenge',
      'A team has challenged your team to a match.',
      'team_challenge_received',
      jsonb_build_object('challengeId', v_challenge_id)
    );
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

  update public.team_challenges
    set status = case when p_accept then 'accepted' else 'declined' end,
        responded_by = auth.uid(), responded_at = now(), updated_at = now()
    where id = p_challenge_id;

  if p_accept then
    insert into public.team_fixtures (
      challenge_id, home_squad_id, away_squad_id, venue, scheduled_at, match_format
    ) values (
      v_challenge.id, v_challenge.sender_squad_id, v_challenge.receiver_squad_id,
      v_challenge.venue, v_challenge.scheduled_at, v_challenge.match_format
    ) on conflict (challenge_id) do nothing returning id into v_fixture_id;
    if v_fixture_id is null then
      select id into v_fixture_id from public.team_fixtures where challenge_id = p_challenge_id;
    end if;
  end if;

  for v_manager in
    select s.squad_owner_id as user_id from public.squads s where s.id = v_challenge.sender_squad_id
    union
    select sm.user_id from public.squad_members sm
    where sm.squad_id = v_challenge.sender_squad_id and sm.role = 'host'::public.squad_role_type
      and sm.status = 'ACTIVE'::public.squad_member_status_type
  loop
    perform public.create_notification(
      v_manager.user_id,
      case when p_accept then 'Challenge accepted' else 'Challenge declined' end,
      case when p_accept then 'Your match is confirmed.' else 'The other team declined your challenge.' end,
      case when p_accept then 'team_challenge_accepted' else 'team_challenge_declined' end,
      jsonb_build_object('challengeId', v_challenge.id, 'fixtureId', v_fixture_id)
    );
  end loop;

  if p_accept then
    for v_manager in
      select s.squad_owner_id as user_id from public.squads s where s.id = v_challenge.receiver_squad_id
      union
      select sm.user_id from public.squad_members sm
      where sm.squad_id = v_challenge.receiver_squad_id and sm.role = 'host'::public.squad_role_type
        and sm.status = 'ACTIVE'::public.squad_member_status_type
    loop
      perform public.create_notification(
        v_manager.user_id, 'Fixture confirmed', 'Your team match is scheduled.',
        'team_fixture_confirmed',
        jsonb_build_object('challengeId', v_challenge.id, 'fixtureId', v_fixture_id)
      );
    end loop;
  end if;
  return v_fixture_id;
end;
$$;

create or replace function public.cancel_team_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge public.team_challenges%rowtype;
  v_manager record;
begin
  if auth.uid() is null then raise exception 'Sign in to cancel a challenge'; end if;
  select * into v_challenge from public.team_challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if not public.is_squad_manager(v_challenge.sender_squad_id) then raise exception 'Only the sender team owner or host can cancel'; end if;
  if v_challenge.status = 'cancelled' then return; end if;
  if v_challenge.status <> 'pending' then raise exception 'Only pending challenges can be cancelled'; end if;

  update public.team_challenges set status = 'cancelled', responded_by = auth.uid(), responded_at = now(), updated_at = now()
    where id = p_challenge_id;
  for v_manager in
    select s.squad_owner_id as user_id from public.squads s where s.id = v_challenge.receiver_squad_id
    union
    select sm.user_id from public.squad_members sm
    where sm.squad_id = v_challenge.receiver_squad_id and sm.role = 'host'::public.squad_role_type
      and sm.status = 'ACTIVE'::public.squad_member_status_type
  loop
    perform public.create_notification(
      v_manager.user_id, 'Challenge cancelled', 'The other team cancelled its challenge.',
      'team_challenge_cancelled', jsonb_build_object('challengeId', v_challenge.id)
    );
  end loop;
end;
$$;

create or replace function public.link_team_fixture_scorecard(p_fixture_id uuid, p_football_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_fixture public.team_fixtures%rowtype;
  v_home_name text;
  v_away_name text;
  v_match public.football_matches%rowtype;
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
  select name into v_home_name from public.squads where id = v_fixture.home_squad_id;
  select name into v_away_name from public.squads where id = v_fixture.away_squad_id;
  select * into v_match from public.football_matches where id = p_football_match_id and user_id = auth.uid();
  if not found then raise exception 'The scorecard must belong to the signed-in user'; end if;
  if v_match.team_a_name <> v_home_name or v_match.team_b_name <> v_away_name then
    raise exception 'Scorecard teams do not match this fixture';
  end if;
  if v_fixture.football_match_id is not null and v_fixture.football_match_id <> p_football_match_id then
    raise exception 'A scorecard has already been linked to this fixture';
  end if;
  update public.team_fixtures set football_match_id = p_football_match_id, updated_at = now() where id = p_fixture_id;
end;
$$;

create or replace function public.sync_team_fixture_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    update public.team_fixtures
      set status = 'completed', result = new.result_summary, updated_at = now()
      where football_match_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists football_match_complete_team_fixture on public.football_matches;
create trigger football_match_complete_team_fixture
  after update of status on public.football_matches
  for each row execute function public.sync_team_fixture_result();

revoke all on function public.is_squad_manager(uuid) from public;
revoke all on function public.send_team_challenge(uuid, uuid, text, timestamptz, text, uuid) from public;
revoke all on function public.respond_to_team_challenge(uuid, boolean) from public;
revoke all on function public.cancel_team_challenge(uuid) from public;
revoke all on function public.link_team_fixture_scorecard(uuid, uuid) from public;
grant execute on function public.is_squad_manager(uuid) to authenticated;
grant execute on function public.send_team_challenge(uuid, uuid, text, timestamptz, text, uuid) to authenticated;
grant execute on function public.respond_to_team_challenge(uuid, boolean) to authenticated;
grant execute on function public.cancel_team_challenge(uuid) to authenticated;
grant execute on function public.link_team_fixture_scorecard(uuid, uuid) to authenticated;

grant select on public.team_challenges to authenticated;
grant select on public.team_fixtures to authenticated;
