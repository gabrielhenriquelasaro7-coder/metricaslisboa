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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_goals: {
        Row: {
          created_at: string
          id: string
          project_id: string
          target_cpc: number | null
          target_cpl: number | null
          target_ctr: number | null
          target_leads_monthly: number | null
          target_roas: number | null
          target_spend_daily: number | null
          target_spend_monthly: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          target_cpc?: number | null
          target_cpl?: number | null
          target_ctr?: number | null
          target_leads_monthly?: number | null
          target_roas?: number | null
          target_spend_daily?: number | null
          target_spend_monthly?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          target_cpc?: number | null
          target_cpl?: number | null
          target_ctr?: number | null
          target_leads_monthly?: number | null
          target_roas?: number | null
          target_spend_daily?: number | null
          target_spend_monthly?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_sets: {
        Row: {
          campaign_id: string
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cpa: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          daily_budget: number | null
          frequency: number | null
          id: string
          impressions: number | null
          lifetime_budget: number | null
          messaging_replies: number | null
          name: string
          profile_visits: number | null
          project_id: string
          reach: number | null
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
          targeting: Json | null
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          daily_budget?: number | null
          frequency?: number | null
          id: string
          impressions?: number | null
          lifetime_budget?: number | null
          messaging_replies?: number | null
          name: string
          profile_visits?: number | null
          project_id: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          targeting?: Json | null
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          daily_budget?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          lifetime_budget?: number | null
          messaging_replies?: number | null
          name?: string
          profile_visits?: number | null
          project_id?: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          targeting?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ad_set_id: string
          cached_image_url: string | null
          campaign_id: string
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cpa: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          creative_id: string | null
          creative_image_url: string | null
          creative_thumbnail: string | null
          creative_video_url: string | null
          cta: string | null
          ctr: number | null
          frequency: number | null
          headline: string | null
          id: string
          impressions: number | null
          messaging_replies: number | null
          name: string
          primary_text: string | null
          profile_visits: number | null
          project_id: string
          reach: number | null
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          ad_set_id: string
          cached_image_url?: string | null
          campaign_id: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_id?: string | null
          creative_image_url?: string | null
          creative_thumbnail?: string | null
          creative_video_url?: string | null
          cta?: string | null
          ctr?: number | null
          frequency?: number | null
          headline?: string | null
          id: string
          impressions?: number | null
          messaging_replies?: number | null
          name: string
          primary_text?: string | null
          profile_visits?: number | null
          project_id: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          ad_set_id?: string
          cached_image_url?: string | null
          campaign_id?: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_id?: string | null
          creative_image_url?: string | null
          creative_thumbnail?: string | null
          creative_video_url?: string | null
          cta?: string | null
          ctr?: number | null
          frequency?: number | null
          headline?: string | null
          id?: string
          impressions?: number | null
          messaging_replies?: number | null
          name?: string
          primary_text?: string | null
          profile_visits?: number | null
          project_id?: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_daily_metrics: {
        Row: {
          ad_account_id: string
          ad_id: string
          ad_name: string
          ad_status: string | null
          adset_id: string
          adset_name: string
          adset_status: string | null
          cached_creative_thumbnail: string | null
          campaign_id: string
          campaign_name: string
          campaign_objective: string | null
          campaign_status: string | null
          clicks: number
          conversion_value: number | null
          conversions: number | null
          cpa: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          creative_id: string | null
          creative_thumbnail: string | null
          ctr: number | null
          date: string
          frequency: number | null
          id: string
          impressions: number
          leads_count: number | null
          messaging_replies: number | null
          profile_visits: number | null
          project_id: string
          purchases_count: number | null
          reach: number
          roas: number | null
          spend: number
          synced_at: string
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          ad_name: string
          ad_status?: string | null
          adset_id: string
          adset_name: string
          adset_status?: string | null
          cached_creative_thumbnail?: string | null
          campaign_id: string
          campaign_name: string
          campaign_objective?: string | null
          campaign_status?: string | null
          clicks?: number
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          creative_thumbnail?: string | null
          ctr?: number | null
          date: string
          frequency?: number | null
          id?: string
          impressions?: number
          leads_count?: number | null
          messaging_replies?: number | null
          profile_visits?: number | null
          project_id: string
          purchases_count?: number | null
          reach?: number
          roas?: number | null
          spend?: number
          synced_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          ad_name?: string
          ad_status?: string | null
          adset_id?: string
          adset_name?: string
          adset_status?: string | null
          cached_creative_thumbnail?: string | null
          campaign_id?: string
          campaign_name?: string
          campaign_objective?: string | null
          campaign_status?: string | null
          clicks?: number
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          creative_thumbnail?: string | null
          ctr?: number | null
          date?: string
          frequency?: number | null
          id?: string
          impressions?: number
          leads_count?: number | null
          messaging_replies?: number | null
          profile_visits?: number | null
          project_id?: string
          purchases_count?: number | null
          reach?: number
          roas?: number | null
          spend?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_daily_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis_cache: {
        Row: {
          ai_response: string
          context_summary: Json | null
          created_at: string
          expires_at: string
          id: string
          project_id: string
          query_hash: string
          user_message: string
        }
        Insert: {
          ai_response: string
          context_summary?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          project_id: string
          query_hash: string
          user_message: string
        }
        Update: {
          ai_response?: string
          context_summary?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          project_id?: string
          query_hash?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_alert_config: {
        Row: {
          ad_paused_alert: boolean | null
          ad_set_paused_alert: boolean | null
          budget_change_alert: boolean | null
          campaign_paused_alert: boolean | null
          cpl_increase_threshold: number | null
          created_at: string
          ctr_drop_threshold: number | null
          enabled: boolean
          group_id: string | null
          group_name: string | null
          id: string
          instance_id: string | null
          last_alert_at: string | null
          phone_number: string | null
          project_id: string
          target_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_paused_alert?: boolean | null
          ad_set_paused_alert?: boolean | null
          budget_change_alert?: boolean | null
          campaign_paused_alert?: boolean | null
          cpl_increase_threshold?: number | null
          created_at?: string
          ctr_drop_threshold?: number | null
          enabled?: boolean
          group_id?: string | null
          group_name?: string | null
          id?: string
          instance_id?: string | null
          last_alert_at?: string | null
          phone_number?: string | null
          project_id: string
          target_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_paused_alert?: boolean | null
          ad_set_paused_alert?: boolean | null
          budget_change_alert?: boolean | null
          campaign_paused_alert?: boolean | null
          cpl_increase_threshold?: number | null
          created_at?: string
          ctr_drop_threshold?: number | null
          enabled?: boolean
          group_id?: string | null
          group_name?: string | null
          id?: string
          instance_id?: string | null
          last_alert_at?: string | null
          phone_number?: string | null
          project_id?: string
          target_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_alert_config_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_alert_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_alerts: {
        Row: {
          anomaly_type: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          notified: boolean
          notified_at: string | null
          project_id: string
          severity: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_name: string
          entity_type: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          project_id: string
          severity?: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          project_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_goals: {
        Row: {
          campaign_id: string
          campaign_name: string
          created_at: string
          id: string
          max_cpc: number | null
          project_id: string
          target_cpl: number | null
          target_ctr: number | null
          target_leads: number | null
          target_roas: number | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          created_at?: string
          id?: string
          max_cpc?: number | null
          project_id: string
          target_cpl?: number | null
          target_ctr?: number | null
          target_leads?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          created_at?: string
          id?: string
          max_cpc?: number | null
          project_id?: string
          target_cpl?: number | null
          target_ctr?: number | null
          target_leads?: number | null
          target_roas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cpa: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          created_time: string | null
          ctr: number | null
          daily_budget: number | null
          frequency: number | null
          id: string
          impressions: number | null
          lifetime_budget: number | null
          messaging_replies: number | null
          name: string
          objective: string | null
          profile_visits: number | null
          project_id: string
          reach: number | null
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
          updated_time: string | null
        }
        Insert: {
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          created_time?: string | null
          ctr?: number | null
          daily_budget?: number | null
          frequency?: number | null
          id: string
          impressions?: number | null
          lifetime_budget?: number | null
          messaging_replies?: number | null
          name: string
          objective?: string | null
          profile_visits?: number | null
          project_id: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          updated_time?: string | null
        }
        Update: {
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          created_time?: string | null
          ctr?: number | null
          daily_budget?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          lifetime_budget?: number | null
          messaging_replies?: number | null
          name?: string
          objective?: string | null
          profile_visits?: number | null
          project_id?: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          updated_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_preferences: {
        Row: {
          chart_key: string
          chart_type: string | null
          created_at: string
          custom_name: string | null
          id: string
          primary_color: string | null
          primary_metric: string | null
          secondary_color: string | null
          secondary_metric: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chart_key: string
          chart_type?: string | null
          created_at?: string
          custom_name?: string | null
          id?: string
          primary_color?: string | null
          primary_metric?: string | null
          secondary_color?: string | null
          secondary_metric?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chart_key?: string
          chart_type?: string | null
          created_at?: string
          custom_name?: string | null
          id?: string
          primary_color?: string | null
          primary_metric?: string | null
          secondary_color?: string | null
          secondary_metric?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_connections: {
        Row: {
          access_token: string | null
          api_key: string | null
          api_url: string | null
          config: Json | null
          connected_at: string | null
          created_at: string | null
          display_name: string | null
          id: string
          last_error: string | null
          project_id: string
          provider: Database["public"]["Enums"]["crm_provider"]
          refresh_token: string | null
          status: Database["public"]["Enums"]["crm_connection_status"] | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          api_url?: string | null
          config?: Json | null
          connected_at?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          last_error?: string | null
          project_id: string
          provider: Database["public"]["Enums"]["crm_provider"]
          refresh_token?: string | null
          status?: Database["public"]["Enums"]["crm_connection_status"] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          api_url?: string | null
          config?: Json | null
          connected_at?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          last_error?: string | null
          project_id?: string
          provider?: Database["public"]["Enums"]["crm_provider"]
          refresh_token?: string | null
          status?: Database["public"]["Enums"]["crm_connection_status"] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          closed_date: string | null
          connection_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_date: string | null
          currency: string | null
          custom_fields: Json | null
          expected_close_date: string | null
          external_id: string
          external_pipeline_id: string | null
          external_stage_id: string | null
          id: string
          lead_source: string | null
          owner_email: string | null
          owner_name: string | null
          pipeline_id: string | null
          project_id: string
          stage_name: string | null
          status: Database["public"]["Enums"]["crm_deal_status"] | null
          synced_at: string | null
          title: string
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
        }
        Insert: {
          closed_date?: string | null
          connection_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_date?: string | null
          currency?: string | null
          custom_fields?: Json | null
          expected_close_date?: string | null
          external_id: string
          external_pipeline_id?: string | null
          external_stage_id?: string | null
          id?: string
          lead_source?: string | null
          owner_email?: string | null
          owner_name?: string | null
          pipeline_id?: string | null
          project_id: string
          stage_name?: string | null
          status?: Database["public"]["Enums"]["crm_deal_status"] | null
          synced_at?: string | null
          title: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
        }
        Update: {
          closed_date?: string | null
          connection_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_date?: string | null
          currency?: string | null
          custom_fields?: Json | null
          expected_close_date?: string | null
          external_id?: string
          external_pipeline_id?: string | null
          external_stage_id?: string | null
          id?: string
          lead_source?: string | null
          owner_email?: string | null
          owner_name?: string | null
          pipeline_id?: string | null
          project_id?: string
          stage_name?: string | null
          status?: Database["public"]["Enums"]["crm_deal_status"] | null
          synced_at?: string | null
          title?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          connection_id: string
          created_at: string | null
          external_id: string
          external_name: string
          id: string
          is_default: boolean | null
          project_id: string
          stages: Json | null
          synced_at: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string | null
          external_id: string
          external_name: string
          id?: string
          is_default?: boolean | null
          project_id: string
          stages?: Json | null
          synced_at?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string | null
          external_id?: string
          external_name?: string
          id?: string
          is_default?: boolean | null
          project_id?: string
          stages?: Json | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pipelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_logs: {
        Row: {
          completed_at: string | null
          connection_id: string
          created_at: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          project_id: string
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["crm_sync_status"] | null
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          project_id: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["crm_sync_status"] | null
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          project_id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["crm_sync_status"] | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sync_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      demographic_insights: {
        Row: {
          breakdown_type: string
          breakdown_value: string
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          created_at: string
          date: string
          id: string
          impressions: number | null
          project_id: string
          reach: number | null
          spend: number | null
          synced_at: string
        }
        Insert: {
          breakdown_type: string
          breakdown_value: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string
          date: string
          id?: string
          impressions?: number | null
          project_id: string
          reach?: number | null
          spend?: number | null
          synced_at?: string
        }
        Update: {
          breakdown_type?: string
          breakdown_value?: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string
          date?: string
          id?: string
          impressions?: number | null
          project_id?: string
          reach?: number | null
          spend?: number | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demographic_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_groups: {
        Row: {
          campaign_id: string
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cost_per_conversion: number | null
          cpc: number | null
          cpc_bid: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          id: string
          impressions: number | null
          name: string
          project_id: string
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpc_bid?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          id: string
          impressions?: number | null
          name: string
          project_id: string
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpc_bid?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          name?: string
          project_id?: string
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads: {
        Row: {
          ad_group_id: string
          ad_type: string | null
          campaign_id: string
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cost_per_conversion: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          descriptions: string[] | null
          final_urls: string[] | null
          headlines: string[] | null
          id: string
          impressions: number | null
          name: string
          project_id: string
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          ad_group_id: string
          ad_type?: string | null
          campaign_id: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          descriptions?: string[] | null
          final_urls?: string[] | null
          headlines?: string[] | null
          id: string
          impressions?: number | null
          name: string
          project_id: string
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          ad_group_id?: string
          ad_type?: string | null
          campaign_id?: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          descriptions?: string[] | null
          final_urls?: string[] | null
          headlines?: string[] | null
          id?: string
          impressions?: number | null
          name?: string
          project_id?: string
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_daily_metrics: {
        Row: {
          ad_group_id: string
          ad_group_name: string
          ad_group_status: string | null
          ad_id: string
          ad_name: string
          ad_status: string | null
          campaign_id: string
          campaign_name: string
          campaign_status: string | null
          campaign_type: string | null
          clicks: number
          conversion_value: number | null
          conversions: number | null
          cost_per_conversion: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          customer_id: string
          date: string
          id: string
          impressions: number
          project_id: string
          roas: number | null
          search_impression_share: number | null
          spend: number
          synced_at: string
        }
        Insert: {
          ad_group_id: string
          ad_group_name: string
          ad_group_status?: string | null
          ad_id: string
          ad_name: string
          ad_status?: string | null
          campaign_id: string
          campaign_name: string
          campaign_status?: string | null
          campaign_type?: string | null
          clicks?: number
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          customer_id: string
          date: string
          id?: string
          impressions?: number
          project_id: string
          roas?: number | null
          search_impression_share?: number | null
          spend?: number
          synced_at?: string
        }
        Update: {
          ad_group_id?: string
          ad_group_name?: string
          ad_group_status?: string | null
          ad_id?: string
          ad_name?: string
          ad_status?: string | null
          campaign_id?: string
          campaign_name?: string
          campaign_status?: string | null
          campaign_type?: string | null
          clicks?: number
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          customer_id?: string
          date?: string
          id?: string
          impressions?: number
          project_id?: string
          roas?: number | null
          search_impression_share?: number | null
          spend?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_daily_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_campaigns: {
        Row: {
          bidding_strategy: string | null
          budget_amount: number | null
          budget_type: string | null
          campaign_type: string | null
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cost_per_conversion: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          end_date: string | null
          id: string
          impressions: number | null
          name: string
          project_id: string
          roas: number | null
          spend: number | null
          start_date: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          bidding_strategy?: string | null
          budget_amount?: number | null
          budget_type?: string | null
          campaign_type?: string | null
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id: string
          impressions?: number | null
          name: string
          project_id: string
          roas?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          bidding_strategy?: string | null
          budget_amount?: number | null
          budget_type?: string | null
          campaign_type?: string | null
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          name?: string
          project_id?: string
          roas?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          expires_at: string | null
          guest_email: string
          guest_name: string
          guest_user_id: string | null
          id: string
          invited_by: string
          password_changed: boolean | null
          project_id: string
          status: string | null
          temp_password: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          guest_email: string
          guest_name: string
          guest_user_id?: string | null
          id?: string
          invited_by: string
          password_changed?: boolean | null
          project_id: string
          status?: string | null
          temp_password: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          guest_email?: string
          guest_name?: string
          guest_user_id?: string | null
          id?: string
          invited_by?: string
          password_changed?: boolean | null
          project_id?: string
          status?: string | null
          temp_password?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_project_access: {
        Row: {
          created_at: string | null
          granted_by: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_project_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leadgen_forms: {
        Row: {
          created_at: string | null
          id: string
          last_synced_at: string | null
          leads_count: number | null
          name: string | null
          page_id: string
          project_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          last_synced_at?: string | null
          leads_count?: number | null
          name?: string | null
          page_id: string
          project_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          leads_count?: number | null
          name?: string | null
          page_id?: string
          project_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leadgen_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          campaign_id: string | null
          created_at: string | null
          created_time: string
          field_data: Json | null
          form_id: string
          form_name: string | null
          id: string
          lead_email: string | null
          lead_name: string | null
          lead_phone: string | null
          project_id: string
          synced_at: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_time: string
          field_data?: Json | null
          form_id: string
          form_name?: string | null
          id: string
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          project_id: string
          synced_at?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_time?: string
          field_data?: Json | null
          form_id?: string
          form_name?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          project_id?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_history: {
        Row: {
          change_percentage: number | null
          change_type: string
          changed_by: string | null
          created_at: string
          detected_at: string
          entity_id: string
          entity_name: string
          entity_type: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string
        }
        Insert: {
          change_percentage?: number | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          detected_at?: string
          entity_id: string
          entity_name: string
          entity_type: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id: string
        }
        Update: {
          change_percentage?: number | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          detected_at?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      period_metrics: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          metrics: Json
          period_key: string
          project_id: string
          status: string | null
          synced_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          id?: string
          metrics?: Json
          period_key: string
          project_id: string
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          metrics?: Json
          period_key?: string
          project_id?: string
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "period_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: Database["public"]["Enums"]["user_cargo"] | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: Database["public"]["Enums"]["user_cargo"] | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: Database["public"]["Enums"]["user_cargo"] | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_import_months: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          month: number
          project_id: string
          records_count: number | null
          retry_count: number | null
          started_at: string | null
          status: string
          year: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          month: number
          project_id: string
          records_count?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          year: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          month?: number
          project_id?: string
          records_count?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_import_months_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_metric_config: {
        Row: {
          chart_primary_metric: string | null
          chart_secondary_metric: string | null
          cost_metrics: Json | null
          created_at: string | null
          efficiency_metrics: Json | null
          id: string
          primary_metrics: Json | null
          project_id: string
          result_metric: string | null
          result_metric_label: string | null
          result_metrics: Json | null
          result_metrics_labels: Json | null
          show_comparison: boolean | null
          updated_at: string | null
        }
        Insert: {
          chart_primary_metric?: string | null
          chart_secondary_metric?: string | null
          cost_metrics?: Json | null
          created_at?: string | null
          efficiency_metrics?: Json | null
          id?: string
          primary_metrics?: Json | null
          project_id: string
          result_metric?: string | null
          result_metric_label?: string | null
          result_metrics?: Json | null
          result_metrics_labels?: Json | null
          show_comparison?: boolean | null
          updated_at?: string | null
        }
        Update: {
          chart_primary_metric?: string | null
          chart_secondary_metric?: string | null
          cost_metrics?: Json | null
          created_at?: string | null
          efficiency_metrics?: Json | null
          id?: string
          primary_metrics?: Json | null
          project_id?: string
          result_metric?: string | null
          result_metric_label?: string | null
          result_metrics?: Json | null
          result_metrics_labels?: Json | null
          show_comparison?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_metric_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_balance: number | null
          account_balance_updated_at: string | null
          ad_account_id: string
          ai_briefing: string | null
          archived: boolean
          archived_at: string | null
          avatar_url: string | null
          business_model: Database["public"]["Enums"]["business_model"]
          created_at: string
          currency: string
          facebook_page_id: string | null
          google_customer_id: string | null
          health_score: string | null
          id: string
          last_sync_at: string | null
          name: string
          sync_progress: Json | null
          timezone: string
          updated_at: string
          user_id: string
          webhook_status: string | null
        }
        Insert: {
          account_balance?: number | null
          account_balance_updated_at?: string | null
          ad_account_id: string
          ai_briefing?: string | null
          archived?: boolean
          archived_at?: string | null
          avatar_url?: string | null
          business_model: Database["public"]["Enums"]["business_model"]
          created_at?: string
          currency?: string
          facebook_page_id?: string | null
          google_customer_id?: string | null
          health_score?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          sync_progress?: Json | null
          timezone?: string
          updated_at?: string
          user_id: string
          webhook_status?: string | null
        }
        Update: {
          account_balance?: number | null
          account_balance_updated_at?: string | null
          ad_account_id?: string
          ai_briefing?: string | null
          archived?: boolean
          archived_at?: string | null
          avatar_url?: string | null
          business_model?: Database["public"]["Enums"]["business_model"]
          created_at?: string
          currency?: string
          facebook_page_id?: string | null
          google_customer_id?: string | null
          health_score?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          sync_progress?: Json | null
          timezone?: string
          updated_at?: string
          user_id?: string
          webhook_status?: string | null
        }
        Relationships: []
      }
      suggestion_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          project_id: string
          reason: string | null
          suggestion_hash: string
          suggestion_title: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          project_id: string
          reason?: string | null
          suggestion_hash: string
          suggestion_title: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          project_id?: string
          reason?: string | null
          suggestion_hash?: string
          suggestion_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          project_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          project_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_progress: {
        Row: {
          completed_at: string | null
          completed_chunks: number | null
          created_at: string | null
          current_chunk: Json | null
          error_message: string | null
          id: string
          period_end: string
          period_start: string
          project_id: string
          records_synced: number | null
          started_at: string | null
          status: string | null
          sync_type: string
          total_chunks: number
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_chunks?: number | null
          created_at?: string | null
          current_chunk?: Json | null
          error_message?: string | null
          id?: string
          period_end: string
          period_start: string
          project_id: string
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
          total_chunks: number
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_chunks?: number | null
          created_at?: string | null
          current_chunk?: Json | null
          error_message?: string | null
          id?: string
          period_end?: string
          period_start?: string
          project_id?: string
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
          total_chunks?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_progress_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          display_name: string
          id: string
          instance_name: string
          instance_status: string
          phone_connected: string | null
          project_id: string
          qr_code: string | null
          qr_code_expires_at: string | null
          token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          instance_name: string
          instance_status?: string
          phone_connected?: string | null
          project_id: string
          qr_code?: string | null
          qr_code_expires_at?: string | null
          token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          instance_name?: string
          instance_status?: string
          phone_connected?: string | null
          project_id?: string
          qr_code?: string | null
          qr_code_expires_at?: string | null
          token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_manager_instances: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          instance_name: string
          instance_status: string | null
          phone_connected: string | null
          qr_code: string | null
          qr_code_expires_at: string | null
          token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          instance_name: string
          instance_status?: string | null
          phone_connected?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string
          instance_status?: string | null
          phone_connected?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages_log: {
        Row: {
          content: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message_type: string
          status: string | null
          subscription_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type: string
          status?: string | null
          subscription_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          status?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_report_configs: {
        Row: {
          balance_alert_enabled: boolean | null
          balance_alert_threshold: number | null
          created_at: string | null
          group_id: string | null
          group_name: string | null
          id: string
          include_clicks: boolean | null
          include_conversion_value: boolean | null
          include_conversions: boolean | null
          include_cpc: boolean | null
          include_cpl: boolean | null
          include_cpm: boolean | null
          include_ctr: boolean | null
          include_frequency: boolean | null
          include_impressions: boolean | null
          include_leads: boolean | null
          include_reach: boolean | null
          include_roas: boolean | null
          include_spend: boolean | null
          instance_id: string | null
          last_balance_alert_at: string | null
          last_report_sent_at: string | null
          message_template: string | null
          phone_number: string | null
          project_id: string | null
          report_day_of_week: number | null
          report_enabled: boolean | null
          report_period: string | null
          report_time: string | null
          target_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance_alert_enabled?: boolean | null
          balance_alert_threshold?: number | null
          created_at?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          include_clicks?: boolean | null
          include_conversion_value?: boolean | null
          include_conversions?: boolean | null
          include_cpc?: boolean | null
          include_cpl?: boolean | null
          include_cpm?: boolean | null
          include_ctr?: boolean | null
          include_frequency?: boolean | null
          include_impressions?: boolean | null
          include_leads?: boolean | null
          include_reach?: boolean | null
          include_roas?: boolean | null
          include_spend?: boolean | null
          instance_id?: string | null
          last_balance_alert_at?: string | null
          last_report_sent_at?: string | null
          message_template?: string | null
          phone_number?: string | null
          project_id?: string | null
          report_day_of_week?: number | null
          report_enabled?: boolean | null
          report_period?: string | null
          report_time?: string | null
          target_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance_alert_enabled?: boolean | null
          balance_alert_threshold?: number | null
          created_at?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          include_clicks?: boolean | null
          include_conversion_value?: boolean | null
          include_conversions?: boolean | null
          include_cpc?: boolean | null
          include_cpl?: boolean | null
          include_cpm?: boolean | null
          include_ctr?: boolean | null
          include_frequency?: boolean | null
          include_impressions?: boolean | null
          include_leads?: boolean | null
          include_reach?: boolean | null
          include_roas?: boolean | null
          include_spend?: boolean | null
          instance_id?: string | null
          last_balance_alert_at?: string | null
          last_report_sent_at?: string | null
          message_template?: string | null
          phone_number?: string | null
          project_id?: string | null
          report_day_of_week?: number | null
          report_enabled?: boolean | null
          report_period?: string | null
          report_time?: string | null
          target_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_report_configs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_manager_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_report_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_subscriptions: {
        Row: {
          balance_alert_enabled: boolean | null
          balance_alert_threshold: number | null
          created_at: string | null
          group_id: string | null
          group_name: string | null
          id: string
          include_clicks: boolean | null
          include_conversion_value: boolean | null
          include_conversions: boolean | null
          include_cpc: boolean | null
          include_cpl: boolean | null
          include_cpm: boolean | null
          include_ctr: boolean | null
          include_frequency: boolean | null
          include_impressions: boolean | null
          include_leads: boolean | null
          include_reach: boolean | null
          include_roas: boolean | null
          include_spend: boolean | null
          instance_id: string | null
          last_balance_alert_at: string | null
          last_report_sent_at: string | null
          message_template: string | null
          phone_number: string
          project_id: string | null
          report_day_of_week: number | null
          report_period: string | null
          report_time: string | null
          target_type: string
          updated_at: string | null
          user_id: string
          weekly_report_enabled: boolean | null
        }
        Insert: {
          balance_alert_enabled?: boolean | null
          balance_alert_threshold?: number | null
          created_at?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          include_clicks?: boolean | null
          include_conversion_value?: boolean | null
          include_conversions?: boolean | null
          include_cpc?: boolean | null
          include_cpl?: boolean | null
          include_cpm?: boolean | null
          include_ctr?: boolean | null
          include_frequency?: boolean | null
          include_impressions?: boolean | null
          include_leads?: boolean | null
          include_reach?: boolean | null
          include_roas?: boolean | null
          include_spend?: boolean | null
          instance_id?: string | null
          last_balance_alert_at?: string | null
          last_report_sent_at?: string | null
          message_template?: string | null
          phone_number: string
          project_id?: string | null
          report_day_of_week?: number | null
          report_period?: string | null
          report_time?: string | null
          target_type?: string
          updated_at?: string | null
          user_id: string
          weekly_report_enabled?: boolean | null
        }
        Update: {
          balance_alert_enabled?: boolean | null
          balance_alert_threshold?: number | null
          created_at?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          include_clicks?: boolean | null
          include_conversion_value?: boolean | null
          include_conversions?: boolean | null
          include_cpc?: boolean | null
          include_cpl?: boolean | null
          include_cpm?: boolean | null
          include_ctr?: boolean | null
          include_frequency?: boolean | null
          include_impressions?: boolean | null
          include_leads?: boolean | null
          include_reach?: boolean | null
          include_roas?: boolean | null
          include_spend?: boolean | null
          instance_id?: string | null
          last_balance_alert_at?: string | null
          last_report_sent_at?: string | null
          message_template?: string | null
          phone_number?: string
          project_id?: string | null
          report_day_of_week?: number | null
          report_period?: string | null
          report_time?: string | null
          target_type?: string
          updated_at?: string | null
          user_id?: string
          weekly_report_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_subscriptions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      trigger_whatsapp_weekly_reports: { Args: never; Returns: undefined }
      user_has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "convidado"
      business_model:
        | "inside_sales"
        | "ecommerce"
        | "pdv"
        | "custom"
        | "infoproduto"
      crm_connection_status:
        | "pending"
        | "connected"
        | "error"
        | "expired"
        | "disconnected"
      crm_deal_status: "open" | "won" | "lost"
      crm_provider:
        | "kommo"
        | "hubspot"
        | "gohighlevel"
        | "bitrix24"
        | "rdstation"
        | "outros"
      crm_sync_status: "idle" | "syncing" | "completed" | "failed"
      user_cargo:
        | "gestor_trafego"
        | "account_manager"
        | "coordenador"
        | "gerente"
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
      app_role: ["admin", "gestor", "convidado"],
      business_model: [
        "inside_sales",
        "ecommerce",
        "pdv",
        "custom",
        "infoproduto",
      ],
      crm_connection_status: [
        "pending",
        "connected",
        "error",
        "expired",
        "disconnected",
      ],
      crm_deal_status: ["open", "won", "lost"],
      crm_provider: [
        "kommo",
        "hubspot",
        "gohighlevel",
        "bitrix24",
        "rdstation",
        "outros",
      ],
      crm_sync_status: ["idle", "syncing", "completed", "failed"],
      user_cargo: [
        "gestor_trafego",
        "account_manager",
        "coordenador",
        "gerente",
      ],
    },
  },
} as const
