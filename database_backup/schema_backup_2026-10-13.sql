-- ============================================================================
-- HitLit / PlayOye — Full Supabase database SCHEMA backup
-- Generated: 2026-10-13, via read-only introspection of the live project
-- (project_ref: gexddahyiaphsjevsnng), by Claude Code.
--
-- WHAT THIS IS: the complete structure of the "public" schema (every table,
-- column, type, constraint, index, function, trigger, RLS policy), plus
-- storage buckets/policies, pg_cron jobs, and realtime publication
-- membership — captured directly from Postgres system catalogs
-- (pg_catalog/information_schema), not hand-written, so it reflects the
-- database exactly as it was at generation time.
--
-- WHAT THIS IS NOT: this is a SCHEMA-ONLY backup. It contains no actual
-- row data (no users, games, matches, messages, etc.) — only the structure
-- needed to recreate an empty database with the exact same shape. If
-- Supabase is ever lost/blocked, hand this file to Claude and it can
-- replay these statements against a fresh Postgres/Supabase project to
-- reconstruct the schema from scratch, in this exact order:
--   1. Extensions
--   2. Enum types
--   3. Tables (columns only)
--   4. Primary keys
--   5. Foreign keys
--   6. Unique constraints
--   7. Check constraints
--   8. Indexes
--   9. Functions
--  10. Triggers (including the one on auth.users)
--  11. Row Level Security (enable + policies)
--  12. Storage buckets + storage policies
--  13. pg_cron scheduled jobs
--  14. Realtime publication membership
--
-- NOTES / CAVEATS:
-- - `profiles.id` has a foreign key to `auth.users(id)` — this assumes
--   Supabase's own `auth` schema (managed by Supabase Auth, not part of
--   this backup) already exists in the target project exactly as it does
--   on any fresh Supabase project.
-- - No custom sequences exist in `public` — every table uses a UUID
--   primary key (`gen_random_uuid()`), so nothing beyond what's below is
--   needed for ID generation.
-- - Extension `pg_net` (used by `send_push_for_notification` to call
--   Expo's push API) and `pg_cron` are Supabase-managed extensions —
--   available by default on Supabase projects, just need enabling.
-- - `supabase_vault` is Supabase's own secrets-management extension,
--   also enabled by default on new projects.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pg_stat_statements;
create extension if not exists supabase_vault;
-- plpgsql is installed by default on every Postgres database.


-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================
create type public.booking_payment_status_type as enum ('paid', 'unpaid');
create type public.booking_status_type as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'BLOCKED');
create type public.game_gender_type as enum ('male', 'female', 'mixed');
create type public.game_invite_status_type as enum ('pending', 'accepted', 'declined');
create type public.game_player_status_type as enum ('PENDING', 'JOINED', 'DECLINED', 'REMOVED', 'LEFT');
create type public.game_skill_level_type as enum ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO');
create type public.game_status_type as enum ('OPEN', 'FULL', 'ONGOING', 'COMPLETED', 'CANCELLED');
create type public.game_type_type as enum ('REGULAR', 'COACHING', 'TOURNAMENT');
create type public.game_visibility_type as enum ('public', 'private', 'squad_only');
create type public.gender_type as enum ('male', 'female', 'other');
create type public.payment_status_type as enum ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
create type public.profile_type as enum ('owner', 'user', 'superadmin');
create type public.skill_level_type as enum ('beginner', 'intermediate', 'expert');
create type public.squad_invite_status_type as enum ('pending', 'accepted', 'declined');
create type public.squad_member_status_type as enum ('ACTIVE', 'LEFT', 'REMOVED', 'PENDING', 'DECLINED');
create type public.squad_role_type as enum ('captain', 'member', 'host');
create type public.tournament_format_type as enum ('KNOCKOUT', 'LEAGUE', 'POOL');
create type public.tournament_team_invite_status_type as enum ('pending', 'accepted', 'declined');
create type public.tournament_team_status_type as enum ('FORMING', 'PENDING_HOST_APPROVAL', 'APPROVED', 'REJECTED');


-- ============================================================================
-- 3. TABLES (columns only — constraints/indexes added in later sections)
-- ============================================================================

create table public.badminton_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_a_name text NOT NULL,
  team_b_name text NOT NULL,
  team_a_players text[] NOT NULL DEFAULT '{}'::text[],
  team_b_players text[] NOT NULL DEFAULT '{}'::text[],
  play_mode text NOT NULL,
  first_serving_team text NOT NULL,
  team_a_server_index smallint NOT NULL DEFAULT 0,
  team_b_server_index smallint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text,
  winner_team text,
  result_summary text,
  venue text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  points_to_win smallint NOT NULL DEFAULT 21,
  games_to_win smallint NOT NULL DEFAULT 2,
  scoring_code text
);

create table public.badminton_rallies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  seq integer NOT NULL,
  winner text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.blocked_users (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.booking_holds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  court_id uuid NOT NULL,
  status booking_status_type NOT NULL DEFAULT 'PENDING'::booking_status_type,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_status booking_payment_status_type NOT NULL DEFAULT 'unpaid'::booking_payment_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  checked_in_at timestamp with time zone,
  game_id uuid
);

create table public.community_comment_likes (
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.community_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_id uuid,
  root_id uuid,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  poll_id uuid
);

create table public.content_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  source text NOT NULL,
  source_id uuid NOT NULL,
  context_id uuid NOT NULL,
  message_snapshot text NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.court (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  sports_id uuid NOT NULL,
  name text NOT NULL,
  price_per_hour numeric(10,2) NOT NULL DEFAULT 0,
  capacity integer,
  isactive boolean NOT NULL DEFAULT true,
  surface_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  description text,
  location text,
  amenities text[] NOT NULL DEFAULT '{}'::text[]
);

create table public.court_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.court_price_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  price_per_hour numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.cricket_balls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  innings_id uuid NOT NULL,
  seq integer NOT NULL,
  striker_name text NOT NULL,
  non_striker_name text,
  bowler_name text NOT NULL,
  runs_batted integer NOT NULL DEFAULT 0,
  extra_type text,
  extra_runs integer NOT NULL DEFAULT 0,
  is_wicket boolean NOT NULL DEFAULT false,
  wicket_type text,
  dismissed_name text,
  fielder_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  fielder2_name text
);

create table public.cricket_innings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  innings_number integer NOT NULL,
  batting_team text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false
);

create table public.cricket_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_a_name text NOT NULL,
  team_b_name text NOT NULL,
  team_a_players text[] NOT NULL DEFAULT '{}'::text[],
  team_b_players text[] NOT NULL DEFAULT '{}'::text[],
  overs_limit integer NOT NULL,
  toss_winner text NOT NULL,
  toss_decision text NOT NULL,
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text,
  result_summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  venue text,
  scoring_code text,
  format text NOT NULL DEFAULT 'T20'::text,
  target_override integer,
  team_a_penalty_runs integer NOT NULL DEFAULT 0,
  team_b_penalty_runs integer NOT NULL DEFAULT 0,
  last_man_stand boolean NOT NULL DEFAULT false
);

create table public.favorite_games (
  user_id uuid NOT NULL,
  game_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.favorite_venues (
  user_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.football_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  seq integer NOT NULL,
  team text NOT NULL,
  phase text NOT NULL,
  minute_label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  scorer_name text
);

create table public.football_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_a_name text NOT NULL,
  team_b_name text NOT NULL,
  requires_winner boolean NOT NULL DEFAULT false,
  phase text NOT NULL DEFAULT 'NOT_STARTED'::text,
  first_half_kickoff_at timestamp with time zone,
  first_half_added_minutes smallint,
  second_half_kickoff_at timestamp with time zone,
  second_half_added_minutes smallint,
  extra_time_first_kickoff_at timestamp with time zone,
  extra_time_first_added_minutes smallint,
  extra_time_second_kickoff_at timestamp with time zone,
  extra_time_second_added_minutes smallint,
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text,
  winner_team text,
  is_draw boolean NOT NULL DEFAULT false,
  result_summary text,
  venue text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  half_duration_minutes smallint NOT NULL DEFAULT 45,
  extra_time_period_minutes smallint NOT NULL DEFAULT 15,
  paused_at timestamp with time zone,
  team_a_players text[] NOT NULL DEFAULT '{}'::text[],
  team_b_players text[] NOT NULL DEFAULT '{}'::text[],
  scoring_code text
);

create table public.football_penalty_kicks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  seq integer NOT NULL,
  team text NOT NULL,
  scored boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.game_chat_reads (
  user_id uuid NOT NULL,
  game_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.game_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id uuid NOT NULL,
  sport_id uuid,
  venue_id uuid,
  title text,
  game_date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  role text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  game_type game_type_type
);

create table public.game_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  invited_user_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  status game_invite_status_type NOT NULL DEFAULT 'pending'::game_invite_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.game_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  parent_id uuid,
  root_id uuid,
  poll_id uuid
);

create table public.game_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  user_id uuid,
  status game_player_status_type NOT NULL DEFAULT 'PENDING'::game_player_status_type,
  payment_status payment_status_type NOT NULL DEFAULT 'PENDING'::payment_status_type,
  joined_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  skill_level skill_level_type,
  location text,
  manual_name text
);

create table public.game_squad_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  squad_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  status game_invite_status_type NOT NULL DEFAULT 'pending'::game_invite_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  sport_id uuid NOT NULL,
  venue_id uuid,
  court_id uuid,
  squad_id uuid,
  booking_id uuid,
  gender game_gender_type NOT NULL DEFAULT 'mixed'::game_gender_type,
  minimum_age integer,
  maximum_age integer,
  visibility game_visibility_type NOT NULL DEFAULT 'public'::game_visibility_type,
  title text NOT NULL,
  description text,
  game_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  status game_status_type NOT NULL DEFAULT 'OPEN'::game_status_type,
  game_type game_type_type NOT NULL DEFAULT 'REGULAR'::game_type_type,
  skill_level game_skill_level_type,
  max_players integer NOT NULL,
  min_players integer NOT NULL DEFAULT 2,
  pay_and_join boolean NOT NULL DEFAULT false,
  entry_fee numeric(10,2) NOT NULL DEFAULT 0,
  cost_shared boolean NOT NULL DEFAULT false,
  bring_equipment boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  game_code text NOT NULL DEFAULT generate_game_code(),
  number_of_teams integer,
  players_per_team integer,
  end_date date,
  tournament_format tournament_format_type,
  custom_venue_name text,
  icon_url text,
  daily_hours integer,
  venue_contacted boolean NOT NULL DEFAULT false,
  pool_qualifiers_per_group smallint,
  custom_venue_lat double precision,
  custom_venue_lng double precision
);

create table public.match_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id uuid NOT NULL,
  match_id uuid NOT NULL,
  team_id uuid NOT NULL,
  sport_id uuid,
  result text NOT NULL,
  game_title text,
  game_date date,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  cricket_match_id uuid,
  football_match_id uuid
);

create table public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

create table public.padel_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_a_name text NOT NULL,
  team_b_name text NOT NULL,
  team_a_players text[] NOT NULL DEFAULT '{}'::text[],
  team_b_players text[] NOT NULL DEFAULT '{}'::text[],
  format text NOT NULL,
  deuce_type text NOT NULL,
  first_server_team text NOT NULL,
  first_server_player_index smallint NOT NULL,
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text,
  winner_team text,
  result_summary text,
  venue text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  games_per_set smallint NOT NULL DEFAULT 6,
  play_mode text NOT NULL DEFAULT 'DOUBLES'::text,
  scoring_code text
);

create table public.padel_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  seq integer NOT NULL,
  winner text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  game_id uuid,
  user_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'PKR'::text,
  payment_gateway text,
  gateway_response jsonb,
  paid_at timestamp with time zone,
  refunded_at timestamp with time zone,
  transaction_id text,
  status payment_status_type NOT NULL DEFAULT 'PENDING'::payment_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.pickleball_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_a_name text NOT NULL,
  team_b_name text NOT NULL,
  team_a_players text[] NOT NULL DEFAULT '{}'::text[],
  team_b_players text[] NOT NULL DEFAULT '{}'::text[],
  scoring_mode text NOT NULL,
  play_mode text NOT NULL,
  first_serving_team text NOT NULL,
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text,
  winner_team text,
  result_summary text,
  venue text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  points_to_win smallint NOT NULL DEFAULT 11,
  games_to_win smallint NOT NULL DEFAULT 2,
  scoring_code text
);

create table public.pickleball_rallies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  seq integer NOT NULL,
  winner text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.player_follows (
  follower_id uuid NOT NULL,
  followed_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.poll_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL,
  option_text text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);

create table public.poll_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL,
  option_id uuid NOT NULL,
  voter_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.polls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.profiles (
  id uuid NOT NULL,
  full_name text,
  type profile_type NOT NULL DEFAULT 'user'::profile_type,
  phone text,
  email text,
  avatar text,
  gender gender_type,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  skill_level skill_level_type,
  bio text,
  date_of_birth date,
  description text,
  isactive boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  user_code text NOT NULL,
  visibility text NOT NULL DEFAULT 'public'::text,
  jersey_number smallint
);

create table public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.sports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  min_players integer,
  max_players integer,
  is_team_sport boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.squad_chat_reads (
  user_id uuid NOT NULL,
  squad_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.squad_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  invited_user_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  status squad_invite_status_type NOT NULL DEFAULT 'pending'::squad_invite_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.squad_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role squad_role_type NOT NULL DEFAULT 'member'::squad_role_type,
  status squad_member_status_type NOT NULL DEFAULT 'ACTIVE'::squad_member_status_type,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  skill_level skill_level_type,
  location text
);

create table public.squad_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  parent_id uuid,
  root_id uuid,
  poll_id uuid
);

create table public.squads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  squad_owner_id uuid NOT NULL,
  name text NOT NULL,
  min_players integer,
  max_players integer,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  skill_level skill_level_type,
  location text,
  squad_code text NOT NULL DEFAULT generate_squad_code(),
  sport_id uuid,
  icon_url text,
  join_requests_blocked boolean NOT NULL DEFAULT false,
  gender game_gender_type NOT NULL DEFAULT 'mixed'::game_gender_type,
  group_type text NOT NULL DEFAULT 'group'::text
);

create table public.table_tennis_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_a_name text NOT NULL,
  team_b_name text NOT NULL,
  team_a_players text[] NOT NULL DEFAULT '{}'::text[],
  team_b_players text[] NOT NULL DEFAULT '{}'::text[],
  play_mode text NOT NULL,
  first_serving_team text NOT NULL,
  first_server_index smallint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text,
  winner_team text,
  result_summary text,
  venue text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  points_to_win smallint NOT NULL DEFAULT 11,
  games_to_win smallint NOT NULL DEFAULT 3,
  scoring_code text
);

create table public.table_tennis_rallies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  seq integer NOT NULL,
  winner text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.team_chat_reads (
  user_id uuid NOT NULL,
  team_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.team_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  parent_id uuid,
  root_id uuid,
  poll_id uuid
);

create table public.tennis_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  player_a_name text NOT NULL,
  player_b_name text NOT NULL,
  format text NOT NULL,
  first_server text NOT NULL,
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text,
  winner_player text,
  result_summary text,
  venue text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  games_per_set smallint NOT NULL DEFAULT 6,
  play_mode text NOT NULL DEFAULT 'SINGLES'::text,
  player_a_players text[] NOT NULL DEFAULT '{}'::text[],
  player_b_players text[] NOT NULL DEFAULT '{}'::text[],
  player_a_server_index smallint NOT NULL DEFAULT 0,
  player_b_server_index smallint NOT NULL DEFAULT 0,
  scoring_code text
);

create table public.tennis_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  seq integer NOT NULL,
  winner text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.tournament_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  team_a_id uuid,
  team_b_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING'::text,
  winner_team_id uuid,
  is_draw boolean NOT NULL DEFAULT false,
  played_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  round integer NOT NULL DEFAULT 1,
  pool_id uuid,
  cricket_match_id uuid,
  padel_match_id uuid,
  tennis_match_id uuid,
  badminton_match_id uuid,
  pickleball_match_id uuid,
  table_tennis_match_id uuid,
  football_match_id uuid,
  manual_score jsonb,
  scorer_user_id uuid,
  scheduled_at timestamp with time zone
);

create table public.tournament_pools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.tournament_team_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  invited_user_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  status tournament_team_invite_status_type NOT NULL DEFAULT 'pending'::tournament_team_invite_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.tournament_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid,
  status game_player_status_type NOT NULL DEFAULT 'PENDING'::game_player_status_type,
  joined_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  skill_level skill_level_type,
  location text,
  manual_name text
);

create table public.tournament_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  name text NOT NULL,
  captain_id uuid,
  status tournament_team_status_type NOT NULL DEFAULT 'FORMING'::tournament_team_status_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  sort_order integer,
  pool_id uuid,
  filled_by_squad_id uuid,
  team_code text
);

create table public.venue_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

create table public.venue_facilities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  name text NOT NULL,
  type text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.venue_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

create table public.venue_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  user_id uuid NOT NULL,
  booking_id uuid,
  rating integer NOT NULL,
  review text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  owner_response text,
  owner_response_at timestamp with time zone
);

create table public.venues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venue_owner_id uuid,
  name text NOT NULL,
  description text,
  address text,
  city text,
  start_time time without time zone,
  end_time time without time zone,
  latitude double precision,
  longitude double precision,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  isactive boolean NOT NULL DEFAULT true,
  images text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  contact_phone text,
  rules_and_policies text,
  boosted_until timestamp with time zone,
  whatsapp_number text,
  maps_link text
);


-- ============================================================================
-- 4. PRIMARY KEYS
-- ============================================================================
alter table public.badminton_matches add constraint badminton_matches_pkey primary key (id);
alter table public.badminton_rallies add constraint badminton_rallies_pkey primary key (id);
alter table public.blocked_users add constraint blocked_users_pkey primary key (blocker_id, blocked_id);
alter table public.booking_holds add constraint booking_holds_pkey primary key (id);
alter table public.bookings add constraint bookings_pkey primary key (id);
alter table public.community_comment_likes add constraint community_comment_likes_pkey primary key (comment_id, user_id);
alter table public.community_comments add constraint community_comments_pkey primary key (id);
alter table public.content_reports add constraint content_reports_pkey primary key (id);
alter table public.court add constraint court_pkey primary key (id);
alter table public.court_images add constraint court_images_pkey primary key (id);
alter table public.court_price_rules add constraint court_price_rules_pkey primary key (id);
alter table public.cricket_balls add constraint cricket_balls_pkey primary key (id);
alter table public.cricket_innings add constraint cricket_innings_pkey primary key (id);
alter table public.cricket_matches add constraint cricket_matches_pkey primary key (id);
alter table public.favorite_games add constraint favorite_games_pkey primary key (user_id, game_id);
alter table public.favorite_venues add constraint favorite_venues_pkey primary key (user_id, venue_id);
alter table public.football_goals add constraint football_goals_pkey primary key (id);
alter table public.football_matches add constraint football_matches_pkey primary key (id);
alter table public.football_penalty_kicks add constraint football_penalty_kicks_pkey primary key (id);
alter table public.game_chat_reads add constraint game_chat_reads_pkey primary key (user_id, game_id);
alter table public.game_history add constraint game_history_pkey primary key (id);
alter table public.game_invites add constraint game_invites_pkey primary key (id);
alter table public.game_messages add constraint game_messages_pkey primary key (id);
alter table public.game_players add constraint game_players_pkey primary key (id);
alter table public.game_squad_invites add constraint game_squad_invites_pkey primary key (id);
alter table public.games add constraint games_pkey primary key (id);
alter table public.match_results add constraint match_results_pkey primary key (id);
alter table public.notifications add constraint notifications_pkey primary key (id);
alter table public.padel_matches add constraint padel_matches_pkey primary key (id);
alter table public.padel_points add constraint padel_points_pkey primary key (id);
alter table public.payments add constraint payments_pkey primary key (id);
alter table public.pickleball_matches add constraint pickleball_matches_pkey primary key (id);
alter table public.pickleball_rallies add constraint pickleball_rallies_pkey primary key (id);
alter table public.player_follows add constraint player_follows_pkey primary key (follower_id, followed_id);
alter table public.poll_options add constraint poll_options_pkey primary key (id);
alter table public.poll_votes add constraint poll_votes_pkey primary key (id);
alter table public.polls add constraint polls_pkey primary key (id);
alter table public.profiles add constraint profiles_pkey primary key (id);
alter table public.push_tokens add constraint push_tokens_pkey primary key (id);
alter table public.slots add constraint slots_pkey primary key (id);
alter table public.sports add constraint sports_pkey primary key (id);
alter table public.squad_chat_reads add constraint squad_chat_reads_pkey primary key (user_id, squad_id);
alter table public.squad_invites add constraint squad_invites_pkey primary key (id);
alter table public.squad_members add constraint squad_members_pkey primary key (id);
alter table public.squad_messages add constraint squad_messages_pkey primary key (id);
alter table public.squads add constraint squads_pkey primary key (id);
alter table public.table_tennis_matches add constraint table_tennis_matches_pkey primary key (id);
alter table public.table_tennis_rallies add constraint table_tennis_rallies_pkey primary key (id);
alter table public.team_chat_reads add constraint team_chat_reads_pkey primary key (user_id, team_id);
alter table public.team_messages add constraint team_messages_pkey primary key (id);
alter table public.tennis_matches add constraint tennis_matches_pkey primary key (id);
alter table public.tennis_points add constraint tennis_points_pkey primary key (id);
alter table public.tournament_matches add constraint tournament_matches_pkey primary key (id);
alter table public.tournament_pools add constraint tournament_pools_pkey primary key (id);
alter table public.tournament_team_invites add constraint tournament_team_invites_pkey primary key (id);
alter table public.tournament_team_members add constraint tournament_team_members_pkey primary key (id);
alter table public.tournament_teams add constraint tournament_teams_pkey primary key (id);
alter table public.venue_admins add constraint venue_admins_pkey primary key (id);
alter table public.venue_facilities add constraint venue_facilities_pkey primary key (id);
alter table public.venue_images add constraint venue_images_pkey primary key (id);
alter table public.venue_reviews add constraint venue_reviews_pkey primary key (id);
alter table public.venues add constraint venues_pkey primary key (id);


-- ============================================================================
-- 5. FOREIGN KEYS
-- (profiles_id_fkey and push_tokens_user_id_fkey reference auth.users,
--  Supabase's own managed schema — present by default on any Supabase
--  project, not part of this backup.)
-- ============================================================================
alter table public.badminton_matches add constraint badminton_matches_user_id_fkey foreign key (user_id) references profiles(id);
alter table public.badminton_rallies add constraint badminton_rallies_match_id_fkey foreign key (match_id) references badminton_matches(id) on delete cascade;
alter table public.blocked_users add constraint blocked_users_blocker_id_fkey foreign key (blocker_id) references profiles(id) on delete cascade;
alter table public.blocked_users add constraint blocked_users_blocked_id_fkey foreign key (blocked_id) references profiles(id) on delete cascade;
alter table public.booking_holds add constraint booking_holds_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.booking_holds add constraint booking_holds_court_id_fkey foreign key (court_id) references court(id) on delete cascade;
alter table public.bookings add constraint bookings_game_id_fkey foreign key (game_id) references games(id) on delete set null;
alter table public.bookings add constraint bookings_court_id_fkey foreign key (court_id) references court(id) on delete restrict;
alter table public.bookings add constraint bookings_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.community_comment_likes add constraint community_comment_likes_comment_id_fkey foreign key (comment_id) references community_comments(id) on delete cascade;
alter table public.community_comment_likes add constraint community_comment_likes_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.community_comments add constraint community_comments_poll_id_fkey foreign key (poll_id) references polls(id);
alter table public.community_comments add constraint community_comments_root_id_fkey foreign key (root_id) references community_comments(id) on delete cascade;
alter table public.community_comments add constraint community_comments_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.community_comments add constraint community_comments_parent_id_fkey foreign key (parent_id) references community_comments(id) on delete cascade;
alter table public.content_reports add constraint content_reports_reported_user_id_fkey foreign key (reported_user_id) references profiles(id) on delete cascade;
alter table public.content_reports add constraint content_reports_reporter_id_fkey foreign key (reporter_id) references profiles(id) on delete cascade;
alter table public.court add constraint court_sports_id_fkey foreign key (sports_id) references sports(id) on delete restrict;
alter table public.court add constraint court_venue_id_fkey foreign key (venue_id) references venues(id) on delete cascade;
alter table public.court_images add constraint court_images_court_id_fkey foreign key (court_id) references court(id) on delete cascade;
alter table public.court_price_rules add constraint court_price_rules_court_id_fkey foreign key (court_id) references court(id) on delete cascade;
alter table public.cricket_balls add constraint cricket_balls_innings_id_fkey foreign key (innings_id) references cricket_innings(id) on delete cascade;
alter table public.cricket_innings add constraint cricket_innings_match_id_fkey foreign key (match_id) references cricket_matches(id) on delete cascade;
alter table public.cricket_matches add constraint cricket_matches_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.favorite_games add constraint favorite_games_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.favorite_games add constraint favorite_games_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.favorite_venues add constraint favorite_venues_venue_id_fkey foreign key (venue_id) references venues(id) on delete cascade;
alter table public.favorite_venues add constraint favorite_venues_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.football_goals add constraint football_goals_match_id_fkey foreign key (match_id) references football_matches(id) on delete cascade;
alter table public.football_matches add constraint football_matches_user_id_fkey foreign key (user_id) references profiles(id);
alter table public.football_penalty_kicks add constraint football_penalty_kicks_match_id_fkey foreign key (match_id) references football_matches(id) on delete cascade;
alter table public.game_chat_reads add constraint game_chat_reads_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.game_chat_reads add constraint game_chat_reads_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.game_history add constraint game_history_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.game_history add constraint game_history_venue_id_fkey foreign key (venue_id) references venues(id) on delete set null;
alter table public.game_history add constraint game_history_sport_id_fkey foreign key (sport_id) references sports(id) on delete set null;
alter table public.game_invites add constraint game_invites_invited_by_fkey foreign key (invited_by) references profiles(id) on delete cascade;
alter table public.game_invites add constraint game_invites_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.game_invites add constraint game_invites_invited_user_id_fkey foreign key (invited_user_id) references profiles(id) on delete cascade;
alter table public.game_messages add constraint game_messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete cascade;
alter table public.game_messages add constraint game_messages_parent_id_fkey foreign key (parent_id) references game_messages(id) on delete cascade;
alter table public.game_messages add constraint game_messages_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.game_messages add constraint game_messages_root_id_fkey foreign key (root_id) references game_messages(id) on delete cascade;
alter table public.game_messages add constraint game_messages_poll_id_fkey foreign key (poll_id) references polls(id);
alter table public.game_players add constraint game_players_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.game_players add constraint game_players_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.game_squad_invites add constraint game_squad_invites_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.game_squad_invites add constraint game_squad_invites_invited_by_fkey foreign key (invited_by) references profiles(id) on delete cascade;
alter table public.game_squad_invites add constraint game_squad_invites_squad_id_fkey foreign key (squad_id) references squads(id) on delete cascade;
alter table public.games add constraint games_creator_id_fkey foreign key (creator_id) references profiles(id) on delete cascade;
alter table public.games add constraint games_venue_id_fkey foreign key (venue_id) references venues(id) on delete set null;
alter table public.games add constraint games_sport_id_fkey foreign key (sport_id) references sports(id) on delete restrict;
alter table public.games add constraint games_court_id_fkey foreign key (court_id) references court(id) on delete set null;
alter table public.games add constraint games_booking_id_fkey foreign key (booking_id) references bookings(id) on delete set null;
alter table public.games add constraint games_squad_id_fkey foreign key (squad_id) references squads(id) on delete set null;
alter table public.match_results add constraint match_results_football_match_id_fkey foreign key (football_match_id) references football_matches(id) on delete set null;
alter table public.match_results add constraint match_results_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.match_results add constraint match_results_sport_id_fkey foreign key (sport_id) references sports(id) on delete set null;
alter table public.match_results add constraint match_results_cricket_match_id_fkey foreign key (cricket_match_id) references cricket_matches(id) on delete set null;
alter table public.notifications add constraint notifications_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.padel_matches add constraint padel_matches_user_id_fkey foreign key (user_id) references profiles(id);
alter table public.padel_points add constraint padel_points_match_id_fkey foreign key (match_id) references padel_matches(id) on delete cascade;
alter table public.payments add constraint payments_game_id_fkey foreign key (game_id) references games(id) on delete set null;
alter table public.payments add constraint payments_booking_id_fkey foreign key (booking_id) references bookings(id) on delete set null;
alter table public.payments add constraint payments_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.pickleball_matches add constraint pickleball_matches_user_id_fkey foreign key (user_id) references profiles(id);
alter table public.pickleball_rallies add constraint pickleball_rallies_match_id_fkey foreign key (match_id) references pickleball_matches(id) on delete cascade;
alter table public.player_follows add constraint player_follows_followed_id_fkey foreign key (followed_id) references profiles(id) on delete cascade;
alter table public.player_follows add constraint player_follows_follower_id_fkey foreign key (follower_id) references profiles(id) on delete cascade;
alter table public.poll_options add constraint poll_options_poll_id_fkey foreign key (poll_id) references polls(id) on delete cascade;
alter table public.poll_votes add constraint poll_votes_voter_id_fkey foreign key (voter_id) references profiles(id);
alter table public.poll_votes add constraint poll_votes_option_id_fkey foreign key (option_id) references poll_options(id) on delete cascade;
alter table public.poll_votes add constraint poll_votes_poll_id_fkey foreign key (poll_id) references polls(id) on delete cascade;
alter table public.polls add constraint polls_created_by_fkey foreign key (created_by) references profiles(id);
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.push_tokens add constraint push_tokens_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.slots add constraint slots_court_id_fkey foreign key (court_id) references court(id) on delete cascade;
alter table public.squad_chat_reads add constraint squad_chat_reads_squad_id_fkey foreign key (squad_id) references squads(id) on delete cascade;
alter table public.squad_chat_reads add constraint squad_chat_reads_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.squad_invites add constraint squad_invites_invited_user_id_fkey foreign key (invited_user_id) references profiles(id) on delete cascade;
alter table public.squad_invites add constraint squad_invites_squad_id_fkey foreign key (squad_id) references squads(id) on delete cascade;
alter table public.squad_invites add constraint squad_invites_invited_by_fkey foreign key (invited_by) references profiles(id) on delete cascade;
alter table public.squad_members add constraint squad_members_squad_id_fkey foreign key (squad_id) references squads(id) on delete cascade;
alter table public.squad_members add constraint squad_members_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.squad_messages add constraint squad_messages_poll_id_fkey foreign key (poll_id) references polls(id);
alter table public.squad_messages add constraint squad_messages_root_id_fkey foreign key (root_id) references squad_messages(id) on delete cascade;
alter table public.squad_messages add constraint squad_messages_parent_id_fkey foreign key (parent_id) references squad_messages(id) on delete cascade;
alter table public.squad_messages add constraint squad_messages_squad_id_fkey foreign key (squad_id) references squads(id) on delete cascade;
alter table public.squad_messages add constraint squad_messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete cascade;
alter table public.squads add constraint squads_sport_id_fkey foreign key (sport_id) references sports(id) on delete restrict;
alter table public.squads add constraint squads_squad_owner_id_fkey foreign key (squad_owner_id) references profiles(id) on delete cascade;
alter table public.table_tennis_matches add constraint table_tennis_matches_user_id_fkey foreign key (user_id) references profiles(id);
alter table public.table_tennis_rallies add constraint table_tennis_rallies_match_id_fkey foreign key (match_id) references table_tennis_matches(id) on delete cascade;
alter table public.team_chat_reads add constraint team_chat_reads_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.team_chat_reads add constraint team_chat_reads_team_id_fkey foreign key (team_id) references tournament_teams(id) on delete cascade;
alter table public.team_messages add constraint team_messages_parent_id_fkey foreign key (parent_id) references team_messages(id) on delete cascade;
alter table public.team_messages add constraint team_messages_root_id_fkey foreign key (root_id) references team_messages(id) on delete cascade;
alter table public.team_messages add constraint team_messages_poll_id_fkey foreign key (poll_id) references polls(id);
alter table public.team_messages add constraint team_messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete cascade;
alter table public.team_messages add constraint team_messages_team_id_fkey foreign key (team_id) references tournament_teams(id) on delete cascade;
alter table public.tennis_matches add constraint tennis_matches_user_id_fkey foreign key (user_id) references profiles(id);
alter table public.tennis_points add constraint tennis_points_match_id_fkey foreign key (match_id) references tennis_matches(id) on delete cascade;
alter table public.tournament_matches add constraint tournament_matches_padel_match_id_fkey foreign key (padel_match_id) references padel_matches(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_pool_id_fkey foreign key (pool_id) references tournament_pools(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_winner_team_id_fkey foreign key (winner_team_id) references tournament_teams(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_tennis_match_id_fkey foreign key (tennis_match_id) references tennis_matches(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_badminton_match_id_fkey foreign key (badminton_match_id) references badminton_matches(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_pickleball_match_id_fkey foreign key (pickleball_match_id) references pickleball_matches(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_table_tennis_match_id_fkey foreign key (table_tennis_match_id) references table_tennis_matches(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_football_match_id_fkey foreign key (football_match_id) references football_matches(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_team_b_id_fkey foreign key (team_b_id) references tournament_teams(id) on delete cascade;
alter table public.tournament_matches add constraint tournament_matches_cricket_match_id_fkey foreign key (cricket_match_id) references cricket_matches(id) on delete set null;
alter table public.tournament_matches add constraint tournament_matches_team_a_id_fkey foreign key (team_a_id) references tournament_teams(id) on delete cascade;
alter table public.tournament_matches add constraint tournament_matches_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.tournament_matches add constraint tournament_matches_scorer_user_id_fkey foreign key (scorer_user_id) references profiles(id) on delete set null;
alter table public.tournament_pools add constraint tournament_pools_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.tournament_team_invites add constraint tournament_team_invites_team_id_fkey foreign key (team_id) references tournament_teams(id) on delete cascade;
alter table public.tournament_team_invites add constraint tournament_team_invites_invited_user_id_fkey foreign key (invited_user_id) references profiles(id);
alter table public.tournament_team_invites add constraint tournament_team_invites_invited_by_fkey foreign key (invited_by) references profiles(id);
alter table public.tournament_team_members add constraint tournament_team_members_team_id_fkey foreign key (team_id) references tournament_teams(id) on delete cascade;
alter table public.tournament_team_members add constraint tournament_team_members_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.tournament_teams add constraint tournament_teams_game_id_fkey foreign key (game_id) references games(id) on delete cascade;
alter table public.tournament_teams add constraint tournament_teams_filled_by_squad_id_fkey foreign key (filled_by_squad_id) references squads(id) on delete set null;
alter table public.tournament_teams add constraint tournament_teams_pool_id_fkey foreign key (pool_id) references tournament_pools(id) on delete set null;
alter table public.tournament_teams add constraint tournament_teams_captain_id_fkey foreign key (captain_id) references profiles(id) on delete cascade;
alter table public.venue_admins add constraint venue_admins_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.venue_admins add constraint venue_admins_venue_id_fkey foreign key (venue_id) references venues(id) on delete cascade;
alter table public.venue_admins add constraint venue_admins_added_by_fkey foreign key (added_by) references profiles(id) on delete set null;
alter table public.venue_facilities add constraint venue_facilities_venue_id_fkey foreign key (venue_id) references venues(id) on delete cascade;
alter table public.venue_images add constraint venue_images_venue_id_fkey foreign key (venue_id) references venues(id) on delete cascade;
alter table public.venue_reviews add constraint venue_reviews_venue_id_fkey foreign key (venue_id) references venues(id) on delete cascade;
alter table public.venue_reviews add constraint venue_reviews_booking_id_fkey foreign key (booking_id) references bookings(id) on delete set null;
alter table public.venue_reviews add constraint venue_reviews_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.venues add constraint venues_venue_owner_id_fkey foreign key (venue_owner_id) references profiles(id) on delete set null;


-- ============================================================================
-- 6. UNIQUE CONSTRAINTS
-- ============================================================================
alter table public.badminton_matches add constraint badminton_matches_scoring_code_key unique (scoring_code);
alter table public.badminton_rallies add constraint badminton_rallies_match_id_seq_key unique (match_id, seq);
alter table public.cricket_balls add constraint cricket_balls_innings_id_seq_key unique (innings_id, seq);
alter table public.cricket_innings add constraint cricket_innings_match_id_innings_number_key unique (match_id, innings_number);
alter table public.cricket_matches add constraint cricket_matches_scoring_code_key unique (scoring_code);
alter table public.football_goals add constraint football_goals_match_id_seq_key unique (match_id, seq);
alter table public.football_matches add constraint football_matches_scoring_code_key unique (scoring_code);
alter table public.football_penalty_kicks add constraint football_penalty_kicks_match_id_seq_key unique (match_id, seq);
alter table public.game_squad_invites add constraint game_squad_invites_game_id_squad_id_key unique (game_id, squad_id);
alter table public.games add constraint games_game_code_key unique (game_code);
alter table public.match_results add constraint match_results_user_id_match_id_key unique (user_id, match_id);
alter table public.padel_matches add constraint padel_matches_scoring_code_key unique (scoring_code);
alter table public.padel_points add constraint padel_points_match_id_seq_key unique (match_id, seq);
alter table public.pickleball_matches add constraint pickleball_matches_scoring_code_key unique (scoring_code);
alter table public.pickleball_rallies add constraint pickleball_rallies_match_id_seq_key unique (match_id, seq);
alter table public.poll_votes add constraint poll_votes_poll_id_voter_id_key unique (poll_id, voter_id);
alter table public.profiles add constraint profiles_user_code_key unique (user_code);
alter table public.profiles add constraint profiles_email_key unique (email);
alter table public.profiles add constraint profiles_phone_key unique (phone);
alter table public.push_tokens add constraint push_tokens_token_key unique (token);
alter table public.sports add constraint sports_name_key unique (name);
alter table public.squads add constraint squads_squad_code_key unique (squad_code);
alter table public.table_tennis_matches add constraint table_tennis_matches_scoring_code_key unique (scoring_code);
alter table public.table_tennis_rallies add constraint table_tennis_rallies_match_id_seq_key unique (match_id, seq);
alter table public.tennis_matches add constraint tennis_matches_scoring_code_key unique (scoring_code);
alter table public.tennis_points add constraint tennis_points_match_id_seq_key unique (match_id, seq);
alter table public.tournament_pools add constraint tournament_pools_game_id_name_key unique (game_id, name);
alter table public.tournament_teams add constraint tournament_teams_team_code_key unique (team_code);
alter table public.venue_admins add constraint venue_admins_venue_id_user_id_key unique (venue_id, user_id);


-- ============================================================================
-- 7. CHECK CONSTRAINTS
-- ============================================================================
alter table public.badminton_matches add constraint badminton_matches_status_check check ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text])));
alter table public.badminton_matches add constraint badminton_matches_play_mode_check check ((play_mode = ANY (ARRAY['SINGLES'::text, 'DOUBLES'::text])));
alter table public.badminton_matches add constraint badminton_matches_winner_team_check check ((winner_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.badminton_matches add constraint badminton_matches_team_a_server_index_check check ((team_a_server_index = ANY (ARRAY[0, 1])));
alter table public.badminton_matches add constraint badminton_matches_team_b_server_index_check check ((team_b_server_index = ANY (ARRAY[0, 1])));
alter table public.badminton_matches add constraint badminton_matches_first_serving_team_check check ((first_serving_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.badminton_rallies add constraint badminton_rallies_winner_check check ((winner = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.booking_holds add constraint booking_holds_time_check check ((end_time > start_time));
alter table public.bookings add constraint bookings_time_check check ((end_time > start_time));
alter table public.community_comments add constraint community_comments_body_check check (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 1000)));
alter table public.content_reports add constraint content_reports_source_check check ((source = ANY (ARRAY['game_message'::text, 'squad_message'::text, 'team_message'::text])));
alter table public.court_price_rules add constraint court_price_rules_check check ((start_time < end_time));
alter table public.court_price_rules add constraint court_price_rules_price_per_hour_check check ((price_per_hour > (0)::numeric));
alter table public.cricket_balls add constraint cricket_balls_wicket_type_check check ((wicket_type = ANY (ARRAY['BOWLED'::text, 'CAUGHT'::text, 'LBW'::text, 'RUN_OUT'::text, 'STUMPED'::text, 'HIT_WICKET'::text, 'RETIRED_OUT'::text, 'MANKAD'::text, 'RETIRED_HURT'::text, 'OVER_THE_FENCE'::text, 'ONE_HAND_ONE_BOUNCE'::text, 'OBSTRUCTING_THE_FIELD'::text, 'HIT_THE_BALL_TWICE'::text, 'TIMED_OUT'::text])));
alter table public.cricket_balls add constraint cricket_balls_extra_type_check check ((extra_type = ANY (ARRAY['WIDE'::text, 'NOBALL'::text, 'BYE'::text, 'LEGBYE'::text, 'PENALTY'::text])));
alter table public.cricket_innings add constraint cricket_innings_innings_number_check check ((innings_number = ANY (ARRAY[1, 2])));
alter table public.cricket_innings add constraint cricket_innings_batting_team_check check ((batting_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.cricket_matches add constraint cricket_matches_status_check check ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text, 'ABANDONED'::text])));
alter table public.cricket_matches add constraint cricket_matches_overs_limit_check check ((overs_limit > 0));
alter table public.cricket_matches add constraint cricket_matches_toss_winner_check check ((toss_winner = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.cricket_matches add constraint cricket_matches_toss_decision_check check ((toss_decision = ANY (ARRAY['BAT'::text, 'BOWL'::text])));
alter table public.cricket_matches add constraint cricket_matches_format_check check ((format = ANY (ARRAY['T10'::text, 'T20'::text, 'ODI'::text, 'Club'::text])));
alter table public.football_goals add constraint football_goals_team_check check ((team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.football_goals add constraint football_goals_phase_check check ((phase = ANY (ARRAY['NOT_STARTED'::text, 'FIRST_HALF'::text, 'HALF_TIME'::text, 'SECOND_HALF'::text, 'FULL_TIME'::text, 'EXTRA_TIME_FIRST'::text, 'EXTRA_TIME_BREAK'::text, 'EXTRA_TIME_SECOND'::text, 'EXTRA_TIME_FULL_TIME'::text, 'PENALTIES'::text, 'COMPLETE'::text])));
alter table public.football_matches add constraint football_matches_phase_check check ((phase = ANY (ARRAY['NOT_STARTED'::text, 'FIRST_HALF'::text, 'HALF_TIME'::text, 'SECOND_HALF'::text, 'FULL_TIME'::text, 'EXTRA_TIME_FIRST'::text, 'EXTRA_TIME_BREAK'::text, 'EXTRA_TIME_SECOND'::text, 'EXTRA_TIME_FULL_TIME'::text, 'PENALTIES'::text, 'COMPLETE'::text])));
alter table public.football_matches add constraint football_matches_status_check check ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text])));
alter table public.football_matches add constraint football_matches_winner_team_check check ((winner_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.football_penalty_kicks add constraint football_penalty_kicks_team_check check ((team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.game_history add constraint game_history_role_check check ((role = ANY (ARRAY['creator'::text, 'player'::text])));
alter table public.game_players add constraint game_players_member_identity_check check (((user_id IS NOT NULL) <> (manual_name IS NOT NULL)));
alter table public.games add constraint games_end_date_after_start check (((end_date IS NULL) OR (end_date >= game_date)));
alter table public.games add constraint games_time_check check ((((end_date IS NOT NULL) AND (end_date > game_date)) OR (end_time > start_time)));
alter table public.games add constraint games_venue_or_custom_check check (((venue_id IS NULL) OR (custom_venue_name IS NULL)));
alter table public.match_results add constraint match_results_result_check check ((result = ANY (ARRAY['WON'::text, 'LOST'::text, 'DRAW'::text])));
alter table public.padel_matches add constraint padel_matches_deuce_type_check check ((deuce_type = ANY (ARRAY['ADVANTAGE'::text, 'GOLDEN_POINT'::text, 'STAR_POINT'::text])));
alter table public.padel_matches add constraint padel_matches_first_server_team_check check ((first_server_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.padel_matches add constraint padel_matches_first_server_player_index_check check ((first_server_player_index = ANY (ARRAY[0, 1])));
alter table public.padel_matches add constraint padel_matches_winner_team_check check ((winner_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.padel_matches add constraint padel_matches_status_check check ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text])));
alter table public.padel_matches add constraint padel_matches_play_mode_check check ((play_mode = ANY (ARRAY['SINGLES'::text, 'DOUBLES'::text])));
alter table public.padel_matches add constraint padel_matches_format_check check ((format = ANY (ARRAY['BEST_OF_1'::text, 'BEST_OF_3'::text, 'BEST_OF_3_MATCH_TIEBREAK'::text])));
alter table public.padel_points add constraint padel_points_winner_check check ((winner = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.pickleball_matches add constraint pickleball_matches_first_serving_team_check check ((first_serving_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.pickleball_matches add constraint pickleball_matches_scoring_mode_check check ((scoring_mode = ANY (ARRAY['SIDE_OUT'::text, 'RALLY'::text])));
alter table public.pickleball_matches add constraint pickleball_matches_play_mode_check check ((play_mode = ANY (ARRAY['SINGLES'::text, 'DOUBLES'::text])));
alter table public.pickleball_matches add constraint pickleball_matches_status_check check ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text])));
alter table public.pickleball_matches add constraint pickleball_matches_winner_team_check check ((winner_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.pickleball_rallies add constraint pickleball_rallies_winner_check check ((winner = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.player_follows add constraint player_follows_no_self_follow check ((follower_id <> followed_id));
alter table public.profiles add constraint profiles_visibility_check check ((visibility = ANY (ARRAY['public'::text, 'private'::text])));
alter table public.push_tokens add constraint push_tokens_platform_check check ((platform = ANY (ARRAY['android'::text, 'ios'::text])));
alter table public.squads add constraint squads_group_type_check check ((group_type = ANY (ARRAY['group'::text, 'club'::text, 'training_camp'::text])));
alter table public.table_tennis_matches add constraint table_tennis_matches_first_server_index_check check ((first_server_index = ANY (ARRAY[0, 1])));
alter table public.table_tennis_matches add constraint table_tennis_matches_winner_team_check check ((winner_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.table_tennis_matches add constraint table_tennis_matches_play_mode_check check ((play_mode = ANY (ARRAY['SINGLES'::text, 'DOUBLES'::text])));
alter table public.table_tennis_matches add constraint table_tennis_matches_first_serving_team_check check ((first_serving_team = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.table_tennis_matches add constraint table_tennis_matches_status_check check ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text])));
alter table public.table_tennis_rallies add constraint table_tennis_rallies_winner_check check ((winner = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.tennis_matches add constraint tennis_matches_format_check check ((format = ANY (ARRAY['BEST_OF_1'::text, 'BEST_OF_3'::text, 'BEST_OF_5'::text])));
alter table public.tennis_matches add constraint tennis_matches_winner_player_check check ((winner_player = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.tennis_matches add constraint tennis_matches_first_server_check check ((first_server = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.tennis_matches add constraint tennis_matches_status_check check ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text])));
alter table public.tennis_matches add constraint tennis_matches_play_mode_check check ((play_mode = ANY (ARRAY['SINGLES'::text, 'DOUBLES'::text])));
alter table public.tennis_points add constraint tennis_points_winner_check check ((winner = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.tournament_matches add constraint tournament_matches_status_check check ((status = ANY (ARRAY['PENDING'::text, 'COMPLETED'::text])));
alter table public.tournament_matches add constraint tournament_matches_check2 check ((team_a_id IS DISTINCT FROM team_b_id));
alter table public.tournament_matches add constraint tournament_matches_check1 check ((NOT (is_draw AND (winner_team_id IS NOT NULL))));
alter table public.tournament_matches add constraint tournament_matches_check check (((winner_team_id IS NULL) OR (winner_team_id = team_a_id) OR (winner_team_id = team_b_id)));
alter table public.tournament_team_members add constraint tournament_team_members_member_identity_check check (((user_id IS NOT NULL) <> (manual_name IS NOT NULL)));
alter table public.venue_reviews add constraint venue_reviews_rating_check check (((rating >= 1) AND (rating <= 5)));


-- ============================================================================
-- 7b. EXCLUSION CONSTRAINT
-- (requires btree_gist, already enabled in section 1 — without it, the
--  court_id "=" term inside this gist exclusion can't be built). This is
--  the actual rule stopping a court from being double-booked for an
--  overlapping time range; it is NOT a plain index.
-- ============================================================================
alter table public.bookings add constraint bookings_no_overlap exclude using gist (
  court_id WITH =,
  tstzrange(start_time, end_time) WITH &&
) where (
  (status = ANY (ARRAY['PENDING'::booking_status_type, 'CONFIRMED'::booking_status_type, 'COMPLETED'::booking_status_type, 'BLOCKED'::booking_status_type]))
  AND (deleted_at IS NULL)
);


-- ============================================================================
-- 8. INDEXES (non-constraint-backed)
-- ============================================================================
CREATE INDEX booking_holds_court_idx ON public.booking_holds USING btree (court_id, start_time, end_time);
CREATE INDEX booking_holds_expires_idx ON public.booking_holds USING btree (expires_at);
CREATE INDEX bookings_court_time_idx ON public.bookings USING btree (court_id, start_time, end_time);
CREATE INDEX bookings_game_id_idx ON public.bookings USING btree (game_id);
CREATE INDEX bookings_user_idx ON public.bookings USING btree (user_id);
CREATE INDEX community_comments_feed_idx ON public.community_comments USING btree (created_at DESC) WHERE (parent_id IS NULL);
CREATE INDEX community_comments_parent_id_idx ON public.community_comments USING btree (parent_id);
CREATE INDEX community_comments_poll_id_idx ON public.community_comments USING btree (poll_id) WHERE (poll_id IS NOT NULL);
CREATE INDEX community_comments_root_id_idx ON public.community_comments USING btree (root_id);
CREATE INDEX court_sport_idx ON public.court USING btree (sports_id);
CREATE INDEX court_venue_idx ON public.court USING btree (venue_id);
CREATE INDEX court_images_court_idx ON public.court_images USING btree (court_id);
CREATE INDEX court_price_rules_court_id_idx ON public.court_price_rules USING btree (court_id);
CREATE INDEX cricket_balls_innings_id_idx ON public.cricket_balls USING btree (innings_id, seq);
CREATE INDEX cricket_matches_user_id_idx ON public.cricket_matches USING btree (user_id, created_at DESC);
CREATE INDEX game_history_sport_id_idx ON public.game_history USING btree (sport_id);
CREATE INDEX game_history_user_id_idx ON public.game_history USING btree (user_id);
CREATE INDEX game_invites_game_idx ON public.game_invites USING btree (game_id);
CREATE INDEX game_invites_invited_user_idx ON public.game_invites USING btree (invited_user_id);
CREATE UNIQUE INDEX game_invites_unique_pending ON public.game_invites USING btree (game_id, invited_user_id) WHERE ((status = 'pending'::game_invite_status_type) AND (deleted_at IS NULL));
CREATE INDEX game_messages_game_id_created_at_idx ON public.game_messages USING btree (game_id, created_at);
CREATE INDEX game_messages_game_idx ON public.game_messages USING btree (game_id, created_at);
CREATE INDEX game_messages_poll_id_idx ON public.game_messages USING btree (poll_id) WHERE (poll_id IS NOT NULL);
CREATE INDEX game_messages_root_id_idx ON public.game_messages USING btree (root_id);
CREATE UNIQUE INDEX game_players_active_unique ON public.game_players USING btree (game_id, user_id) WHERE (status = ANY (ARRAY['PENDING'::game_player_status_type, 'JOINED'::game_player_status_type]));
CREATE INDEX game_players_game_idx ON public.game_players USING btree (game_id);
CREATE INDEX game_players_user_idx ON public.game_players USING btree (user_id);
CREATE INDEX game_squad_invites_game_id_idx ON public.game_squad_invites USING btree (game_id);
CREATE INDEX game_squad_invites_squad_id_idx ON public.game_squad_invites USING btree (squad_id);
CREATE INDEX games_creator_idx ON public.games USING btree (creator_id);
CREATE INDEX games_date_idx ON public.games USING btree (game_date);
CREATE INDEX games_sport_idx ON public.games USING btree (sport_id);
CREATE INDEX games_status_idx ON public.games USING btree (status);
CREATE UNIQUE INDEX games_title_unique_active ON public.games USING btree (lower(title)) WHERE ((deleted_at IS NULL) AND (status <> 'CANCELLED'::game_status_type));
CREATE INDEX games_venue_idx ON public.games USING btree (venue_id);
CREATE INDEX match_results_sport_id_idx ON public.match_results USING btree (sport_id);
CREATE INDEX match_results_user_id_idx ON public.match_results USING btree (user_id);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, is_read);
CREATE INDEX payments_booking_idx ON public.payments USING btree (booking_id);
CREATE INDEX payments_game_idx ON public.payments USING btree (game_id);
CREATE INDEX payments_user_idx ON public.payments USING btree (user_id);
CREATE INDEX player_follows_followed_idx ON public.player_follows USING btree (followed_id);
CREATE INDEX poll_options_poll_id_idx ON public.poll_options USING btree (poll_id);
CREATE INDEX poll_votes_option_id_idx ON public.poll_votes USING btree (option_id);
CREATE INDEX poll_votes_poll_id_idx ON public.poll_votes USING btree (poll_id);
CREATE INDEX profiles_city_idx ON public.profiles USING btree (city);
CREATE INDEX push_tokens_user_id_idx ON public.push_tokens USING btree (user_id);
CREATE INDEX slots_court_date_idx ON public.slots USING btree (court_id, date);
CREATE UNIQUE INDEX squad_invites_unique_pending ON public.squad_invites USING btree (squad_id, invited_user_id) WHERE ((status = 'pending'::squad_invite_status_type) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX squad_members_active_unique ON public.squad_members USING btree (squad_id, user_id) WHERE (status = 'ACTIVE'::squad_member_status_type);
CREATE INDEX squad_members_squad_idx ON public.squad_members USING btree (squad_id);
CREATE INDEX squad_members_user_idx ON public.squad_members USING btree (user_id);
CREATE INDEX squad_messages_poll_id_idx ON public.squad_messages USING btree (poll_id) WHERE (poll_id IS NOT NULL);
CREATE INDEX squad_messages_root_id_idx ON public.squad_messages USING btree (root_id);
CREATE INDEX squad_messages_squad_id_created_at_idx ON public.squad_messages USING btree (squad_id, created_at);
CREATE UNIQUE INDEX squads_name_unique_active ON public.squads USING btree (lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX squads_owner_idx ON public.squads USING btree (squad_owner_id);
CREATE INDEX squads_sport_id_idx ON public.squads USING btree (sport_id);
CREATE INDEX team_messages_poll_id_idx ON public.team_messages USING btree (poll_id) WHERE (poll_id IS NOT NULL);
CREATE INDEX team_messages_root_id_idx ON public.team_messages USING btree (root_id);
CREATE INDEX team_messages_team_id_idx ON public.team_messages USING btree (team_id);
CREATE INDEX tournament_matches_game_id_idx ON public.tournament_matches USING btree (game_id);
CREATE INDEX tournament_team_invites_invited_user_idx ON public.tournament_team_invites USING btree (invited_user_id);
CREATE INDEX tournament_team_invites_team_idx ON public.tournament_team_invites USING btree (team_id);
CREATE UNIQUE INDEX tournament_team_invites_unique_pending ON public.tournament_team_invites USING btree (team_id, invited_user_id) WHERE ((status = 'pending'::tournament_team_invite_status_type) AND (deleted_at IS NULL));
CREATE INDEX tournament_team_members_team_id_idx ON public.tournament_team_members USING btree (team_id);
CREATE INDEX tournament_teams_game_id_idx ON public.tournament_teams USING btree (game_id);
CREATE UNIQUE INDEX tournament_teams_name_unique_per_game ON public.tournament_teams USING btree (game_id, lower(name)) WHERE ((deleted_at IS NULL) AND (status <> 'REJECTED'::tournament_team_status_type));
CREATE INDEX venue_admins_user_id_idx ON public.venue_admins USING btree (user_id);
CREATE INDEX venue_facilities_venue_idx ON public.venue_facilities USING btree (venue_id);
CREATE INDEX venue_images_venue_idx ON public.venue_images USING btree (venue_id);
CREATE INDEX venue_reviews_user_idx ON public.venue_reviews USING btree (user_id);
CREATE INDEX venue_reviews_venue_idx ON public.venue_reviews USING btree (venue_id);
CREATE INDEX venues_city_idx ON public.venues USING btree (city);
CREATE INDEX venues_owner_idx ON public.venues USING btree (venue_owner_id);


-- ============================================================================
-- 9. FUNCTIONS (71 total, full source, in the exact order needed so earlier
--    functions a later one calls are already defined)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_game_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where game_code = code);
  end loop;
  return code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_squad_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.squads where squad_code = code);
  end loop;
  return code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_team_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.tournament_teams where team_code = code);
  end loop;
  return code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_user_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where user_code = code);
  end loop;
  return code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and type = 'superadmin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_venue_owner(target_venue_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_superadmin()
    or exists (
      select 1 from public.venues v
      where v.id = target_venue_id and v.venue_owner_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_venue_admin(target_venue_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_superadmin()
    or exists (
      select 1 from public.venues v
      where v.id = target_venue_id and v.venue_owner_id = auth.uid()
    )
    or exists (
      select 1 from public.venue_admins va
      where va.venue_id = target_venue_id and va.user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_body text, p_type text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_user_id is null or p_user_id = auth.uid() then
    return;
  end if;
  insert into public.notifications (user_id, title, body, type, data)
  values (p_user_id, p_title, p_body, p_type, p_data);
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_poll(p_poll_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    exists (select 1 from public.game_messages gm where gm.poll_id = p_poll_id)
    or exists (select 1 from public.team_messages tm where tm.poll_id = p_poll_id)
    or exists (select 1 from public.squad_messages sm where sm.poll_id = p_poll_id)
    or exists (select 1 from public.community_comments cc where cc.poll_id = p_poll_id)
$function$;

CREATE OR REPLACE FUNCTION public.accept_game_invite(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite record;
  v_game record;
  v_joined_count int;
begin
  select * into v_invite from public.game_invites where id = p_invite_id and deleted_at is null;
  if v_invite is null then
    raise exception 'Invite not found.';
  end if;
  if v_invite.invited_user_id <> auth.uid() then
    raise exception 'This invite is not for you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  select * into v_game from public.games where id = v_invite.game_id and deleted_at is null;
  if v_game is null then
    raise exception 'This game no longer exists.';
  end if;
  if v_game.status = 'CANCELLED' then
    raise exception 'This game was cancelled.';
  end if;
  if (coalesce(v_game.end_date, v_game.game_date) + v_game.end_time) at time zone 'Asia/Karachi' < now() then
    raise exception 'This game has already ended.';
  end if;

  if v_game.game_type = 'REGULAR' then
    if exists (
      select 1 from public.game_players
      where game_id = v_game.id and user_id = auth.uid() and status in ('JOINED', 'PENDING')
    ) then
      raise exception 'You are already part of this game.';
    end if;

    select count(*) into v_joined_count from public.game_players
      where game_id = v_game.id and status = 'JOINED';
    if v_joined_count >= v_game.max_players then
      raise exception 'This game is already full.';
    end if;

    insert into public.game_players (game_id, user_id, status, joined_at, payment_status)
    values (v_game.id, auth.uid(), 'JOINED', now(), 'PENDING');
  end if;

  update public.game_invites set status = 'accepted' where id = p_invite_id;

  perform public.create_notification(
    v_invite.invited_by,
    'Invite accepted',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone')
      || ' accepted your invite to "' || v_game.title || '"',
    'game_invite_accepted',
    jsonb_build_object('gameId', v_game.id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_squad_invite(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite record;
  v_squad record;
  v_active_count int;
begin
  select * into v_invite from public.squad_invites where id = p_invite_id and deleted_at is null;
  if v_invite is null then
    raise exception 'Invite not found.';
  end if;
  if v_invite.invited_user_id <> auth.uid() then
    raise exception 'This invite is not for you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  select * into v_squad from public.squads where id = v_invite.squad_id and deleted_at is null;
  if v_squad is null then
    raise exception 'This group no longer exists.';
  end if;

  if exists (
    select 1 from public.squad_members
    where squad_id = v_squad.id and user_id = auth.uid() and status in ('ACTIVE', 'PENDING')
  ) then
    raise exception 'You are already part of this group.';
  end if;

  select count(*) into v_active_count from public.squad_members
    where squad_id = v_squad.id and status = 'ACTIVE';
  if v_squad.max_players is not null and v_active_count >= v_squad.max_players then
    raise exception 'This group is already full.';
  end if;

  insert into public.squad_members (squad_id, user_id, role, status, joined_at)
  values (v_squad.id, auth.uid(), 'member', 'ACTIVE', now());

  update public.squad_invites set status = 'accepted' where id = p_invite_id;

  perform public.create_notification(
    v_invite.invited_by,
    'Invite accepted',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone')
      || ' accepted your invite to "' || v_squad.name || '"',
    'squad_invite_accepted',
    jsonb_build_object('squadId', v_squad.id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite record;
  v_team record;
begin
  select * into v_invite from public.tournament_team_invites where id = p_invite_id and deleted_at is null;
  if v_invite is null then
    raise exception 'Invite not found.';
  end if;
  if v_invite.invited_user_id <> auth.uid() then
    raise exception 'This invite is not for you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  select * into v_team from public.tournament_teams where id = v_invite.team_id and deleted_at is null;
  if v_team is null then
    raise exception 'This team no longer exists.';
  end if;

  insert into public.tournament_team_members (team_id, user_id, status, joined_at)
  values (v_invite.team_id, auth.uid(), 'JOINED', now());

  update public.tournament_team_invites set status = 'accepted' where id = p_invite_id;

  perform public.create_notification(
    v_invite.invited_by,
    'Invite accepted',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone')
      || ' accepted your invite to join team "' || v_team.name || '"',
    'team_invite_accepted',
    jsonb_build_object('gameId', v_team.game_id, 'teamId', v_team.id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_manual_game_player(p_game_id uuid, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_host boolean;
  v_player_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_trimmed = '' then
    raise exception 'A name is required.';
  end if;

  select (g.creator_id = auth.uid()) into v_is_host from public.games g where g.id = p_game_id;
  if not coalesce(v_is_host, false) then
    raise exception 'Only the host can add a player manually.';
  end if;

  insert into public.game_players (game_id, manual_name, status, joined_at, payment_status)
  values (p_game_id, v_trimmed, 'JOINED', now(), 'PENDING')
  returning id into v_player_id;

  return v_player_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_manual_team_member(p_team_id uuid, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game_id uuid;
  v_is_host boolean;
  v_member_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_trimmed = '' then
    raise exception 'A name is required.';
  end if;

  select t.game_id into v_game_id from public.tournament_teams t where t.id = p_team_id and t.deleted_at is null;
  if v_game_id is null then
    raise exception 'Team not found.';
  end if;

  select (g.creator_id = auth.uid()) into v_is_host from public.games g where g.id = v_game_id;
  if not coalesce(v_is_host, false) then
    raise exception 'Only the tournament host can add a player manually.';
  end if;

  insert into public.tournament_team_members (team_id, manual_name, status, joined_at)
  values (p_team_id, v_trimmed, 'JOINED', now())
  returning id into v_member_id;

  return v_member_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.auto_approve_full_team()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_required integer;
  v_team_status public.tournament_team_status_type;
  v_joined_count integer;
  v_creator_id uuid;
  v_is_host boolean;
begin
  if new.status = 'JOINED' then
    select t.status, g.players_per_team, g.creator_id into v_team_status, v_required, v_creator_id
      from public.tournament_teams t
      join public.games g on g.id = t.game_id
      where t.id = new.team_id;

    if v_team_status = 'FORMING' and v_required is not null then
      select count(*) into v_joined_count
        from public.tournament_team_members
        where team_id = new.team_id and status = 'JOINED' and deleted_at is null;

      if v_joined_count >= v_required then
        v_is_host := (v_creator_id is not distinct from auth.uid());
        update public.tournament_teams
        set status = case when v_is_host then 'APPROVED'::public.tournament_team_status_type
                          else 'PENDING_HOST_APPROVAL'::public.tournament_team_status_type end
        where id = new.team_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_head_to_head_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game_type text;
  v_number_of_teams integer;
  v_tournament_format text;
  v_teams uuid[];
begin
  if new.status <> 'APPROVED' or old.status = 'APPROVED' then
    return new;
  end if;

  select game_type, number_of_teams, tournament_format
    into v_game_type, v_number_of_teams, v_tournament_format
    from public.games where id = new.game_id;

  if v_game_type = 'TOURNAMENT' or v_number_of_teams is distinct from 2 or v_tournament_format is not null then
    return new;
  end if;

  if exists (select 1 from public.tournament_matches where game_id = new.game_id) then
    return new;
  end if;

  select array_agg(id order by created_at) into v_teams
    from public.tournament_teams
    where game_id = new.game_id and status = 'APPROVED';

  if array_length(v_teams, 1) = 2 then
    insert into public.tournament_matches (game_id, round, team_a_id, team_b_id, sort_order)
    values (new.game_id, 1, v_teams[1], v_teams[2], 0);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_team_on_first_join()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'JOINED' then
    update public.tournament_teams
    set captain_id = new.user_id
    where id = new.team_id and captain_id is null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_poll_on_message_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.poll_id is not null then
    delete from public.polls where id = old.poll_id;
  end if;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decline_game_invite(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite record;
  v_title text;
begin
  select * into v_invite from public.game_invites where id = p_invite_id and deleted_at is null;
  if v_invite is null then
    raise exception 'Invite not found.';
  end if;
  if v_invite.invited_user_id <> auth.uid() then
    raise exception 'This invite is not for you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  update public.game_invites set status = 'declined' where id = p_invite_id;

  select title into v_title from public.games where id = v_invite.game_id;
  perform public.create_notification(
    v_invite.invited_by,
    'Invite declined',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone')
      || ' declined your invite to "' || coalesce(v_title, 'your game') || '"',
    'game_invite_declined',
    jsonb_build_object('gameId', v_invite.game_id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.decline_squad_invite(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite record;
  v_name text;
begin
  select * into v_invite from public.squad_invites where id = p_invite_id and deleted_at is null;
  if v_invite is null then
    raise exception 'Invite not found.';
  end if;
  if v_invite.invited_user_id <> auth.uid() then
    raise exception 'This invite is not for you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  update public.squad_invites set status = 'declined' where id = p_invite_id;

  select name into v_name from public.squads where id = v_invite.squad_id;
  perform public.create_notification(
    v_invite.invited_by,
    'Invite declined',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone')
      || ' declined your invite to "' || coalesce(v_name, 'your group') || '"',
    'squad_invite_declined',
    jsonb_build_object('squadId', v_invite.squad_id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.decline_team_invite(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite record;
  v_team_name text;
  v_game_id uuid;
begin
  select * into v_invite from public.tournament_team_invites where id = p_invite_id and deleted_at is null;
  if v_invite is null then
    raise exception 'Invite not found.';
  end if;
  if v_invite.invited_user_id <> auth.uid() then
    raise exception 'This invite is not for you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  update public.tournament_team_invites set status = 'declined' where id = p_invite_id;

  select t.name, t.game_id into v_team_name, v_game_id from public.tournament_teams t where t.id = v_invite.team_id;

  perform public.create_notification(
    v_invite.invited_by,
    'Invite declined',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone')
      || ' declined your invite to join team "' || coalesce(v_team_name, 'your team') || '"',
    'team_invite_declined',
    jsonb_build_object('gameId', v_game_id, 'teamId', v_invite.team_id)
  );
end;
$function$;

-- NOTE: the 4 functions below (delete_old_*) are kept here for historical
-- completeness, but per migration remove_automatic_deletion their cron
-- jobs are UNSCHEDULED (see section 13) — they are defined but never
-- invoked automatically.
CREATE OR REPLACE FUNCTION public.delete_old_community_comments()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.community_comments
  where created_at < now() - interval '6 months';
$function$;

CREATE OR REPLACE FUNCTION public.delete_old_game_messages()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.game_messages
  where created_at < now() - interval '1 month';
$function$;

CREATE OR REPLACE FUNCTION public.delete_old_squad_messages()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.squad_messages
  where created_at < now() - interval '1 month';
$function$;

CREATE OR REPLACE FUNCTION public.delete_old_team_messages()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.team_messages
  where created_at < now() - interval '1 month';
$function$;

CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from auth.users where id = auth.uid();
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_own_chat_message(p_table text, p_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sender_id uuid;
begin
  if p_table not in ('game_messages', 'team_messages', 'squad_messages') then
    raise exception 'Invalid table.';
  end if;

  execute format('select sender_id from public.%I where id = $1', p_table)
    into v_sender_id
    using p_message_id;

  if v_sender_id is null then
    raise exception 'Message not found.';
  end if;
  if v_sender_id <> auth.uid() then
    raise exception 'You can only delete your own messages.';
  end if;

  execute format('update public.%I set deleted_at = now() where id = $1', p_table)
    using p_message_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_pool_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_host boolean;
  v_number_of_teams integer;
  v_pool_count integer;
  v_expected_per_group integer;
  v_current_in_pool integer;
begin
  if new.pool_id is distinct from old.pool_id then
    select (g.creator_id = auth.uid()), g.number_of_teams into v_is_host, v_number_of_teams
    from public.games g where g.id = new.game_id;

    if not coalesce(v_is_host, false) then
      raise exception 'Only the tournament host can assign a team to a group.';
    end if;

    if new.pool_id is not null and v_number_of_teams is not null then
      select count(*) into v_pool_count from public.tournament_pools where game_id = new.game_id;

      if v_pool_count > 0 then
        v_expected_per_group := v_number_of_teams / v_pool_count;

        select count(*) into v_current_in_pool
          from public.tournament_teams
          where pool_id = new.pool_id and id <> new.id and status = 'APPROVED';

        if v_current_in_pool >= v_expected_per_group then
          raise exception 'This group is already full (%/% teams).', v_current_in_pool, v_expected_per_group;
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_single_team_per_tournament()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game_id uuid;
  v_existing_count int;
begin
  if new.status in ('PENDING', 'JOINED') then
    select game_id into v_game_id from public.tournament_teams where id = new.team_id;

    select count(*) into v_existing_count
    from public.tournament_team_members ttm
    join public.tournament_teams tt on tt.id = ttm.team_id
    where tt.game_id = v_game_id
      and tt.status <> 'REJECTED'
      and ttm.user_id = new.user_id
      and ttm.status in ('PENDING', 'JOINED')
      and ttm.team_id <> new.team_id;

    if v_existing_count > 0 then
      raise exception 'You already have an active request or membership on another team in this tournament.';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_team_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_number_of_teams integer;
  v_active_count integer;
begin
  select number_of_teams into v_number_of_teams from public.games where id = new.game_id;

  if v_number_of_teams is not null then
    select count(*) into v_active_count
      from public.tournament_teams
      where game_id = new.game_id and status <> 'REJECTED' and deleted_at is null;

    if v_active_count >= v_number_of_teams then
      raise exception 'This tournament already has its maximum number of teams (%).', v_number_of_teams;
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_team_roster_rules()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_team_status public.tournament_team_status_type;
  v_players_per_team integer;
  v_joined_count integer;
  v_venue_id uuid;
  v_booking_id uuid;
  v_custom_venue_name text;
  v_venue_booked boolean;
begin
  select t.status, g.players_per_team, g.venue_id, g.booking_id, g.custom_venue_name
    into v_team_status, v_players_per_team, v_venue_id, v_booking_id, v_custom_venue_name
    from public.tournament_teams t
    join public.games g on g.id = t.game_id
    where t.id = new.team_id;

  v_venue_booked := case when v_venue_id is not null then v_booking_id is not null else v_custom_venue_name is not null end;

  if v_team_status in ('PENDING_HOST_APPROVAL', 'APPROVED') then
    if tg_op = 'UPDATE' and old.status = 'JOINED' and new.status in ('LEFT', 'REMOVED') and not v_venue_booked then
      update public.tournament_teams
      set status = 'FORMING'
      where id = new.team_id and status in ('PENDING_HOST_APPROVAL', 'APPROVED');
    else
      raise exception 'This team''s roster is locked while it is submitted to the tournament host.';
    end if;
  end if;

  if new.status = 'PENDING' and tg_op = 'INSERT' and v_team_status not in ('FORMING', 'REJECTED') then
    raise exception 'This team is not currently accepting join requests.';
  end if;

  if new.status = 'JOINED' then
    select count(*) into v_joined_count
      from public.tournament_team_members
      where team_id = new.team_id and status = 'JOINED' and deleted_at is null
        and id is distinct from new.id;

    if v_players_per_team is not null and v_joined_count >= v_players_per_team then
      raise exception 'Team already has the required number of players (%).', v_players_per_team;
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_team_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_players_per_team integer;
  v_joined_count integer;
  v_is_host boolean;
  v_creator_id uuid;
begin
  select creator_id, players_per_team into v_creator_id, v_players_per_team
    from public.games where id = new.game_id;
  v_is_host := (v_creator_id is not distinct from auth.uid());

  if new.status = 'APPROVED' and old.status in ('FORMING', 'PENDING_HOST_APPROVAL') then
    select count(*) into v_joined_count
      from public.tournament_team_members
      where team_id = new.id and status = 'JOINED' and deleted_at is null;

    if v_players_per_team is not null and v_joined_count < v_players_per_team then
      raise exception 'Team is not full yet (%/% players) and cannot be approved.', v_joined_count, v_players_per_team;
    end if;

    if old.status = 'PENDING_HOST_APPROVAL' and not v_is_host then
      raise exception 'Only the tournament host can approve a pending team.';
    end if;

  elsif new.status = 'REJECTED' and old.status is distinct from new.status then
    if old.status <> 'APPROVED' then
      raise exception 'A team can only be removed from Approved, not %.', old.status;
    end if;
    if not v_is_host then
      raise exception 'Only the tournament host can remove a team from the tournament.';
    end if;

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
$function$;

-- ============================================================================
-- expire_past_games(): this is the CURRENT (post remove_automatic_deletion)
-- version — marks an expired game COMPLETED instead of deleting it, and no
-- longer purges CANCELLED/soft-deleted games at all.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_past_games()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_expiring_ids uuid[];
begin
  select array_agg(g.id) into v_expiring_ids
  from public.games g
  where g.deleted_at is null
    and g.status in ('OPEN', 'FULL', 'ONGOING')
    and greatest(
      (coalesce(g.end_date, g.game_date) + g.end_time) at time zone 'Asia/Karachi',
      coalesce(
        (select max(b.end_time) from public.bookings b where b.game_id = g.id and b.status <> 'CANCELLED'),
        (coalesce(g.end_date, g.game_date) + g.end_time) at time zone 'Asia/Karachi'
      )
    ) < now();

  if v_expiring_ids is not null then
    insert into public.game_history (user_id, game_id, sport_id, venue_id, title, game_date, start_time, end_time, role, game_type)
    select gp.user_id, g.id, g.sport_id, g.venue_id, g.title, g.game_date, g.start_time, g.end_time,
      case when gp.user_id = g.creator_id then 'creator' else 'player' end, g.game_type
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    where g.id = any(v_expiring_ids) and gp.status = 'JOINED';

    insert into public.game_history (user_id, game_id, sport_id, venue_id, title, game_date, start_time, end_time, role, game_type)
    select ttm.user_id, g.id, g.sport_id, g.venue_id, g.title, g.game_date, g.start_time, g.end_time,
      case when ttm.user_id = g.creator_id then 'creator' else 'player' end, g.game_type
    from public.tournament_team_members ttm
    join public.tournament_teams tt on tt.id = ttm.team_id
    join public.games g on g.id = tt.game_id
    where g.id = any(v_expiring_ids) and tt.status = 'APPROVED' and ttm.status = 'JOINED';

    update public.games set status = 'COMPLETED' where id = any(v_expiring_ids);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_booked_slots(p_court_id uuid, p_date date)
 RETURNS TABLE(start_time timestamp with time zone, end_time timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.start_time, b.end_time
  FROM bookings b
  WHERE b.court_id = p_court_id
    AND b.deleted_at IS NULL
    AND b.status NOT IN ('CANCELLED', 'EXPIRED')
    AND b.start_time::date = p_date
  UNION ALL
  SELECT bh.start_time, bh.end_time
  FROM booking_holds bh
  WHERE bh.court_id = p_court_id
    AND bh.expires_at > now()
    AND bh.start_time::date = p_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_follower_counts(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, follower_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select pf.followed_id, count(*)::int
    from public.player_follows pf
   where pf.followed_id = any(p_user_ids)
   group by pf.followed_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_player_extra_stats(p_user_id uuid, p_sport_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(active_squads integer, regular_games_played integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select count(*)::int
       from public.squad_members sm
       join public.squads sq on sq.id = sm.squad_id
      where sm.user_id = p_user_id
        and sm.status = 'ACTIVE'
        and sq.deleted_at is null
        and (p_sport_id is null or sq.sport_id = p_sport_id)),
    (select count(*)::int
       from public.match_results mr
      where mr.user_id = p_user_id
        and (p_sport_id is null or mr.sport_id = p_sport_id)
        and not exists (
          select 1 from public.game_history gh
           where gh.user_id = mr.user_id and gh.game_id = mr.game_id and gh.game_type = 'TOURNAMENT'
        ));
$function$;

CREATE OR REPLACE FUNCTION public.get_player_public_stats(p_user_id uuid, p_sport_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(games_played integer, tournaments_played integer, games_hosted integer, hours_played numeric, computed_skill_level skill_level_type, sport_breakdown jsonb, matches_played integer, matches_won integer, total_runs integer, total_goals integer, total_wickets integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select
    count(*)::int,
    count(*) filter (where gh.game_type = 'TOURNAMENT')::int,
    count(*) filter (where gh.role = 'creator')::int,
    round(coalesce(sum(
      case when gh.start_time is not null and gh.end_time is not null
        then greatest(extract(epoch from (gh.end_time - gh.start_time)) / 3600.0, 0) else 0 end
    ), 0), 1),
    (select gp.skill_level from public.game_players gp
      where gp.user_id = p_user_id and gp.skill_level is not null
      group by gp.skill_level order by count(*) desc limit 1),
    coalesce((
      select jsonb_agg(jsonb_build_object('sportId', s.sport_id, 'sportName', s.sport_name, 'count', s.cnt) order by s.cnt desc)
      from (
        select mr.sport_id, sp.name as sport_name, count(*) as cnt
        from public.match_results mr join public.sports sp on sp.id = mr.sport_id
        where mr.user_id = p_user_id and (p_sport_id is null or mr.sport_id = p_sport_id)
        group by mr.sport_id, sp.name
      ) s
    ), '[]'::jsonb),
    (select count(*)::int from public.match_results mr
      where mr.user_id = p_user_id and (p_sport_id is null or mr.sport_id = p_sport_id)),
    (select count(*)::int from public.match_results mr
      where mr.user_id = p_user_id and mr.result = 'WON' and (p_sport_id is null or mr.sport_id = p_sport_id)),
    (select coalesce(sum(cb.runs_batted), 0)::int
      from public.match_results mr
      join public.sports sp on sp.id = mr.sport_id and sp.name ilike 'cricket'
      join public.cricket_innings ci on ci.match_id = mr.cricket_match_id
      join public.cricket_balls cb on cb.innings_id = ci.id
      where mr.user_id = p_user_id and (p_sport_id is null or mr.sport_id = p_sport_id)
        and cb.striker_name = (select p.full_name from public.profiles p where p.id = p_user_id)),
    (select count(*)::int
      from public.match_results mr
      join public.sports sp on sp.id = mr.sport_id and sp.name ilike 'football'
      join public.football_goals fg on fg.match_id = mr.football_match_id
      where mr.user_id = p_user_id and (p_sport_id is null or mr.sport_id = p_sport_id)
        and fg.scorer_name = (select p.full_name from public.profiles p where p.id = p_user_id)),
    (select count(*)::int
      from public.match_results mr
      join public.sports sp on sp.id = mr.sport_id and sp.name ilike 'cricket'
      join public.cricket_innings ci on ci.match_id = mr.cricket_match_id
      join public.cricket_balls cb on cb.innings_id = ci.id
      where mr.user_id = p_user_id and (p_sport_id is null or mr.sport_id = p_sport_id)
        and cb.is_wicket and cb.wicket_type <> 'RUN_OUT'
        and cb.bowler_name = (select p.full_name from public.profiles p where p.id = p_user_id))
  from public.game_history gh
  where gh.user_id = p_user_id and (p_sport_id is null or gh.sport_id = p_sport_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_players(p_sport_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 200)
 RETURNS TABLE(user_id uuid, full_name text, avatar text, city text, skill_level skill_level_type, games_played integer, tournaments_played integer, games_hosted integer, hours_played numeric, matches_played integer, matches_won integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with agg as (
    select
      gh.user_id as uid,
      count(*)::int as games_played,
      count(*) filter (where gh.game_type = 'TOURNAMENT')::int as tournaments_played,
      count(*) filter (where gh.role = 'creator')::int as games_hosted,
      coalesce(sum(
        case when gh.start_time is not null and gh.end_time is not null
          then greatest(extract(epoch from (gh.end_time - gh.start_time)) / 3600.0, 0)
          else 0
        end
      ), 0) as hours_played
    from public.game_history gh
    where p_sport_id is null or gh.sport_id = p_sport_id
    group by gh.user_id
  ),
  match_stats as (
    select
      mr.user_id as uid,
      count(*)::int as matches_played,
      count(*) filter (where mr.result = 'WON')::int as matches_won
    from public.match_results mr
    where p_sport_id is null or mr.sport_id = p_sport_id
    group by mr.user_id
  )
  select
    p.id,
    p.full_name,
    p.avatar,
    p.city,
    p.skill_level,
    coalesce(agg.games_played, 0),
    coalesce(agg.tournaments_played, 0),
    coalesce(agg.games_hosted, 0),
    round(coalesce(agg.hours_played, 0), 1),
    coalesce(ms.matches_played, 0),
    coalesce(ms.matches_won, 0)
  from public.profiles p
  left join agg on agg.uid = p.id
  left join match_stats ms on ms.uid = p.id
  where p.deleted_at is null
    and (p_sport_id is null or agg.games_played > 0)
  order by
    (0.7 * case when coalesce(ms.matches_played, 0) > 0
                then least(100.0, ms.matches_won::numeric / ms.matches_played * 100)
                else 0 end
     + 0.3 * least(100, coalesce(ms.matches_played, 0))) desc,
    coalesce(ms.matches_played, 0) desc,
    coalesce(agg.games_played, 0) desc,
    p.full_name asc nulls last
  limit p_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION public.grant_venue_admin(target_venue_id uuid, target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_venue_owner(target_venue_id) then
    raise exception 'Only this venue''s owner can add admin access.';
  end if;

  if exists (select 1 from public.venues where id = target_venue_id and venue_owner_id = target_user_id) then
    raise exception 'This user already owns the venue.';
  end if;

  insert into public.venue_admins (venue_id, user_id, added_by)
  values (target_venue_id, target_user_id, auth.uid())
  on conflict (venue_id, user_id) do nothing;

  perform set_config('app.venue_admin_grant', 'true', true);
  update public.profiles
  set type = 'owner'
  where id = target_user_id and type = 'user';
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, email, phone, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    new.phone,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_venue_admin_removed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old_type public.profile_type;
  v_remaining_count int;
begin
  if old.venue_owner_id is not null and old.venue_owner_id is distinct from new.venue_owner_id then
    select type into v_old_type from public.profiles where id = old.venue_owner_id;

    if v_old_type = 'owner' then
      select count(*) into v_remaining_count
      from public.venues
      where venue_owner_id = old.venue_owner_id and deleted_at is null;

      if v_remaining_count = 0 then
        update public.profiles set type = 'user' where id = old.venue_owner_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_community_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_parent_user_id uuid;
  v_replier_name text;
begin
  if new.parent_id is not null then
    select user_id into v_parent_user_id from public.community_comments where id = new.parent_id;
    select full_name into v_replier_name from public.profiles where id = new.user_id;
    perform public.create_notification(
      v_parent_user_id,
      'New reply',
      coalesce(v_replier_name, 'Someone') || ' replied to your comment',
      'community_reply',
      jsonb_build_object('commentId', new.root_id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_followers_of_community_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_poster_name text;
  v_follower record;
begin
  select full_name into v_poster_name from public.profiles where id = new.user_id;

  for v_follower in
    select follower_id from public.player_follows where followed_id = new.user_id
  loop
    perform public.create_notification(
      v_follower.follower_id,
      coalesce(v_poster_name, 'Someone') || ' posted in Community Chat',
      left(new.body, 140),
      'followed_post',
      jsonb_build_object('commentId', coalesce(new.root_id, new.id))
    );
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_game_cancelled_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
begin
  if tg_op = 'UPDATE' and new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    for r in
      select user_id from public.game_players
      where game_id = new.id and status = 'JOINED'
    loop
      perform public.create_notification(
        r.user_id, 'Game cancelled',
        '"' || new.title || '" was cancelled by the host',
        'game_cancelled', jsonb_build_object('gameId', new.id)
      );
    end loop;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_game_invite_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_title text;
  v_inviter_name text;
begin
  select title into v_title from public.games where id = new.game_id;
  select full_name into v_inviter_name from public.profiles where id = new.invited_by;
  perform public.create_notification(
    new.invited_user_id,
    'You''re invited!',
    coalesce(v_inviter_name, 'Someone') || ' invited you to join "' || coalesce(v_title, 'a game') || '"',
    'game_invite',
    jsonb_build_object('gameId', new.game_id, 'inviteId', new.id)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_game_invite_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game_title text;
  v_inviter_name text;
begin
  if tg_op = 'INSERT' then
    select title into v_game_title from public.games where id = new.game_id;
    select full_name into v_inviter_name from public.profiles where id = new.invited_by;
    perform public.create_notification(
      new.invited_user_id,
      'Game invite',
      coalesce(v_inviter_name, 'Someone') || ' invited you to join "' || coalesce(v_game_title, 'a game') || '"',
      'game_invite',
      jsonb_build_object('gameId', new.game_id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_game_player_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game record;
  v_actor_name text;
begin
  select title, creator_id into v_game from public.games where id = coalesce(new.game_id, old.game_id);

  if tg_op = 'INSERT' then
    if new.status = 'PENDING' then
      select full_name into v_actor_name from public.profiles where id = new.user_id;
      perform public.create_notification(
        v_game.creator_id,
        'New join request',
        coalesce(v_actor_name, 'Someone') || ' wants to join "' || v_game.title || '"',
        'game_join_request',
        jsonb_build_object('gameId', new.game_id, 'gamePlayerId', new.id)
      );
    elsif new.status = 'JOINED' then
      perform public.create_notification(
        new.user_id, 'Added to game',
        'You''ve been added to "' || v_game.title || '"',
        'game_join_approved', jsonb_build_object('gameId', new.game_id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'JOINED' and old.status = 'PENDING' then
      perform public.create_notification(
        new.user_id, 'Request approved',
        'Your request to join "' || v_game.title || '" was approved',
        'game_join_approved', jsonb_build_object('gameId', new.game_id)
      );
    elsif new.status = 'DECLINED' then
      perform public.create_notification(
        new.user_id, 'Request declined',
        'Your request to join "' || v_game.title || '" was declined',
        'game_join_declined', jsonb_build_object('gameId', new.game_id)
      );
    elsif new.status = 'REMOVED' then
      perform public.create_notification(
        new.user_id, 'Removed from game',
        'You were removed from "' || v_game.title || '"',
        'game_removed', jsonb_build_object('gameId', new.game_id)
      );
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_squad_invite_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
  v_inviter_name text;
begin
  select name into v_name from public.squads where id = new.squad_id;
  select full_name into v_inviter_name from public.profiles where id = new.invited_by;
  perform public.create_notification(
    new.invited_user_id,
    'You''re invited!',
    coalesce(v_inviter_name, 'Someone') || ' invited you to join "' || coalesce(v_name, 'a group') || '"',
    'squad_invite',
    jsonb_build_object('squadId', new.squad_id, 'inviteId', new.id)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_squad_member_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_squad record;
  v_actor_name text;
begin
  select name, squad_owner_id into v_squad from public.squads where id = coalesce(new.squad_id, old.squad_id);

  if tg_op = 'INSERT' then
    if new.status = 'PENDING' then
      select full_name into v_actor_name from public.profiles where id = new.user_id;
      perform public.create_notification(
        v_squad.squad_owner_id,
        'New group request',
        coalesce(v_actor_name, 'Someone') || ' wants to join "' || v_squad.name || '"',
        'squad_join_request',
        jsonb_build_object('squadId', new.squad_id, 'squadMemberId', new.id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'ACTIVE' and old.status = 'PENDING' then
      perform public.create_notification(
        new.user_id, 'Request approved',
        'Your request to join "' || v_squad.name || '" was approved',
        'squad_join_approved', jsonb_build_object('squadId', new.squad_id)
      );
    elsif new.status = 'DECLINED' then
      perform public.create_notification(
        new.user_id, 'Request declined',
        'Your request to join "' || v_squad.name || '" was declined',
        'squad_join_declined', jsonb_build_object('squadId', new.squad_id)
      );
    elsif new.status = 'REMOVED' then
      perform public.create_notification(
        new.user_id, 'Removed from group',
        'You were removed from "' || v_squad.name || '"',
        'squad_removed', jsonb_build_object('squadId', new.squad_id)
      );
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_team_invite_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team_name text;
  v_game_id uuid;
  v_game_title text;
  v_inviter_name text;
begin
  select t.name, t.game_id, g.title into v_team_name, v_game_id, v_game_title
    from public.tournament_teams t join public.games g on g.id = t.game_id
    where t.id = new.team_id;
  select full_name into v_inviter_name from public.profiles where id = new.invited_by;

  perform public.create_notification(
    new.invited_user_id,
    'You''re invited!',
    coalesce(v_inviter_name, 'Someone') || ' invited you to join team "' || coalesce(v_team_name, 'a team')
      || '" in "' || coalesce(v_game_title, 'a tournament') || '"',
    'team_invite',
    jsonb_build_object('gameId', v_game_id, 'teamId', new.team_id, 'inviteId', new.id)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_team_member_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team record;
  v_actor_name text;
begin
  select t.name, t.captain_id, t.game_id, g.title as game_title
    into v_team
    from public.tournament_teams t
    join public.games g on g.id = t.game_id
    where t.id = coalesce(new.team_id, old.team_id);

  if tg_op = 'INSERT' then
    if new.status = 'PENDING' then
      select full_name into v_actor_name from public.profiles where id = new.user_id;
      perform public.create_notification(
        v_team.captain_id,
        'New team join request',
        coalesce(v_actor_name, 'Someone') || ' wants to join team "' || v_team.name || '"',
        'team_join_request',
        jsonb_build_object('gameId', v_team.game_id, 'teamId', new.team_id, 'teamMemberId', new.id)
      );
    elsif new.status = 'JOINED' then
      perform public.create_notification(
        new.user_id, 'Added to team',
        'You''ve been added to team "' || v_team.name || '" in "' || v_team.game_title || '"',
        'team_join_approved', jsonb_build_object('gameId', v_team.game_id, 'teamId', new.team_id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'JOINED' and old.status = 'PENDING' then
      perform public.create_notification(
        new.user_id, 'Team request approved',
        'Your request to join team "' || v_team.name || '" was approved',
        'team_join_approved', jsonb_build_object('gameId', v_team.game_id, 'teamId', new.team_id)
      );
    elsif new.status = 'DECLINED' then
      perform public.create_notification(
        new.user_id, 'Team request declined',
        'Your request to join team "' || v_team.name || '" was declined',
        'team_join_declined', jsonb_build_object('gameId', v_team.game_id, 'teamId', new.team_id)
      );
    elsif new.status = 'REMOVED' then
      perform public.create_notification(
        new.user_id, 'Removed from team',
        'You were removed from team "' || v_team.name || '"',
        'team_removed', jsonb_build_object('gameId', v_team.game_id, 'teamId', new.team_id)
      );
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_team_status_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_host_id uuid;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'PENDING_HOST_APPROVAL' then
      select creator_id into v_host_id from public.games where id = new.game_id;
      perform public.create_notification(
        v_host_id, 'Team ready for approval',
        'Team "' || new.name || '" is full and awaiting your approval',
        'team_pending_approval', jsonb_build_object('gameId', new.game_id, 'teamId', new.id)
      );
    elsif new.status = 'APPROVED' then
      perform public.create_notification(
        new.captain_id, 'Team approved',
        'Your team "' || new.name || '" was approved for the tournament',
        'team_approved', jsonb_build_object('gameId', new.game_id, 'teamId', new.id)
      );
    elsif new.status = 'REJECTED' then
      perform public.create_notification(
        new.captain_id, 'Team rejected',
        'Your team "' || new.name || '" was rejected. You can update your roster and resubmit.',
        'team_rejected', jsonb_build_object('gameId', new.game_id, 'teamId', new.id)
      );
    end if;

    if old.status = 'PENDING_HOST_APPROVAL' and new.status in ('APPROVED', 'REJECTED', 'FORMING') then
      update public.notifications
      set deleted_at = now()
      where type = 'team_pending_approval'
        and (data->>'teamId') = new.id::text
        and deleted_at is null;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_venue_admins_of_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_venue_id uuid;
  v_court_name text;
  v_admin_id uuid;
  v_time_label text;
begin
  select c.venue_id, c.name into v_venue_id, v_court_name
  from public.court c where c.id = coalesce(new.court_id, old.court_id);

  if v_venue_id is null then
    return coalesce(new, old);
  end if;

  v_time_label := to_char(coalesce(new.start_time, old.start_time) at time zone 'Asia/Karachi', 'FMDay, FMMon FMDD, HH12:MI AM');

  if tg_op = 'INSERT' and new.status in ('PENDING', 'CONFIRMED') then
    for v_admin_id in
      select venue_owner_id from public.venues where id = v_venue_id and venue_owner_id is not null
      union
      select user_id from public.venue_admins where venue_id = v_venue_id
    loop
      perform public.create_notification(
        v_admin_id, 'New Booking', v_court_name || ' booked for ' || v_time_label, 'venue_booking_created',
        jsonb_build_object('venue_id', v_venue_id, 'booking_id', new.id)
      );
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> 'CANCELLED' and new.status = 'CANCELLED' then
    for v_admin_id in
      select venue_owner_id from public.venues where id = v_venue_id and venue_owner_id is not null
      union
      select user_id from public.venue_admins where venue_id = v_venue_id
    loop
      perform public.create_notification(
        v_admin_id, 'Booking Cancelled', v_court_name || ' booking for ' || v_time_label || ' was cancelled', 'venue_booking_cancelled',
        jsonb_build_object('venue_id', v_venue_id, 'booking_id', new.id)
      );
    end loop;
  end if;

  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_type_self_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.type is distinct from old.type and not public.is_superadmin() then
    if coalesce(current_setting('app.venue_admin_grant', true), '') = 'true'
       and old.type in ('user', 'owner') and new.type in ('user', 'owner') then
      return new;
    end if;
    raise exception 'Only a superadmin can change a profile''s type.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_match_results()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game_title text;
  v_game_date date;
  v_sport_id uuid;
begin
  if new.status <> 'COMPLETED' then
    return new;
  end if;

  if new.winner_team_id is null and not new.is_draw then
    return new;
  end if;

  select g.title, g.game_date, g.sport_id
    into v_game_title, v_game_date, v_sport_id
  from public.games g
  where g.id = new.game_id;

  insert into public.match_results (user_id, game_id, match_id, team_id, sport_id, result, game_title, game_date, cricket_match_id, football_match_id)
  select
    ttm.user_id, new.game_id, new.id, new.team_a_id, v_sport_id,
    case when new.is_draw then 'DRAW' when new.winner_team_id = new.team_a_id then 'WON' else 'LOST' end,
    v_game_title, v_game_date, new.cricket_match_id, new.football_match_id
  from public.tournament_team_members ttm
  join public.tournament_teams tt on tt.id = ttm.team_id
  where ttm.team_id = new.team_a_id and ttm.status = 'JOINED' and ttm.user_id is not null and tt.status = 'APPROVED'
  on conflict (user_id, match_id) do update
    set result = excluded.result, game_title = excluded.game_title, game_date = excluded.game_date,
        cricket_match_id = excluded.cricket_match_id, football_match_id = excluded.football_match_id,
        recorded_at = now();

  insert into public.match_results (user_id, game_id, match_id, team_id, sport_id, result, game_title, game_date, cricket_match_id, football_match_id)
  select
    ttm.user_id, new.game_id, new.id, new.team_b_id, v_sport_id,
    case when new.is_draw then 'DRAW' when new.winner_team_id = new.team_b_id then 'WON' else 'LOST' end,
    v_game_title, v_game_date, new.cricket_match_id, new.football_match_id
  from public.tournament_team_members ttm
  join public.tournament_teams tt on tt.id = ttm.team_id
  where ttm.team_id = new.team_b_id and ttm.status = 'JOINED' and ttm.user_id is not null and tt.status = 'APPROVED'
  on conflict (user_id, match_id) do update
    set result = excluded.result, game_title = excluded.game_title, game_date = excluded.game_date,
        cricket_match_id = excluded.cricket_match_id, football_match_id = excluded.football_match_id,
        recorded_at = now();

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_platform text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.push_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_pending_team(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game_id uuid;
  v_creator_id uuid;
  v_status public.tournament_team_status_type;
begin
  select t.game_id, t.status into v_game_id, v_status from public.tournament_teams t where t.id = p_team_id;
  if v_game_id is null then
    raise exception 'Team not found.';
  end if;

  select creator_id into v_creator_id from public.games where id = v_game_id;
  if v_creator_id is distinct from auth.uid() then
    raise exception 'Only the tournament host can reject a pending team request.';
  end if;

  if v_status <> 'PENDING_HOST_APPROVAL' then
    raise exception 'This team is not awaiting approval.';
  end if;

  delete from public.tournament_team_members where team_id = p_team_id;

  update public.tournament_teams
  set status = 'FORMING', captain_id = null, filled_by_squad_id = null
  where id = p_team_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_venue_review(target_review_id uuid, response_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id from public.venue_reviews where id = target_review_id;
  if v_venue_id is null then
    raise exception 'Review not found.';
  end if;

  if not public.is_venue_admin(v_venue_id) then
    raise exception 'Only this venue''s admins can respond to reviews.';
  end if;

  update public.venue_reviews
  set owner_response = response_text, owner_response_at = now()
  where id = target_review_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_venue_admin(target_venue_id uuid, target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_venue_owner(target_venue_id) then
    raise exception 'Only this venue''s owner can revoke admin access.';
  end if;

  delete from public.venue_admins
  where venue_id = target_venue_id and user_id = target_user_id;

  if not exists (select 1 from public.venues where venue_owner_id = target_user_id)
     and not exists (select 1 from public.venue_admins where user_id = target_user_id) then
    perform set_config('app.venue_admin_grant', 'true', true);
    update public.profiles
    set type = 'user'
    where id = target_user_id and type = 'owner';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_push_for_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  messages jsonb;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'to', t.token,
      'title', new.title,
      'body', coalesce(new.body, ''),
      'sound', 'default',
      'priority', 'high',
      'channelId', 'playoye-alerts',
      'data', coalesce(new.data, '{}'::jsonb) || jsonb_build_object('type', new.type, 'notificationId', new.id)
    )
  )
  into messages
  from public.push_tokens t
  where t.user_id = new.user_id;

  if messages is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := messages,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
  );
  return new;
exception when others then
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_chat_message_root_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.parent_id is null then
    new.root_id := new.id;
  else
    execute format('select root_id from public.%I where id = $1', tg_table_name)
      into new.root_id
      using new.parent_id;
    if new.root_id is null then
      new.root_id := new.parent_id;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_community_comment_root()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.parent_id is not null then
    select coalesce(root_id, id) into new.root_id
      from public.community_comments where id = new.parent_id;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_game_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.game_code is null then
    new.game_code := public.generate_game_code();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_match_scoring_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_exists boolean;
begin
  if new.scoring_code is not null then
    return new;
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    execute format('select exists(select 1 from public.%I where scoring_code = $1)', TG_TABLE_NAME) into v_exists using v_code;
    exit when not v_exists;
  end loop;
  new.scoring_code := v_code;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_squad_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.squad_code is null then
    new.squad_code := public.generate_squad_code();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.user_code is null then
    new.user_code := public.generate_user_code();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.squad_add_members_to_team(p_team_id uuid, p_squad_id uuid, p_member_user_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_squad_owner_id uuid;
  v_squad_gender public.game_gender_type;
  v_is_authorized boolean;
  v_game_id uuid;
  v_game_gender public.game_gender_type;
  v_required int;
  v_current_joined int;
  v_selected_count int;
  v_active_count int;
  v_overlap_count int;
  v_captain_id uuid;
  v_new_members uuid[];
begin
  select squad_owner_id, gender into v_squad_owner_id, v_squad_gender
    from public.squads where id = p_squad_id;

  v_is_authorized := (v_squad_owner_id = auth.uid()) or exists (
    select 1 from public.squad_members sm
    where sm.squad_id = p_squad_id and sm.user_id = auth.uid() and sm.role = 'host' and sm.status = 'ACTIVE'
  );
  if not coalesce(v_is_authorized, false) then
    raise exception 'Only the group owner or a host can add the group''s members to a team.';
  end if;

  select game_id, captain_id into v_game_id, v_captain_id from public.tournament_teams where id = p_team_id and deleted_at is null;
  if v_game_id is null then
    raise exception 'Team not found.';
  end if;

  select players_per_team, gender into v_required, v_game_gender from public.games where id = v_game_id;

  if v_game_gender <> 'mixed' and v_squad_gender <> v_game_gender then
    raise exception 'This tournament is open to % players only — a % group can''t be added.', v_game_gender, v_game_gender;
  end if;

  select array_agg(distinct u) into v_new_members
  from unnest(p_member_user_ids) u
  where not exists (
    select 1 from public.tournament_team_members ttm
    where ttm.team_id = p_team_id and ttm.user_id = u and ttm.status = 'JOINED'
  );

  v_selected_count := coalesce(array_length(v_new_members, 1), 0);
  if v_selected_count = 0 then
    return;
  end if;

  select count(*) into v_current_joined
  from public.tournament_team_members
  where team_id = p_team_id and status = 'JOINED';

  if v_required is not null and v_current_joined + v_selected_count > v_required then
    raise exception 'Only % open slot(s) left on this team.', greatest(v_required - v_current_joined, 0);
  end if;

  select count(*) into v_active_count
  from public.squad_members
  where squad_id = p_squad_id and status = 'ACTIVE' and user_id = any(v_new_members);

  if v_active_count <> v_selected_count then
    raise exception 'Every selected member must be an active member of the group.';
  end if;

  select count(*) into v_overlap_count
  from public.tournament_team_members ttm
  join public.tournament_teams t on t.id = ttm.team_id
  where t.game_id = v_game_id
    and t.id <> p_team_id
    and t.status <> 'REJECTED'
    and ttm.status = 'JOINED'
    and ttm.user_id = any(v_new_members);

  if v_overlap_count > 0 then
    raise exception 'One or more selected players are already on another team in this tournament.';
  end if;

  if v_captain_id is null then
    update public.tournament_teams
    set captain_id = auth.uid(), filled_by_squad_id = coalesce(filled_by_squad_id, p_squad_id)
    where id = p_team_id;
  end if;

  insert into public.tournament_team_members (team_id, user_id, status, joined_at)
  select p_team_id, u, 'JOINED', now() from unnest(v_new_members) u;
end;
$function$;

CREATE OR REPLACE FUNCTION public.squad_fill_game_slots(p_game_id uuid, p_squad_id uuid, p_member_user_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_owner boolean;
  v_game_type public.game_type_type;
  v_max_players int;
  v_joined_count int;
  v_open_slots int;
  v_selected_count int;
  v_active_count int;
begin
  select exists (
    select 1 from public.squads s
    where s.id = p_squad_id
      and (
        s.squad_owner_id = auth.uid()
        or exists (
          select 1 from public.squad_members sm
          where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host' and sm.status = 'ACTIVE'
        )
      )
  ) into v_is_owner;
  if not coalesce(v_is_owner, false) then
    raise exception 'Only the group owner or a host can register group members for this game.';
  end if;

  select game_type, max_players into v_game_type, v_max_players
  from public.games where id = p_game_id and deleted_at is null;

  if v_game_type is null then
    raise exception 'Game not found.';
  end if;
  if v_game_type <> 'REGULAR' then
    raise exception 'Groups can only bulk-join regular games this way.';
  end if;

  select count(*) into v_joined_count
  from public.game_players
  where game_id = p_game_id and status = 'JOINED' and deleted_at is null;

  v_open_slots := greatest(v_max_players - v_joined_count, 0);
  v_selected_count := coalesce(array_length(p_member_user_ids, 1), 0);

  if v_selected_count = 0 or v_selected_count <> v_open_slots then
    raise exception 'Select exactly % group member(s) to fill the remaining open slots.', v_open_slots;
  end if;

  if v_selected_count <> (select count(distinct u) from unnest(p_member_user_ids) u) then
    raise exception 'Duplicate members selected.';
  end if;

  if exists (
    select 1 from public.game_players
    where game_id = p_game_id and user_id = any(p_member_user_ids)
      and status in ('PENDING', 'JOINED') and deleted_at is null
  ) then
    raise exception 'One of the selected members has already joined this game.';
  end if;

  select count(*) into v_active_count
  from public.squad_members
  where squad_id = p_squad_id and status = 'ACTIVE' and user_id = any(p_member_user_ids);

  if v_active_count <> v_selected_count then
    raise exception 'Every selected member must be an active member of the group.';
  end if;

  insert into public.game_players (game_id, user_id, status, payment_status, joined_at)
  select p_game_id, u, 'JOINED', 'PENDING', now() from unnest(p_member_user_ids) u;
end;
$function$;

CREATE OR REPLACE FUNCTION public.squad_fill_tournament_team(p_team_id uuid, p_squad_id uuid, p_member_user_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_owner boolean;
  v_game_id uuid;
  v_required int;
  v_active_count int;
  v_selected_count int;
  v_claimed uuid;
  v_already_used uuid;
begin
  select exists (
    select 1 from public.squads s
    where s.id = p_squad_id
      and (
        s.squad_owner_id = auth.uid()
        or exists (
          select 1 from public.squad_members sm
          where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host' and sm.status = 'ACTIVE'
        )
      )
  ) into v_is_owner;
  if not coalesce(v_is_owner, false) then
    raise exception 'Only the group owner or a host can register the group for a team.';
  end if;

  select game_id into v_game_id from public.tournament_teams where id = p_team_id;
  if v_game_id is null then
    raise exception 'Team not found.';
  end if;

  select id into v_already_used
  from public.tournament_teams
  where game_id = v_game_id
    and filled_by_squad_id = p_squad_id
    and id <> p_team_id
    and deleted_at is null;

  if v_already_used is not null then
    raise exception 'This group has already been registered to another team in this tournament.';
  end if;

  select players_per_team into v_required from public.games where id = v_game_id;
  v_selected_count := coalesce(array_length(p_member_user_ids, 1), 0);

  if v_required is null or v_selected_count <> v_required then
    raise exception 'Select exactly % group member(s) to register this team.', coalesce(v_required, 0);
  end if;

  if v_selected_count <> (select count(distinct u) from unnest(p_member_user_ids) u) then
    raise exception 'Duplicate members selected.';
  end if;

  select count(*) into v_active_count
  from public.squad_members
  where squad_id = p_squad_id and status = 'ACTIVE' and user_id = any(p_member_user_ids);

  if v_active_count <> v_required then
    raise exception 'Every selected member must be an active member of the group.';
  end if;

  update public.tournament_teams
  set captain_id = auth.uid(),
      filled_by_squad_id = p_squad_id
  where id = p_team_id and captain_id is null
  returning id into v_claimed;

  if v_claimed is null then
    raise exception 'This team already has a captain — it is not empty.';
  end if;

  insert into public.tournament_team_members (team_id, user_id, status, joined_at)
  select p_team_id, u, 'JOINED', now() from unnest(p_member_user_ids) u;
end;
$function$;

CREATE OR REPLACE FUNCTION public.squad_fill_tournament_team(p_team_id uuid, p_squad_id uuid, p_member_user_ids uuid[], p_team_name text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_owner boolean;
  v_squad_owner_id uuid;
  v_game_id uuid;
  v_game_gender public.game_gender_type;
  v_squad_gender public.game_gender_type;
  v_required int;
  v_active_count int;
  v_selected_count int;
  v_claimed uuid;
  v_overlap_count int;
begin
  select squad_owner_id, gender into v_squad_owner_id, v_squad_gender
    from public.squads where id = p_squad_id;

  v_is_owner := (v_squad_owner_id = auth.uid()) or exists (
    select 1 from public.squad_members sm
    where sm.squad_id = p_squad_id and sm.user_id = auth.uid() and sm.role = 'host' and sm.status = 'ACTIVE'
  );
  if not coalesce(v_is_owner, false) then
    raise exception 'Only the group owner or a host can register the group for a team.';
  end if;

  select game_id into v_game_id from public.tournament_teams where id = p_team_id;
  if v_game_id is null then
    raise exception 'Team not found.';
  end if;

  select players_per_team, gender into v_required, v_game_gender from public.games where id = v_game_id;

  if v_game_gender <> 'mixed' and v_squad_gender <> v_game_gender then
    raise exception 'This % is open to % players only — register a % group to create a team.',
      'tournament', v_game_gender, v_game_gender;
  end if;

  v_selected_count := coalesce(array_length(p_member_user_ids, 1), 0);

  if v_required is null or v_selected_count <> v_required then
    raise exception 'Select exactly % group member(s) to register this team.', coalesce(v_required, 0);
  end if;

  if v_selected_count <> (select count(distinct u) from unnest(p_member_user_ids) u) then
    raise exception 'Duplicate members selected.';
  end if;

  select count(*) into v_active_count
  from public.squad_members
  where squad_id = p_squad_id and status = 'ACTIVE' and user_id = any(p_member_user_ids);

  if v_active_count <> v_required then
    raise exception 'Every selected member must be an active member of the group.';
  end if;

  select count(*) into v_overlap_count
  from public.tournament_team_members ttm
  join public.tournament_teams t on t.id = ttm.team_id
  where t.game_id = v_game_id
    and t.id <> p_team_id
    and t.status <> 'REJECTED'
    and ttm.status = 'JOINED'
    and ttm.user_id = any(p_member_user_ids);

  if v_overlap_count > 0 then
    raise exception 'One or more selected players are already on another team in this tournament.';
  end if;

  update public.tournament_teams
  set captain_id = auth.uid(),
      filled_by_squad_id = p_squad_id,
      name = coalesce(nullif(trim(p_team_name), ''), name)
  where id = p_team_id and captain_id is null
  returning id into v_claimed;

  if v_claimed is null then
    raise exception 'This team already has a captain — it is not empty.';
  end if;

  insert into public.tournament_team_members (team_id, user_id, status, joined_at)
  select p_team_id, u, 'JOINED', now() from unnest(p_member_user_ids) u;
end;
$function$;

CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$function$;


-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================

-- The one trigger outside "public" — fires on Supabase Auth's own
-- auth.users table to create the matching public.profiles row on signup.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER set_scoring_code BEFORE INSERT ON public.badminton_matches FOR EACH ROW EXECUTE FUNCTION set_match_scoring_code();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notify_venue_admins_of_booking AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION notify_venue_admins_of_booking();
CREATE TRIGGER community_comments_notify_followers AFTER INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION notify_followers_of_community_post();
CREATE TRIGGER community_comments_notify_reply AFTER INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION notify_community_reply();
CREATE TRIGGER community_comments_poll_cleanup AFTER DELETE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION cleanup_poll_on_message_delete();
CREATE TRIGGER community_comments_set_root BEFORE INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION set_community_comment_root();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.court FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.court_images FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_scoring_code BEFORE INSERT ON public.cricket_matches FOR EACH ROW EXECUTE FUNCTION set_match_scoring_code();
CREATE TRIGGER set_scoring_code BEFORE INSERT ON public.football_matches FOR EACH ROW EXECUTE FUNCTION set_match_scoring_code();
CREATE TRIGGER game_invites_notify AFTER INSERT ON public.game_invites FOR EACH ROW EXECUTE FUNCTION notify_game_invite_created();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.game_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER game_messages_poll_cleanup AFTER DELETE ON public.game_messages FOR EACH ROW EXECUTE FUNCTION cleanup_poll_on_message_delete();
CREATE TRIGGER game_messages_set_root BEFORE INSERT ON public.game_messages FOR EACH ROW EXECUTE FUNCTION set_chat_message_root_id();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.game_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER game_players_notify AFTER INSERT OR UPDATE ON public.game_players FOR EACH ROW EXECUTE FUNCTION notify_game_player_events();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.game_players FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.game_squad_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER games_cancelled_notify AFTER UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION notify_game_cancelled_events();
CREATE TRIGGER games_set_code BEFORE INSERT ON public.games FOR EACH ROW EXECUTE FUNCTION set_game_code();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notifications_send_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION send_push_for_notification();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_scoring_code BEFORE INSERT ON public.padel_matches FOR EACH ROW EXECUTE FUNCTION set_match_scoring_code();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_scoring_code BEFORE INSERT ON public.pickleball_matches FOR EACH ROW EXECUTE FUNCTION set_match_scoring_code();
CREATE TRIGGER profiles_type_lockdown BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_type_self_escalation();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_user_code BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_user_code();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.squad_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER squad_invites_notify AFTER INSERT ON public.squad_invites FOR EACH ROW EXECUTE FUNCTION notify_squad_invite_created();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.squad_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER squad_members_notify AFTER INSERT OR UPDATE ON public.squad_members FOR EACH ROW EXECUTE FUNCTION notify_squad_member_events();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.squad_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER squad_messages_poll_cleanup AFTER DELETE ON public.squad_messages FOR EACH ROW EXECUTE FUNCTION cleanup_poll_on_message_delete();
CREATE TRIGGER squad_messages_set_root BEFORE INSERT ON public.squad_messages FOR EACH ROW EXECUTE FUNCTION set_chat_message_root_id();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.squads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER squads_set_code BEFORE INSERT ON public.squads FOR EACH ROW EXECUTE FUNCTION set_squad_code();
CREATE TRIGGER set_scoring_code BEFORE INSERT ON public.table_tennis_matches FOR EACH ROW EXECUTE FUNCTION set_match_scoring_code();
CREATE TRIGGER team_messages_poll_cleanup AFTER DELETE ON public.team_messages FOR EACH ROW EXECUTE FUNCTION cleanup_poll_on_message_delete();
CREATE TRIGGER team_messages_set_root BEFORE INSERT ON public.team_messages FOR EACH ROW EXECUTE FUNCTION set_chat_message_root_id();
CREATE TRIGGER set_scoring_code BEFORE INSERT ON public.tennis_matches FOR EACH ROW EXECUTE FUNCTION set_match_scoring_code();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tournament_matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_record_match_results AFTER INSERT OR UPDATE ON public.tournament_matches FOR EACH ROW EXECUTE FUNCTION record_match_results();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tournament_team_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tournament_team_invites_notify AFTER INSERT ON public.tournament_team_invites FOR EACH ROW EXECUTE FUNCTION notify_team_invite_created();
CREATE TRIGGER auto_approve_full_team AFTER INSERT OR UPDATE ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION auto_approve_full_team();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tournament_team_members_check_roster BEFORE INSERT OR UPDATE ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION enforce_team_roster_rules();
CREATE TRIGGER tournament_team_members_claim_captain AFTER INSERT ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION claim_team_on_first_join();
CREATE TRIGGER tournament_team_members_notify AFTER INSERT OR UPDATE ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION notify_team_member_events();
CREATE TRIGGER tournament_team_members_single_team BEFORE INSERT ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION enforce_single_team_per_tournament();
CREATE TRIGGER enforce_pool_assignment BEFORE UPDATE ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION enforce_pool_assignment();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tournament_teams_check_capacity BEFORE INSERT ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION enforce_team_capacity();
CREATE TRIGGER tournament_teams_check_status_transition BEFORE UPDATE ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION enforce_team_status_transition();
CREATE TRIGGER tournament_teams_notify AFTER UPDATE ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION notify_team_status_events();
CREATE TRIGGER trg_auto_generate_head_to_head_match AFTER UPDATE ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION auto_generate_head_to_head_match();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.venue_facilities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.venue_images FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.venue_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER venues_admin_removed AFTER UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION handle_venue_admin_removed();


-- ============================================================================
-- 11. ROW LEVEL SECURITY — enable on every table, then every policy
-- (all 60 public tables have RLS enabled; none use FORCE ROW LEVEL SECURITY)
-- ============================================================================
alter table public.badminton_matches enable row level security;
alter table public.badminton_rallies enable row level security;
alter table public.blocked_users enable row level security;
alter table public.booking_holds enable row level security;
alter table public.bookings enable row level security;
alter table public.community_comment_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.content_reports enable row level security;
alter table public.court enable row level security;
alter table public.court_images enable row level security;
alter table public.court_price_rules enable row level security;
alter table public.cricket_balls enable row level security;
alter table public.cricket_innings enable row level security;
alter table public.cricket_matches enable row level security;
alter table public.favorite_games enable row level security;
alter table public.favorite_venues enable row level security;
alter table public.football_goals enable row level security;
alter table public.football_matches enable row level security;
alter table public.football_penalty_kicks enable row level security;
alter table public.game_chat_reads enable row level security;
alter table public.game_history enable row level security;
alter table public.game_invites enable row level security;
alter table public.game_messages enable row level security;
alter table public.game_players enable row level security;
alter table public.game_squad_invites enable row level security;
alter table public.games enable row level security;
alter table public.match_results enable row level security;
alter table public.notifications enable row level security;
alter table public.padel_matches enable row level security;
alter table public.padel_points enable row level security;
alter table public.payments enable row level security;
alter table public.pickleball_matches enable row level security;
alter table public.pickleball_rallies enable row level security;
alter table public.player_follows enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.polls enable row level security;
alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.slots enable row level security;
alter table public.sports enable row level security;
alter table public.squad_chat_reads enable row level security;
alter table public.squad_invites enable row level security;
alter table public.squad_members enable row level security;
alter table public.squad_messages enable row level security;
alter table public.squads enable row level security;
alter table public.table_tennis_matches enable row level security;
alter table public.table_tennis_rallies enable row level security;
alter table public.team_chat_reads enable row level security;
alter table public.team_messages enable row level security;
alter table public.tennis_matches enable row level security;
alter table public.tennis_points enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_pools enable row level security;
alter table public.tournament_team_invites enable row level security;
alter table public.tournament_team_members enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.venue_admins enable row level security;
alter table public.venue_facilities enable row level security;
alter table public.venue_images enable row level security;
alter table public.venue_reviews enable row level security;
alter table public.venues enable row level security;

-- --- badminton_matches ---
create policy badminton_matches_owner on public.badminton_matches for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy badminton_matches_select_any on public.badminton_matches for select to public using (auth.uid() is not null);
-- --- badminton_rallies ---
create policy badminton_rallies_owner on public.badminton_rallies for all to public using (exists (select 1 from badminton_matches m where m.id = badminton_rallies.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from badminton_matches m where m.id = badminton_rallies.match_id and m.user_id = auth.uid()));
create policy badminton_rallies_select_any on public.badminton_rallies for select to public using (auth.uid() is not null);
-- --- blocked_users ---
create policy blocked_users_manage_own on public.blocked_users for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
-- --- booking_holds ---
create policy booking_holds_delete_self on public.booking_holds for delete to public using (user_id = auth.uid());
create policy booking_holds_insert_self on public.booking_holds for insert to authenticated with check (user_id = auth.uid());
create policy booking_holds_select_self on public.booking_holds for select to public using (user_id = auth.uid());
-- --- bookings ---
create policy bookings_insert_self on public.bookings for insert to authenticated
  with check (user_id = auth.uid() and (status <> 'BLOCKED'::booking_status_type or exists (select 1 from court c where c.id = bookings.court_id and is_venue_admin(c.venue_id))));
create policy bookings_select_self_or_venue_owner on public.bookings for select to public
  using (user_id = auth.uid() or exists (select 1 from court c where c.id = bookings.court_id and is_venue_admin(c.venue_id)));
create policy bookings_update_self_or_venue_owner on public.bookings for update to public
  using (user_id = auth.uid() or exists (select 1 from court c where c.id = bookings.court_id and is_venue_admin(c.venue_id)))
  with check (user_id = auth.uid() or exists (select 1 from court c where c.id = bookings.court_id and is_venue_admin(c.venue_id)));
-- --- community_comment_likes ---
create policy community_comment_likes_delete_self on public.community_comment_likes for delete to public using (user_id = auth.uid());
create policy community_comment_likes_insert_self on public.community_comment_likes for insert to public with check (user_id = auth.uid());
create policy community_comment_likes_select_all on public.community_comment_likes for select to public using (true);
-- --- community_comments ---
create policy community_comments_delete_self on public.community_comments for delete to public using (user_id = auth.uid());
create policy community_comments_insert_self on public.community_comments for insert to public with check (user_id = auth.uid());
create policy community_comments_select_all on public.community_comments for select to public using (true);
create policy community_comments_update_self on public.community_comments for update to public using (user_id = auth.uid()) with check (user_id = auth.uid());
-- --- content_reports ---
create policy content_reports_insert_own on public.content_reports for insert to authenticated with check (reporter_id = auth.uid());
-- --- court ---
create policy court_select_public_or_owner on public.court for select to public using (isactive = true or is_venue_admin(venue_id));
create policy court_write_owner on public.court for all to public using (is_venue_admin(venue_id)) with check (is_venue_admin(venue_id));
-- --- court_images ---
create policy court_images_select_all on public.court_images for select to public using (true);
create policy court_images_write_admin on public.court_images for all to public
  using (is_venue_admin((select court.venue_id from court where court.id = court_images.court_id)))
  with check (is_venue_admin((select court.venue_id from court where court.id = court_images.court_id)));
-- --- court_price_rules ---
create policy court_price_rules_select on public.court_price_rules for select to public
  using (exists (select 1 from court c where c.id = court_price_rules.court_id and (c.isactive = true or is_venue_admin(c.venue_id))));
create policy court_price_rules_write on public.court_price_rules for all to public
  using (exists (select 1 from court c where c.id = court_price_rules.court_id and is_venue_admin(c.venue_id)))
  with check (exists (select 1 from court c where c.id = court_price_rules.court_id and is_venue_admin(c.venue_id)));
-- --- cricket_balls ---
create policy cricket_balls_owner on public.cricket_balls for all to public
  using (exists (select 1 from cricket_innings i join cricket_matches m on m.id = i.match_id where i.id = cricket_balls.innings_id and m.user_id = auth.uid()))
  with check (exists (select 1 from cricket_innings i join cricket_matches m on m.id = i.match_id where i.id = cricket_balls.innings_id and m.user_id = auth.uid()));
create policy cricket_balls_select_any on public.cricket_balls for select to public using (auth.uid() is not null);
-- --- cricket_innings ---
create policy cricket_innings_owner on public.cricket_innings for all to public
  using (exists (select 1 from cricket_matches m where m.id = cricket_innings.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from cricket_matches m where m.id = cricket_innings.match_id and m.user_id = auth.uid()));
create policy cricket_innings_select_any on public.cricket_innings for select to public using (auth.uid() is not null);
-- --- cricket_matches ---
create policy cricket_matches_owner on public.cricket_matches for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cricket_matches_select_any on public.cricket_matches for select to public using (auth.uid() is not null);
-- --- favorite_games ---
create policy favorite_games_all_self on public.favorite_games for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
-- --- favorite_venues ---
create policy favorite_venues_all_self on public.favorite_venues for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
-- --- football_goals ---
create policy football_goals_owner on public.football_goals for all to public
  using (exists (select 1 from football_matches m where m.id = football_goals.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from football_matches m where m.id = football_goals.match_id and m.user_id = auth.uid()));
create policy football_goals_select_any on public.football_goals for select to public using (auth.uid() is not null);
-- --- football_matches ---
create policy football_matches_owner on public.football_matches for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy football_matches_select_any on public.football_matches for select to public using (auth.uid() is not null);
-- --- football_penalty_kicks ---
create policy football_penalty_kicks_owner on public.football_penalty_kicks for all to public
  using (exists (select 1 from football_matches m where m.id = football_penalty_kicks.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from football_matches m where m.id = football_penalty_kicks.match_id and m.user_id = auth.uid()));
create policy football_penalty_kicks_select_any on public.football_penalty_kicks for select to public using (auth.uid() is not null);
-- --- game_chat_reads ---
create policy game_chat_reads_all_self on public.game_chat_reads for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy game_chat_reads_select_participant on public.game_chat_reads for select to public using (
  exists (select 1 from game_players gp where gp.game_id = game_chat_reads.game_id and gp.user_id = auth.uid() and gp.status = 'JOINED'::game_player_status_type)
  or exists (select 1 from games g where g.id = game_chat_reads.game_id and g.creator_id = auth.uid())
  or exists (select 1 from tournament_team_members ttm join tournament_teams tt on tt.id = ttm.team_id
    where tt.game_id = game_chat_reads.game_id and tt.status = 'APPROVED'::tournament_team_status_type
      and ttm.user_id = auth.uid() and ttm.status = 'JOINED'::game_player_status_type));
-- --- game_history ---
create policy game_history_select_own on public.game_history for select to authenticated using (user_id = auth.uid());
-- --- game_invites ---
create policy game_invites_insert_inviter on public.game_invites for insert to public
  with check (invited_by = auth.uid() and exists (select 1 from games g where g.id = game_invites.game_id and g.creator_id = auth.uid()));
create policy game_invites_select_participant on public.game_invites for select to public
  using (invited_user_id = auth.uid() or invited_by = auth.uid() or exists (select 1 from games g where g.id = game_invites.game_id and g.creator_id = auth.uid()));
create policy game_invites_update_participant on public.game_invites for update to public
  using (invited_user_id = auth.uid() or invited_by = auth.uid()) with check (invited_user_id = auth.uid() or invited_by = auth.uid());
-- --- game_messages ---
create policy game_messages_insert_participant on public.game_messages for insert to public with check (
  sender_id = auth.uid() and (
    exists (select 1 from game_players gp where gp.game_id = game_messages.game_id and gp.user_id = auth.uid() and gp.status = 'JOINED'::game_player_status_type)
    or exists (select 1 from games g where g.id = game_messages.game_id and g.creator_id = auth.uid())
    or exists (select 1 from tournament_team_members ttm join tournament_teams tt on tt.id = ttm.team_id
      where tt.game_id = game_messages.game_id and tt.status = 'APPROVED'::tournament_team_status_type
        and ttm.user_id = auth.uid() and ttm.status = 'JOINED'::game_player_status_type)
  ));
create policy game_messages_select_participant on public.game_messages for select to public using (
  exists (select 1 from game_players gp where gp.game_id = game_messages.game_id and gp.user_id = auth.uid() and gp.status = 'JOINED'::game_player_status_type)
  or exists (select 1 from games g where g.id = game_messages.game_id and g.creator_id = auth.uid())
  or exists (select 1 from tournament_team_members ttm join tournament_teams tt on tt.id = ttm.team_id
    where tt.game_id = game_messages.game_id and tt.status = 'APPROVED'::tournament_team_status_type
      and ttm.user_id = auth.uid() and ttm.status = 'JOINED'::game_player_status_type));
-- --- game_players ---
create policy game_players_insert_own on public.game_players for insert to authenticated with check (user_id = auth.uid());
create policy game_players_insert_self on public.game_players for insert to public with check (user_id = auth.uid());
create policy game_players_select_authenticated on public.game_players for select to authenticated using (deleted_at is null);
create policy game_players_update_host on public.game_players for update to authenticated
  using (exists (select 1 from games where games.id = game_players.game_id and games.creator_id = auth.uid()))
  with check (exists (select 1 from games where games.id = game_players.game_id and games.creator_id = auth.uid()));
create policy game_players_update_own on public.game_players for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- --- game_squad_invites ---
create policy game_squad_invites_insert on public.game_squad_invites for insert to public
  with check (invited_by = auth.uid() and exists (select 1 from games g where g.id = game_squad_invites.game_id and g.creator_id = auth.uid()));
create policy game_squad_invites_select on public.game_squad_invites for select to public using (
  invited_by = auth.uid() or exists (select 1 from games g where g.id = game_squad_invites.game_id and g.creator_id = auth.uid())
  or exists (select 1 from squads s where s.id = game_squad_invites.squad_id and (s.squad_owner_id = auth.uid()
    or exists (select 1 from squad_members sm where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type))));
create policy game_squad_invites_update on public.game_squad_invites for update to public
  using (exists (select 1 from squads s where s.id = game_squad_invites.squad_id and (s.squad_owner_id = auth.uid()
    or exists (select 1 from squad_members sm where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type))))
  with check (exists (select 1 from squads s where s.id = game_squad_invites.squad_id and (s.squad_owner_id = auth.uid()
    or exists (select 1 from squad_members sm where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type))));
-- --- games ---
create policy games_delete_own on public.games for delete to authenticated using (creator_id = auth.uid());
create policy games_insert_creator on public.games for insert to public with check (creator_id = auth.uid());
create policy games_insert_own on public.games for insert to authenticated with check (creator_id = auth.uid());
create policy games_select_public on public.games for select to authenticated using (deleted_at is null and (visibility = 'public'::game_visibility_type or creator_id = auth.uid()));
create policy games_select_visible on public.games for select to public using (
  visibility = 'public'::game_visibility_type or creator_id = auth.uid()
  or exists (select 1 from game_players gp where gp.game_id = games.id and gp.user_id = auth.uid())
  or (visibility = 'squad_only'::game_visibility_type and squad_id is not null
    and exists (select 1 from squad_members sm where sm.squad_id = games.squad_id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'::squad_member_status_type)));
create policy games_update_creator on public.games for update to public using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy games_update_own on public.games for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
-- --- match_results ---
create policy "match_results are publicly readable" on public.match_results for select to public using (true);
-- --- notifications ---
create policy notifications_select_self on public.notifications for select to public using (user_id = auth.uid());
create policy notifications_update_self on public.notifications for update to public using (user_id = auth.uid()) with check (user_id = auth.uid());
-- --- padel_matches ---
create policy padel_matches_owner on public.padel_matches for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy padel_matches_select_any on public.padel_matches for select to public using (auth.uid() is not null);
-- --- padel_points ---
create policy padel_points_owner on public.padel_points for all to public
  using (exists (select 1 from padel_matches m where m.id = padel_points.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from padel_matches m where m.id = padel_points.match_id and m.user_id = auth.uid()));
create policy padel_points_select_any on public.padel_points for select to public using (auth.uid() is not null);
-- --- payments ---
create policy payments_select_self on public.payments for select to public using (user_id = auth.uid());
-- --- pickleball_matches ---
create policy pickleball_matches_owner on public.pickleball_matches for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pickleball_matches_select_any on public.pickleball_matches for select to public using (auth.uid() is not null);
-- --- pickleball_rallies ---
create policy pickleball_rallies_owner on public.pickleball_rallies for all to public
  using (exists (select 1 from pickleball_matches m where m.id = pickleball_rallies.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from pickleball_matches m where m.id = pickleball_rallies.match_id and m.user_id = auth.uid()));
create policy pickleball_rallies_select_any on public.pickleball_rallies for select to public using (auth.uid() is not null);
-- --- player_follows ---
create policy player_follows_delete_self on public.player_follows for delete to public using (follower_id = auth.uid());
create policy player_follows_insert_self on public.player_follows for insert to public with check (follower_id = auth.uid());
create policy player_follows_select_all on public.player_follows for select to public using (true);
-- --- poll_options ---
create policy poll_options_insert_via_poll on public.poll_options for insert to authenticated with check (exists (select 1 from polls p where p.id = poll_options.poll_id and p.created_by = auth.uid()));
create policy poll_options_select_via_message on public.poll_options for select to authenticated using (can_view_poll(poll_id));
-- --- poll_votes ---
create policy poll_votes_insert_self on public.poll_votes for insert to authenticated with check (voter_id = auth.uid() and can_view_poll(poll_id));
create policy poll_votes_select_via_message on public.poll_votes for select to authenticated using (can_view_poll(poll_id));
create policy poll_votes_update_self on public.poll_votes for update to authenticated using (voter_id = auth.uid()) with check (voter_id = auth.uid() and can_view_poll(poll_id));
-- --- polls ---
create policy polls_insert_self on public.polls for insert to authenticated with check (created_by = auth.uid());
create policy polls_select_via_message on public.polls for select to authenticated using (can_view_poll(id) or created_by = auth.uid());
-- --- profiles ---
create policy profiles_insert_self on public.profiles for insert to public with check (auth.uid() = id);
create policy profiles_select_all on public.profiles for select to public using (true);
create policy profiles_update_self on public.profiles for update to public using (auth.uid() = id or is_superadmin()) with check (auth.uid() = id or is_superadmin());
-- --- slots ---
create policy slots_select_all on public.slots for select to public using (true);
create policy slots_write_owner on public.slots for all to public
  using ((exists (select 1 from court c join venues v on v.id = c.venue_id where c.id = slots.court_id and v.venue_owner_id = auth.uid())) or is_superadmin())
  with check ((exists (select 1 from court c join venues v on v.id = c.venue_id where c.id = slots.court_id and v.venue_owner_id = auth.uid())) or is_superadmin());
-- --- sports ---
create policy sports_select_all on public.sports for select to public using (true);
-- --- squad_chat_reads ---
create policy squad_chat_reads_all_self on public.squad_chat_reads for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy squad_chat_reads_select_participant on public.squad_chat_reads for select to public using (
  exists (select 1 from squad_members sm where sm.squad_id = squad_chat_reads.squad_id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'::squad_member_status_type)
  or exists (select 1 from squads s where s.id = squad_chat_reads.squad_id and s.squad_owner_id = auth.uid()));
-- --- squad_invites ---
create policy squad_invites_insert_member on public.squad_invites for insert to public with check (
  invited_by = auth.uid() and (
    exists (select 1 from squads s where s.id = squad_invites.squad_id and s.squad_owner_id = auth.uid())
    or exists (select 1 from squad_members m where m.squad_id = squad_invites.squad_id and m.user_id = auth.uid() and m.status = 'ACTIVE'::squad_member_status_type)
  ));
create policy squad_invites_select_participant on public.squad_invites for select to public using (
  invited_user_id = auth.uid() or invited_by = auth.uid() or exists (select 1 from squads s where s.id = squad_invites.squad_id and s.squad_owner_id = auth.uid()));
create policy squad_invites_update_participant on public.squad_invites for update to public
  using (invited_user_id = auth.uid() or invited_by = auth.uid()) with check (invited_user_id = auth.uid() or invited_by = auth.uid());
-- --- squad_members ---
create policy squad_members_insert_self_or_owner on public.squad_members for insert to public with check (
  (user_id = auth.uid() and exists (select 1 from squads s where s.id = squad_members.squad_id
    and (s.gender = 'mixed'::game_gender_type or exists (select 1 from profiles p where p.id = auth.uid() and p.gender::text = s.gender::text))))
  or exists (select 1 from squads s where s.id = squad_members.squad_id and s.squad_owner_id = auth.uid()));
create policy squad_members_select_all on public.squad_members for select to public using (true);
create policy squad_members_update_self_or_owner on public.squad_members for update to public using (
  user_id = auth.uid() or exists (select 1 from squads s where s.id = squad_members.squad_id and s.squad_owner_id = auth.uid())
  or exists (select 1 from squad_members h where h.squad_id = squad_members.squad_id and h.user_id = auth.uid() and h.role = 'host'::squad_role_type and h.status = 'ACTIVE'::squad_member_status_type))
  with check (
  user_id = auth.uid() or exists (select 1 from squads s where s.id = squad_members.squad_id and s.squad_owner_id = auth.uid())
  or exists (select 1 from squad_members h where h.squad_id = squad_members.squad_id and h.user_id = auth.uid() and h.role = 'host'::squad_role_type and h.status = 'ACTIVE'::squad_member_status_type));
-- --- squad_messages ---
create policy squad_messages_insert_participant on public.squad_messages for insert to public with check (
  sender_id = auth.uid() and (
    exists (select 1 from squad_members sm where sm.squad_id = squad_messages.squad_id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'::squad_member_status_type)
    or exists (select 1 from squads s where s.id = squad_messages.squad_id and s.squad_owner_id = auth.uid())
  ));
create policy squad_messages_select_participant on public.squad_messages for select to public using (
  exists (select 1 from squad_members sm where sm.squad_id = squad_messages.squad_id and sm.user_id = auth.uid() and sm.status = 'ACTIVE'::squad_member_status_type)
  or exists (select 1 from squads s where s.id = squad_messages.squad_id and s.squad_owner_id = auth.uid()));
-- --- squads ---
create policy squads_delete_owner on public.squads for delete to public using (
  squad_owner_id = auth.uid() or exists (select 1 from squad_members sm where sm.squad_id = squads.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type));
create policy squads_insert_owner on public.squads for insert to public with check (squad_owner_id = auth.uid());
create policy squads_select_all on public.squads for select to public using (deleted_at is null or squad_owner_id = auth.uid());
create policy squads_update_owner on public.squads for update to public using (
  squad_owner_id = auth.uid() or exists (select 1 from squad_members sm where sm.squad_id = squads.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type))
  with check (
  squad_owner_id = auth.uid() or exists (select 1 from squad_members sm where sm.squad_id = squads.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type));
-- --- table_tennis_matches ---
create policy table_tennis_matches_owner on public.table_tennis_matches for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy table_tennis_matches_select_any on public.table_tennis_matches for select to public using (auth.uid() is not null);
-- --- table_tennis_rallies ---
create policy table_tennis_rallies_owner on public.table_tennis_rallies for all to public
  using (exists (select 1 from table_tennis_matches m where m.id = table_tennis_rallies.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from table_tennis_matches m where m.id = table_tennis_rallies.match_id and m.user_id = auth.uid()));
create policy table_tennis_rallies_select_any on public.table_tennis_rallies for select to public using (auth.uid() is not null);
-- --- team_chat_reads ---
create policy team_chat_reads_all_self on public.team_chat_reads for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy team_chat_reads_select_participant on public.team_chat_reads for select to public using (
  exists (select 1 from tournament_team_members tm where tm.team_id = team_chat_reads.team_id and tm.user_id = auth.uid() and tm.status = 'JOINED'::game_player_status_type));
-- --- team_messages ---
create policy team_messages_insert_participant on public.team_messages for insert to public with check (
  sender_id = auth.uid() and exists (select 1 from tournament_team_members tm where tm.team_id = team_messages.team_id and tm.user_id = auth.uid() and tm.status = 'JOINED'::game_player_status_type));
create policy team_messages_select_participant on public.team_messages for select to public using (
  exists (select 1 from tournament_team_members tm where tm.team_id = team_messages.team_id and tm.user_id = auth.uid() and tm.status = 'JOINED'::game_player_status_type));
-- --- tennis_matches ---
create policy tennis_matches_owner on public.tennis_matches for all to public using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tennis_matches_select_any on public.tennis_matches for select to public using (auth.uid() is not null);
-- --- tennis_points ---
create policy tennis_points_owner on public.tennis_points for all to public
  using (exists (select 1 from tennis_matches m where m.id = tennis_points.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from tennis_matches m where m.id = tennis_points.match_id and m.user_id = auth.uid()));
create policy tennis_points_select_any on public.tennis_points for select to public using (auth.uid() is not null);
-- --- tournament_matches ---
create policy tournament_matches_select_all on public.tournament_matches for select to public using (true);
create policy tournament_matches_write_host on public.tournament_matches for all to public
  using (exists (select 1 from games g where g.id = tournament_matches.game_id and g.creator_id = auth.uid()))
  with check (exists (select 1 from games g where g.id = tournament_matches.game_id and g.creator_id = auth.uid()));
create policy tournament_matches_write_scorer on public.tournament_matches for update to public using (scorer_user_id = auth.uid()) with check (scorer_user_id = auth.uid());
-- --- tournament_pools ---
create policy tournament_pools_select_all on public.tournament_pools for select to public using (true);
create policy tournament_pools_write_host on public.tournament_pools for all to public
  using (exists (select 1 from games g where g.id = tournament_pools.game_id and g.creator_id = auth.uid()))
  with check (exists (select 1 from games g where g.id = tournament_pools.game_id and g.creator_id = auth.uid()));
-- --- tournament_team_invites ---
create policy tournament_team_invites_insert_member on public.tournament_team_invites for insert to public with check (
  invited_by = auth.uid() and (
    exists (select 1 from tournament_team_members m where m.team_id = tournament_team_invites.team_id and m.user_id = auth.uid() and m.status = 'JOINED'::game_player_status_type)
    or exists (select 1 from tournament_teams t join games g on g.id = t.game_id where t.id = tournament_team_invites.team_id and g.creator_id = auth.uid())
  ));
create policy tournament_team_invites_select_participant on public.tournament_team_invites for select to public using (
  invited_user_id = auth.uid() or invited_by = auth.uid() or exists (select 1 from tournament_teams t join games g on g.id = t.game_id where t.id = tournament_team_invites.team_id and g.creator_id = auth.uid()));
create policy tournament_team_invites_update_participant on public.tournament_team_invites for update to public
  using (invited_user_id = auth.uid() or invited_by = auth.uid()) with check (invited_user_id = auth.uid() or invited_by = auth.uid());
-- --- tournament_team_members ---
create policy tournament_team_members_insert_self on public.tournament_team_members for insert to public with check (user_id = auth.uid() and status = 'JOINED'::game_player_status_type);
create policy tournament_team_members_select_all on public.tournament_team_members for select to public using (deleted_at is null);
create policy tournament_team_members_update_host on public.tournament_team_members for update to public
  using (exists (select 1 from tournament_teams t join games g on g.id = t.game_id where t.id = tournament_team_members.team_id and g.creator_id = auth.uid()))
  with check (exists (select 1 from tournament_teams t join games g on g.id = t.game_id where t.id = tournament_team_members.team_id and g.creator_id = auth.uid()));
create policy tournament_team_members_update_self on public.tournament_team_members for update to public using (user_id = auth.uid()) with check (user_id = auth.uid());
-- --- tournament_teams ---
create policy tournament_teams_insert_captain on public.tournament_teams for insert to public with check (
  (captain_id = auth.uid() and exists (select 1 from games g where g.id = tournament_teams.game_id
    and (g.gender = 'mixed'::game_gender_type or exists (select 1 from profiles p where p.id = auth.uid() and p.gender::text = g.gender::text))))
  or (captain_id is null and exists (select 1 from games g where g.id = tournament_teams.game_id and g.creator_id = auth.uid())));
create policy tournament_teams_select_all on public.tournament_teams for select to public using (deleted_at is null);
create policy tournament_teams_update_captain_or_host on public.tournament_teams for update to public
  using (captain_id = auth.uid() or exists (select 1 from games g where g.id = tournament_teams.game_id and g.creator_id = auth.uid()))
  with check (captain_id = auth.uid() or exists (select 1 from games g where g.id = tournament_teams.game_id and g.creator_id = auth.uid()));
-- --- venue_admins ---
create policy venue_admins_delete on public.venue_admins for delete to public using (is_venue_owner(venue_id));
create policy venue_admins_insert on public.venue_admins for insert to public with check (is_venue_owner(venue_id));
create policy venue_admins_select on public.venue_admins for select to public using (is_venue_owner(venue_id));
create policy venue_admins_select_own on public.venue_admins for select to public using (user_id = auth.uid());
-- --- venue_facilities ---
create policy venue_facilities_select_all on public.venue_facilities for select to public using (true);
create policy venue_facilities_write_owner on public.venue_facilities for all to public using (is_venue_admin(venue_id)) with check (is_venue_admin(venue_id));
-- --- venue_images ---
create policy venue_images_select_all on public.venue_images for select to public using (true);
create policy venue_images_write_owner on public.venue_images for all to public using (is_venue_admin(venue_id)) with check (is_venue_admin(venue_id));
-- --- venue_reviews ---
create policy venue_reviews_insert_verified_booking on public.venue_reviews for insert to public with check (
  user_id = auth.uid() and exists (select 1 from bookings b where b.id = venue_reviews.booking_id and b.user_id = auth.uid() and b.status = 'COMPLETED'::booking_status_type));
create policy venue_reviews_select_all on public.venue_reviews for select to public using (true);
create policy venue_reviews_update_self on public.venue_reviews for update to public using (user_id = auth.uid()) with check (user_id = auth.uid());
-- --- venues ---
create policy venues_insert_owner on public.venues for insert to public with check (
  is_superadmin() or (venue_owner_id = auth.uid() and exists (select 1 from profiles p where p.id = auth.uid() and p.type = 'owner'::profile_type)));
create policy venues_select_public_or_owner on public.venues for select to public using (isactive = true or is_venue_admin(id));
create policy venues_update_owner on public.venues for update to public using (is_venue_admin(id)) with check (is_venue_admin(id));


-- ============================================================================
-- 12. STORAGE — buckets + storage.objects policies
-- ============================================================================
insert into storage.buckets (id, name, public) values
  ('app-images', 'app-images', true),
  ('avatars', 'avatars', true),
  ('court-images', 'court-images', true),
  ('game-icons', 'game-icons', true),
  ('squad-icons', 'squad-icons', true),
  ('venue-images', 'venue-images', true)
on conflict (id) do nothing;

create policy app_images_public_read on storage.objects for select to public using (bucket_id = 'app-images');

create policy avatars_delete_own_folder on storage.objects for delete to public using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_insert_own_folder on storage.objects for insert to public with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_public_read on storage.objects for select to public using (bucket_id = 'avatars');
create policy avatars_update_own_folder on storage.objects for update to public
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy court_images_delete_admin on storage.objects for delete to public using (
  bucket_id = 'court-images' and exists (select 1 from court c where c.id = ((storage.foldername(objects.name))[1])::uuid and is_venue_admin(c.venue_id)));
create policy court_images_insert_admin on storage.objects for insert to public with check (
  bucket_id = 'court-images' and exists (select 1 from court c where c.id = ((storage.foldername(objects.name))[1])::uuid and is_venue_admin(c.venue_id)));
create policy court_images_public_read on storage.objects for select to public using (bucket_id = 'court-images');
create policy court_images_update_admin on storage.objects for update to public
  using (bucket_id = 'court-images' and exists (select 1 from court c where c.id = ((storage.foldername(objects.name))[1])::uuid and is_venue_admin(c.venue_id)))
  with check (bucket_id = 'court-images' and exists (select 1 from court c where c.id = ((storage.foldername(objects.name))[1])::uuid and is_venue_admin(c.venue_id)));

create policy game_icons_delete_owner on storage.objects for delete to authenticated using (
  bucket_id = 'game-icons' and exists (select 1 from games g where g.id = ((storage.foldername(objects.name))[1])::uuid and g.creator_id = auth.uid()));
create policy game_icons_insert_owner on storage.objects for insert to authenticated with check (
  bucket_id = 'game-icons' and exists (select 1 from games g where g.id = ((storage.foldername(objects.name))[1])::uuid and g.creator_id = auth.uid()));
create policy game_icons_public_read on storage.objects for select to public using (bucket_id = 'game-icons');
create policy game_icons_update_owner on storage.objects for update to authenticated using (
  bucket_id = 'game-icons' and exists (select 1 from games g where g.id = ((storage.foldername(objects.name))[1])::uuid and g.creator_id = auth.uid()));

create policy squad_icons_delete_owner on storage.objects for delete to authenticated using (
  bucket_id = 'squad-icons' and exists (select 1 from squads s where s.id = ((storage.foldername(objects.name))[1])::uuid
    and (s.squad_owner_id = auth.uid() or exists (select 1 from squad_members sm where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type))));
create policy squad_icons_insert_owner on storage.objects for insert to authenticated with check (
  bucket_id = 'squad-icons' and exists (select 1 from squads s where s.id = ((storage.foldername(objects.name))[1])::uuid
    and (s.squad_owner_id = auth.uid() or exists (select 1 from squad_members sm where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type))));
create policy squad_icons_public_read on storage.objects for select to public using (bucket_id = 'squad-icons');
create policy squad_icons_update_owner on storage.objects for update to authenticated using (
  bucket_id = 'squad-icons' and exists (select 1 from squads s where s.id = ((storage.foldername(objects.name))[1])::uuid
    and (s.squad_owner_id = auth.uid() or exists (select 1 from squad_members sm where sm.squad_id = s.id and sm.user_id = auth.uid() and sm.role = 'host'::squad_role_type and sm.status = 'ACTIVE'::squad_member_status_type))));

create policy venue_images_delete_admin on storage.objects for delete to public using (bucket_id = 'venue-images' and is_venue_admin(((storage.foldername(name))[1])::uuid));
create policy venue_images_insert_admin on storage.objects for insert to public with check (bucket_id = 'venue-images' and is_venue_admin(((storage.foldername(name))[1])::uuid));
create policy venue_images_public_read on storage.objects for select to public using (bucket_id = 'venue-images');
create policy venue_images_update_admin on storage.objects for update to public
  using (bucket_id = 'venue-images' and is_venue_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'venue-images' and is_venue_admin(((storage.foldername(name))[1])::uuid));


-- ============================================================================
-- 13. PG_CRON SCHEDULED JOBS
-- Only 1 active job — the 4 message/comment-deletion jobs that used to
-- exist here (delete-old-game-messages, delete-old-squad-messages,
-- delete-old-community-comments, delete-old-team-messages, all */15 min)
-- were UNSCHEDULED via migration remove_automatic_deletion and are
-- intentionally NOT recreated below.
-- ============================================================================
select cron.schedule('expire-past-games', '*/10 * * * *', 'select public.expire_past_games();');


-- ============================================================================
-- 14. REALTIME PUBLICATION MEMBERSHIP
-- ============================================================================
alter publication supabase_realtime add table public.cricket_balls;
alter publication supabase_realtime add table public.cricket_innings;
alter publication supabase_realtime add table public.cricket_matches;
alter publication supabase_realtime add table public.game_messages;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.squad_members;
alter publication supabase_realtime add table public.squad_messages;
alter publication supabase_realtime add table public.squads;
alter publication supabase_realtime add table public.team_chat_reads;
alter publication supabase_realtime add table public.team_messages;
alter publication supabase_realtime add table public.tournament_matches;
alter publication supabase_realtime add table public.tournament_team_members;
alter publication supabase_realtime add table public.tournament_teams;

-- ============================================================================
-- END OF BACKUP
-- ============================================================================
