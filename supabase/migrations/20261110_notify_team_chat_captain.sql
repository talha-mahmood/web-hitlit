-- A tournament team captain is associated with team chat even if their
-- membership row is missing or not in JOINED state. The primary chat
-- notification trigger handles joined members; this additive trigger fills
-- only that captain gap to avoid duplicate notifications.
create or replace function public.notify_team_chat_captain_if_unlisted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_captain_id uuid;
  v_game_id uuid;
begin
  if new.deleted_at is not null or coalesce(trim(new.message), '') = '' then
    return new;
  end if;

  select tt.captain_id, tt.game_id
    into v_captain_id, v_game_id
    from public.tournament_teams tt
   where tt.id = new.team_id;

  if v_captain_id is null or v_captain_id = new.sender_id then
    return new;
  end if;

  if exists (
    select 1
      from public.tournament_team_members ttm
     where ttm.team_id = new.team_id
       and ttm.user_id = v_captain_id
       and ttm.status = 'JOINED'
  ) then
    return new;
  end if;

  perform public.create_notification(
    v_captain_id,
    'New message in team chat',
    left(new.message, 180),
    'chat_message',
    jsonb_build_object(
      'eventCategory', 'chat_message',
      'gameId', v_game_id,
      'teamId', new.team_id,
      'messageId', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_team_chat_captain_if_unlisted on public.team_messages;
create trigger notify_team_chat_captain_if_unlisted
after insert on public.team_messages
for each row execute function public.notify_team_chat_captain_if_unlisted();
