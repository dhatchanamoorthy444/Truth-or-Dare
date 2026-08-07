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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      parties: {
        Row: {
          blue_score: number
          code: string
          created_at: string
          current_challenge: Json | null
          current_turn: string | null
          host_id: string
          host_seen_at: string
          id: string
          max_players: number
          mode: string
          mystery: Json | null
          name: string
          phase: string
          preset: string
          recap: Json | null
          red_score: number
          round: number
          settings: Json
          spin: Json | null
          status: string
          team_mode: boolean
          theme: string
          transfer_used: boolean
          turn_ends_at: string | null
          updated_at: string
          used_ids: string[]
          verdicts: Json
          victim_id: string | null
          visibility: string
        }
        Insert: {
          blue_score?: number
          code: string
          created_at?: string
          current_challenge?: Json | null
          current_turn?: string | null
          host_id: string
          host_seen_at?: string
          id?: string
          max_players?: number
          mode?: string
          mystery?: Json | null
          name?: string
          phase?: string
          preset?: string
          recap?: Json | null
          red_score?: number
          round?: number
          settings?: Json
          spin?: Json | null
          status?: string
          team_mode?: boolean
          theme?: string
          transfer_used?: boolean
          turn_ends_at?: string | null
          updated_at?: string
          used_ids?: string[]
          verdicts?: Json
          victim_id?: string | null
          visibility?: string
        }
        Update: {
          blue_score?: number
          code?: string
          created_at?: string
          current_challenge?: Json | null
          current_turn?: string | null
          host_id?: string
          host_seen_at?: string
          id?: string
          max_players?: number
          mode?: string
          mystery?: Json | null
          name?: string
          phase?: string
          preset?: string
          recap?: Json | null
          red_score?: number
          round?: number
          settings?: Json
          spin?: Json | null
          status?: string
          team_mode?: boolean
          theme?: string
          transfer_used?: boolean
          turn_ends_at?: string | null
          updated_at?: string
          used_ids?: string[]
          verdicts?: Json
          victim_id?: string | null
          visibility?: string
        }
        Relationships: []
      }
      party_bans: {
        Row: {
          created_at: string
          id: string
          party_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          party_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_bans_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_imposters: {
        Row: {
          created_at: string
          imposter_id: string | null
          party_id: string
          round: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          imposter_id?: string | null
          party_id: string
          round?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          imposter_id?: string | null
          party_id?: string
          round?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_imposters_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_members: {
        Row: {
          dares: number
          id: string
          joined_at: string
          mission: string | null
          mission_done: boolean
          party_id: string
          ready: boolean
          score: number
          skips_left: number
          spectator: boolean
          team: string
          truths: number
          user_id: string
          votes: number
        }
        Insert: {
          dares?: number
          id?: string
          joined_at?: string
          mission?: string | null
          mission_done?: boolean
          party_id: string
          ready?: boolean
          score?: number
          skips_left?: number
          spectator?: boolean
          team?: string
          truths?: number
          user_id: string
          votes?: number
        }
        Update: {
          dares?: number
          id?: string
          joined_at?: string
          mission?: string | null
          mission_done?: boolean
          party_id?: string
          ready?: boolean
          score?: number
          skips_left?: number
          spectator?: boolean
          team?: string
          truths?: number
          user_id?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          party_id: string
          pinned: boolean
          reactions: Json
          reply_to: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          party_id: string
          pinned?: boolean
          reactions?: Json
          reply_to?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          party_id?: string
          pinned?: boolean
          reactions?: Json
          reply_to?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_messages_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "party_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string
          badges: string[]
          coins: number
          country: string
          created_at: string
          frame: string
          id: string
          level: number
          losses: number
          name_color: string
          player_code: string
          rank_points: number
          title: string
          updated_at: string
          username: string
          wins: number
          xp: number
        }
        Insert: {
          avatar?: string
          badges?: string[]
          coins?: number
          country?: string
          created_at?: string
          frame?: string
          id: string
          level?: number
          losses?: number
          name_color?: string
          player_code: string
          rank_points?: number
          title?: string
          updated_at?: string
          username: string
          wins?: number
          xp?: number
        }
        Update: {
          avatar?: string
          badges?: string[]
          coins?: number
          country?: string
          created_at?: string
          frame?: string
          id?: string
          level?: number
          losses?: number
          name_color?: string
          player_code?: string
          rank_points?: number
          title?: string
          updated_at?: string
          username?: string
          wins?: number
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      am_i_imposter: { Args: { _party: string }; Returns: boolean }
      can_use_party_topic: { Args: { _topic: string }; Returns: boolean }
      claim_host: { Args: { _party: string }; Returns: boolean }
      is_party_host: {
        Args: { _party: string; _user: string }
        Returns: boolean
      }
      is_party_member: {
        Args: { _party: string; _user: string }
        Returns: boolean
      }
      join_party: {
        Args: { _code: string; _spectator?: boolean }
        Returns: {
          blue_score: number
          code: string
          created_at: string
          current_challenge: Json | null
          current_turn: string | null
          host_id: string
          host_seen_at: string
          id: string
          max_players: number
          mode: string
          mystery: Json | null
          name: string
          phase: string
          preset: string
          recap: Json | null
          red_score: number
          round: number
          settings: Json
          spin: Json | null
          status: string
          team_mode: boolean
          theme: string
          transfer_used: boolean
          turn_ends_at: string | null
          updated_at: string
          used_ids: string[]
          verdicts: Json
          victim_id: string | null
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "parties"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pin_message: {
        Args: { _message: string; _party: string; _pinned: boolean }
        Returns: boolean
      }
      react_to_message: {
        Args: { _emoji: string; _message: string }
        Returns: boolean
      }
      set_imposter: {
        Args: { _party: string; _round?: number; _user: string }
        Returns: boolean
      }
      shares_party: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
