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
      referral_codes: {
        Row: {
          id: string
          user_id: string
          code: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          code: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          created_at?: string | null
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          id: string
          referral_code: string
          referrer_user_id: string
          referred_user_id: string | null
          clicked_at: string | null
          referrer_url: string | null
          user_agent: string | null
          ip_hash: string | null
        }
        Insert: {
          id?: string
          referral_code: string
          referrer_user_id: string
          referred_user_id?: string | null
          clicked_at?: string | null
          referrer_url?: string | null
          user_agent?: string | null
          ip_hash?: string | null
        }
        Update: {
          id?: string
          referral_code?: string
          referrer_user_id?: string
          referred_user_id?: string | null
          clicked_at?: string | null
          referrer_url?: string | null
          user_agent?: string | null
          ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_referral_code_fkey"
            columns: ["referral_code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      referral_conversions: {
        Row: {
          id: string
          referrer_user_id: string
          referred_user_id: string
          referral_code: string
          whop_membership_id: string
          bonus_cents: number
          converted_at: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          referrer_user_id: string
          referred_user_id: string
          referral_code: string
          whop_membership_id: string
          bonus_cents: number
          converted_at?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          referrer_user_id?: string
          referred_user_id?: string
          referral_code?: string
          whop_membership_id?: string
          bonus_cents?: number
          converted_at?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_conversions_referral_code_fkey"
            columns: ["referral_code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["code"]
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
          onboarding_completed_at: string | null
          onboarding_step: string | null
          primary_goal: string | null
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
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          primary_goal?: string | null
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
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          primary_goal?: string | null
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
          is_trial: boolean | null
          trial_ends_at: string | null
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
          is_trial?: boolean | null
          trial_ends_at?: string | null
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
          is_trial?: boolean | null
          trial_ends_at?: string | null
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
          balance_after_cents?: number
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
      tiktok_accounts: {
        Row: {
          id: string
          user_id: string
          handle: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          handle: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          handle?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
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
