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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_date: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          count: number
          created_at: string
          id: string
          notes: string | null
          rep_id: string
          updated_at: string
        }
        Insert: {
          activity_date?: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          count?: number
          created_at?: string
          id?: string
          notes?: string | null
          rep_id: string
          updated_at?: string
        }
        Update: {
          activity_date?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          count?: number
          created_at?: string
          id?: string
          notes?: string | null
          rep_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_call_analysis: {
        Row: {
          call_effectiveness_score: number | null
          call_id: string
          call_summary: string
          confidence: number | null
          created_at: string
          deal_advancement_score: number | null
          deal_gaps: Json | null
          deal_tags: string[] | null
          discovery_score: number | null
          id: string
          meta_tags: string[] | null
          model_name: string
          objection_handling_score: number | null
          opportunities: Json | null
          product_knowledge_score: number | null
          prompt_version: string
          rapport_communication_score: number | null
          raw_json: Json | null
          rep_id: string
          skill_tags: string[] | null
          strengths: Json | null
          trend_indicators: Json | null
        }
        Insert: {
          call_effectiveness_score?: number | null
          call_id: string
          call_summary: string
          confidence?: number | null
          created_at?: string
          deal_advancement_score?: number | null
          deal_gaps?: Json | null
          deal_tags?: string[] | null
          discovery_score?: number | null
          id?: string
          meta_tags?: string[] | null
          model_name: string
          objection_handling_score?: number | null
          opportunities?: Json | null
          product_knowledge_score?: number | null
          prompt_version?: string
          rapport_communication_score?: number | null
          raw_json?: Json | null
          rep_id: string
          skill_tags?: string[] | null
          strengths?: Json | null
          trend_indicators?: Json | null
        }
        Update: {
          call_effectiveness_score?: number | null
          call_id?: string
          call_summary?: string
          confidence?: number | null
          created_at?: string
          deal_advancement_score?: number | null
          deal_gaps?: Json | null
          deal_tags?: string[] | null
          discovery_score?: number | null
          id?: string
          meta_tags?: string[] | null
          model_name?: string
          objection_handling_score?: number | null
          opportunities?: Json | null
          product_knowledge_score?: number | null
          prompt_version?: string
          rapport_communication_score?: number | null
          raw_json?: Json | null
          rep_id?: string
          skill_tags?: string[] | null
          strengths?: Json | null
          trend_indicators?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_analysis_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_analysis_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_analysis_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          analysis_error: string | null
          analysis_status: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version: string
          call_date: string
          created_at: string
          id: string
          manager_id: string | null
          notes: string | null
          raw_text: string
          rep_id: string
          source: Database["public"]["Enums"]["call_source_type"]
          updated_at: string
        }
        Insert: {
          analysis_error?: string | null
          analysis_status?: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version?: string
          call_date?: string
          created_at?: string
          id?: string
          manager_id?: string | null
          notes?: string | null
          raw_text: string
          rep_id: string
          source?: Database["public"]["Enums"]["call_source_type"]
          updated_at?: string
        }
        Update: {
          analysis_error?: string | null
          analysis_status?: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version?: string
          call_date?: string
          created_at?: string
          id?: string
          manager_id?: string | null
          notes?: string | null
          raw_text?: string
          rep_id?: string
          source?: Database["public"]["Enums"]["call_source_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_sessions: {
        Row: {
          action_items: string | null
          created_at: string
          focus_area: string
          follow_up_date: string | null
          id: string
          manager_id: string
          notes: string | null
          rep_id: string
          session_date: string
          updated_at: string
        }
        Insert: {
          action_items?: string | null
          created_at?: string
          focus_area: string
          follow_up_date?: string | null
          id?: string
          manager_id: string
          notes?: string | null
          rep_id: string
          session_date?: string
          updated_at?: string
        }
        Update: {
          action_items?: string | null
          created_at?: string
          focus_area?: string
          follow_up_date?: string | null
          id?: string
          manager_id?: string
          notes?: string | null
          rep_id?: string
          session_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          hire_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          hire_date?: string | null
          id: string
          is_active?: boolean
          name: string
          notes?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_performance_snapshots: {
        Row: {
          created_at: string
          demo_goal: number
          demos_set: number
          id: string
          period_month: number
          period_type: string
          period_year: number
          pipeline_count: number | null
          rep_id: string
          revenue_closed: number
          revenue_goal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          demo_goal?: number
          demos_set?: number
          id?: string
          period_month: number
          period_type?: string
          period_year: number
          pipeline_count?: number | null
          rep_id: string
          revenue_closed?: number
          revenue_goal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          demo_goal?: number
          demos_set?: number
          id?: string
          period_month?: number
          period_type?: string
          period_year?: number
          pipeline_count?: number | null
          rep_id?: string
          revenue_closed?: number
          revenue_goal?: number
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_with_role: {
        Row: {
          created_at: string | null
          email: string | null
          hire_date: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          team_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role:
        | { Args: { p_role: string; p_user_id: string }; Returns: boolean }
        | {
            Args: {
              _role: Database["public"]["Enums"]["user_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_manager_of_user: {
        Args: { _manager_id: string; _rep_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "cold_calls"
        | "emails"
        | "linkedin"
        | "demos"
        | "meetings"
        | "proposals"
      call_analysis_status: "pending" | "processing" | "completed" | "error"
      call_source_type: "zoom" | "teams" | "dialer" | "other"
      user_role: "rep" | "manager" | "admin"
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
    Enums: {
      activity_type: [
        "cold_calls",
        "emails",
        "linkedin",
        "demos",
        "meetings",
        "proposals",
      ],
      call_analysis_status: ["pending", "processing", "completed", "error"],
      call_source_type: ["zoom", "teams", "dialer", "other"],
      user_role: ["rep", "manager", "admin"],
    },
  },
} as const
