-- Notify the participants of a chat room when somebody else posts, and notify
-- the participants of a game/tournament/fixture when scoring begins. This
-- uses the existing create_notification pipeline, which is responsible for
-- persisting the inbox row and delivering registered device push tokens.

create or replace function public.notify_chat_message_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users uuid[];
  v_data jsonb;
  v_room_title text;
  v_body text;
  v_room_id uuid;
  v_root_id uuid;
  v_sender_id uuid;
begin
  if tg_table_name = 'community_comments' then
    if coalesce(trim(new.body), '') = '' then return new; end if;
    v_sender_id := new.user_id;
    v_body := left(new.body, 180);
  else
    if new.deleted_at is not null or coalesce(trim(new.message), '') = '' then return new; end if;
    v_sender_id := new.sender_id;
    v_body := left(new.message, 180);
  end if;

  if tg_table_name = 'game_messages' then
    v_room_id := new.game_id;
    select coalesce(array_agg(distinct recipients.user_id), '{}'::uuid[])
      into v_users
      from (
        select gp.user_id
          from public.game_players gp
         where gp.game_id = new.game_id and gp.status = 'JOINED' and gp.user_id is not null
        union
        select ttm.user_id
          from public.tournament_teams tt
          join public.tournament_team_members ttm on ttm.team_id = tt.id
         where tt.game_id = new.game_id and ttm.status = 'JOINED' and ttm.user_id is not null
        union
        select g.creator_id from public.games g where g.id = new.game_id
      ) recipients
     where recipients.user_id is not null and recipients.user_id <> v_sender_id;
    v_data := jsonb_build_object('eventCategory', 'chat_message', 'gameId', new.game_id, 'messageId', new.id);
    v_room_title := 'New message in game chat';

  elsif tg_table_name = 'team_messages' then
    v_room_id := new.team_id;
    select coalesce(array_agg(distinct ttm.user_id), '{}'::uuid[])
      into v_users
      from public.tournament_team_members ttm
     where ttm.team_id = new.team_id and ttm.status = 'JOINED'
       and ttm.user_id is not null and ttm.user_id <> v_sender_id;
    select jsonb_build_object('eventCategory', 'chat_message', 'gameId', tt.game_id, 'teamId', new.team_id, 'messageId', new.id)
      into v_data from public.tournament_teams tt where tt.id = new.team_id;
    v_room_title := 'New message in team chat';

  elsif tg_table_name = 'squad_messages' then
    v_room_id := new.squad_id;
    select coalesce(array_agg(distinct recipients.user_id), '{}'::uuid[])
      into v_users
      from (
        select s.squad_owner_id as user_id from public.squads s where s.id = new.squad_id
        union
        select sm.user_id from public.squad_members sm
         where sm.squad_id = new.squad_id and sm.status = 'ACTIVE'
      ) recipients
     where recipients.user_id is not null and recipients.user_id <> v_sender_id;
    v_data := jsonb_build_object('eventCategory', 'chat_message', 'squadId', new.squad_id, 'messageId', new.id);
    v_room_title := 'New message in group chat';

  elsif tg_table_name = 'event_messages' then
    v_room_id := new.event_id;
    select coalesce(array_agg(distinct recipients.user_id), '{}'::uuid[])
      into v_users
      from (
        select em.user_id from public.event_members em
         where em.event_id = new.event_id and em.status = 'ACTIVE'
        union
        select e.event_owner_id from public.events e where e.id = new.event_id
      ) recipients
     where recipients.user_id is not null and recipients.user_id <> v_sender_id;
    v_data := jsonb_build_object('eventCategory', 'chat_message', 'eventId', new.event_id, 'messageId', new.id);
    v_room_title := 'New message in event chat';

  elsif tg_table_name = 'community_comments' then
    -- The community board has no membership list. Notify the participants of
    -- this thread and users explicitly mentioned in the new comment.
    v_root_id := coalesce(new.root_id, new.id);
    select coalesce(array_agg(distinct recipients.user_id), '{}'::uuid[])
      into v_users
      from (
        select cc.user_id
          from public.community_comments cc
         where (cc.id = v_root_id or cc.root_id = v_root_id)
           and cc.user_id <> new.user_id
        union
        select (mention->>'entityId')::uuid
          from jsonb_array_elements(coalesce(new.mentions, '[]'::jsonb)) mention
         where mention->>'entityType' = 'player'
           and coalesce(mention->>'entityId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) recipients
     where recipients.user_id is not null and recipients.user_id <> v_sender_id;
    v_data := jsonb_build_object('eventCategory', 'chat_message', 'commentId', v_root_id, 'highlightId', new.id, 'messageId', new.id);
    v_room_title := 'New community message';
  else
    return new;
  end if;

  foreach v_room_id in array coalesce(v_users, '{}'::uuid[]) loop
    perform public.create_notification(
      v_room_id,
      v_room_title,
      v_body,
      'chat_message',
      v_data
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_game_message_members on public.game_messages;
create trigger notify_game_message_members after insert on public.game_messages
for each row execute function public.notify_chat_message_members();

drop trigger if exists notify_team_message_members on public.team_messages;
create trigger notify_team_message_members after insert on public.team_messages
for each row execute function public.notify_chat_message_members();

drop trigger if exists notify_squad_message_members on public.squad_messages;
create trigger notify_squad_message_members after insert on public.squad_messages
for each row execute function public.notify_chat_message_members();

drop trigger if exists notify_event_message_members on public.event_messages;
create trigger notify_event_message_members after insert on public.event_messages
for each row execute function public.notify_chat_message_members();

drop trigger if exists notify_community_comment_participants on public.community_comments;
create trigger notify_community_comment_participants after insert on public.community_comments
for each row execute function public.notify_chat_message_members();

create or replace function public.notify_game_scoring_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users uuid[];
  v_title text;
  v_user uuid;
begin
  select coalesce(array_agg(distinct recipients.user_id), '{}'::uuid[])
    into v_users
    from (
      select gp.user_id from public.game_players gp
       where gp.game_id = new.id and gp.status = 'JOINED' and gp.user_id is not null
      union
      select ttm.user_id
        from public.tournament_teams tt
        join public.tournament_team_members ttm on ttm.team_id = tt.id
       where tt.game_id = new.id and ttm.status = 'JOINED' and ttm.user_id is not null
      union
      select new.creator_id
    ) recipients
   where recipients.user_id is not null;

  v_title := coalesce(nullif(trim(new.title), ''), 'Your game');
  foreach v_user in array coalesce(v_users, '{}'::uuid[]) loop
    perform public.create_notification(
      v_user,
      'Scoring started',
      'Scoring has started for ' || v_title || '.',
      'scoring_started',
      jsonb_build_object('eventCategory', 'scoring_started', 'gameId', new.id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_game_scoring_started on public.games;
create trigger notify_game_scoring_started
after update of status on public.games
for each row
when (old.status is distinct from 'ONGOING'::public.game_status_type and new.status = 'ONGOING'::public.game_status_type)
execute function public.notify_game_scoring_started();

create or replace function public.notify_tournament_scoring_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users uuid[];
  v_title text;
  v_user uuid;
  v_has_match boolean;
begin
  v_has_match := new.cricket_match_id is not null or new.football_match_id is not null
    or new.padel_match_id is not null or new.pickleball_match_id is not null
    or new.tennis_match_id is not null or new.badminton_match_id is not null
    or new.table_tennis_match_id is not null or new.status = 'IN_PROGRESS';
  if not v_has_match then return new; end if;

  if tg_op = 'UPDATE' and (
    old.cricket_match_id is not null or old.football_match_id is not null
    or old.padel_match_id is not null or old.pickleball_match_id is not null
    or old.tennis_match_id is not null or old.badminton_match_id is not null
    or old.table_tennis_match_id is not null or old.status = 'IN_PROGRESS'
  ) then
    return new;
  end if;

  select coalesce(array_agg(distinct recipients.user_id), '{}'::uuid[])
    into v_users
    from (
      select ttm.user_id
        from public.tournament_teams tt
        join public.tournament_team_members ttm on ttm.team_id = tt.id
       where tt.game_id = new.game_id and ttm.status = 'JOINED' and ttm.user_id is not null
      union
      select gp.user_id from public.game_players gp
       where gp.game_id = new.game_id and gp.status = 'JOINED' and gp.user_id is not null
      union
      select g.creator_id from public.games g where g.id = new.game_id
    ) recipients
   where recipients.user_id is not null;
  select coalesce(nullif(trim(g.title), ''), 'Your tournament') into v_title
    from public.games g where g.id = new.game_id;

  foreach v_user in array coalesce(v_users, '{}'::uuid[]) loop
    perform public.create_notification(
      v_user,
      'Tournament scoring started',
      'Scoring has started for ' || coalesce(v_title, 'your tournament') || '.',
      'scoring_started',
      jsonb_build_object('eventCategory', 'scoring_started', 'gameId', new.game_id, 'tournamentMatchId', new.id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_tournament_scoring_started on public.tournament_matches;
create trigger notify_tournament_scoring_started
after insert or update
on public.tournament_matches
for each row execute function public.notify_tournament_scoring_started();

create or replace function public.notify_team_fixture_scoring_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users uuid[];
  v_user uuid;
begin
  if new.scorecard_match_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.scorecard_match_id is not null then return new; end if;

  select coalesce(array_agg(distinct recipients.user_id), '{}'::uuid[])
    into v_users
    from (
      select s.squad_owner_id as user_id from public.squads s
       where s.id in (new.home_squad_id, new.away_squad_id)
      union
      select sm.user_id from public.squad_members sm
       where sm.squad_id in (new.home_squad_id, new.away_squad_id) and sm.status = 'ACTIVE'
    ) recipients
   where recipients.user_id is not null;

  foreach v_user in array coalesce(v_users, '{}'::uuid[]) loop
    perform public.create_notification(
      v_user,
      'Match scoring started',
      'Scoring has started for your team fixture.',
      'scoring_started',
      jsonb_build_object('eventCategory', 'scoring_started', 'fixtureId', new.id, 'gameId', new.game_id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_team_fixture_scoring_started on public.team_fixtures;
create trigger notify_team_fixture_scoring_started
after insert or update on public.team_fixtures
for each row execute function public.notify_team_fixture_scoring_started();
