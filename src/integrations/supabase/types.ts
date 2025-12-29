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
          name: string
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
          name: string
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
          name?: string
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
          name: string
          primary_text: string | null
          project_id: string
          reach: number | null
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          ad_set_id: string
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
          name: string
          primary_text?: string | null
          project_id: string
          reach?: number | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          ad_set_id?: string
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
          name?: string
          primary_text?: string | null
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
          project_id: string
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
          project_id: string
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
          project_id?: string
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
          name: string
          objective: string | null
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
          name: string
          objective?: string | null
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
          name?: string
          objective?: string | null
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
      projects: {
        Row: {
          ad_account_id: string
          archived: boolean
          archived_at: string | null
          avatar_url: string | null
          business_model: Database["public"]["Enums"]["business_model"]
          created_at: string
          currency: string
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
          ad_account_id: string
          archived?: boolean
          archived_at?: string | null
          avatar_url?: string | null
          business_model: Database["public"]["Enums"]["business_model"]
          created_at?: string
          currency?: string
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
          ad_account_id?: string
          archived?: boolean
          archived_at?: string | null
          avatar_url?: string | null
          business_model?: Database["public"]["Enums"]["business_model"]
          created_at?: string
          currency?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      business_model: "inside_sales" | "ecommerce" | "pdv"
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
      business_model: ["inside_sales", "ecommerce", "pdv"],
      user_cargo: [
        "gestor_trafego",
        "account_manager",
        "coordenador",
        "gerente",
      ],
    },
  },
} as const
