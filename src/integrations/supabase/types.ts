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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_events: {
        Row: {
          created_at: string
          detail: Json | null
          device_id: string | null
          id: number
          kind: string
          platform: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          device_id?: string | null
          id?: never
          kind: string
          platform?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          device_id?: string | null
          id?: never
          kind?: string
          platform?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee: string
          created_at: string
          id: string
          requester: string
          status: string
        }
        Insert: {
          addressee: string
          created_at?: string
          id?: string
          requester: string
          status?: string
        }
        Update: {
          addressee?: string
          created_at?: string
          id?: string
          requester?: string
          status?: string
        }
        Relationships: []
      }
      match_invites: {
        Row: {
          created_at: string
          from_user: string
          id: string
          match_id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          match_id: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          match_id?: string
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_invites_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          avatar: string
          color: number
          country: string
          display_name: string
          joined_at: string
          last_seen: string
          left_at: string | null
          match_id: string
          seat: number
          user_id: string
        }
        Insert: {
          avatar?: string
          color: number
          country?: string
          display_name: string
          joined_at?: string
          last_seen?: string
          left_at?: string | null
          match_id: string
          seat: number
          user_id: string
        }
        Update: {
          avatar?: string
          color?: number
          country?: string
          display_name?: string
          joined_at?: string
          last_seen?: string
          left_at?: string | null
          match_id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          code: string
          created_at: string
          finished_at: string | null
          host_id: string
          id: string
          is_private: boolean
          max_players: number
          state: Json | null
          status: string
          turn_started_at: string | null
          updated_at: string
          variant: string
          verified: boolean
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          finished_at?: string | null
          host_id: string
          id?: string
          is_private?: boolean
          max_players?: number
          state?: Json | null
          status?: string
          turn_started_at?: string | null
          updated_at?: string
          variant?: string
          verified?: boolean
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          finished_at?: string | null
          host_id?: string
          id?: string
          is_private?: boolean
          max_players?: number
          state?: Json | null
          status?: string
          turn_started_at?: string | null
          updated_at?: string
          variant?: string
          verified?: boolean
          version?: number
        }
        Relationships: []
      }
      player_stats: {
        Row: {
          captures: number
          forfeits: number
          pieces_home: number
          played: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          captures?: number
          forfeits?: number
          pieces_home?: number
          played?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          captures?: number
          forfeits?: number
          pieces_home?: number
          played?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string
          avatar_image: string | null
          country: string
          created_at: string
          display_name: string
          friend_code: string
          id: string
          last_seen: string
        }
        Insert: {
          avatar?: string
          avatar_image?: string | null
          country?: string
          created_at?: string
          display_name?: string
          friend_code?: string
          id: string
          last_seen?: string
        }
        Update: {
          avatar?: string
          avatar_image?: string | null
          country?: string
          created_at?: string
          display_name?: string
          friend_code?: string
          id?: string
          last_seen?: string
        }
        Relationships: []
      }
      push_sent: {
        Row: {
          created_at: string
          key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          key: string
          user_id: string
        }
        Update: {
          created_at?: string
          key?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          environment: string
          locale: string
          nudges: boolean
          platform: string
          reminders: boolean
          token: string
          turns: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment?: string
          locale?: string
          nudges?: boolean
          platform?: string
          reminders?: boolean
          token: string
          turns?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          locale?: string
          nudges?: boolean
          platform?: string
          reminders?: boolean
          token?: string
          turns?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_search_locks: {
        Row: {
          locked_at: string
          user_id: string
        }
        Insert: {
          locked_at?: string
          user_id: string
        }
        Update: {
          locked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start?: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_player_stats: {
        Args: {
          _captures: number
          _forfeits: number
          _pieces_home: number
          _played: number
          _uid: string
          _wins: number
        }
        Returns: undefined
      }
      cleanup_stale_matches: { Args: never; Returns: Json }
      commit_match: {
        Args: {
          _deltas: Json
          _finished: boolean
          _id: string
          _state: Json
          _verified: boolean
          _version: number
        }
        Returns: boolean
      }
      get_my_ranks: { Args: never; Returns: Json }
      get_top_countries: {
        Args: { _limit?: number }
        Returns: {
          country: string
          games: number
          players: number
        }[]
      }
      get_weekly_most_active: {
        Args: { _limit?: number }
        Returns: {
          avatar: string
          country: string
          display_name: string
          games: number
          games_24h: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_match_member: {
        Args: { _match: string; _user: string }
        Returns: boolean
      }
      rate_hit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      rate_peek: {
        Args: { _key: string; _window_seconds: number }
        Returns: number
      }
      scrub_player: { Args: { _uid: string }; Returns: undefined }
      start_match: {
        Args: {
          _id: string
          _state: Json
          _user_ids: string[]
          _version: number
        }
        Returns: string
      }
      weekly_reminder_targets: {
        Args: { _limit?: number }
        Returns: {
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
