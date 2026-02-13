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
      affiliate_clicks: {
        Row: {
          clicked_at: string | null
          creator_id: string
          device_type: string | null
          id: string
          ip_hash: string | null
          link_code: string
          program_id: string
          referrer_url: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          clicked_at?: string | null
          creator_id: string
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          link_code: string
          program_id: string
          referrer_url?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          clicked_at?: string | null
          creator_id?: string
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          link_code?: string
          program_id?: string
          referrer_url?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          attributed_at: string | null
          click_id: string | null
          commission_cents: number
          conversion_type: string
          conversion_value_cents: number
          converted_at: string | null
          creator_id: string
          id: string
          metadata: Json | null
          program_id: string
        }
        Insert: {
          attributed_at?: string | null
          click_id?: string | null
          commission_cents: number
          conversion_type: string
          conversion_value_cents: number
          converted_at?: string | null
          creator_id: string
          id?: string
          metadata?: Json | null
          program_id: string
        }
        Update: {
          attributed_at?: string | null
          click_id?: string | null
          commission_cents?: number
          conversion_type?: string
          conversion_value_cents?: number
          converted_at?: string | null
          creator_id?: string
          id?: string
          metadata?: Json | null
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          engagement_rate: number | null
          id: string
          instagram_followers: number | null
          instagram_handle: string | null
          niches: string[] | null
          tiktok_followers: number | null
          tiktok_handle: string | null
          twitter_followers: number | null
          twitter_handle: string | null
          updated_at: string | null
          user_id: string
          youtube_handle: string | null
          youtube_subscribers: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          niches?: string[] | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          twitter_followers?: number | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_id: string
          youtube_handle?: string | null
          youtube_subscribers?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          niches?: string[] | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          twitter_followers?: number | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_id?: string
          youtube_handle?: string | null
          youtube_subscribers?: number | null
        }
        Relationships: []
      }
      deal_enrollments: {
        Row: {
          accepted_at: string | null
          application_note: string | null
          applied_at: string | null
          completed_at: string | null
          created_at: string | null
          deal_id: string
          deliverables_completed: number | null
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          application_note?: string | null
          applied_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deal_id: string
          deliverables_completed?: number | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          application_note?: string | null
          applied_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deal_id?: string
          deliverables_completed?: number | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_enrollments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          brand_category: string | null
          brand_logo_url: string | null
          brand_name: string
          compensation_fixed_cents: number | null
          compensation_rev_share_percent: number | null
          compensation_type: string
          content_count: number | null
          content_types: string[] | null
          created_at: string | null
          deadline_days: number | null
          description: string | null
          expires_at: string | null
          id: string
          min_engagement_rate: number | null
          min_followers: number | null
          required_niches: string[] | null
          required_platforms: string[] | null
          status: string
          tier_required: string
          title: string
          updated_at: string | null
        }
        Insert: {
          brand_category?: string | null
          brand_logo_url?: string | null
          brand_name: string
          compensation_fixed_cents?: number | null
          compensation_rev_share_percent?: number | null
          compensation_type: string
          content_count?: number | null
          content_types?: string[] | null
          created_at?: string | null
          deadline_days?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          min_engagement_rate?: number | null
          min_followers?: number | null
          required_niches?: string[] | null
          required_platforms?: string[] | null
          status?: string
          tier_required?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          brand_category?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          compensation_fixed_cents?: number | null
          compensation_rev_share_percent?: number | null
          compensation_type?: string
          content_count?: number | null
          content_types?: string[] | null
          created_at?: string | null
          deadline_days?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          min_engagement_rate?: number | null
          min_followers?: number | null
          required_niches?: string[] | null
          required_platforms?: string[] | null
          status?: string
          tier_required?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          whop_user_id: string | null
          whop_membership_id: string | null
          whop_product_id: string | null
          virtuna_tier: string
          status: string
          cancel_at_period_end: boolean | null
          current_period_end: string | null
          created_at: string | null
          updated_at: string | null
          last_synced_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          whop_user_id?: string | null
          whop_membership_id?: string | null
          whop_product_id?: string | null
          virtuna_tier?: string
          status?: string
          cancel_at_period_end?: boolean | null
          current_period_end?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_synced_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          whop_user_id?: string | null
          whop_membership_id?: string | null
          whop_product_id?: string | null
          virtuna_tier?: string
          status?: string
          cancel_at_period_end?: boolean | null
          current_period_end?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_synced_at?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
      analysis_results: {
        Row: {
          id: string
          user_id: string
          content_text: string
          content_type: string
          society_id: string | null
          overall_score: number | null
          confidence: number | null
          factors: Json | null
          suggestions: Json | null
          personas: Json | null
          variants: Json | null
          insights: string | null
          conversation_themes: Json | null
          gemini_model: string | null
          deepseek_model: string | null
          engine_version: string | null
          latency_ms: number | null
          cost_cents: number | null
          rule_score: number | null
          trend_score: number | null
          ml_score: number | null
          score_weights: Json | null
          deleted_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          content_text: string
          content_type: string
          society_id?: string | null
          overall_score?: number | null
          confidence?: number | null
          factors?: Json | null
          suggestions?: Json | null
          personas?: Json | null
          variants?: Json | null
          insights?: string | null
          conversation_themes?: Json | null
          gemini_model?: string | null
          deepseek_model?: string | null
          engine_version?: string | null
          latency_ms?: number | null
          cost_cents?: number | null
          rule_score?: number | null
          trend_score?: number | null
          ml_score?: number | null
          score_weights?: Json | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          content_text?: string
          content_type?: string
          society_id?: string | null
          overall_score?: number | null
          confidence?: number | null
          factors?: Json | null
          suggestions?: Json | null
          personas?: Json | null
          variants?: Json | null
          insights?: string | null
          conversation_themes?: Json | null
          gemini_model?: string | null
          deepseek_model?: string | null
          engine_version?: string | null
          latency_ms?: number | null
          cost_cents?: number | null
          rule_score?: number | null
          trend_score?: number | null
          ml_score?: number | null
          score_weights?: Json | null
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      outcomes: {
        Row: {
          id: string
          analysis_id: string
          user_id: string
          actual_views: number | null
          actual_likes: number | null
          actual_shares: number | null
          actual_engagement_rate: number | null
          predicted_score: number | null
          actual_score: number | null
          delta: number | null
          platform: string | null
          platform_post_url: string | null
          deleted_at: string | null
          reported_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          analysis_id: string
          user_id: string
          actual_views?: number | null
          actual_likes?: number | null
          actual_shares?: number | null
          actual_engagement_rate?: number | null
          predicted_score?: number | null
          actual_score?: number | null
          delta?: number | null
          platform?: string | null
          platform_post_url?: string | null
          deleted_at?: string | null
          reported_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          analysis_id?: string
          user_id?: string
          actual_views?: number | null
          actual_likes?: number | null
          actual_shares?: number | null
          actual_engagement_rate?: number | null
          predicted_score?: number | null
          actual_score?: number | null
          delta?: number | null
          platform?: string | null
          platform_post_url?: string | null
          deleted_at?: string | null
          reported_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_library: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          pattern: string | null
          score_modifier: number | null
          platform: string | null
          evaluation_prompt: string | null
          weight: number
          max_score: number
          accuracy_rate: number | null
          sample_count: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          pattern?: string | null
          score_modifier?: number | null
          platform?: string | null
          evaluation_prompt?: string | null
          weight?: number
          max_score?: number
          accuracy_rate?: number | null
          sample_count?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          pattern?: string | null
          score_modifier?: number | null
          platform?: string | null
          evaluation_prompt?: string | null
          weight?: number
          max_score?: number
          accuracy_rate?: number | null
          sample_count?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scraped_videos: {
        Row: {
          id: string
          platform: string
          platform_video_id: string
          video_url: string | null
          author: string | null
          author_url: string | null
          description: string | null
          views: number | null
          likes: number | null
          shares: number | null
          comments: number | null
          sound_name: string | null
          sound_url: string | null
          hashtags: string[] | null
          category: string | null
          duration_seconds: number | null
          metadata: Json | null
          archived_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          platform?: string
          platform_video_id: string
          video_url?: string | null
          author?: string | null
          author_url?: string | null
          description?: string | null
          views?: number | null
          likes?: number | null
          shares?: number | null
          comments?: number | null
          sound_name?: string | null
          sound_url?: string | null
          hashtags?: string[] | null
          category?: string | null
          duration_seconds?: number | null
          metadata?: Json | null
          archived_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          platform?: string
          platform_video_id?: string
          video_url?: string | null
          author?: string | null
          author_url?: string | null
          description?: string | null
          views?: number | null
          likes?: number | null
          shares?: number | null
          comments?: number | null
          sound_name?: string | null
          sound_url?: string | null
          hashtags?: string[] | null
          category?: string | null
          duration_seconds?: number | null
          metadata?: Json | null
          archived_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trending_sounds: {
        Row: {
          id: string
          sound_name: string
          sound_url: string | null
          video_count: number | null
          total_views: number | null
          growth_rate: number | null
          velocity_score: number | null
          trend_phase: string | null
          first_seen: string | null
          last_seen: string | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          sound_name: string
          sound_url?: string | null
          video_count?: number | null
          total_views?: number | null
          growth_rate?: number | null
          velocity_score?: number | null
          trend_phase?: string | null
          first_seen?: string | null
          last_seen?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          sound_name?: string
          sound_url?: string | null
          video_count?: number | null
          total_views?: number | null
          growth_rate?: number | null
          velocity_score?: number | null
          trend_phase?: string | null
          first_seen?: string | null
          last_seen?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          id: string
          user_id: string
          period_start: string
          period_type: string
          analysis_count: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          period_start: string
          period_type: string
          analysis_count?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          period_start?: string
          period_type?: string
          analysis_count?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
