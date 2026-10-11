// Generated from the Postory Supabase schema (supabase/migrations).
// Regenerate with: npx supabase gen types typescript --project-id <ref> > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_snapshots: {
        Row: {
          created_at: string
          engagements: number | null
          followers: number | null
          id: string
          impressions: number | null
          metric_date: string
          metrics: Json
          platform: string
          social_account_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engagements?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          metric_date: string
          metrics?: Json
          platform: string
          social_account_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          engagements?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          metric_date?: string
          metrics?: Json
          platform?: string
          social_account_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_email_sends: {
        Row: {
          created_at: string
          email_hash: string
          id: number
          ip_hash: string | null
          purpose: string
        }
        Insert: {
          created_at?: string
          email_hash: string
          id?: never
          ip_hash?: string | null
          purpose: string
        }
        Update: {
          created_at?: string
          email_hash?: string
          id?: never
          ip_hash?: string | null
          purpose?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          kind: string
          plan: string | null
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          plan?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          plan?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_memory: {
        Row: {
          category: string
          confidence: number
          created_at: string
          id: string
          key: string
          source: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          category: string
          confidence?: number
          created_at?: string
          id?: string
          key: string
          source?: string
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          key?: string
          source?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          author_handle: string | null
          author_name: string | null
          category: string
          content: string
          created_at: string
          external_id: string
          external_url: string | null
          id: string
          kind: string
          platform: string
          received_at: string
          replied_at: string | null
          reply_draft: string | null
          reply_status: string
          social_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          author_handle?: string | null
          author_name?: string | null
          category?: string
          content: string
          created_at?: string
          external_id: string
          external_url?: string | null
          id?: string
          kind: string
          platform: string
          received_at?: string
          replied_at?: string | null
          reply_draft?: string | null
          reply_status?: string
          social_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          author_handle?: string | null
          author_name?: string | null
          category?: string
          content?: string
          created_at?: string
          external_id?: string
          external_url?: string | null
          id?: string
          kind?: string
          platform?: string
          received_at?: string
          replied_at?: string | null
          reply_draft?: string | null
          reply_status?: string
          social_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_preferences: Json
          avatar_url: string | null
          business_description: string | null
          business_name: string | null
          business_type: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_step: string
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          ai_preferences?: Json
          avatar_url?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: string
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          ai_preferences?: Json
          avatar_url?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: string
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          connected_at: string
          created_at: string
          display_name: string | null
          external_account_id: string
          id: string
          last_synced_at: string | null
          metadata: Json
          platform: string
          profile_image_url: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          connected_at?: string
          created_at?: string
          display_name?: string | null
          external_account_id: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          platform: string
          profile_image_url?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          connected_at?: string
          created_at?: string
          display_name?: string | null
          external_account_id?: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          platform?: string
          profile_image_url?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      social_connection_attempts: {
        Row: {
          accounts_before: string[]
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          platform: string
          status: string
          user_id: string
        }
        Insert: {
          accounts_before?: string[]
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          platform: string
          status?: string
          user_id: string
        }
        Update: {
          accounts_before?: string[]
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          platform?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      social_workspaces: {
        Row: {
          created_at: string
          external_profile_id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_profile_id: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_profile_id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          angles: Json
          archived_at: string | null
          created_at: string
          id: string
          source_text: string
          source_type: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          angles?: Json
          archived_at?: string | null
          created_at?: string
          id?: string
          source_text: string
          source_type?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          angles?: Json
          archived_at?: string | null
          created_at?: string
          id?: string
          source_text?: string
          source_type?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      story_posts: {
        Row: {
          angle: string | null
          content: string
          created_at: string
          error_code: string | null
          error_message: string | null
          external_post_id: string | null
          external_url: string | null
          generated_content: string | null
          id: string
          idempotency_key: string
          last_edited_by: string
          media: Json
          media_suggestion: string | null
          platform: string
          provider_batch_id: string | null
          publish_attempts: number
          published_at: string | null
          reasoning: string | null
          scheduled_for: string | null
          social_account_id: string | null
          status: string
          story_id: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          angle?: string | null
          content?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          external_post_id?: string | null
          external_url?: string | null
          generated_content?: string | null
          id?: string
          idempotency_key?: string
          last_edited_by?: string
          media?: Json
          media_suggestion?: string | null
          platform: string
          provider_batch_id?: string | null
          publish_attempts?: number
          published_at?: string | null
          reasoning?: string | null
          scheduled_for?: string | null
          social_account_id?: string | null
          status?: string
          story_id: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          angle?: string | null
          content?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          external_post_id?: string | null
          external_url?: string | null
          generated_content?: string | null
          id?: string
          idempotency_key?: string
          last_edited_by?: string
          media?: Json
          media_suggestion?: string | null
          platform?: string
          provider_batch_id?: string | null
          publish_attempts?: number
          published_at?: string | null
          reasoning?: string | null
          scheduled_for?: string | null
          social_account_id?: string | null
          status?: string
          story_id?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_posts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_posts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_synced_at: string | null
          plan: string | null
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_synced_at?: string | null
          plan?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_synced_at?: string | null
          plan?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          id: number
          metric: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          metric: string
          quantity: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          metric?: string
          quantity?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_email_status: {
        Args: { p_email: string }
        Returns: {
          confirmed: boolean
          user_id: string
        }[]
      }
      claim_auth_email_send: {
        Args: { p_email_hash: string; p_ip_hash: string | null; p_purpose: string }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      consume_usage: {
        Args: {
          p_limit: number
          p_metric: string
          p_quantity: number
          p_since: string
          p_user_id: string
        }
        Returns: {
          allowed: boolean
          used: number
        }[]
      }
      search_stories: {
        Args: { q: string }
        Returns: {
          angles: Json
          archived_at: string | null
          created_at: string
          id: string
          source_text: string
          source_type: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "stories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
