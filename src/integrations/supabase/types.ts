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
      account_follow_ups: {
        Row: {
          ai_reasoning: string | null
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          generated_from_call_ids: string[] | null
          id: string
          priority: string | null
          prospect_id: string
          rep_id: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_reasoning?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          generated_from_call_ids?: string[] | null
          id?: string
          priority?: string | null
          prospect_id: string
          rep_id: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_reasoning?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          generated_from_call_ids?: string[] | null
          id?: string
          priority?: string | null
          prospect_id?: string
          rep_id?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_follow_ups_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
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
          call_notes: string | null
          call_summary: string
          coach_output: Json | null
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
          prospect_intel: Json | null
          rapport_communication_score: number | null
          raw_json: Json | null
          recap_email_draft: string | null
          rep_id: string
          skill_tags: string[] | null
          strengths: Json | null
          trend_indicators: Json | null
        }
        Insert: {
          call_effectiveness_score?: number | null
          call_id: string
          call_notes?: string | null
          call_summary: string
          coach_output?: Json | null
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
          prospect_intel?: Json | null
          rapport_communication_score?: number | null
          raw_json?: Json | null
          recap_email_draft?: string | null
          rep_id: string
          skill_tags?: string[] | null
          strengths?: Json | null
          trend_indicators?: Json | null
        }
        Update: {
          call_effectiveness_score?: number | null
          call_id?: string
          call_notes?: string | null
          call_summary?: string
          coach_output?: Json | null
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
          prospect_intel?: Json | null
          rapport_communication_score?: number | null
          raw_json?: Json | null
          recap_email_draft?: string | null
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
          {
            foreignKeyName: "fk_ai_call_analysis_call_id"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_call_analysis_rep_id"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_call_analysis_rep_id"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      call_stakeholder_mentions: {
        Row: {
          call_id: string
          context_notes: string | null
          created_at: string
          id: string
          stakeholder_id: string
          was_present: boolean | null
        }
        Insert: {
          call_id: string
          context_notes?: string | null
          created_at?: string
          id?: string
          stakeholder_id: string
          was_present?: boolean | null
        }
        Update: {
          call_id?: string
          context_notes?: string | null
          created_at?: string
          id?: string
          stakeholder_id?: string
          was_present?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "call_stakeholder_mentions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_stakeholder_mentions_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          account_name: string | null
          analysis_error: string | null
          analysis_status: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version: string
          call_date: string
          call_type: string | null
          call_type_other: string | null
          created_at: string
          id: string
          manager_id: string | null
          notes: string | null
          potential_revenue: number | null
          primary_stakeholder_name: string | null
          prospect_id: string | null
          raw_text: string
          rep_id: string
          salesforce_demo_link: string | null
          source: Database["public"]["Enums"]["call_source_type"]
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          analysis_error?: string | null
          analysis_status?: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version?: string
          call_date?: string
          call_type?: string | null
          call_type_other?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          notes?: string | null
          potential_revenue?: number | null
          primary_stakeholder_name?: string | null
          prospect_id?: string | null
          raw_text: string
          rep_id: string
          salesforce_demo_link?: string | null
          source?: Database["public"]["Enums"]["call_source_type"]
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          analysis_error?: string | null
          analysis_status?: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version?: string
          call_date?: string
          call_type?: string | null
          call_type_other?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          notes?: string | null
          potential_revenue?: number | null
          primary_stakeholder_name?: string | null
          prospect_id?: string | null
          raw_text?: string
          rep_id?: string
          salesforce_demo_link?: string | null
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
            foreignKeyName: "call_transcripts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
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
          {
            foreignKeyName: "fk_call_transcripts_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_transcripts_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_transcripts_rep_id"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_transcripts_rep_id"
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
      email_logs: {
        Row: {
          body: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          direction: Database["public"]["Enums"]["email_direction"]
          email_date: string
          id: string
          notes: string | null
          prospect_id: string
          rep_id: string
          stakeholder_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["email_direction"]
          email_date?: string
          id?: string
          notes?: string | null
          prospect_id: string
          rep_id: string
          stakeholder_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["email_direction"]
          email_date?: string
          id?: string
          notes?: string | null
          prospect_id?: string
          rep_id?: string
          stakeholder_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
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
      prospect_activities: {
        Row: {
          activity_date: string
          activity_type: Database["public"]["Enums"]["prospect_activity_type"]
          created_at: string
          description: string | null
          id: string
          prospect_id: string
          rep_id: string
        }
        Insert: {
          activity_date?: string
          activity_type: Database["public"]["Enums"]["prospect_activity_type"]
          created_at?: string
          description?: string | null
          id?: string
          prospect_id: string
          rep_id: string
        }
        Update: {
          activity_date?: string
          activity_type?: Database["public"]["Enums"]["prospect_activity_type"]
          created_at?: string
          description?: string | null
          id?: string
          prospect_id?: string
          rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_activities_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          account_name: string | null
          ai_extracted_info: Json | null
          created_at: string
          follow_ups_generation_status: string | null
          follow_ups_last_generated_at: string | null
          heat_score: number | null
          id: string
          industry: string | null
          last_contact_date: string | null
          potential_revenue: number | null
          prospect_name: string
          rep_id: string
          salesforce_link: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          suggested_follow_ups: Json | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          ai_extracted_info?: Json | null
          created_at?: string
          follow_ups_generation_status?: string | null
          follow_ups_last_generated_at?: string | null
          heat_score?: number | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          potential_revenue?: number | null
          prospect_name: string
          rep_id: string
          salesforce_link?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          suggested_follow_ups?: Json | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          ai_extracted_info?: Json | null
          created_at?: string
          follow_ups_generation_status?: string | null
          follow_ups_last_generated_at?: string | null
          heat_score?: number | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          potential_revenue?: number | null
          prospect_name?: string
          rep_id?: string
          salesforce_link?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          suggested_follow_ups?: Json | null
          updated_at?: string
        }
        Relationships: []
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
      stakeholder_relationships: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          prospect_id: string
          relationship_type: string
          rep_id: string
          source_stakeholder_id: string
          strength: number | null
          target_stakeholder_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id: string
          relationship_type: string
          rep_id: string
          source_stakeholder_id: string
          strength?: number | null
          target_stakeholder_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id?: string
          relationship_type?: string
          rep_id?: string
          source_stakeholder_id?: string
          strength?: number | null
          target_stakeholder_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_relationships_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholder_relationships_source_stakeholder_id_fkey"
            columns: ["source_stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholder_relationships_target_stakeholder_id_fkey"
            columns: ["target_stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          ai_extracted_info: Json | null
          champion_score: number | null
          champion_score_reasoning: string | null
          created_at: string
          email: string | null
          id: string
          influence_level:
            | Database["public"]["Enums"]["stakeholder_influence_level"]
            | null
          is_primary_contact: boolean | null
          job_title: string | null
          last_interaction_date: string | null
          name: string
          phone: string | null
          prospect_id: string
          rep_id: string
          updated_at: string
        }
        Insert: {
          ai_extracted_info?: Json | null
          champion_score?: number | null
          champion_score_reasoning?: string | null
          created_at?: string
          email?: string | null
          id?: string
          influence_level?:
            | Database["public"]["Enums"]["stakeholder_influence_level"]
            | null
          is_primary_contact?: boolean | null
          job_title?: string | null
          last_interaction_date?: string | null
          name: string
          phone?: string | null
          prospect_id: string
          rep_id: string
          updated_at?: string
        }
        Update: {
          ai_extracted_info?: Json | null
          champion_score?: number | null
          champion_score_reasoning?: string | null
          created_at?: string
          email?: string | null
          id?: string
          influence_level?:
            | Database["public"]["Enums"]["stakeholder_influence_level"]
            | null
          is_primary_contact?: boolean | null
          job_title?: string | null
          last_interaction_date?: string | null
          name?: string
          phone?: string | null
          prospect_id?: string
          rep_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
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
      email_direction: "incoming" | "outgoing"
      prospect_activity_type:
        | "call"
        | "email"
        | "meeting"
        | "note"
        | "linkedin"
        | "demo"
      prospect_status: "active" | "won" | "lost" | "dormant"
      stakeholder_influence_level:
        | "light_influencer"
        | "heavy_influencer"
        | "secondary_dm"
        | "final_dm"
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
      email_direction: ["incoming", "outgoing"],
      prospect_activity_type: [
        "call",
        "email",
        "meeting",
        "note",
        "linkedin",
        "demo",
      ],
      prospect_status: ["active", "won", "lost", "dormant"],
      stakeholder_influence_level: [
        "light_influencer",
        "heavy_influencer",
        "secondary_dm",
        "final_dm",
      ],
      user_role: ["rep", "manager", "admin"],
    },
  },
} as const
