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
          due_date: string | null
          generated_from_call_ids: string[] | null
          id: string
          priority: string | null
          prospect_id: string
          reminder_enabled: boolean | null
          reminder_sent_at: string | null
          reminder_time: string | null
          rep_id: string
          source: string | null
          source_call_id: string | null
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
          due_date?: string | null
          generated_from_call_ids?: string[] | null
          id?: string
          priority?: string | null
          prospect_id: string
          reminder_enabled?: boolean | null
          reminder_sent_at?: string | null
          reminder_time?: string | null
          rep_id: string
          source?: string | null
          source_call_id?: string | null
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
          due_date?: string | null
          generated_from_call_ids?: string[] | null
          id?: string
          priority?: string | null
          prospect_id?: string
          reminder_enabled?: boolean | null
          reminder_sent_at?: string | null
          reminder_time?: string | null
          rep_id?: string
          source?: string | null
          source_call_id?: string | null
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
          {
            foreignKeyName: "account_follow_ups_source_call_id_fkey"
            columns: ["source_call_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
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
      admin_assistant_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          messages: Json
          page_context: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          messages?: Json
          page_context?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          messages?: Json
          page_context?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_assistant_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_assistant_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_assistant_sessions_user_id_fkey"
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
          analysis_coaching: Json | null
          analysis_metadata: Json | null
          analysis_pipeline_version: string | null
          analysis_pricing: Json | null
          analysis_psychology: Json | null
          analysis_strategy: Json | null
          audio_voice_analysis: Json | null
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
          detected_call_type: string | null
          discovery_score: number | null
          follow_up_suggestions: Json | null
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
          sales_assets: Json | null
          sales_assets_generated_at: string | null
          skill_tags: string[] | null
          strengths: Json | null
          trend_indicators: Json | null
          updated_at: string | null
        }
        Insert: {
          analysis_behavior?: Json | null
          analysis_coaching?: Json | null
          analysis_metadata?: Json | null
          analysis_pipeline_version?: string | null
          analysis_pricing?: Json | null
          analysis_psychology?: Json | null
          analysis_strategy?: Json | null
          audio_voice_analysis?: Json | null
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
          detected_call_type?: string | null
          discovery_score?: number | null
          follow_up_suggestions?: Json | null
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
          sales_assets?: Json | null
          sales_assets_generated_at?: string | null
          skill_tags?: string[] | null
          strengths?: Json | null
          trend_indicators?: Json | null
          updated_at?: string | null
        }
        Update: {
          analysis_behavior?: Json | null
          analysis_coaching?: Json | null
          analysis_metadata?: Json | null
          analysis_pipeline_version?: string | null
          analysis_pricing?: Json | null
          analysis_psychology?: Json | null
          analysis_strategy?: Json | null
          audio_voice_analysis?: Json | null
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
          detected_call_type?: string | null
          discovery_score?: number | null
          follow_up_suggestions?: Json | null
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
          sales_assets?: Json | null
          sales_assets_generated_at?: string | null
          skill_tags?: string[] | null
          strengths?: Json | null
          trend_indicators?: Json | null
          updated_at?: string | null
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
        ]
      }
      analysis_sessions: {
        Row: {
          analysis_mode: string | null
          created_at: string
          id: string
          is_active: boolean | null
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
          is_active?: boolean | null
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
          is_active?: boolean | null
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
          additional_speakers: string[] | null
          analysis_error: string | null
          analysis_status: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version: string
          audio_duration_seconds: number | null
          audio_file_path: string | null
          call_date: string
          call_type: string | null
          call_type_other: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          estimated_opportunity_size: number | null
          id: string
          is_unqualified: boolean | null
          manager_id: string | null
          notes: string | null
          opportunity_label: string | null
          potential_revenue: number | null
          primary_stakeholder_name: string | null
          prospect_id: string | null
          raw_text: string | null
          rep_id: string
          salesforce_demo_link: string | null
          source: Database["public"]["Enums"]["call_source_type"]
          suggestions_reviewed_at: string | null
          target_close_date: string | null
          updated_at: string
          upload_method: string
        }
        Insert: {
          account_name?: string | null
          additional_speakers?: string[] | null
          analysis_error?: string | null
          analysis_status?: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version?: string
          audio_duration_seconds?: number | null
          audio_file_path?: string | null
          call_date?: string
          call_type?: string | null
          call_type_other?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          estimated_opportunity_size?: number | null
          id?: string
          is_unqualified?: boolean | null
          manager_id?: string | null
          notes?: string | null
          opportunity_label?: string | null
          potential_revenue?: number | null
          primary_stakeholder_name?: string | null
          prospect_id?: string | null
          raw_text?: string | null
          rep_id: string
          salesforce_demo_link?: string | null
          source?: Database["public"]["Enums"]["call_source_type"]
          suggestions_reviewed_at?: string | null
          target_close_date?: string | null
          updated_at?: string
          upload_method?: string
        }
        Update: {
          account_name?: string | null
          additional_speakers?: string[] | null
          analysis_error?: string | null
          analysis_status?: Database["public"]["Enums"]["call_analysis_status"]
          analysis_version?: string
          audio_duration_seconds?: number | null
          audio_file_path?: string | null
          call_date?: string
          call_type?: string | null
          call_type_other?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          estimated_opportunity_size?: number | null
          id?: string
          is_unqualified?: boolean | null
          manager_id?: string | null
          notes?: string | null
          opportunity_label?: string | null
          potential_revenue?: number | null
          primary_stakeholder_name?: string | null
          prospect_id?: string | null
          raw_text?: string | null
          rep_id?: string
          salesforce_demo_link?: string | null
          source?: Database["public"]["Enums"]["call_source_type"]
          suggestions_reviewed_at?: string | null
          target_close_date?: string | null
          updated_at?: string
          upload_method?: string
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
      competitors: {
        Row: {
          branding: Json | null
          created_at: string
          created_by: string | null
          id: string
          intel: Json | null
          last_researched_at: string | null
          logo_url: string | null
          name: string
          raw_content: Json | null
          research_status: string | null
          updated_at: string
          website: string
        }
        Insert: {
          branding?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          intel?: Json | null
          last_researched_at?: string | null
          logo_url?: string | null
          name: string
          raw_content?: Json | null
          research_status?: string | null
          updated_at?: string
          website: string
        }
        Update: {
          branding?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          intel?: Json | null
          last_researched_at?: string | null
          logo_url?: string | null
          name?: string
          raw_content?: Json | null
          research_status?: string | null
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      daily_report_configs: {
        Row: {
          created_at: string
          delivery_time: string
          enabled: boolean
          id: string
          include_weekends: boolean
          rep_ids: string[] | null
          report_sections: Json | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_time?: string
          enabled?: boolean
          id?: string
          include_weekends?: boolean
          rep_ids?: string[] | null
          report_sections?: Json | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_time?: string
          enabled?: boolean
          id?: string
          include_weekends?: boolean
          rep_ids?: string[] | null
          report_sections?: Json | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_report_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_report_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
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
      email_log_stakeholders: {
        Row: {
          created_at: string
          email_log_id: string
          id: string
          stakeholder_id: string
        }
        Insert: {
          created_at?: string
          email_log_id: string
          id?: string
          stakeholder_id: string
        }
        Update: {
          created_at?: string
          email_log_id?: string
          id?: string
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_stakeholders_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_stakeholders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
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
      in_app_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          related_entity_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          related_entity_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          related_entity_id?: string | null
          title?: string
          type?: string
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
      ms_calendar_events: {
        Row: {
          attendees: Json | null
          created_at: string | null
          end_time: string
          id: string
          is_online_meeting: boolean | null
          linked_call_id: string | null
          location: string | null
          ms_event_id: string
          ms_meeting_id: string | null
          organizer_email: string | null
          start_time: string
          subject: string | null
          transcript_synced: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendees?: Json | null
          created_at?: string | null
          end_time: string
          id?: string
          is_online_meeting?: boolean | null
          linked_call_id?: string | null
          location?: string | null
          ms_event_id: string
          ms_meeting_id?: string | null
          organizer_email?: string | null
          start_time: string
          subject?: string | null
          transcript_synced?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendees?: Json | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_online_meeting?: boolean | null
          linked_call_id?: string | null
          location?: string | null
          ms_event_id?: string
          ms_meeting_id?: string | null
          organizer_email?: string | null
          start_time?: string
          subject?: string | null
          transcript_synced?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_calendar_events_linked_call_id_fkey"
            columns: ["linked_call_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      ms_graph_connections: {
        Row: {
          access_token: string
          connected_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          ms_display_name: string | null
          ms_email: string | null
          ms_user_id: string
          refresh_token: string
          scopes: string[]
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          ms_display_name?: string | null
          ms_email?: string | null
          ms_user_id: string
          refresh_token: string
          scopes: string[]
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          ms_display_name?: string | null
          ms_email?: string | null
          ms_user_id?: string
          refresh_token?: string
          scopes?: string[]
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ms_graph_sync_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          items_synced: number | null
          metadata: Json | null
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_synced?: number | null
          metadata?: Json | null
          status: string
          sync_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_synced?: number | null
          metadata?: Json | null
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          id: string
          notification_type: string
          sent_at: string
          summary: string | null
          task_count: number
          title: string
          user_id: string
        }
        Insert: {
          channel?: string
          id?: string
          notification_type: string
          sent_at?: string
          summary?: string | null
          task_count?: number
          title: string
          user_id: string
        }
        Update: {
          channel?: string
          id?: string
          notification_type?: string
          sent_at?: string
          summary?: string | null
          task_count?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          exclude_weekends: boolean | null
          id: string
          min_priority: string | null
          notify_due_today: boolean | null
          notify_due_tomorrow: boolean | null
          notify_overdue: boolean | null
          reminder_time: string | null
          secondary_reminder_time: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          exclude_weekends?: boolean | null
          id?: string
          min_priority?: string | null
          notify_due_today?: boolean | null
          notify_due_tomorrow?: boolean | null
          notify_overdue?: boolean | null
          reminder_time?: string | null
          secondary_reminder_time?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          exclude_weekends?: boolean | null
          id?: string
          min_priority?: string | null
          notify_due_today?: boolean | null
          notify_due_tomorrow?: boolean | null
          notify_overdue?: boolean | null
          reminder_time?: string | null
          secondary_reminder_time?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      password_reset_otps: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          otp_code: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          otp_code: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          otp_code?: string
          used_at?: string | null
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
      product_knowledge: {
        Row: {
          created_at: string | null
          file_path: string | null
          id: string
          metadata: Json | null
          original_filename: string | null
          page_type: string | null
          raw_markdown: string
          scrape_error: string | null
          scrape_status: string | null
          scraped_at: string | null
          source_type: string | null
          source_url: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          original_filename?: string | null
          page_type?: string | null
          raw_markdown: string
          scrape_error?: string | null
          scrape_status?: string | null
          scraped_at?: string | null
          source_type?: string | null
          source_url: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          original_filename?: string | null
          page_type?: string | null
          raw_markdown?: string
          scrape_error?: string | null
          scrape_status?: string | null
          scraped_at?: string | null
          source_type?: string | null
          source_url?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_knowledge_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string | null
          embedding: string | null
          id: string
          products_mentioned: string[] | null
          search_vector: unknown
          source_id: string
          topics: string[] | null
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          products_mentioned?: string[] | null
          search_vector?: unknown
          source_id: string
          topics?: string[] | null
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          products_mentioned?: string[] | null
          search_vector?: unknown
          source_id?: string
          topics?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "product_knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "product_knowledge"
            referencedColumns: ["id"]
          },
        ]
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
          account_heat_analysis: Json | null
          account_heat_score: number | null
          account_heat_updated_at: string | null
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
          opportunity_link: string | null
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
          account_heat_analysis?: Json | null
          account_heat_score?: number | null
          account_heat_updated_at?: string | null
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
          opportunity_link?: string | null
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
          account_heat_analysis?: Json | null
          account_heat_score?: number | null
          account_heat_updated_at?: string | null
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
          opportunity_link?: string | null
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
      rate_limits: {
        Row: {
          key: string
          request_count: number
          window_start: string
        }
        Insert: {
          key: string
          request_count?: number
          window_start?: string
        }
        Update: {
          key?: string
          request_count?: number
          window_start?: string
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
      rep_task_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          rep_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rep_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rep_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_task_sequences_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_task_sequences_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_task_sequences_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_task_template_settings: {
        Row: {
          auto_create_enabled: boolean | null
          rep_id: string
          updated_at: string
        }
        Insert: {
          auto_create_enabled?: boolean | null
          rep_id: string
          updated_at?: string
        }
        Update: {
          auto_create_enabled?: boolean | null
          rep_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_task_template_settings_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_task_template_settings_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: true
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_task_template_settings_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: true
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_task_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          due_days_offset: number | null
          id: string
          is_active: boolean | null
          priority: string | null
          reminder_enabled: boolean | null
          reminder_time: string | null
          rep_id: string
          sequence_id: string | null
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_days_offset?: number | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          reminder_enabled?: boolean | null
          reminder_time?: string | null
          rep_id: string
          sequence_id?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_days_offset?: number | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          reminder_enabled?: boolean | null
          reminder_time?: string | null
          rep_id?: string
          sequence_id?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_task_templates_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_task_templates_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_task_templates_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_task_templates_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "rep_task_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_grades: {
        Row: {
          coaching_prescription: string | null
          created_at: string | null
          feedback: Json | null
          feedback_visibility: string | null
          focus_areas: Json | null
          graded_at: string | null
          grader_id: string | null
          grader_type: string | null
          id: string
          overall_grade: string | null
          scores: Json
          session_id: string
        }
        Insert: {
          coaching_prescription?: string | null
          created_at?: string | null
          feedback?: Json | null
          feedback_visibility?: string | null
          focus_areas?: Json | null
          graded_at?: string | null
          grader_id?: string | null
          grader_type?: string | null
          id?: string
          overall_grade?: string | null
          scores?: Json
          session_id: string
        }
        Update: {
          coaching_prescription?: string | null
          created_at?: string | null
          feedback?: Json | null
          feedback_visibility?: string | null
          focus_areas?: Json | null
          graded_at?: string | null
          grader_id?: string | null
          grader_type?: string | null
          id?: string
          overall_grade?: string | null
          scores?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_grades_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roleplay_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_personas: {
        Row: {
          backstory: string | null
          common_objections: Json | null
          communication_style: Json | null
          created_at: string | null
          created_by: string | null
          difficulty_level: string | null
          disc_profile: string | null
          dos_and_donts: Json | null
          grading_criteria: Json | null
          id: string
          industry: string | null
          is_active: boolean | null
          is_ai_generated: boolean | null
          name: string
          pain_points: Json | null
          persona_type: string
          source_data_refs: Json | null
          technical_environment: Json | null
          updated_at: string | null
          voice: string | null
        }
        Insert: {
          backstory?: string | null
          common_objections?: Json | null
          communication_style?: Json | null
          created_at?: string | null
          created_by?: string | null
          difficulty_level?: string | null
          disc_profile?: string | null
          dos_and_donts?: Json | null
          grading_criteria?: Json | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_ai_generated?: boolean | null
          name: string
          pain_points?: Json | null
          persona_type: string
          source_data_refs?: Json | null
          technical_environment?: Json | null
          updated_at?: string | null
          voice?: string | null
        }
        Update: {
          backstory?: string | null
          common_objections?: Json | null
          communication_style?: Json | null
          created_at?: string | null
          created_by?: string | null
          difficulty_level?: string | null
          disc_profile?: string | null
          dos_and_donts?: Json | null
          grading_criteria?: Json | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_ai_generated?: boolean | null
          name?: string
          pain_points?: Json | null
          persona_type?: string
          source_data_refs?: Json | null
          technical_environment?: Json | null
          updated_at?: string | null
          voice?: string | null
        }
        Relationships: []
      }
      roleplay_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          manager_id: string | null
          persona_id: string | null
          scenario_prompt: string | null
          session_config: Json | null
          session_type: string | null
          started_at: string | null
          status: string | null
          team_id: string | null
          trainee_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          manager_id?: string | null
          persona_id?: string | null
          scenario_prompt?: string | null
          session_config?: Json | null
          session_type?: string | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          trainee_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          manager_id?: string | null
          persona_id?: string | null
          scenario_prompt?: string | null
          session_config?: Json | null
          session_type?: string | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          trainee_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_sessions_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "roleplay_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleplay_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_transcripts: {
        Row: {
          audio_url: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          raw_text: string | null
          session_id: string
          transcript_json: Json | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          raw_text?: string | null
          session_id: string
          transcript_json?: Json | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          raw_text?: string | null
          session_id?: string
          transcript_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roleplay_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_assistant_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          messages: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_coach_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          messages: Json
          prospect_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          messages?: Json
          prospect_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          messages?: Json
          prospect_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_coach_sessions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_coach_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_coach_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_coach_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_assistant_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          messages: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sdr_call_grades: {
        Row: {
          appointment_setting_score: number | null
          audio_voice_analysis: Json | null
          call_id: string
          call_summary: string | null
          coaching_feedback_at: string | null
          coaching_feedback_helpful: boolean | null
          coaching_feedback_note: string | null
          coaching_notes: string | null
          created_at: string
          engagement_score: number | null
          id: string
          improvements: Json | null
          key_moments: Json | null
          meeting_scheduled: boolean | null
          model_name: string
          objection_handling_score: number | null
          opener_score: number | null
          overall_grade: string
          professionalism_score: number | null
          raw_json: Json | null
          sdr_id: string
          strengths: Json | null
        }
        Insert: {
          appointment_setting_score?: number | null
          audio_voice_analysis?: Json | null
          call_id: string
          call_summary?: string | null
          coaching_feedback_at?: string | null
          coaching_feedback_helpful?: boolean | null
          coaching_feedback_note?: string | null
          coaching_notes?: string | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          improvements?: Json | null
          key_moments?: Json | null
          meeting_scheduled?: boolean | null
          model_name: string
          objection_handling_score?: number | null
          opener_score?: number | null
          overall_grade: string
          professionalism_score?: number | null
          raw_json?: Json | null
          sdr_id: string
          strengths?: Json | null
        }
        Update: {
          appointment_setting_score?: number | null
          audio_voice_analysis?: Json | null
          call_id?: string
          call_summary?: string | null
          coaching_feedback_at?: string | null
          coaching_feedback_helpful?: boolean | null
          coaching_feedback_note?: string | null
          coaching_notes?: string | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          improvements?: Json | null
          key_moments?: Json | null
          meeting_scheduled?: boolean | null
          model_name?: string
          objection_handling_score?: number | null
          opener_score?: number | null
          overall_grade?: string
          professionalism_score?: number | null
          raw_json?: Json | null
          sdr_id?: string
          strengths?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_call_grades_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "sdr_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_call_grades_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_call_grades_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_call_grades_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_calls: {
        Row: {
          analysis_status: string
          call_index: number
          call_type: string
          created_at: string
          daily_transcript_id: string
          duration_estimate_seconds: number | null
          id: string
          is_meaningful: boolean
          processing_error: string | null
          prospect_company: string | null
          prospect_name: string | null
          raw_text: string | null
          sdr_id: string
          start_timestamp: string | null
          updated_at: string
        }
        Insert: {
          analysis_status?: string
          call_index: number
          call_type?: string
          created_at?: string
          daily_transcript_id: string
          duration_estimate_seconds?: number | null
          id?: string
          is_meaningful?: boolean
          processing_error?: string | null
          prospect_company?: string | null
          prospect_name?: string | null
          raw_text?: string | null
          sdr_id: string
          start_timestamp?: string | null
          updated_at?: string
        }
        Update: {
          analysis_status?: string
          call_index?: number
          call_type?: string
          created_at?: string
          daily_transcript_id?: string
          duration_estimate_seconds?: number | null
          id?: string
          is_meaningful?: boolean
          processing_error?: string | null
          prospect_company?: string | null
          prospect_name?: string | null
          raw_text?: string | null
          sdr_id?: string
          start_timestamp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_calls_daily_transcript_id_fkey"
            columns: ["daily_transcript_id"]
            isOneToOne: false
            referencedRelation: "sdr_daily_transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_calls_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_calls_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_calls_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_coaching_prompts: {
        Row: {
          agent_key: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          prompt_name: string
          scoring_weights: Json | null
          system_prompt: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          agent_key: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          prompt_name: string
          scoring_weights?: Json | null
          system_prompt: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_key?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          prompt_name?: string
          scoring_weights?: Json | null
          system_prompt?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_coaching_prompts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sdr_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_daily_transcripts: {
        Row: {
          audio_file_path: string | null
          created_at: string
          id: string
          meaningful_calls_count: number
          processing_error: string | null
          processing_status: string
          raw_text: string | null
          sdr_id: string
          total_calls_detected: number
          transcript_date: string
          updated_at: string
          upload_method: string
          uploaded_by: string
        }
        Insert: {
          audio_file_path?: string | null
          created_at?: string
          id?: string
          meaningful_calls_count?: number
          processing_error?: string | null
          processing_status?: string
          raw_text?: string | null
          sdr_id: string
          total_calls_detected?: number
          transcript_date?: string
          updated_at?: string
          upload_method?: string
          uploaded_by: string
        }
        Update: {
          audio_file_path?: string | null
          created_at?: string
          id?: string
          meaningful_calls_count?: number
          processing_error?: string | null
          processing_status?: string
          raw_text?: string | null
          sdr_id?: string
          total_calls_detected?: number
          transcript_date?: string
          updated_at?: string
          upload_method?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_daily_transcripts_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_daily_transcripts_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_daily_transcripts_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sdr_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "team_member_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_with_role"
            referencedColumns: ["id"]
          },
        ]
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
      voice_analysis_limits: {
        Row: {
          created_at: string
          id: string
          monthly_limit: number
          scope: string
          target_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_limit?: number
          scope: string
          target_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          monthly_limit?: number
          scope?: string
          target_id?: string | null
        }
        Relationships: []
      }
      voice_analysis_usage: {
        Row: {
          analyses_used: number
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analyses_used?: number
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analyses_used?: number
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
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
      find_product_knowledge: {
        Args: {
          filter_products?: string[]
          filter_topics?: string[]
          match_count?: number
          query_embedding?: string
          query_text?: string
          weight_fts?: number
          weight_vector?: number
        }
        Returns: {
          chunk_text: string
          fts_score: number
          id: string
          page_type: string
          products_mentioned: string[]
          relevance_score: number
          source_id: string
          source_url: string
          title: string
          topics: string[]
          vector_score: number
        }[]
      }
      fuzzy_match_prospects: {
        Args: { p_account_names: string[]; p_threshold?: number }
        Returns: {
          account_name: string
          active_revenue: number
          heat_score: number
          industry: string
          input_name: string
          last_contact_date: string
          potential_revenue: number
          prospect_id: string
          prospect_name: string
          rep_id: string
          similarity_score: number
          status: string
        }[]
      }
      fuzzy_match_stakeholders: {
        Args: { p_contact_names: string[]; p_threshold?: number }
        Returns: {
          account_name: string
          active_revenue: number
          heat_score: number
          industry: string
          input_name: string
          job_title: string
          last_contact_date: string
          potential_revenue: number
          prospect_id: string
          prospect_name: string
          rep_id: string
          similarity_score: number
          stakeholder_id: string
          stakeholder_name: string
          status: string
        }[]
      }
      get_admin_prospects_with_call_counts: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_rep_filter?: string
          p_search?: string
          p_sort_by?: string
          p_status_filter?: string
          p_team_filter?: string
        }
        Returns: {
          account_name: string
          active_revenue: number
          ai_extracted_info: Json
          call_count: number
          heat_score: number
          id: string
          industry: string
          last_contact_date: string
          prospect_name: string
          rep_id: string
          rep_name: string
          status: string
          team_name: string
          total_count: number
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
      get_product_knowledge_stats: { Args: never; Returns: Json }
      get_rag_health_stats: { Args: never; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["user_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { p_role: string; p_user_id: string }; Returns: boolean }
      invalidate_cache: { Args: { p_cache_key: string }; Returns: undefined }
      is_manager_of_user: {
        Args: { _manager_id: string; _rep_id: string }
        Returns: boolean
      }
      is_sdr_manager_of: {
        Args: { manager: string; sdr: string }
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
          previous_status: string
          stuck_since: string
          transcript_id: string
        }[]
      }
      recover_stuck_roleplay_sessions: {
        Args: { p_threshold_minutes?: number }
        Returns: {
          persona_name: string
          session_id: string
          stuck_since: string
          trainee_name: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
        | "transcribing"
        | "transcribed"
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
        | "self_pay"
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
      user_role: "rep" | "manager" | "admin" | "sdr" | "sdr_manager"
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
        "transcribing",
        "transcribed",
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
        "self_pay",
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
      user_role: ["rep", "manager", "admin", "sdr", "sdr_manager"],
    },
  },
} as const
