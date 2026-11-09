-- A team cannot send a second challenge to the same opponent team while an
-- earlier one from them is still pending that opponent's response.
create or replace function public.send_team_challenge(
  p_sender_squad_id uuid,
  p_receiver_squad_id uuid,
  p_venue text,
  p_scheduled_at timestamptz,
  p_match_format text,
  p_idempotency_key uuid,
  p_sport_id uuid,
  p_total_players integer
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
  if p_total_players is null or p_total_players < 1 or p_total_players > 20 then raise exception 'Enter a valid number of total players (1-20)'; end if;

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

  if exists (
    select 1 from public.team_challenges
    where sender_squad_id = p_sender_squad_id and receiver_squad_id = p_receiver_squad_id and status = 'pending'
  ) then
    raise exception 'You already have a pending challenge to this team — wait for them to respond before sending another.';
  end if;

  select id into v_challenge_id from public.team_challenges
  where sender_squad_id = p_sender_squad_id and receiver_squad_id = p_receiver_squad_id
    and scheduled_at = p_scheduled_at and status = 'pending';
  if v_challenge_id is not null then return v_challenge_id; end if;

  begin
    insert into public.team_challenges (
      sender_squad_id, receiver_squad_id, created_by, venue, scheduled_at,
      match_format, idempotency_key, sport_id, total_players
    ) values (
      p_sender_squad_id, p_receiver_squad_id, auth.uid(), btrim(p_venue),
      p_scheduled_at, p_match_format, p_idempotency_key, p_sport_id, p_total_players
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
