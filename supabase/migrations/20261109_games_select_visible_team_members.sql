-- A private/not-public team-based game (tournament_teams +
-- tournament_team_members, not the flat game_players list) was only
-- visible to its own creator — every other rostered team member got zero
-- rows back. Extend the same "I'm a participant" carve-out game_players
-- already gets to tournament_team_members.
alter policy games_select_visible on public.games
  using (
    (visibility = 'public'::public.game_visibility_type)
    or (creator_id = auth.uid())
    or (exists (
      select 1 from public.game_players gp
      where gp.game_id = games.id and gp.user_id = auth.uid()
    ))
    or (exists (
      select 1 from public.tournament_team_members ttm
      join public.tournament_teams tt on tt.id = ttm.team_id
      where tt.game_id = games.id
        and ttm.user_id = auth.uid()
        and ttm.status = 'JOINED'
        and tt.status <> 'REJECTED'::public.tournament_team_status_type
    ))
    or (
      (visibility = 'squad_only'::public.game_visibility_type)
      and (squad_id is not null)
      and (exists (
        select 1 from public.squad_members sm
        where sm.squad_id = games.squad_id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'::public.squad_member_status_type
      ))
    )
  );
