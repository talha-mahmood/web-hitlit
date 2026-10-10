export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      badminton_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          first_serving_team: string
          games_to_win: number
          id: string
          play_mode: string
          points_to_win: number
          result_summary: string | null
          scoring_code: string | null
          status: string
          team_a_name: string
          team_a_players: string[]
          team_a_server_index: number
          team_b_name: string
          team_b_players: string[]
          team_b_server_index: number
          user_id: string
          venue: string | null
          winner_team: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_serving_team: string
          games_to_win?: number
          id?: string
          play_mode: string
          points_to_win?: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          team_a_name: string
          team_a_players?: string[]
          team_a_server_index?: number
          team_b_name: string
          team_b_players?: string[]
          team_b_server_index?: number
          user_id: string
          venue?: string | null
          winner_team?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_serving_team?: string
          games_to_win?: number
          id?: string
          play_mode?: string
          points_to_win?: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          team_a_name?: string
          team_a_players?: string[]
          team_a_server_index?: number
          team_b_name?: string
          team_b_players?: string[]
          team_b_server_index?: number
          user_id?: string
          venue?: string | null
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badminton_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badminton_rallies: {
        Row: {
          created_at: string
          id: string
          match_id: string
          seq: number
          winner: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          seq: number
          winner: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          seq?: number
          winner?: string
        }
        Relationships: [
          {
            foreignKeyName: "badminton_rallies_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "badminton_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_holds: {
        Row: {
          court_id: string
          created_at: string
          end_time: string
          expires_at: string
          id: string
          start_time: string
          user_id: string
        }
        Insert: {
          court_id: string
          created_at?: string
          end_time: string
          expires_at: string
          id?: string
          start_time: string
          user_id: string
        }
        Update: {
          court_id?: string
          created_at?: string
          end_time?: string
          expires_at?: string
          id?: string
          start_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_holds_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          checked_in_at: string | null
          court_id: string
          created_at: string
          deleted_at: string | null
          end_time: string
          game_id: string | null
          id: string
          payment_status: Database["public"]["Enums"]["booking_payment_status_type"]
          start_time: string
          status: Database["public"]["Enums"]["booking_status_type"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          court_id: string
          created_at?: string
          deleted_at?: string | null
          end_time: string
          game_id?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["booking_payment_status_type"]
          start_time: string
          status?: Database["public"]["Enums"]["booking_status_type"]
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          court_id?: string
          created_at?: string
          deleted_at?: string | null
          end_time?: string
          game_id?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["booking_payment_status_type"]
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status_type"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: Json
          parent_id: string | null
          root_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: Json
          parent_id?: string | null
          root_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: Json
          parent_id?: string | null
          root_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          context_id: string
          created_at: string
          id: string
          message_snapshot: string
          reason: string
          reported_user_id: string
          reporter_id: string
          source: string
          source_id: string
        }
        Insert: {
          context_id: string
          created_at?: string
          id?: string
          message_snapshot: string
          reason: string
          reported_user_id: string
          reporter_id: string
          source: string
          source_id: string
        }
        Update: {
          context_id?: string
          created_at?: string
          id?: string
          message_snapshot?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          source?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      court: {
        Row: {
          amenities: string[]
          capacity: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          isactive: boolean
          location: string | null
          name: string
          price_per_hour: number
          sports_id: string
          surface_type: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          amenities?: string[]
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          isactive?: boolean
          location?: string | null
          name: string
          price_per_hour?: number
          sports_id: string
          surface_type?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          amenities?: string[]
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          isactive?: boolean
          location?: string | null
          name?: string
          price_per_hour?: number
          sports_id?: string
          surface_type?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_sports_id_fkey"
            columns: ["sports_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      court_images: {
        Row: {
          court_id: string
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          image_url: string
          updated_at: string
        }
        Insert: {
          court_id: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          image_url: string
          updated_at?: string
        }
        Update: {
          court_id?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          image_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_images_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id"]
          },
        ]
      }
      court_price_rules: {
        Row: {
          court_id: string
          created_at: string
          end_time: string
          id: string
          price_per_hour: number
          start_time: string
        }
        Insert: {
          court_id: string
          created_at?: string
          end_time: string
          id?: string
          price_per_hour: number
          start_time: string
        }
        Update: {
          court_id?: string
          created_at?: string
          end_time?: string
          id?: string
          price_per_hour?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_price_rules_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id"]
          },
        ]
      }
      cricket_balls: {
        Row: {
          bowler_name: string
          created_at: string
          dismissed_name: string | null
          extra_runs: number
          extra_type: string | null
          fielder_name: string | null
          id: string
          innings_id: string
          is_wicket: boolean
          non_striker_name: string
          runs_batted: number
          seq: number
          striker_name: string
          wicket_type: string | null
        }
        Insert: {
          bowler_name: string
          created_at?: string
          dismissed_name?: string | null
          extra_runs?: number
          extra_type?: string | null
          fielder_name?: string | null
          id?: string
          innings_id: string
          is_wicket?: boolean
          non_striker_name: string
          runs_batted?: number
          seq: number
          striker_name: string
          wicket_type?: string | null
        }
        Update: {
          bowler_name?: string
          created_at?: string
          dismissed_name?: string | null
          extra_runs?: number
          extra_type?: string | null
          fielder_name?: string | null
          id?: string
          innings_id?: string
          is_wicket?: boolean
          non_striker_name?: string
          runs_batted?: number
          seq?: number
          striker_name?: string
          wicket_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cricket_balls_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "cricket_innings"
            referencedColumns: ["id"]
          },
        ]
      }
      cricket_innings: {
        Row: {
          batting_team: string
          id: string
          innings_number: number
          is_completed: boolean
          match_id: string
        }
        Insert: {
          batting_team: string
          id?: string
          innings_number: number
          is_completed?: boolean
          match_id: string
        }
        Update: {
          batting_team?: string
          id?: string
          innings_number?: number
          is_completed?: boolean
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cricket_innings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      cricket_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          format: string
          id: string
          overs_limit: number
          result_summary: string | null
          scoring_code: string | null
          status: string
          target_override: number | null
          team_a_name: string
          team_a_penalty_runs: number
          team_a_players: string[]
          team_b_name: string
          team_b_penalty_runs: number
          team_b_players: string[]
          toss_decision: string
          toss_winner: string
          user_id: string
          venue: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          format?: string
          id?: string
          overs_limit: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          target_override?: number | null
          team_a_name: string
          team_a_penalty_runs?: number
          team_a_players?: string[]
          team_b_name: string
          team_b_penalty_runs?: number
          team_b_players?: string[]
          toss_decision: string
          toss_winner: string
          user_id: string
          venue?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          format?: string
          id?: string
          overs_limit?: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          target_override?: number | null
          team_a_name?: string
          team_a_penalty_runs?: number
          team_a_players?: string[]
          team_b_name?: string
          team_b_penalty_runs?: number
          team_b_players?: string[]
          toss_decision?: string
          toss_winner?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cricket_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_games: {
        Row: {
          created_at: string
          game_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_games_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_venues: {
        Row: {
          created_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_venues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      football_goals: {
        Row: {
          created_at: string
          id: string
          match_id: string
          minute_label: string
          phase: string
          scorer_name: string | null
          seq: number
          team: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          minute_label: string
          phase: string
          scorer_name?: string | null
          seq: number
          team: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          minute_label?: string
          phase?: string
          scorer_name?: string | null
          seq?: number
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "football_goals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "football_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      football_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          extra_time_first_added_minutes: number | null
          extra_time_first_kickoff_at: string | null
          extra_time_period_minutes: number
          extra_time_second_added_minutes: number | null
          extra_time_second_kickoff_at: string | null
          first_half_added_minutes: number | null
          first_half_kickoff_at: string | null
          half_duration_minutes: number
          id: string
          is_draw: boolean
          paused_at: string | null
          phase: string
          requires_winner: boolean
          result_summary: string | null
          scoring_code: string | null
          second_half_added_minutes: number | null
          second_half_kickoff_at: string | null
          status: string
          team_a_name: string
          team_a_players: string[]
          team_b_name: string
          team_b_players: string[]
          user_id: string
          venue: string | null
          winner_team: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          extra_time_first_added_minutes?: number | null
          extra_time_first_kickoff_at?: string | null
          extra_time_period_minutes?: number
          extra_time_second_added_minutes?: number | null
          extra_time_second_kickoff_at?: string | null
          first_half_added_minutes?: number | null
          first_half_kickoff_at?: string | null
          half_duration_minutes?: number
          id?: string
          is_draw?: boolean
          paused_at?: string | null
          phase?: string
          requires_winner?: boolean
          result_summary?: string | null
          scoring_code?: string | null
          second_half_added_minutes?: number | null
          second_half_kickoff_at?: string | null
          status?: string
          team_a_name: string
          team_a_players?: string[]
          team_b_name: string
          team_b_players?: string[]
          user_id: string
          venue?: string | null
          winner_team?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          extra_time_first_added_minutes?: number | null
          extra_time_first_kickoff_at?: string | null
          extra_time_period_minutes?: number
          extra_time_second_added_minutes?: number | null
          extra_time_second_kickoff_at?: string | null
          first_half_added_minutes?: number | null
          first_half_kickoff_at?: string | null
          half_duration_minutes?: number
          id?: string
          is_draw?: boolean
          paused_at?: string | null
          phase?: string
          requires_winner?: boolean
          result_summary?: string | null
          scoring_code?: string | null
          second_half_added_minutes?: number | null
          second_half_kickoff_at?: string | null
          status?: string
          team_a_name?: string
          team_a_players?: string[]
          team_b_name?: string
          team_b_players?: string[]
          user_id?: string
          venue?: string | null
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "football_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      football_penalty_kicks: {
        Row: {
          created_at: string
          id: string
          match_id: string
          scored: boolean
          seq: number
          team: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          scored: boolean
          seq: number
          team: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          scored?: boolean
          seq?: number
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "football_penalty_kicks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "football_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      game_chat_reads: {
        Row: {
          game_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          game_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          game_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_chat_reads_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_history: {
        Row: {
          created_at: string
          end_time: string | null
          game_date: string
          game_id: string
          game_type: Database["public"]["Enums"]["game_type_type"] | null
          id: string
          role: string
          sport_id: string | null
          start_time: string | null
          title: string | null
          user_id: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          game_date: string
          game_id: string
          game_type?: Database["public"]["Enums"]["game_type_type"] | null
          id?: string
          role: string
          sport_id?: string | null
          start_time?: string | null
          title?: string | null
          user_id: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          game_date?: string
          game_id?: string
          game_type?: Database["public"]["Enums"]["game_type_type"] | null
          id?: string
          role?: string
          sport_id?: string | null
          start_time?: string | null
          title?: string | null
          user_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_history_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_history_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      game_invites: {
        Row: {
          created_at: string
          deleted_at: string | null
          game_id: string
          id: string
          invited_by: string
          invited_user_id: string
          status: Database["public"]["Enums"]["game_invite_status_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          game_id: string
          id?: string
          invited_by: string
          invited_user_id: string
          status?: Database["public"]["Enums"]["game_invite_status_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          game_id?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          status?: Database["public"]["Enums"]["game_invite_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_invites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          game_id: string
          id: string
          message: string
          parent_id: string | null
          root_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          game_id: string
          id?: string
          message: string
          parent_id?: string | null
          root_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          game_id?: string
          id?: string
          message?: string
          parent_id?: string | null
          root_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "game_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "game_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          created_at: string
          deleted_at: string | null
          game_id: string
          id: string
          joined_at: string | null
          location: string | null
          payment_status: Database["public"]["Enums"]["payment_status_type"]
          skill_level: Database["public"]["Enums"]["skill_level_type"] | null
          status: Database["public"]["Enums"]["game_player_status_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          game_id: string
          id?: string
          joined_at?: string | null
          location?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_type"]
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          status?: Database["public"]["Enums"]["game_player_status_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          game_id?: string
          id?: string
          joined_at?: string | null
          location?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_type"]
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          status?: Database["public"]["Enums"]["game_player_status_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_squad_invites: {
        Row: {
          created_at: string
          game_id: string
          id: string
          invited_by: string
          squad_id: string
          status: Database["public"]["Enums"]["game_invite_status_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          invited_by: string
          squad_id: string
          status?: Database["public"]["Enums"]["game_invite_status_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          invited_by?: string
          squad_id?: string
          status?: Database["public"]["Enums"]["game_invite_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_squad_invites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_squad_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_squad_invites_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          booking_id: string | null
          bring_equipment: boolean
          cost_shared: boolean
          court_id: string | null
          created_at: string
          creator_id: string
          custom_venue_name: string | null
          daily_hours: number | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          end_time: string
          entry_fee: number
          game_code: string
          game_date: string
          game_type: Database["public"]["Enums"]["game_type_type"]
          gender: Database["public"]["Enums"]["game_gender_type"]
          icon_url: string | null
          id: string
          max_players: number
          maximum_age: number | null
          min_players: number
          minimum_age: number | null
          number_of_teams: number | null
          pay_and_join: boolean
          players_per_team: number | null
          skill_level:
            | Database["public"]["Enums"]["game_skill_level_type"]
            | null
          sport_id: string
          squad_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["game_status_type"]
          title: string
          tournament_format:
            | Database["public"]["Enums"]["tournament_format_type"]
            | null
          updated_at: string
          venue_id: string | null
          visibility: Database["public"]["Enums"]["game_visibility_type"]
        }
        Insert: {
          booking_id?: string | null
          bring_equipment?: boolean
          cost_shared?: boolean
          court_id?: string | null
          created_at?: string
          creator_id: string
          custom_venue_name?: string | null
          daily_hours?: number | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time: string
          entry_fee?: number
          game_code?: string
          game_date: string
          game_type?: Database["public"]["Enums"]["game_type_type"]
          gender?: Database["public"]["Enums"]["game_gender_type"]
          icon_url?: string | null
          id?: string
          max_players: number
          maximum_age?: number | null
          min_players?: number
          minimum_age?: number | null
          number_of_teams?: number | null
          pay_and_join?: boolean
          players_per_team?: number | null
          skill_level?:
            | Database["public"]["Enums"]["game_skill_level_type"]
            | null
          sport_id: string
          squad_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["game_status_type"]
          title: string
          tournament_format?:
            | Database["public"]["Enums"]["tournament_format_type"]
            | null
          updated_at?: string
          venue_id?: string | null
          visibility?: Database["public"]["Enums"]["game_visibility_type"]
        }
        Update: {
          booking_id?: string | null
          bring_equipment?: boolean
          cost_shared?: boolean
          court_id?: string | null
          created_at?: string
          creator_id?: string
          custom_venue_name?: string | null
          daily_hours?: number | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          entry_fee?: number
          game_code?: string
          game_date?: string
          game_type?: Database["public"]["Enums"]["game_type_type"]
          gender?: Database["public"]["Enums"]["game_gender_type"]
          icon_url?: string | null
          id?: string
          max_players?: number
          maximum_age?: number | null
          min_players?: number
          minimum_age?: number | null
          number_of_teams?: number | null
          pay_and_join?: boolean
          players_per_team?: number | null
          skill_level?:
            | Database["public"]["Enums"]["game_skill_level_type"]
            | null
          sport_id?: string
          squad_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["game_status_type"]
          title?: string
          tournament_format?:
            | Database["public"]["Enums"]["tournament_format_type"]
            | null
          updated_at?: string
          venue_id?: string | null
          visibility?: Database["public"]["Enums"]["game_visibility_type"]
        }
        Relationships: [
          {
            foreignKeyName: "games_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          cricket_match_id: string | null
          football_match_id: string | null
          game_date: string | null
          game_id: string
          game_title: string | null
          id: string
          match_id: string
          recorded_at: string
          result: string
          sport_id: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          cricket_match_id?: string | null
          football_match_id?: string | null
          game_date?: string | null
          game_id: string
          game_title?: string | null
          id?: string
          match_id: string
          recorded_at?: string
          result: string
          sport_id?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          cricket_match_id?: string | null
          football_match_id?: string | null
          game_date?: string | null
          game_id?: string
          game_title?: string | null
          id?: string
          match_id?: string
          recorded_at?: string
          result?: string
          sport_id?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_cricket_match_id_fkey"
            columns: ["cricket_match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_football_match_id_fkey"
            columns: ["football_match_id"]
            isOneToOne: false
            referencedRelation: "football_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          deleted_at: string | null
          id: string
          is_read: boolean
          title: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      padel_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          deuce_type: string
          first_server_player_index: number
          first_server_team: string
          format: string
          games_per_set: number
          id: string
          play_mode: string
          result_summary: string | null
          scoring_code: string | null
          status: string
          team_a_name: string
          team_a_players: string[]
          team_b_name: string
          team_b_players: string[]
          user_id: string
          venue: string | null
          winner_team: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deuce_type: string
          first_server_player_index: number
          first_server_team: string
          format: string
          games_per_set?: number
          id?: string
          play_mode?: string
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          team_a_name: string
          team_a_players?: string[]
          team_b_name: string
          team_b_players?: string[]
          user_id: string
          venue?: string | null
          winner_team?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deuce_type?: string
          first_server_player_index?: number
          first_server_team?: string
          format?: string
          games_per_set?: number
          id?: string
          play_mode?: string
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          team_a_name?: string
          team_a_players?: string[]
          team_b_name?: string
          team_b_players?: string[]
          user_id?: string
          venue?: string | null
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "padel_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      padel_points: {
        Row: {
          created_at: string
          id: string
          match_id: string
          seq: number
          winner: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          seq: number
          winner: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          seq?: number
          winner?: string
        }
        Relationships: [
          {
            foreignKeyName: "padel_points_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "padel_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          game_id: string | null
          gateway_response: Json | null
          id: string
          paid_at: string | null
          payment_gateway: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status_type"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          game_id?: string | null
          gateway_response?: Json | null
          id?: string
          paid_at?: string | null
          payment_gateway?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          game_id?: string | null
          gateway_response?: Json | null
          id?: string
          paid_at?: string | null
          payment_gateway?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status_type"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pickleball_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          first_serving_team: string
          games_to_win: number
          id: string
          play_mode: string
          points_to_win: number
          result_summary: string | null
          scoring_code: string | null
          scoring_mode: string
          status: string
          team_a_name: string
          team_a_players: string[]
          team_b_name: string
          team_b_players: string[]
          user_id: string
          venue: string | null
          winner_team: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_serving_team: string
          games_to_win?: number
          id?: string
          play_mode: string
          points_to_win?: number
          result_summary?: string | null
          scoring_code?: string | null
          scoring_mode: string
          status?: string
          team_a_name: string
          team_a_players?: string[]
          team_b_name: string
          team_b_players?: string[]
          user_id: string
          venue?: string | null
          winner_team?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_serving_team?: string
          games_to_win?: number
          id?: string
          play_mode?: string
          points_to_win?: number
          result_summary?: string | null
          scoring_code?: string | null
          scoring_mode?: string
          status?: string
          team_a_name?: string
          team_a_players?: string[]
          team_b_name?: string
          team_b_players?: string[]
          user_id?: string
          venue?: string | null
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickleball_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pickleball_rallies: {
        Row: {
          created_at: string
          id: string
          match_id: string
          seq: number
          winner: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          seq: number
          winner: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          seq?: number
          winner?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickleball_rallies_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pickleball_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      player_follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar: string | null
          bio: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          description: string | null
          email: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          isactive: boolean
          latitude: number | null
          longitude: number | null
          phone: string | null
          skill_level: Database["public"]["Enums"]["skill_level_type"] | null
          type: Database["public"]["Enums"]["profile_type"]
          updated_at: string
          user_code: string
          visibility: string
        }
        Insert: {
          address?: string | null
          avatar?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          isactive?: boolean
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          type?: Database["public"]["Enums"]["profile_type"]
          updated_at?: string
          user_code: string
          visibility?: string
        }
        Update: {
          address?: string | null
          avatar?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          isactive?: boolean
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          type?: Database["public"]["Enums"]["profile_type"]
          updated_at?: string
          user_code?: string
          visibility?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      slots: {
        Row: {
          court_id: string
          created_at: string
          date: string
          deleted_at: string | null
          end_time: string
          id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          court_id: string
          created_at?: string
          date: string
          deleted_at?: string | null
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          court_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          is_team_sport: boolean
          max_players: number | null
          min_players: number | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          is_team_sport?: boolean
          max_players?: number | null
          min_players?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          is_team_sport?: boolean
          max_players?: number | null
          min_players?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_chat_reads: {
        Row: {
          last_read_at: string
          squad_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          squad_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_chat_reads_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_invites: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          invited_by: string
          invited_user_id: string
          squad_id: string
          status: Database["public"]["Enums"]["squad_invite_status_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_by: string
          invited_user_id: string
          squad_id: string
          status?: Database["public"]["Enums"]["squad_invite_status_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_by?: string
          invited_user_id?: string
          squad_id?: string
          status?: Database["public"]["Enums"]["squad_invite_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_invites_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          joined_at: string
          location: string | null
          role: Database["public"]["Enums"]["squad_role_type"]
          skill_level: Database["public"]["Enums"]["skill_level_type"] | null
          squad_id: string
          status: Database["public"]["Enums"]["squad_member_status_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          joined_at?: string
          location?: string | null
          role?: Database["public"]["Enums"]["squad_role_type"]
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          squad_id: string
          status?: Database["public"]["Enums"]["squad_member_status_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          joined_at?: string
          location?: string | null
          role?: Database["public"]["Enums"]["squad_role_type"]
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          squad_id?: string
          status?: Database["public"]["Enums"]["squad_member_status_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          message: string
          parent_id: string | null
          root_id: string | null
          sender_id: string
          squad_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message: string
          parent_id?: string | null
          root_id?: string | null
          sender_id: string
          squad_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string
          parent_id?: string | null
          root_id?: string | null
          sender_id?: string
          squad_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "squad_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_messages_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "squad_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_messages_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          gender: Database["public"]["Enums"]["game_gender_type"]
          group_type: string
          icon_url: string | null
          id: string
          join_requests_blocked: boolean
          location: string | null
          max_players: number | null
          min_players: number | null
          name: string
          skill_level: Database["public"]["Enums"]["skill_level_type"] | null
          sport_id: string | null
          squad_code: string
          squad_owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          gender?: Database["public"]["Enums"]["game_gender_type"]
          group_type?: string
          icon_url?: string | null
          id?: string
          join_requests_blocked?: boolean
          location?: string | null
          max_players?: number | null
          min_players?: number | null
          name: string
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          sport_id?: string | null
          squad_code?: string
          squad_owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          gender?: Database["public"]["Enums"]["game_gender_type"]
          group_type?: string
          icon_url?: string | null
          id?: string
          join_requests_blocked?: boolean
          location?: string | null
          max_players?: number | null
          min_players?: number | null
          name?: string
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          sport_id?: string | null
          squad_code?: string
          squad_owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_squad_owner_id_fkey"
            columns: ["squad_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      table_tennis_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          first_server_index: number
          first_serving_team: string
          games_to_win: number
          id: string
          play_mode: string
          points_to_win: number
          result_summary: string | null
          scoring_code: string | null
          status: string
          team_a_name: string
          team_a_players: string[]
          team_b_name: string
          team_b_players: string[]
          user_id: string
          venue: string | null
          winner_team: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_server_index?: number
          first_serving_team: string
          games_to_win?: number
          id?: string
          play_mode: string
          points_to_win?: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          team_a_name: string
          team_a_players?: string[]
          team_b_name: string
          team_b_players?: string[]
          user_id: string
          venue?: string | null
          winner_team?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_server_index?: number
          first_serving_team?: string
          games_to_win?: number
          id?: string
          play_mode?: string
          points_to_win?: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          team_a_name?: string
          team_a_players?: string[]
          team_b_name?: string
          team_b_players?: string[]
          user_id?: string
          venue?: string | null
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_tennis_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      table_tennis_rallies: {
        Row: {
          created_at: string
          id: string
          match_id: string
          seq: number
          winner: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          seq: number
          winner: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          seq?: number
          winner?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_tennis_rallies_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "table_tennis_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_reads: {
        Row: {
          last_read_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_reads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          message: string
          parent_id: string | null
          root_id: string | null
          sender_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message: string
          parent_id?: string | null
          root_id?: string | null
          sender_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string
          parent_id?: string | null
          root_id?: string | null
          sender_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tennis_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          first_server: string
          format: string
          games_per_set: number
          id: string
          play_mode: string
          player_a_name: string
          player_a_players: string[]
          player_a_server_index: number
          player_b_name: string
          player_b_players: string[]
          player_b_server_index: number
          result_summary: string | null
          scoring_code: string | null
          status: string
          user_id: string
          venue: string | null
          winner_player: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_server: string
          format: string
          games_per_set?: number
          id?: string
          play_mode?: string
          player_a_name: string
          player_a_players?: string[]
          player_a_server_index?: number
          player_b_name: string
          player_b_players?: string[]
          player_b_server_index?: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          user_id: string
          venue?: string | null
          winner_player?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_server?: string
          format?: string
          games_per_set?: number
          id?: string
          play_mode?: string
          player_a_name?: string
          player_a_players?: string[]
          player_a_server_index?: number
          player_b_name?: string
          player_b_players?: string[]
          player_b_server_index?: number
          result_summary?: string | null
          scoring_code?: string | null
          status?: string
          user_id?: string
          venue?: string | null
          winner_player?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tennis_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tennis_points: {
        Row: {
          created_at: string
          id: string
          match_id: string
          seq: number
          winner: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          seq: number
          winner: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          seq?: number
          winner?: string
        }
        Relationships: [
          {
            foreignKeyName: "tennis_points_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tennis_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          badminton_match_id: string | null
          created_at: string
          cricket_match_id: string | null
          football_match_id: string | null
          game_id: string
          id: string
          is_draw: boolean
          manual_score: Json | null
          padel_match_id: string | null
          pickleball_match_id: string | null
          played_at: string | null
          pool_id: string | null
          round: number
          scorer_user_id: string | null
          sort_order: number
          status: string
          table_tennis_match_id: string | null
          team_a_id: string | null
          team_b_id: string | null
          tennis_match_id: string | null
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          badminton_match_id?: string | null
          created_at?: string
          cricket_match_id?: string | null
          football_match_id?: string | null
          game_id: string
          id?: string
          is_draw?: boolean
          manual_score?: Json | null
          padel_match_id?: string | null
          pickleball_match_id?: string | null
          played_at?: string | null
          pool_id?: string | null
          round?: number
          scorer_user_id?: string | null
          sort_order?: number
          status?: string
          table_tennis_match_id?: string | null
          team_a_id?: string | null
          team_b_id?: string | null
          tennis_match_id?: string | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          badminton_match_id?: string | null
          created_at?: string
          cricket_match_id?: string | null
          football_match_id?: string | null
          game_id?: string
          id?: string
          is_draw?: boolean
          manual_score?: Json | null
          padel_match_id?: string | null
          pickleball_match_id?: string | null
          played_at?: string | null
          pool_id?: string | null
          round?: number
          scorer_user_id?: string | null
          sort_order?: number
          status?: string
          table_tennis_match_id?: string | null
          team_a_id?: string | null
          team_b_id?: string | null
          tennis_match_id?: string | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_badminton_match_id_fkey"
            columns: ["badminton_match_id"]
            isOneToOne: false
            referencedRelation: "badminton_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_cricket_match_id_fkey"
            columns: ["cricket_match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_football_match_id_fkey"
            columns: ["football_match_id"]
            isOneToOne: false
            referencedRelation: "football_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_padel_match_id_fkey"
            columns: ["padel_match_id"]
            isOneToOne: false
            referencedRelation: "padel_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_pickleball_match_id_fkey"
            columns: ["pickleball_match_id"]
            isOneToOne: false
            referencedRelation: "pickleball_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "tournament_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_scorer_user_id_fkey"
            columns: ["scorer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_table_tennis_match_id_fkey"
            columns: ["table_tennis_match_id"]
            isOneToOne: false
            referencedRelation: "table_tennis_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tennis_match_id_fkey"
            columns: ["tennis_match_id"]
            isOneToOne: false
            referencedRelation: "tennis_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_pools: {
        Row: {
          created_at: string
          game_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_pools_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_team_invites: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          invited_by: string
          invited_user_id: string
          status: Database["public"]["Enums"]["tournament_team_invite_status_type"]
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_by: string
          invited_user_id: string
          status?: Database["public"]["Enums"]["tournament_team_invite_status_type"]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_by?: string
          invited_user_id?: string
          status?: Database["public"]["Enums"]["tournament_team_invite_status_type"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_team_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_team_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          joined_at: string | null
          location: string | null
          skill_level: Database["public"]["Enums"]["skill_level_type"] | null
          status: Database["public"]["Enums"]["game_player_status_type"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          location?: string | null
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          status?: Database["public"]["Enums"]["game_player_status_type"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          location?: string | null
          skill_level?: Database["public"]["Enums"]["skill_level_type"] | null
          status?: Database["public"]["Enums"]["game_player_status_type"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_teams: {
        Row: {
          captain_id: string | null
          created_at: string
          deleted_at: string | null
          filled_by_squad_id: string | null
          game_id: string
          id: string
          name: string
          pool_id: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["tournament_team_status_type"]
          team_code: string | null
          updated_at: string
        }
        Insert: {
          captain_id?: string | null
          created_at?: string
          deleted_at?: string | null
          filled_by_squad_id?: string | null
          game_id: string
          id?: string
          name: string
          pool_id?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["tournament_team_status_type"]
          team_code?: string | null
          updated_at?: string
        }
        Update: {
          captain_id?: string | null
          created_at?: string
          deleted_at?: string | null
          filled_by_squad_id?: string | null
          game_id?: string
          id?: string
          name?: string
          pool_id?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["tournament_team_status_type"]
          team_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_filled_by_squad_id_fkey"
            columns: ["filled_by_squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "tournament_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_admins: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_admins_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_admins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_facilities: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          type: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          type?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_facilities_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_images: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          image_url: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          image_url: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          image_url?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_images_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_reviews: {
        Row: {
          booking_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          owner_response: string | null
          owner_response_at: string | null
          rating: number
          review: string | null
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          owner_response?: string | null
          owner_response_at?: string | null
          rating: number
          review?: string | null
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          owner_response?: string | null
          owner_response_at?: string | null
          rating?: number
          review?: string | null
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          boosted_until: string | null
          city: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_time: string | null
          id: string
          images: string[]
          isactive: boolean
          latitude: number | null
          longitude: number | null
          maps_link: string | null
          name: string
          rating: number
          rules_and_policies: string | null
          start_time: string | null
          updated_at: string
          venue_owner_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          boosted_until?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          images?: string[]
          isactive?: boolean
          latitude?: number | null
          longitude?: number | null
          maps_link?: string | null
          name: string
          rating?: number
          rules_and_policies?: string | null
          start_time?: string | null
          updated_at?: string
          venue_owner_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          boosted_until?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          images?: string[]
          isactive?: boolean
          latitude?: number | null
          longitude?: number | null
          maps_link?: string | null
          name?: string
          rating?: number
          rules_and_policies?: string | null
          start_time?: string | null
          updated_at?: string
          venue_owner_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_venue_owner_id_fkey"
            columns: ["venue_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_game_invite: { Args: { p_invite_id: string }; Returns: undefined }
      accept_squad_invite: { Args: { p_invite_id: string }; Returns: undefined }
      accept_team_invite: { Args: { p_invite_id: string }; Returns: undefined }
      create_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      decline_game_invite: { Args: { p_invite_id: string }; Returns: undefined }
      decline_squad_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      decline_team_invite: { Args: { p_invite_id: string }; Returns: undefined }
      delete_old_community_comments: { Args: never; Returns: undefined }
      delete_old_game_messages: { Args: never; Returns: undefined }
      delete_old_squad_messages: { Args: never; Returns: undefined }
      delete_old_team_messages: { Args: never; Returns: undefined }
      delete_own_account: { Args: never; Returns: undefined }
      delete_own_chat_message: {
        Args: { p_message_id: string; p_table: string }
        Returns: undefined
      }
      expire_past_games: { Args: never; Returns: undefined }
      generate_game_code: { Args: never; Returns: string }
      generate_squad_code: { Args: never; Returns: string }
      generate_team_code: { Args: never; Returns: string }
      generate_user_code: { Args: never; Returns: string }
      get_booked_slots: {
        Args: { p_court_id: string; p_date: string }
        Returns: {
          end_time: string
          start_time: string
        }[]
      }
      get_follower_counts: {
        Args: { p_user_ids: string[] }
        Returns: {
          follower_count: number
          user_id: string
        }[]
      }
      get_player_extra_stats: {
        Args: { p_sport_id?: string; p_user_id: string }
        Returns: {
          active_squads: number
          regular_games_played: number
        }[]
      }
      get_player_public_stats: {
        Args: { p_sport_id?: string; p_user_id: string }
        Returns: {
          computed_skill_level: Database["public"]["Enums"]["skill_level_type"]
          games_hosted: number
          games_played: number
          hours_played: number
          matches_played: number
          matches_won: number
          sport_breakdown: Json
          total_goals: number
          total_runs: number
          total_wickets: number
          tournaments_played: number
        }[]
      }
      get_top_players: {
        Args: { p_limit?: number; p_sport_id?: string }
        Returns: {
          avatar: string
          city: string
          full_name: string
          games_hosted: number
          games_played: number
          hours_played: number
          matches_played: number
          matches_won: number
          skill_level: Database["public"]["Enums"]["skill_level_type"]
          tournaments_played: number
          user_id: string
        }[]
      }
      grant_venue_admin: {
        Args: { target_user_id: string; target_venue_id: string }
        Returns: undefined
      }
      is_superadmin: { Args: never; Returns: boolean }
      is_venue_admin: { Args: { target_venue_id: string }; Returns: boolean }
      is_venue_owner: { Args: { target_venue_id: string }; Returns: boolean }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      reject_pending_team: { Args: { p_team_id: string }; Returns: undefined }
      respond_to_venue_review: {
        Args: { response_text: string; target_review_id: string }
        Returns: undefined
      }
      revoke_venue_admin: {
        Args: { target_user_id: string; target_venue_id: string }
        Returns: undefined
      }
      squad_fill_game_slots: {
        Args: {
          p_game_id: string
          p_member_user_ids: string[]
          p_squad_id: string
        }
        Returns: undefined
      }
      squad_fill_tournament_team:
        | {
            Args: {
              p_member_user_ids: string[]
              p_squad_id: string
              p_team_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_member_user_ids: string[]
              p_squad_id: string
              p_team_id: string
              p_team_name?: string
            }
            Returns: undefined
          }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      booking_payment_status_type: "paid" | "unpaid"
      booking_status_type:
        | "PENDING"
        | "CONFIRMED"
        | "CANCELLED"
        | "EXPIRED"
        | "COMPLETED"
        | "BLOCKED"
      game_gender_type: "male" | "female" | "mixed"
      game_invite_status_type: "pending" | "accepted" | "declined"
      game_player_status_type:
        | "PENDING"
        | "JOINED"
        | "DECLINED"
        | "REMOVED"
        | "LEFT"
      game_skill_level_type: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PRO"
      game_status_type: "OPEN" | "FULL" | "ONGOING" | "COMPLETED" | "CANCELLED"
      game_type_type: "REGULAR" | "COACHING" | "TOURNAMENT"
      game_visibility_type: "public" | "private" | "squad_only"
      gender_type: "male" | "female" | "other"
      payment_status_type: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED"
      profile_type: "owner" | "user" | "superadmin"
      skill_level_type: "beginner" | "intermediate" | "expert"
      squad_invite_status_type: "pending" | "accepted" | "declined"
      squad_member_status_type:
        | "ACTIVE"
        | "LEFT"
        | "REMOVED"
        | "PENDING"
        | "DECLINED"
      squad_role_type: "captain" | "member" | "host"
      tournament_format_type: "KNOCKOUT" | "LEAGUE" | "POOL"
      tournament_team_invite_status_type: "pending" | "accepted" | "declined"
      tournament_team_status_type:
        | "FORMING"
        | "PENDING_HOST_APPROVAL"
        | "APPROVED"
        | "REJECTED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_payment_status_type: ["paid", "unpaid"],
      booking_status_type: [
        "PENDING",
        "CONFIRMED",
        "CANCELLED",
        "EXPIRED",
        "COMPLETED",
        "BLOCKED",
      ],
      game_gender_type: ["male", "female", "mixed"],
      game_invite_status_type: ["pending", "accepted", "declined"],
      game_player_status_type: [
        "PENDING",
        "JOINED",
        "DECLINED",
        "REMOVED",
        "LEFT",
      ],
      game_skill_level_type: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"],
      game_status_type: ["OPEN", "FULL", "ONGOING", "COMPLETED", "CANCELLED"],
      game_type_type: ["REGULAR", "COACHING", "TOURNAMENT"],
      game_visibility_type: ["public", "private", "squad_only"],
      gender_type: ["male", "female", "other"],
      payment_status_type: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
      profile_type: ["owner", "user", "superadmin"],
      skill_level_type: ["beginner", "intermediate", "expert"],
      squad_invite_status_type: ["pending", "accepted", "declined"],
      squad_member_status_type: [
        "ACTIVE",
        "LEFT",
        "REMOVED",
        "PENDING",
        "DECLINED",
      ],
      squad_role_type: ["captain", "member", "host"],
      tournament_format_type: ["KNOCKOUT", "LEAGUE", "POOL"],
      tournament_team_invite_status_type: ["pending", "accepted", "declined"],
      tournament_team_status_type: [
        "FORMING",
        "PENDING_HOST_APPROVAL",
        "APPROVED",
        "REJECTED",
      ],
    },
  },
} as const

