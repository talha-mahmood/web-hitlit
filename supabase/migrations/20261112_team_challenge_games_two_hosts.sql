-- Challenge-created games retain the accepting manager as creator_id (the
-- existing team auto-approval flow depends on it) and add both challenge
-- managers as equal game hosts.
alter table public.games
  add column if not exists co_host_ids uuid[] not null default '{}'::uuid[];

create or replace function public.is_game_host(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
      from public.games g
     where g.id = p_game_id
       and (g.creator_id = auth.uid() or auth.uid() = any(coalesce(g.co_host_ids, '{}'::uuid[])))
  );
$$;

revoke all on function public.is_game_host(uuid) from public, anon;
grant execute on function public.is_game_host(uuid) to authenticated;

create or replace function public.sync_team_fixture_game_hosts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_ids uuid[];
begin
  if new.game_id is null or new.game_id is not distinct from old.game_id then
    return new;
  end if;

  select array_agg(host_id order by host_order)
    into v_host_ids
    from (
      select hosts.host_id, min(hosts.host_order) as host_order
        from public.team_challenges c
        cross join lateral unnest(array[c.created_by, c.responded_by]) with ordinality as hosts(host_id, host_order)
       where c.id = new.challenge_id and hosts.host_id is not null
       group by hosts.host_id
    ) distinct_hosts;

  update public.games
     set co_host_ids = coalesce(v_host_ids, '{}'::uuid[])
   where id = new.game_id;

  return new;
end;
$$;

drop trigger if exists team_fixture_assign_game_hosts on public.team_fixtures;
create trigger team_fixture_assign_game_hosts
after update of game_id on public.team_fixtures
for each row execute function public.sync_team_fixture_game_hosts();

-- Keep host assignments tied to the two managers on the accepted challenge;
-- a co-host must not be able to grant host access to an unrelated account.
create or replace function public.guard_challenge_game_hosts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_hosts uuid[];
  v_supplied_hosts uuid[];
  v_fixture_exists boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and cardinality(coalesce(new.co_host_ids, '{}'::uuid[])) > 0 then
      raise exception 'Co-hosts are assigned only through accepted team challenges.';
    end if;
    return new;
  end if;

  if new.creator_id is distinct from old.creator_id then
    raise exception 'A game''s original host cannot be changed.';
  end if;
  if new.co_host_ids is not distinct from old.co_host_ids then
    return new;
  end if;

  select exists(select 1 from public.team_fixtures f where f.game_id = old.id)
    into v_fixture_exists;
  if not v_fixture_exists then
    raise exception 'Co-hosts are assigned only through accepted team challenges.';
  end if;

  select array_agg(distinct host_id order by host_id)
    into v_expected_hosts
    from public.team_fixtures f
    join public.team_challenges c on c.id = f.challenge_id
    cross join lateral unnest(array[c.created_by, c.responded_by]) as challenge_hosts(host_id)
   where f.game_id = old.id and host_id is not null;

  select array_agg(host_id order by host_id) into v_supplied_hosts
    from (select distinct supplied.host_id
            from unnest(coalesce(new.co_host_ids, '{}'::uuid[])) as supplied(host_id)) distinct_hosts;

  if coalesce(v_supplied_hosts, '{}'::uuid[]) is distinct from coalesce(v_expected_hosts, '{}'::uuid[]) then
    raise exception 'Challenge game hosts must match the two participating team managers.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_challenge_game_hosts on public.games;
create trigger guard_challenge_game_hosts
before insert or update of creator_id, co_host_ids on public.games
for each row execute function public.guard_challenge_game_hosts();
revoke all on function public.guard_challenge_game_hosts() from public, anon, authenticated;

-- Backfill games created by an already accepted challenge before this
-- migration, preserving sender then receiver manager order.
update public.games g
   set co_host_ids = hosts.host_ids
  from public.team_fixtures f
  join public.team_challenges c on c.id = f.challenge_id
 cross join lateral (
   select coalesce(array_agg(host_id order by host_order), '{}'::uuid[]) as host_ids
     from (
       select values_by_order.host_id, min(values_by_order.host_order) as host_order
         from public.team_challenges challenge
         cross join lateral unnest(array[challenge.created_by, challenge.responded_by]) with ordinality as values_by_order(host_id, host_order)
        where challenge.id = c.id and values_by_order.host_id is not null
        group by values_by_order.host_id
     ) distinct_hosts
  ) hosts
 where f.game_id = g.id;

-- Let either assigned challenge manager access the game and perform the
-- same game-level actions as its creator.
drop policy if exists games_select_cohost on public.games;
create policy games_select_cohost on public.games for select to authenticated
  using (public.is_game_host(id));
drop policy if exists games_update_cohost on public.games;
create policy games_update_cohost on public.games for update to authenticated
  using (public.is_game_host(id)) with check (public.is_game_host(id));
drop policy if exists games_delete_cohost on public.games;
create policy games_delete_cohost on public.games for delete to authenticated
  using (public.is_game_host(id));

drop policy if exists game_players_update_cohost on public.game_players;
create policy game_players_update_cohost on public.game_players for update to authenticated
  using (public.is_game_host(game_id)) with check (public.is_game_host(game_id));

drop policy if exists tournament_teams_insert_cohost on public.tournament_teams;
create policy tournament_teams_insert_cohost on public.tournament_teams for insert to authenticated
  with check (public.is_game_host(game_id));
drop policy if exists tournament_teams_update_cohost on public.tournament_teams;
create policy tournament_teams_update_cohost on public.tournament_teams for update to authenticated
  using (public.is_game_host(game_id)) with check (public.is_game_host(game_id));

drop policy if exists tournament_team_members_update_cohost on public.tournament_team_members;
create policy tournament_team_members_update_cohost on public.tournament_team_members for update to authenticated
  using (exists (
    select 1 from public.tournament_teams t
     where t.id = tournament_team_members.team_id and public.is_game_host(t.game_id)
  ))
  with check (exists (
    select 1 from public.tournament_teams t
     where t.id = tournament_team_members.team_id and public.is_game_host(t.game_id)
  ));

drop policy if exists tournament_matches_manage_cohost on public.tournament_matches;
create policy tournament_matches_manage_cohost on public.tournament_matches for all to authenticated
  using (public.is_game_host(game_id)) with check (public.is_game_host(game_id));
drop policy if exists tournament_pools_manage_cohost on public.tournament_pools;
create policy tournament_pools_manage_cohost on public.tournament_pools for all to authenticated
  using (public.is_game_host(game_id)) with check (public.is_game_host(game_id));

drop policy if exists game_squad_invites_insert_cohost on public.game_squad_invites;
create policy game_squad_invites_insert_cohost on public.game_squad_invites for insert to authenticated
  with check (invited_by = auth.uid() and public.is_game_host(game_id));
drop policy if exists game_squad_invites_select_cohost on public.game_squad_invites;
create policy game_squad_invites_select_cohost on public.game_squad_invites for select to authenticated
  using (public.is_game_host(game_id));
drop policy if exists game_squad_invites_update_cohost on public.game_squad_invites;
create policy game_squad_invites_update_cohost on public.game_squad_invites for update to authenticated
  using (public.is_game_host(game_id)) with check (public.is_game_host(game_id));

drop policy if exists game_invites_insert_cohost on public.game_invites;
create policy game_invites_insert_cohost on public.game_invites for insert to authenticated
  with check (invited_by = auth.uid() and public.is_game_host(game_id));
drop policy if exists game_invites_select_cohost on public.game_invites;
create policy game_invites_select_cohost on public.game_invites for select to authenticated
  using (public.is_game_host(game_id));
drop policy if exists game_invites_update_cohost on public.game_invites;
create policy game_invites_update_cohost on public.game_invites for update to authenticated
  using (public.is_game_host(game_id)) with check (public.is_game_host(game_id));

drop policy if exists tournament_team_invites_insert_cohost on public.tournament_team_invites;
create policy tournament_team_invites_insert_cohost on public.tournament_team_invites for insert to authenticated
  with check (invited_by = auth.uid() and exists (
    select 1 from public.tournament_teams t
     where t.id = tournament_team_invites.team_id and public.is_game_host(t.game_id)
  ));
drop policy if exists tournament_team_invites_select_cohost on public.tournament_team_invites;
create policy tournament_team_invites_select_cohost on public.tournament_team_invites for select to authenticated
  using (exists (
    select 1 from public.tournament_teams t
     where t.id = tournament_team_invites.team_id and public.is_game_host(t.game_id)
  ));
drop policy if exists tournament_team_invites_update_cohost on public.tournament_team_invites;
create policy tournament_team_invites_update_cohost on public.tournament_team_invites for update to authenticated
  using (exists (
    select 1 from public.tournament_teams t
     where t.id = tournament_team_invites.team_id and public.is_game_host(t.game_id)
  ))
  with check (exists (
    select 1 from public.tournament_teams t
     where t.id = tournament_team_invites.team_id and public.is_game_host(t.game_id)
  ));

drop policy if exists game_messages_insert_cohost on public.game_messages;
create policy game_messages_insert_cohost on public.game_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_game_host(game_id));
drop policy if exists game_messages_select_cohost on public.game_messages;
create policy game_messages_select_cohost on public.game_messages for select to authenticated
  using (public.is_game_host(game_id));

drop policy if exists game_chat_reads_select_cohost on public.game_chat_reads;
create policy game_chat_reads_select_cohost on public.game_chat_reads for select to authenticated
  using (public.is_game_host(game_id));

-- Hosts may update a game's visual/details and manage its generated game
-- assets using the same host check as the creator.
drop policy if exists game_icons_insert_cohost on storage.objects;
create policy game_icons_insert_cohost on storage.objects for insert to authenticated
  with check (bucket_id = 'game-icons' and public.is_game_host(((storage.foldername(name))[1])::uuid));
drop policy if exists game_icons_update_cohost on storage.objects;
create policy game_icons_update_cohost on storage.objects for update to authenticated
  using (bucket_id = 'game-icons' and public.is_game_host(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'game-icons' and public.is_game_host(((storage.foldername(name))[1])::uuid));
drop policy if exists game_icons_delete_cohost on storage.objects;
create policy game_icons_delete_cohost on storage.objects for delete to authenticated
  using (bucket_id = 'game-icons' and public.is_game_host(((storage.foldername(name))[1])::uuid));

-- The existing trigger and RPC checks use creator_id directly. Extend those
-- checks to is_game_host so co-hosts can approve/remove teams and use the
-- same manual roster actions as the creator.
create or replace function public.auto_approve_full_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required integer;
  v_team_status public.tournament_team_status_type;
  v_joined_count integer;
  v_game_id uuid;
  v_is_host boolean;
begin
  if new.status = 'JOINED' then
    select t.status, g.players_per_team, g.id
      into v_team_status, v_required, v_game_id
      from public.tournament_teams t
      join public.games g on g.id = t.game_id
     where t.id = new.team_id;

    if v_team_status = 'FORMING' and v_required is not null then
      select count(*) into v_joined_count
        from public.tournament_team_members
       where team_id = new.team_id and status = 'JOINED' and deleted_at is null;

      if v_joined_count >= v_required then
        v_is_host := public.is_game_host(v_game_id);
        update public.tournament_teams
           set status = case when v_is_host then 'APPROVED'::public.tournament_team_status_type
                             else 'PENDING_HOST_APPROVAL'::public.tournament_team_status_type end
         where id = new.team_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_team_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players_per_team integer;
  v_joined_count integer;
  v_is_host boolean;
begin
  select players_per_team into v_players_per_team from public.games where id = new.game_id;
  v_is_host := public.is_game_host(new.game_id);

  if new.status = 'APPROVED' and old.status in ('FORMING', 'PENDING_HOST_APPROVAL') then
    select count(*) into v_joined_count
      from public.tournament_team_members
     where team_id = new.id and status = 'JOINED' and deleted_at is null;
    if v_players_per_team is not null and v_joined_count < v_players_per_team then
      raise exception 'Team is not full yet (%/% players) and cannot be approved.', v_joined_count, v_players_per_team;
    end if;
    if old.status = 'PENDING_HOST_APPROVAL' and not v_is_host then
      raise exception 'Only a game host can approve a pending team.';
    end if;
  elsif new.status = 'REJECTED' and old.status is distinct from new.status then
    if old.status <> 'APPROVED' then
      raise exception 'A team can only be removed from Approved, not %.', old.status;
    end if;
    if not v_is_host then raise exception 'Only a game host can remove a team.'; end if;
  elsif new.status = 'FORMING' and old.status is distinct from 'FORMING' then
    if old.status = 'PENDING_HOST_APPROVAL' and v_is_host then
      null;
    else
      raise exception 'A team cannot be moved back to Forming directly.';
    end if;
  elsif new.status = 'PENDING_HOST_APPROVAL' and old.status is distinct from new.status then
    if old.status <> 'FORMING' then
      raise exception 'A team can only be submitted for approval from Forming.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.add_manual_team_member(p_team_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_member_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_trimmed = '' then raise exception 'A name is required.'; end if;
  select game_id into v_game_id from public.tournament_teams where id = p_team_id and deleted_at is null;
  if v_game_id is null then raise exception 'Team not found.'; end if;
  if not public.is_game_host(v_game_id) then raise exception 'Only a game host can add a player manually.'; end if;
  insert into public.tournament_team_members (team_id, manual_name, status, joined_at)
  values (p_team_id, v_trimmed, 'JOINED', now()) returning id into v_member_id;
  return v_member_id;
end;
$$;

create or replace function public.reject_pending_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_status public.tournament_team_status_type;
begin
  select game_id, status into v_game_id, v_status from public.tournament_teams where id = p_team_id;
  if v_game_id is null then raise exception 'Team not found.'; end if;
  if not public.is_game_host(v_game_id) then raise exception 'Only a game host can reject a pending team request.'; end if;
  if v_status <> 'PENDING_HOST_APPROVAL' then raise exception 'This team is not awaiting approval.'; end if;
  delete from public.tournament_team_members where team_id = p_team_id;
  update public.tournament_teams set status = 'FORMING', captain_id = null, filled_by_squad_id = null where id = p_team_id;
end;
$$;

create or replace function public.enforce_pool_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number_of_teams integer;
  v_pool_count integer;
  v_expected_per_group integer;
  v_current_in_pool integer;
begin
  if new.pool_id is distinct from old.pool_id then
    select g.number_of_teams into v_number_of_teams from public.games g where g.id = new.game_id;
    if not public.is_game_host(new.game_id) then
      raise exception 'Only a game host can assign a team to a group.';
    end if;

    if new.pool_id is not null and v_number_of_teams is not null then
      select count(*) into v_pool_count from public.tournament_pools where game_id = new.game_id;
      if v_pool_count > 0 then
        v_expected_per_group := v_number_of_teams / v_pool_count;
        select count(*) into v_current_in_pool from public.tournament_teams
         where pool_id = new.pool_id and id <> new.id and status = 'APPROVED';
        if v_current_in_pool >= v_expected_per_group then
          raise exception 'This group is already full (%/% teams).', v_current_in_pool, v_expected_per_group;
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.add_manual_game_player(p_game_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_trimmed = '' then raise exception 'A name is required.'; end if;
  if not public.is_game_host(p_game_id) then raise exception 'Only a game host can add a player manually.'; end if;
  insert into public.game_players (game_id, manual_name, status, joined_at, payment_status)
  values (p_game_id, v_trimmed, 'JOINED', now(), 'PENDING') returning id into v_player_id;
  return v_player_id;
end;
$$;

revoke all on function public.sync_team_fixture_game_hosts() from public, anon, authenticated;
