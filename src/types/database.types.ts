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
      account_posts: {
        Row: {
          account_id: string
          caption: string
          comments: number
          created_at: string
          handle: string
          hashtags: string[]
          id: string
          is_pinned: boolean
          likes: number
          pillar_id: string | null
          platform: string
          post_id: string
          posted_at: string | null
          saves: number
          shares: number
          updated_at: string
          user_id: string
          views: number
        }
        Insert: {
          account_id: string
          caption?: string
          comments?: number
          created_at?: string
          handle: string
          hashtags?: string[]
          id?: string
          is_pinned?: boolean
          likes?: number
          pillar_id?: string | null
          platform?: string
          post_id: string
          posted_at?: string | null
          saves?: number
          shares?: number
          updated_at?: string
          user_id: string
          views?: number
        }
        Update: {
          account_id?: string
          caption?: string
          comments?: number
          created_at?: string
          handle?: string
          hashtags?: string[]
          id?: string
          is_pinned?: boolean
          likes?: number
          pillar_id?: string | null
          platform?: string
          post_id?: string
          posted_at?: string | null
          saves?: number
          shares?: number
          updated_at?: string
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_posts_pillar_fk"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      account_snapshots: {
        Row: {
          account_id: string
          created_at: string
          follower_count: number
          following_count: number | null
          handle: string
          heart_count: number
          id: string
          platform: string
          recent_views: number | null
          snapshot_date: string
          user_id: string
          video_count: number
        }
        Insert: {
          account_id: string
          created_at?: string
          follower_count: number
          following_count?: number | null
          handle: string
          heart_count: number
          id?: string
          platform?: string
          recent_views?: number | null
          snapshot_date?: string
          user_id: string
          video_count: number
        }
        Update: {
          account_id?: string
          created_at?: string
          follower_count?: number
          following_count?: number | null
          handle?: string
          heart_count?: number
          id?: string
          platform?: string
          recent_views?: number | null
          snapshot_date?: string
          user_id?: string
          video_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      affiliate_links: {
        Row: {
          clicks: number
          commission_rate_pct: number
          conversions: number
          created_at: string
          deal_id: string | null
          earnings_cents: number
          id: string
          product_name: string
          short_code: string
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          clicks?: number
          commission_rate_pct?: number
          conversions?: number
          created_at?: string
          deal_id?: string | null
          earnings_cents?: number
          id?: string
          product_name: string
          short_code: string
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          clicks?: number
          commission_rate_pct?: number
          conversions?: number
          created_at?: string
          deal_id?: string | null
          earnings_cents?: number
          id?: string
          product_name?: string
          short_code?: string
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_chats: {
        Row: {
          analysis_id: string
          content: string
          created_at: string
          id: string
          role: string
          scope: string | null
          user_id: string
        }
        Insert: {
          analysis_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          scope?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          scope?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_chats_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_results: {
        Row: {
          analysis_override: Json | null
          anti_virality_gated: boolean | null
          audio_description: string | null
          behavioral_predictions: Json | null
          confidence: number | null
          confidence_label: string | null
          content_hash: string | null
          content_text: string
          content_type: string
          conversation_themes: Json | null
          cost_cents: number | null
          counterfactuals: Json | null
          created_at: string | null
          deepseek_model: string | null
          deleted_at: string | null
          emotion_arc: Json | null
          engine_version: string | null
          factors: Json | null
          feature_vector: Json | null
          gemini_model: string | null
          gemini_score: number | null
          has_video: boolean | null
          heatmap: Json | null
          hook_decomposition: Json | null
          id: string
          input_mode: string | null
          insights: string | null
          latency_ms: number | null
          ml_score: number | null
          mode: string
          optimal_post_override: Json | null
          optimal_post_window: Json | null
          overall_score: number | null
          parent_id: string | null
          persona_behavioral_aggregate: Json | null
          personas: Json | null
          project_id: string | null
          reasoning: string | null
          retrieval_evidence: Json | null
          retrieval_score: number | null
          rule_score: number | null
          score_weights: Json | null
          script_result: Json | null
          signal_availability: Json | null
          society_id: string | null
          suggestions: Json | null
          trend_score: number | null
          updated_at: string | null
          user_id: string
          variants: Json | null
          verbatim: Json | null
          video_storage_path: string | null
          warnings: string[] | null
        }
        Insert: {
          analysis_override?: Json | null
          anti_virality_gated?: boolean | null
          audio_description?: string | null
          behavioral_predictions?: Json | null
          confidence?: number | null
          confidence_label?: string | null
          content_hash?: string | null
          content_text: string
          content_type: string
          conversation_themes?: Json | null
          cost_cents?: number | null
          counterfactuals?: Json | null
          created_at?: string | null
          deepseek_model?: string | null
          deleted_at?: string | null
          emotion_arc?: Json | null
          engine_version?: string | null
          factors?: Json | null
          feature_vector?: Json | null
          gemini_model?: string | null
          gemini_score?: number | null
          has_video?: boolean | null
          heatmap?: Json | null
          hook_decomposition?: Json | null
          id: string
          input_mode?: string | null
          insights?: string | null
          latency_ms?: number | null
          ml_score?: number | null
          mode?: string
          optimal_post_override?: Json | null
          optimal_post_window?: Json | null
          overall_score?: number | null
          parent_id?: string | null
          persona_behavioral_aggregate?: Json | null
          personas?: Json | null
          project_id?: string | null
          reasoning?: string | null
          retrieval_evidence?: Json | null
          retrieval_score?: number | null
          rule_score?: number | null
          score_weights?: Json | null
          script_result?: Json | null
          signal_availability?: Json | null
          society_id?: string | null
          suggestions?: Json | null
          trend_score?: number | null
          updated_at?: string | null
          user_id: string
          variants?: Json | null
          verbatim?: Json | null
          video_storage_path?: string | null
          warnings?: string[] | null
        }
        Update: {
          analysis_override?: Json | null
          anti_virality_gated?: boolean | null
          audio_description?: string | null
          behavioral_predictions?: Json | null
          confidence?: number | null
          confidence_label?: string | null
          content_hash?: string | null
          content_text?: string
          content_type?: string
          conversation_themes?: Json | null
          cost_cents?: number | null
          counterfactuals?: Json | null
          created_at?: string | null
          deepseek_model?: string | null
          deleted_at?: string | null
          emotion_arc?: Json | null
          engine_version?: string | null
          factors?: Json | null
          feature_vector?: Json | null
          gemini_model?: string | null
          gemini_score?: number | null
          has_video?: boolean | null
          heatmap?: Json | null
          hook_decomposition?: Json | null
          id?: string
          input_mode?: string | null
          insights?: string | null
          latency_ms?: number | null
          ml_score?: number | null
          mode?: string
          optimal_post_override?: Json | null
          optimal_post_window?: Json | null
          overall_score?: number | null
          parent_id?: string | null
          persona_behavioral_aggregate?: Json | null
          personas?: Json | null
          project_id?: string | null
          reasoning?: string | null
          retrieval_evidence?: Json | null
          retrieval_score?: number | null
          rule_score?: number | null
          score_weights?: Json | null
          script_result?: Json | null
          signal_availability?: Json | null
          society_id?: string | null
          suggestions?: Json | null
          trend_score?: number | null
          updated_at?: string | null
          user_id?: string
          variants?: Json | null
          verbatim?: Json | null
          video_storage_path?: string | null
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiences: {
        Row: {
          calibration: Json | null
          created_at: string
          creator_persona: Json | null
          cross_niche: number
          custom_context: Json
          fyp: number
          goal_intent: string | null
          goal_label: string | null
          id: string
          is_general: boolean
          is_preset: boolean
          loyalist: number
          mode: string
          name: string
          niche: number
          personas: Json
          platform: string
          profile: Json | null
          signature: Json | null
          source_account_id: string | null
          success_criterion: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calibration?: Json | null
          created_at?: string
          creator_persona?: Json | null
          cross_niche?: number
          custom_context?: Json
          fyp?: number
          goal_intent?: string | null
          goal_label?: string | null
          id?: string
          is_general?: boolean
          is_preset?: boolean
          loyalist?: number
          mode?: string
          name: string
          niche?: number
          personas?: Json
          platform: string
          profile?: Json | null
          signature?: Json | null
          source_account_id?: string | null
          success_criterion?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calibration?: Json | null
          created_at?: string
          creator_persona?: Json | null
          cross_niche?: number
          custom_context?: Json
          fyp?: number
          goal_intent?: string | null
          goal_label?: string | null
          id?: string
          is_general?: boolean
          is_preset?: boolean
          loyalist?: number
          mode?: string
          name?: string
          niche?: number
          personas?: Json
          platform?: string
          profile?: Json | null
          signature?: Json | null
          source_account_id?: string | null
          success_criterion?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiences_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_results: {
        Row: {
          corpus_version: string
          cost_cents_avg: number | null
          cost_cents_total: number | null
          created_at: string | null
          deleted_at: string | null
          drift_metrics: Json | null
          ece: number | null
          engine_version: string
          failure_cases: Json | null
          id: string
          latency_p50: number | null
          latency_p95: number | null
          latency_p99: number | null
          macro_f1: number
          mae_engagement_rate: number | null
          notes: string | null
          per_class_metrics: Json | null
          per_niche_f1: Json
          run_at: string | null
          signal_contribution: Json | null
          spearman_within_niche: Json | null
          stage_timings: Json | null
          under_precision: number | null
          updated_at: string | null
          viral_recall: number | null
        }
        Insert: {
          corpus_version: string
          cost_cents_avg?: number | null
          cost_cents_total?: number | null
          created_at?: string | null
          deleted_at?: string | null
          drift_metrics?: Json | null
          ece?: number | null
          engine_version: string
          failure_cases?: Json | null
          id?: string
          latency_p50?: number | null
          latency_p95?: number | null
          latency_p99?: number | null
          macro_f1: number
          mae_engagement_rate?: number | null
          notes?: string | null
          per_class_metrics?: Json | null
          per_niche_f1: Json
          run_at?: string | null
          signal_contribution?: Json | null
          spearman_within_niche?: Json | null
          stage_timings?: Json | null
          under_precision?: number | null
          updated_at?: string | null
          viral_recall?: number | null
        }
        Update: {
          corpus_version?: string
          cost_cents_avg?: number | null
          cost_cents_total?: number | null
          created_at?: string | null
          deleted_at?: string | null
          drift_metrics?: Json | null
          ece?: number | null
          engine_version?: string
          failure_cases?: Json | null
          id?: string
          latency_p50?: number | null
          latency_p95?: number | null
          latency_p99?: number | null
          macro_f1?: number
          mae_engagement_rate?: number | null
          notes?: string | null
          per_class_metrics?: Json | null
          per_niche_f1?: Json
          run_at?: string | null
          signal_contribution?: Json | null
          spearman_within_niche?: Json | null
          stage_timings?: Json | null
          under_precision?: number | null
          updated_at?: string | null
          viral_recall?: number | null
        }
        Relationships: []
      }
      competitor_intelligence: {
        Row: {
          analysis_type: string
          competitor_id: string
          completion_tokens: number | null
          created_at: string | null
          generated_at: string
          id: string
          insights: Json
          model_used: string | null
          prompt_tokens: number | null
          user_id: string | null
        }
        Insert: {
          analysis_type: string
          competitor_id: string
          completion_tokens?: number | null
          created_at?: string | null
          generated_at?: string
          id?: string
          insights: Json
          model_used?: string | null
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          analysis_type?: string
          competitor_id?: string
          completion_tokens?: number | null
          created_at?: string | null
          generated_at?: string
          id?: string
          insights?: Json
          model_used?: string | null
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_intelligence_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          follower_count: number | null
          following_count: number | null
          heart_count: number | null
          id: string
          last_scraped_at: string | null
          scrape_status: string | null
          tiktok_handle: string
          updated_at: string | null
          verified: boolean | null
          video_count: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          heart_count?: number | null
          id?: string
          last_scraped_at?: string | null
          scrape_status?: string | null
          tiktok_handle: string
          updated_at?: string | null
          verified?: boolean | null
          video_count?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          heart_count?: number | null
          id?: string
          last_scraped_at?: string | null
          scrape_status?: string | null
          tiktok_handle?: string
          updated_at?: string | null
          verified?: boolean | null
          video_count?: number | null
        }
        Relationships: []
      }
      competitor_snapshots: {
        Row: {
          competitor_id: string
          created_at: string | null
          follower_count: number
          following_count: number
          heart_count: number
          id: string
          snapshot_date: string
          video_count: number
        }
        Insert: {
          competitor_id: string
          created_at?: string | null
          follower_count: number
          following_count: number
          heart_count: number
          id?: string
          snapshot_date?: string
          video_count: number
        }
        Update: {
          competitor_id?: string
          created_at?: string | null
          follower_count?: number
          following_count?: number
          heart_count?: number
          id?: string
          snapshot_date?: string
          video_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "competitor_snapshots_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_videos: {
        Row: {
          caption: string | null
          comments: number | null
          competitor_id: string
          cover_url: string | null
          created_at: string | null
          duration_seconds: number | null
          hashtags: string[] | null
          id: string
          likes: number | null
          platform_video_id: string
          posted_at: string | null
          saves: number | null
          shares: number | null
          updated_at: string | null
          video_url: string | null
          views: number | null
        }
        Insert: {
          caption?: string | null
          comments?: number | null
          competitor_id: string
          cover_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          hashtags?: string[] | null
          id?: string
          likes?: number | null
          platform_video_id: string
          posted_at?: string | null
          saves?: number | null
          shares?: number | null
          updated_at?: string | null
          video_url?: string | null
          views?: number | null
        }
        Update: {
          caption?: string | null
          comments?: number | null
          competitor_id?: string
          cover_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          hashtags?: string[] | null
          id?: string
          likes?: number | null
          platform_video_id?: string
          posted_at?: string | null
          saves?: number | null
          shares?: number | null
          updated_at?: string | null
          video_url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_videos_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          connection_method: string
          created_at: string
          display_name: string | null
          handle: string
          id: string
          is_primary: boolean
          last_synced_at: string | null
          platform: string
          user_id: string
        }
        Insert: {
          connection_method?: string
          created_at?: string
          display_name?: string | null
          handle: string
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          platform?: string
          user_id: string
        }
        Update: {
          connection_method?: string
          created_at?: string
          display_name?: string | null
          handle?: string
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      content_pillars: {
        Row: {
          confirmed: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      creator_persona_weights: {
        Row: {
          cross_niche: number
          fyp: number
          loyalist: number
          niche: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cross_niche?: number
          fyp?: number
          loyalist?: number
          niche?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cross_niche?: number
          fyp?: number
          loyalist?: number
          niche?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          analysis_count: number
          avatar_url: string | null
          bio: string | null
          content_style: string | null
          created_at: string | null
          creator_stage: string | null
          cuts_per_second: string | null
          display_name: string | null
          engagement_rate: number | null
          id: string
          instagram_followers: number | null
          instagram_handle: string | null
          niche_primary: string | null
          niche_sub: string | null
          niches: string[] | null
          onboarding_completed_at: string | null
          onboarding_step: string | null
          pain_points: string | null
          past_flops: Json | null
          past_wins: Json | null
          posting_frequency: string | null
          primary_goal: string | null
          profile_interview_seen_at: string | null
          reference_creators: Json | null
          storage_retention_opted_in: boolean
          target_audience: Json | null
          target_platforms: string[] | null
          tiktok_followers: number | null
          tiktok_handle: string | null
          time_of_day_aware: boolean | null
          twitter_followers: number | null
          twitter_handle: string | null
          updated_at: string | null
          user_id: string
          youtube_handle: string | null
          youtube_subscribers: number | null
        }
        Insert: {
          analysis_count?: number
          avatar_url?: string | null
          bio?: string | null
          content_style?: string | null
          created_at?: string | null
          creator_stage?: string | null
          cuts_per_second?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          niche_primary?: string | null
          niche_sub?: string | null
          niches?: string[] | null
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          pain_points?: string | null
          past_flops?: Json | null
          past_wins?: Json | null
          posting_frequency?: string | null
          primary_goal?: string | null
          profile_interview_seen_at?: string | null
          reference_creators?: Json | null
          storage_retention_opted_in?: boolean
          target_audience?: Json | null
          target_platforms?: string[] | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          time_of_day_aware?: boolean | null
          twitter_followers?: number | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_id: string
          youtube_handle?: string | null
          youtube_subscribers?: number | null
        }
        Update: {
          analysis_count?: number
          avatar_url?: string | null
          bio?: string | null
          content_style?: string | null
          created_at?: string | null
          creator_stage?: string | null
          cuts_per_second?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          niche_primary?: string | null
          niche_sub?: string | null
          niches?: string[] | null
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          pain_points?: string | null
          past_flops?: Json | null
          past_wins?: Json | null
          posting_frequency?: string | null
          primary_goal?: string | null
          profile_interview_seen_at?: string | null
          reference_creators?: Json | null
          storage_retention_opted_in?: boolean
          target_audience?: Json | null
          target_platforms?: string[] | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          time_of_day_aware?: boolean | null
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
      engine_training_videos: {
        Row: {
          bucket_match: boolean | null
          created_at: string
          creator_handle: string | null
          duration_seconds: number | null
          engine_evaluated_at: string | null
          engine_feature_vector: Json | null
          engine_overall_score: number | null
          engine_predicted_bucket: string | null
          engine_prediction: Json | null
          engine_version: string | null
          follower_count: number | null
          id: string
          niche: string | null
          platform: string
          platform_video_id: string
          posted_at: string | null
          prediction_error: number | null
          real_bucket: string | null
          real_comments: number | null
          real_completion_pct: number | null
          real_likes: number | null
          real_percentile: number | null
          real_saves: number | null
          real_shares: number | null
          real_views: number | null
          scraped_at: string
          society_id: string | null
          status: string
          updated_at: string
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          bucket_match?: boolean | null
          created_at?: string
          creator_handle?: string | null
          duration_seconds?: number | null
          engine_evaluated_at?: string | null
          engine_feature_vector?: Json | null
          engine_overall_score?: number | null
          engine_predicted_bucket?: string | null
          engine_prediction?: Json | null
          engine_version?: string | null
          follower_count?: number | null
          id?: string
          niche?: string | null
          platform?: string
          platform_video_id: string
          posted_at?: string | null
          prediction_error?: number | null
          real_bucket?: string | null
          real_comments?: number | null
          real_completion_pct?: number | null
          real_likes?: number | null
          real_percentile?: number | null
          real_saves?: number | null
          real_shares?: number | null
          real_views?: number | null
          scraped_at?: string
          society_id?: string | null
          status?: string
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          bucket_match?: boolean | null
          created_at?: string
          creator_handle?: string | null
          duration_seconds?: number | null
          engine_evaluated_at?: string | null
          engine_feature_vector?: Json | null
          engine_overall_score?: number | null
          engine_predicted_bucket?: string | null
          engine_prediction?: Json | null
          engine_version?: string | null
          follower_count?: number | null
          id?: string
          niche?: string | null
          platform?: string
          platform_video_id?: string
          posted_at?: string | null
          prediction_error?: number | null
          real_bucket?: string | null
          real_comments?: number | null
          real_completion_pct?: number | null
          real_likes?: number | null
          real_percentile?: number | null
          real_saves?: number | null
          real_shares?: number | null
          real_views?: number | null
          scraped_at?: string
          society_id?: string | null
          status?: string
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: Json
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          body?: Json
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          body?: Json
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      niche_post_windows: {
        Row: {
          computed_at: string
          day_of_week: string
          hour_end: number
          hour_start: number
          niche: string
          sample_size: number
        }
        Insert: {
          computed_at?: string
          day_of_week: string
          hour_end: number
          hour_start: number
          niche: string
          sample_size: number
        }
        Update: {
          computed_at?: string
          day_of_week?: string
          hour_end?: number
          hour_start?: number
          niche?: string
          sample_size?: number
        }
        Relationships: []
      }
      outcome_signatures: {
        Row: {
          analysis_id: string | null
          audience_id: string | null
          created_at: string
          id: string
          platform_post_url: string | null
          posted_at: string | null
          predicted_vector: Json
          raw_metrics: Json | null
          realized_provenance: Json | null
          realized_vector: Json | null
          source: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          audience_id?: string | null
          created_at?: string
          id?: string
          platform_post_url?: string | null
          posted_at?: string | null
          predicted_vector: Json
          raw_metrics?: Json | null
          realized_provenance?: Json | null
          realized_vector?: Json | null
          source?: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          audience_id?: string | null
          created_at?: string
          id?: string
          platform_post_url?: string | null
          posted_at?: string | null
          predicted_vector?: Json
          raw_metrics?: Json | null
          realized_provenance?: Json | null
          realized_vector?: Json | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_signatures_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          analysis_id: string
          captured_at: string | null
          creator_note: string | null
          creator_rating: number | null
          id: string
          posted_at: string | null
          real_comment_pct: number | null
          real_completion_pct: number | null
          real_save_pct: number | null
          real_share_pct: number | null
          real_views: number | null
          source: string
        }
        Insert: {
          analysis_id: string
          captured_at?: string | null
          creator_note?: string | null
          creator_rating?: number | null
          id?: string
          posted_at?: string | null
          real_comment_pct?: number | null
          real_completion_pct?: number | null
          real_save_pct?: number | null
          real_share_pct?: number | null
          real_views?: number | null
          source?: string
        }
        Update: {
          analysis_id?: string
          captured_at?: string | null
          creator_note?: string | null
          creator_rating?: number | null
          id?: string
          posted_at?: string | null
          real_comment_pct?: number | null
          real_completion_pct?: number | null
          real_save_pct?: number | null
          real_share_pct?: number | null
          real_views?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_posts: {
        Row: {
          content_id: string
          created_at: string
          format: string
          id: string
          personas: Json
          scheduled_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          format?: string
          id?: string
          personas?: Json
          scheduled_date: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          format?: string
          id?: string
          personas?: Json
          scheduled_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      reconciliations: {
        Row: {
          audience_id: string | null
          classification: Json
          confirmed_at: string | null
          created_at: string
          divergence_vector: Json
          follower_tier: string | null
          goal_intent: string | null
          id: string
          niche: string | null
          outcome_signature_id: string | null
          predicted_vector: Json
          proposal_state: string
          proposed_delta: Json | null
          realized_vector: Json
          user_id: string
        }
        Insert: {
          audience_id?: string | null
          classification: Json
          confirmed_at?: string | null
          created_at?: string
          divergence_vector: Json
          follower_tier?: string | null
          goal_intent?: string | null
          id?: string
          niche?: string | null
          outcome_signature_id?: string | null
          predicted_vector: Json
          proposal_state?: string
          proposed_delta?: Json | null
          realized_vector: Json
          user_id: string
        }
        Update: {
          audience_id?: string | null
          classification?: Json
          confirmed_at?: string | null
          created_at?: string
          divergence_vector?: Json
          follower_tier?: string | null
          goal_intent?: string | null
          id?: string
          niche?: string | null
          outcome_signature_id?: string | null
          predicted_vector?: Json
          proposal_state?: string
          proposed_delta?: Json | null
          realized_vector?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_outcome_signature_id_fkey"
            columns: ["outcome_signature_id"]
            isOneToOne: false
            referencedRelation: "outcome_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          clicked_at: string | null
          id: string
          ip_hash: string | null
          referral_code: string
          referred_user_id: string | null
          referrer_url: string | null
          referrer_user_id: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          ip_hash?: string | null
          referral_code: string
          referred_user_id?: string | null
          referrer_url?: string | null
          referrer_user_id: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string | null
          id?: string
          ip_hash?: string | null
          referral_code?: string
          referred_user_id?: string | null
          referrer_url?: string | null
          referrer_user_id?: string
          user_agent?: string | null
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
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_conversions: {
        Row: {
          bonus_cents: number
          converted_at: string | null
          id: string
          metadata: Json | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          whop_membership_id: string
        }
        Insert: {
          bonus_cents: number
          converted_at?: string | null
          id?: string
          metadata?: Json | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          whop_membership_id: string
        }
        Update: {
          bonus_cents?: number
          converted_at?: string | null
          id?: string
          metadata?: Json | null
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          whop_membership_id?: string
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
      rule_library: {
        Row: {
          accuracy_rate: number | null
          category: string
          created_at: string | null
          description: string | null
          evaluation_prompt: string | null
          evaluation_tier: string | null
          id: string
          is_active: boolean | null
          max_score: number
          name: string
          pattern: string | null
          platform: string | null
          rule_contributions: Json | null
          sample_count: number | null
          score_modifier: number | null
          updated_at: string | null
          weight: number
        }
        Insert: {
          accuracy_rate?: number | null
          category: string
          created_at?: string | null
          description?: string | null
          evaluation_prompt?: string | null
          evaluation_tier?: string | null
          id?: string
          is_active?: boolean | null
          max_score?: number
          name: string
          pattern?: string | null
          platform?: string | null
          rule_contributions?: Json | null
          sample_count?: number | null
          score_modifier?: number | null
          updated_at?: string | null
          weight?: number
        }
        Update: {
          accuracy_rate?: number | null
          category?: string
          created_at?: string | null
          description?: string | null
          evaluation_prompt?: string | null
          evaluation_tier?: string | null
          id?: string
          is_active?: boolean | null
          max_score?: number
          name?: string
          pattern?: string | null
          platform?: string | null
          rule_contributions?: Json | null
          sample_count?: number | null
          score_modifier?: number | null
          updated_at?: string | null
          weight?: number
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          ref_id: string | null
          snapshot: Json
          thread_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          ref_id?: string | null
          snapshot: Json
          thread_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          ref_id?: string | null
          snapshot?: Json
          thread_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_videos: {
        Row: {
          archived_at: string | null
          author: string | null
          author_url: string | null
          baseline_label: string | null
          category: string | null
          comments: number | null
          created_at: string | null
          creator_handle: string | null
          description: string | null
          duration_seconds: number | null
          embedding: string | null
          engagement_rate: number | null
          follower_tier: string | null
          hashtags: string[] | null
          id: string
          likes: number | null
          metadata: Json | null
          outlier_multiplier: number | null
          platform: string
          platform_video_id: string
          posted_at: string | null
          primary_niche: string | null
          shares: number | null
          sound_name: string | null
          sound_url: string | null
          updated_at: string | null
          video_url: string | null
          views: number | null
        }
        Insert: {
          archived_at?: string | null
          author?: string | null
          author_url?: string | null
          baseline_label?: string | null
          category?: string | null
          comments?: number | null
          created_at?: string | null
          creator_handle?: string | null
          description?: string | null
          duration_seconds?: number | null
          embedding?: string | null
          engagement_rate?: number | null
          follower_tier?: string | null
          hashtags?: string[] | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          outlier_multiplier?: number | null
          platform?: string
          platform_video_id: string
          posted_at?: string | null
          primary_niche?: string | null
          shares?: number | null
          sound_name?: string | null
          sound_url?: string | null
          updated_at?: string | null
          video_url?: string | null
          views?: number | null
        }
        Update: {
          archived_at?: string | null
          author?: string | null
          author_url?: string | null
          baseline_label?: string | null
          category?: string | null
          comments?: number | null
          created_at?: string | null
          creator_handle?: string | null
          description?: string | null
          duration_seconds?: number | null
          embedding?: string | null
          engagement_rate?: number | null
          follower_tier?: string | null
          hashtags?: string[] | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          outlier_multiplier?: number | null
          platform?: string
          platform_video_id?: string
          posted_at?: string | null
          primary_niche?: string | null
          shares?: number | null
          sound_name?: string | null
          sound_url?: string | null
          updated_at?: string | null
          video_url?: string | null
          views?: number | null
        }
        Relationships: []
      }
      surface_reactions: {
        Row: {
          audience_key: string
          cards: Json
          created_at: string
          id: string
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_key: string
          cards: Json
          created_at?: string
          id?: string
          kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_key?: string
          cards?: Json
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          joined_at: string | null
          role: string
          status: string
          team_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          team_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          active_audience_id: string | null
          created_at: string
          id: string
          reading_id: string | null
          sim_seals: Json
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_audience_id?: string | null
          created_at?: string
          id?: string
          reading_id?: string | null
          sim_seals?: Json
          title?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_audience_id?: string | null
          created_at?: string
          id?: string
          reading_id?: string | null
          sim_seals?: Json
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_active_audience_id_fkey"
            columns: ["active_audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_accounts: {
        Row: {
          created_at: string | null
          handle: string
          id: string
          is_active: boolean | null
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          handle: string
          id?: string
          is_active?: boolean | null
          platform?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          handle?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      tracked_accounts: {
        Row: {
          created_at: string
          handle: string
          id: string
          platform: string
          source_video_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          platform?: string
          source_video_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          platform?: string
          source_video_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      training_corpus: {
        Row: {
          bucket: string
          bucket_target: string | null
          caption: string | null
          comments: number | null
          completion_pct: number | null
          corpus_version: string
          created_at: string | null
          creator_handle: string | null
          duration_seconds: number | null
          embedding: string | null
          follower_count: number | null
          follower_tier: string | null
          hashtags: string[] | null
          id: string
          likes: number | null
          metadata: Json | null
          niche: string
          platform: string
          platform_video_id: string
          posted_at: string | null
          saves: number | null
          scraped_at: string | null
          shares: number | null
          sound_name: string | null
          updated_at: string | null
          video_url: string | null
          views: number | null
        }
        Insert: {
          bucket: string
          bucket_target?: string | null
          caption?: string | null
          comments?: number | null
          completion_pct?: number | null
          corpus_version: string
          created_at?: string | null
          creator_handle?: string | null
          duration_seconds?: number | null
          embedding?: string | null
          follower_count?: number | null
          follower_tier?: string | null
          hashtags?: string[] | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          niche: string
          platform?: string
          platform_video_id: string
          posted_at?: string | null
          saves?: number | null
          scraped_at?: string | null
          shares?: number | null
          sound_name?: string | null
          updated_at?: string | null
          video_url?: string | null
          views?: number | null
        }
        Update: {
          bucket?: string
          bucket_target?: string | null
          caption?: string | null
          comments?: number | null
          completion_pct?: number | null
          corpus_version?: string
          created_at?: string | null
          creator_handle?: string | null
          duration_seconds?: number | null
          embedding?: string | null
          follower_count?: number | null
          follower_tier?: string | null
          hashtags?: string[] | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          niche?: string
          platform?: string
          platform_video_id?: string
          posted_at?: string | null
          saves?: number | null
          scraped_at?: string | null
          shares?: number | null
          sound_name?: string | null
          updated_at?: string | null
          video_url?: string | null
          views?: number | null
        }
        Relationships: []
      }
      trending_sounds: {
        Row: {
          audio_description: string | null
          audio_embedding: string | null
          created_at: string | null
          first_seen: string | null
          growth_rate: number | null
          id: string
          last_seen: string | null
          metadata: Json | null
          sound_name: string
          sound_url: string | null
          total_views: number | null
          trend_phase: string | null
          updated_at: string | null
          velocity_score: number | null
          video_count: number | null
        }
        Insert: {
          audio_description?: string | null
          audio_embedding?: string | null
          created_at?: string | null
          first_seen?: string | null
          growth_rate?: number | null
          id?: string
          last_seen?: string | null
          metadata?: Json | null
          sound_name: string
          sound_url?: string | null
          total_views?: number | null
          trend_phase?: string | null
          updated_at?: string | null
          velocity_score?: number | null
          video_count?: number | null
        }
        Update: {
          audio_description?: string | null
          audio_embedding?: string | null
          created_at?: string | null
          first_seen?: string | null
          growth_rate?: number | null
          id?: string
          last_seen?: string | null
          metadata?: Json | null
          sound_name?: string
          sound_url?: string | null
          total_views?: number | null
          trend_phase?: string | null
          updated_at?: string | null
          velocity_score?: number | null
          video_count?: number | null
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          analysis_count: number
          created_at: string | null
          id: string
          period_start: string
          period_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_count?: number
          created_at?: string | null
          id?: string
          period_start: string
          period_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_count?: number
          created_at?: string | null
          id?: string
          period_start?: string
          period_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_bookmarks: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      user_competitors: {
        Row: {
          added_at: string | null
          competitor_id: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          competitor_id: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          competitor_id?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_competitors_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          avatar_url: string | null
          company: string | null
          display_name: string | null
          last_audience_id: string | null
          notification_email_updates: boolean
          notification_marketing: boolean
          notification_test_results: boolean
          notification_weekly_digest: boolean
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          display_name?: string | null
          last_audience_id?: string | null
          notification_email_updates?: boolean
          notification_marketing?: boolean
          notification_test_results?: boolean
          notification_weekly_digest?: boolean
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          display_name?: string | null
          last_audience_id?: string | null
          notification_email_updates?: boolean
          notification_marketing?: boolean
          notification_test_results?: boolean
          notification_weekly_digest?: boolean
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_last_audience_id_fkey"
            columns: ["last_audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          id: string
          is_trial: boolean | null
          last_synced_at: string | null
          status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
          virtuna_tier: string
          whop_membership_id: string | null
          whop_product_id: string | null
          whop_user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          is_trial?: boolean | null
          last_synced_at?: string | null
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
          virtuna_tier?: string
          whop_membership_id?: string | null
          whop_product_id?: string | null
          whop_user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          is_trial?: boolean | null
          last_synced_at?: string | null
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string
          virtuna_tier?: string
          whop_membership_id?: string | null
          whop_product_id?: string | null
          whop_user_id?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
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
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_filmstrips: { Args: never; Returns: undefined }
      compute_niche_percentiles: {
        Args: {
          p_exclude_user_id?: string
          p_min_cohort_size?: number
          p_society_id: string
        }
        Returns: {
          count: number
          histogram: number[]
          median: number
          p75: number
        }[]
      }
      increment_creator_analysis_count: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      jsonb_deep_merge: { Args: { a: Json; b: Json }; Returns: Json }
      match_corpus_videos: {
        Args: {
          filter_follower_tier: string
          filter_niche: string
          filter_platform: string
          match_count: number
          query_embedding: string
        }
        Returns: {
          bucket_label: string
          caption: string
          comments: number
          creator_handle: string
          follower_count: number
          hashtags: string[]
          likes: number
          niche: string
          posted_at: string
          saves: number
          shares: number
          similarity: number
          source_id: string
          source_pool: string
          video_url: string
          views: number
        }[]
      }
      match_scraped_videos: {
        Args: {
          filter_follower_tier: string
          filter_niche: string
          filter_platform: string
          match_count: number
          query_embedding: string
        }
        Returns: {
          bucket_label: string
          caption: string
          comments: number
          creator_handle: string
          follower_count: number
          hashtags: string[]
          likes: number
          niche: string
          posted_at: string
          saves: number
          shares: number
          similarity: number
          source_id: string
          source_pool: string
          video_url: string
          views: number
        }[]
      }
      match_trending_sound_by_audio: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
          sound_name: string
          sound_url: string
          trend_phase: string
          velocity_score: number
        }[]
      }
      patch_analysis_variants: {
        Args: { p_id: string; p_patch: Json; p_user_id?: string }
        Returns: undefined
      }
      refresh_niche_post_windows: { Args: never; Returns: undefined }
      waitlist_count: { Args: never; Returns: number }
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
