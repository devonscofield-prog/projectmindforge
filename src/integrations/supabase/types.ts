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
      activity_templates: {
        Row: {
          activity_type: string
          created_at: string | null
          id: string
          template_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          id?: string
          template_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          id?: string
          template_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_chat_insights: {
        Row: {
          admin_id: string
          chat_context: Json | null
          content: string
          created_at: string
          id: string
          is_shared: boolean | null
          selection_id: string | null
          share_token: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          chat_context?: Json | null
          content: string
          created_at?: string
          id?: string
          is_shared?: boolean | null
          selection_id?: string | null
          share_token?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          chat_context?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_shared?: boolean | null
          selection_id?: string | null
          share_token?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_chat_insights_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "admin_transcript_selections"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_custom_presets: {
        Row: {
          admin_id: string
          created_at: string
          description: string | null
          icon_name: string | null
          id: string
          is_shared: boolean | null
          mode_ids: string[]
          name: string
          starter_prompt: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_shared?: boolean | null
          mode_ids: string[]
          name: string
          starter_prompt: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_shared?: boolean | null
          mode_ids?: string[]
          name?: string
          starter_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_transcript_selections: {
        Row: {
          admin_id: string
          created_at: string
          description: string | null
          filters: Json | null
          id: string
          is_shared: boolean | null
          name: string
          share_token: string | null
          transcript_ids: string[]
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          description?: string | null
          filters?: Json | null
          id?: string
          is_shared?: boolean | null
          name: string
          share_token?: string | null
          transcript_ids: string[]
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          description?: string | null
          filters?: Json | null
          id?: string
          is_shared?: boolean | null
          name?: string
          share_token?: string | null
          transcript_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      ai_call_analysis: {
        Row: {
          analysis_behavior: Json | null
          analysis_metadata: Json | null
          analysis_pipeline_version: string | null
          analysis_strategy: Json | null
          call_effectiveness_score: number | null
          call_id: string
          call_notes: string | null
          call_summary: string
          coach_output: Json | null
          confidence: number | null
          created_at: string
          deal_advancement_score: number | null
          deal_gaps: Json | null
          deal_heat_analysis: Json | null
          deal_tags: string[] | null
          deleted_at: string | null
          deleted_by: string | null
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
          analysis_behavior?: Json | null
          analysis_metadata?: Json | null
          analysis_pipeline_version?: string | null
          analysis_strategy?: Json | null
          call_effectiveness_score?: number | null
          call_id: string
          call_notes?: string | null
          call_summary: string
          coach_output?: Json | null
          confidence?: number | null
          created_at?: string
          deal_advancement_score?: number | null
          deal_gaps?: Json | null
          deal_heat_analysis?: Json | null
          deal_tags?: string[] | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          analysis_behavior?: Json | null
          analysis_metadata?: Json | null
          analysis_pipeline_version?: string | null
          analysis_strategy?: Json | null
          call_effectiveness_score?: number | null
          call_id?: string
          call_notes?: string | null
          call_summary?: string
          coach_output?: Json | null
          confidence?: number | null
          created_at?: string
          deal_advancement_score?: number | null
          deal_gaps?: Json | null
          deal_heat_analysis?: Json | null
          deal_tags?: string[] | null
          deleted_at?: string | null
          deleted_by?: string | null
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
            referencedRelation: "team_member_names"
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
            referencedRelation: "team_member_names"
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
      analysis_sessions: {
        Row: {
          analysis_mode: string | null
          created_at: string
          id: string
          messages: Json
          title: string | null
          transcript_ids: string[]
          updated_at: string
          use_rag: boolean | null
          user_id: string
        }
        Insert: {
          analysis_mode?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          transcript_ids: string[]
          updated_at?: string
          use_rag?: boolean | null
          user_id: string
        }
        Update: {
          analysis_mode?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          transcript_ids?: string[]
          updated_at?: string
          use_rag?: boolean | null
          user_id?: string
        }
        Relationships: []
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
      background_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error: string | null
          id: string
          job_type: string
          progress: Json | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          id?: string
          job_type: string
          progress?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          id?: string
          job_type?: string
          progress?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      call_products: {
        Row: {
          call_id: string
          created_at: string | null
          id: string
          product_id: string
          promotion_notes: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          call_id: string
          created_at?: string | null
          id?: string
          product_id: string
          promotion_notes?: string | null
          quantity?: number
          unit_price: number
        }
        Update: {
          call_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          promotion_notes?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_products_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
            referencedRelation: "team_member_names"
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
            referencedRelation: "team_member_names"
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
            referencedRelation: "team_member_names"
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
            referencedRelation: "team_member_names"
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
      coaching_trend_analyses: {
        Row: {
          analysis_data: Json
          call_count: number
          created_at: string
          date_range_from: string
          date_range_to: string
          id: string
          is_snapshot: boolean
          rep_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          analysis_data: Json
          call_count: number
          created_at?: string
          date_range_from: string
          date_range_to: string
          id?: string
          is_snapshot?: boolean
          rep_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          analysis_data?: Json
          call_count?: number
          created_at?: string
          date_range_from?: string
          date_range_to?: string
          id?: string
          is_snapshot?: boolean
          rep_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_cache: {
        Row: {
          cache_data: Json
          cache_key: string
          computed_at: string | null
          expires_at: string
          metadata: Json | null
        }
        Insert: {
          cache_data: Json
          cache_key: string
          computed_at?: string | null
          expires_at: string
          metadata?: Json | null
        }
        Update: {
          cache_data?: Json
          cache_key?: string
          computed_at?: string | null
          expires_at?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      data_access_logs: {
        Row: {
          access_reason: string | null
          access_type: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_reason?: string | null
          access_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_reason?: string | null
          access_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      implemented_recommendations: {
        Row: {
          affected_operations: string[] | null
          baseline_metrics: Json
          created_at: string
          id: string
          implemented_at: string
          improvement_percent: number | null
          measured_at: string | null
          notes: string | null
          post_metrics: Json | null
          recommendation_action: string
          recommendation_category: string
          recommendation_priority: string
          recommendation_title: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affected_operations?: string[] | null
          baseline_metrics: Json
          created_at?: string
          id?: string
          implemented_at?: string
          improvement_percent?: number | null
          measured_at?: string | null
          notes?: string | null
          post_metrics?: Json | null
          recommendation_action: string
          recommendation_category: string
          recommendation_priority: string
          recommendation_title: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affected_operations?: string[] | null
          baseline_metrics?: Json
          created_at?: string
          id?: string
          implemented_at?: string
          improvement_percent?: number | null
          measured_at?: string | null
          notes?: string | null
          post_metrics?: Json | null
          recommendation_action?: string
          recommendation_category?: string
          recommendation_priority?: string
          recommendation_title?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mfa_enrollment_status: {
        Row: {
          created_at: string | null
          enrolled_at: string | null
          is_enrolled: boolean | null
          reset_at: string | null
          reset_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enrolled_at?: string | null
          is_enrolled?: boolean | null
          reset_at?: string | null
          reset_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enrolled_at?: string | null
          is_enrolled?: boolean | null
          reset_at?: string | null
          reset_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      performance_alert_config: {
        Row: {
          alert_on_critical: boolean | null
          alert_on_warning: boolean | null
          cooldown_hours: number | null
          created_at: string | null
          email: string
          enabled: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_on_critical?: boolean | null
          alert_on_warning?: boolean | null
          cooldown_hours?: number | null
          created_at?: string | null
          email: string
          enabled?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_on_critical?: boolean | null
          alert_on_warning?: boolean | null
          cooldown_hours?: number | null
          created_at?: string | null
          email?: string
          enabled?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      performance_alert_history: {
        Row: {
          alert_type: string
          config_id: string | null
          email_sent_to: string
          id: string
          metric_type: string
          metric_value: number | null
          sent_at: string | null
          threshold_value: number | null
        }
        Insert: {
          alert_type: string
          config_id?: string | null
          email_sent_to: string
          id?: string
          metric_type: string
          metric_value?: number | null
          sent_at?: string | null
          threshold_value?: number | null
        }
        Update: {
          alert_type?: string
          config_id?: string | null
          email_sent_to?: string
          id?: string
          metric_type?: string
          metric_value?: number | null
          sent_at?: string | null
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_alert_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "performance_alert_config"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          created_at: string | null
          duration_ms: number
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms: number
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
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
          last_seen_at: string | null
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
          last_seen_at?: string | null
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
          last_seen_at?: string | null
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
          active_revenue: number | null
          ai_extracted_info: Json | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          follow_ups_generation_status: string | null
          follow_ups_last_generated_at: string | null
          heat_score: number | null
          id: string
          industry: string | null
          last_contact_date: string | null
          opportunity_details: Json | null
          potential_revenue: number | null
          prospect_name: string
          rep_id: string
          salesforce_link: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          suggested_follow_ups: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_name?: string | null
          active_revenue?: number | null
          ai_extracted_info?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          follow_ups_generation_status?: string | null
          follow_ups_last_generated_at?: string | null
          heat_score?: number | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          opportunity_details?: Json | null
          potential_revenue?: number | null
          prospect_name: string
          rep_id: string
          salesforce_link?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          suggested_follow_ups?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_name?: string | null
          active_revenue?: number | null
          ai_extracted_info?: Json | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          follow_ups_generation_status?: string | null
          follow_ups_last_generated_at?: string | null
          heat_score?: number | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          opportunity_details?: Json | null
          potential_revenue?: number | null
          prospect_name?: string
          rep_id?: string
          salesforce_link?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          suggested_follow_ups?: Json | null
          updated_at?: string
          website?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      transcript_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          embedding: string | null
          entities: Json | null
          extraction_status: string | null
          id: string
          meddpicc_elements: string[] | null
          metadata: Json | null
          search_vector: unknown
          topics: string[] | null
          transcript_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string
          embedding?: string | null
          entities?: Json | null
          extraction_status?: string | null
          id?: string
          meddpicc_elements?: string[] | null
          metadata?: Json | null
          search_vector?: unknown
          topics?: string[] | null
          transcript_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          embedding?: string | null
          entities?: Json | null
          extraction_status?: string | null
          id?: string
          meddpicc_elements?: string[] | null
          metadata?: Json | null
          search_vector?: unknown
          topics?: string[] | null
          transcript_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_chunks_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          activity_type: Database["public"]["Enums"]["user_activity_type"]
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["user_activity_type"]
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["user_activity_type"]
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
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
      user_trusted_devices: {
        Row: {
          created_at: string | null
          device_id: string
          device_name: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          last_used_at: string | null
          trusted_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          trusted_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          trusted_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      data_access_logs_with_user: {
        Row: {
          access_reason: string | null
          access_type: string | null
          created_at: string | null
          id: string | null
          ip_address: string | null
          metadata: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      team_member_names: {
        Row: {
          id: string | null
          is_active: boolean | null
          name: string | null
          team_id: string | null
        }
        Insert: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          team_id?: string | null
        }
        Update: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          team_id?: string | null
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
      can_access_historical_data: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_device_trusted: {
        Args: { p_device_id: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_expired_cache: { Args: never; Returns: number }
      cleanup_expired_devices: { Args: never; Returns: number }
      cleanup_old_metrics: { Args: never; Returns: number }
      find_best_chunks: {
        Args: {
          filter_transcript_ids?: string[]
          match_count?: number
          query_embedding?: string
          query_text?: string
          search_entities?: Json
          search_meddpicc?: string[]
          search_topics?: string[]
          weight_entity?: number
          weight_fts?: number
          weight_vector?: number
        }
        Returns: {
          chunk_index: number
          chunk_text: string
          entities: Json
          entity_score: number
          fts_score: number
          id: string
          meddpicc_elements: string[]
          metadata: Json
          relevance_score: number
          topics: string[]
          transcript_id: string
          vector_score: number
        }[]
      }
      get_admin_transcripts: {
        Args: {
          p_account_search?: string
          p_analysis_status?: string[]
          p_call_types?: string[]
          p_from_date: string
          p_limit?: number
          p_offset?: number
          p_rep_ids?: string[]
          p_to_date: string
        }
        Returns: {
          account_name: string
          analysis_status: string
          call_date: string
          call_type: string
          id: string
          manager_id: string
          raw_text: string
          rep_id: string
          rep_name: string
          team_name: string
          total_count: number
        }[]
      }
      get_cached_admin_stats: { Args: never; Returns: Json }
      get_cached_prospect_stats: { Args: never; Returns: Json }
      get_chunk_status_for_transcripts: {
        Args: { transcript_ids: string[] }
        Returns: Json
      }
      get_performance_summary: {
        Args: { p_hours?: number }
        Returns: {
          avg_duration_ms: number
          error_count: number
          error_rate: number
          metric_name: string
          metric_type: string
          p50_duration_ms: number
          p90_duration_ms: number
          p99_duration_ms: number
          total_count: number
        }[]
      }
      get_rag_health_stats: { Args: never; Returns: Json }
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
      invalidate_cache: { Args: { p_cache_key: string }; Returns: undefined }
      is_manager_of_user: {
        Args: { _manager_id: string; _rep_id: string }
        Returns: boolean
      }
      log_data_access: {
        Args: {
          p_access_reason?: string
          p_access_type: string
          p_metadata?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      maintenance_analyze_tables: { Args: never; Returns: Json }
      recover_stuck_processing_transcripts: {
        Args: never
        Returns: {
          account_name: string
          stuck_since: string
          transcript_id: string
        }[]
      }
      soft_delete_record: {
        Args: { p_record_id: string; p_table_name: string }
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
      call_analysis_status:
        | "pending"
        | "processing"
        | "completed"
        | "error"
        | "skipped"
      call_source_type: "zoom" | "teams" | "dialer" | "other" | "bulk_upload"
      email_direction: "incoming" | "outgoing"
      prospect_activity_type:
        | "call"
        | "email"
        | "meeting"
        | "note"
        | "linkedin"
        | "demo"
        | "text_message"
      prospect_status: "active" | "won" | "lost" | "dormant"
      stakeholder_influence_level:
        | "light_influencer"
        | "heavy_influencer"
        | "secondary_dm"
        | "final_dm"
      user_activity_type:
        | "login"
        | "logout"
        | "session_refresh"
        | "user_invited"
        | "user_profile_updated"
        | "user_role_changed"
        | "password_reset_requested"
        | "user_deactivated"
        | "user_reactivated"
        | "user_deleted"
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
      call_analysis_status: [
        "pending",
        "processing",
        "completed",
        "error",
        "skipped",
      ],
      call_source_type: ["zoom", "teams", "dialer", "other", "bulk_upload"],
      email_direction: ["incoming", "outgoing"],
      prospect_activity_type: [
        "call",
        "email",
        "meeting",
        "note",
        "linkedin",
        "demo",
        "text_message",
      ],
      prospect_status: ["active", "won", "lost", "dormant"],
      stakeholder_influence_level: [
        "light_influencer",
        "heavy_influencer",
        "secondary_dm",
        "final_dm",
      ],
      user_activity_type: [
        "login",
        "logout",
        "session_refresh",
        "user_invited",
        "user_profile_updated",
        "user_role_changed",
        "password_reset_requested",
        "user_deactivated",
        "user_reactivated",
        "user_deleted",
      ],
      user_role: ["rep", "manager", "admin"],
    },
  },
} as const
