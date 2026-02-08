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
      admin_permissions: {
        Row: {
          added_by_user_id: string | null
          can_manage_admins: boolean
          can_manage_analytics: boolean
          can_manage_companies: boolean
          can_manage_feedbacks: boolean
          can_manage_finances: boolean
          can_manage_freelancers: boolean
          can_manage_identity: boolean
          can_manage_landing_page: boolean
          can_manage_payment_providers: boolean
          can_manage_payments: boolean
          can_manage_projects: boolean
          can_manage_tiers: boolean
          can_manage_users: boolean
          created_at: string
          id: string
          is_owner: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by_user_id?: string | null
          can_manage_admins?: boolean
          can_manage_analytics?: boolean
          can_manage_companies?: boolean
          can_manage_feedbacks?: boolean
          can_manage_finances?: boolean
          can_manage_freelancers?: boolean
          can_manage_identity?: boolean
          can_manage_landing_page?: boolean
          can_manage_payment_providers?: boolean
          can_manage_payments?: boolean
          can_manage_projects?: boolean
          can_manage_tiers?: boolean
          can_manage_users?: boolean
          created_at?: string
          id?: string
          is_owner?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by_user_id?: string | null
          can_manage_admins?: boolean
          can_manage_analytics?: boolean
          can_manage_companies?: boolean
          can_manage_feedbacks?: boolean
          can_manage_finances?: boolean
          can_manage_freelancers?: boolean
          can_manage_identity?: boolean
          can_manage_landing_page?: boolean
          can_manage_payment_providers?: boolean
          can_manage_payments?: boolean
          can_manage_projects?: boolean
          can_manage_tiers?: boolean
          can_manage_users?: boolean
          created_at?: string
          id?: string
          is_owner?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          element_class: string | null
          element_id: string | null
          element_text: string | null
          event_data: Json | null
          event_name: string
          id: string
          page_path: string | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          element_class?: string | null
          element_id?: string | null
          element_text?: string | null
          event_data?: Json | null
          event_name: string
          id?: string
          page_path?: string | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          element_class?: string | null
          element_id?: string | null
          element_text?: string | null
          event_data?: Json | null
          event_name?: string
          id?: string
          page_path?: string | null
          session_id?: string
        }
        Relationships: []
      }
      analytics_interactions: {
        Row: {
          created_at: string | null
          id: string
          interaction_type: string
          page_height: number | null
          page_path: string
          page_width: number | null
          scroll_depth: number | null
          session_id: string
          viewport_height: number | null
          viewport_width: number | null
          x_position: number | null
          y_position: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_type: string
          page_height?: number | null
          page_path: string
          page_width?: number | null
          scroll_depth?: number | null
          session_id: string
          viewport_height?: number | null
          viewport_width?: number | null
          x_position?: number | null
          y_position?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_type?: string
          page_height?: number | null
          page_path?: string
          page_width?: number | null
          scroll_depth?: number | null
          session_id?: string
          viewport_height?: number | null
          viewport_width?: number | null
          x_position?: number | null
          y_position?: number | null
        }
        Relationships: []
      }
      analytics_page_views: {
        Row: {
          country: string | null
          created_at: string | null
          device_type: string | null
          id: string
          page_path: string
          referrer: string | null
          session_id: string
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          page_path: string
          referrer?: string | null
          session_id: string
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          page_path?: string
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      analytics_session_recordings: {
        Row: {
          country: string | null
          created_at: string | null
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_bounce: boolean | null
          page_count: number | null
          pages_visited: string[] | null
          recording_events: Json | null
          session_id: string
          started_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_bounce?: boolean | null
          page_count?: number | null
          pages_visited?: string[] | null
          recording_events?: Json | null
          session_id: string
          started_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_bounce?: boolean | null
          page_count?: number | null
          pages_visited?: string[] | null
          recording_events?: Json | null
          session_id?: string
          started_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_en: string
          name_pt: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_en: string
          name_pt: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_en?: string
          name_pt?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string
          credential_url: string | null
          expiry_date: string | null
          freelancer_user_id: string
          id: string
          issue_date: string | null
          issuer: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credential_url?: string | null
          expiry_date?: string | null
          freelancer_user_id: string
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credential_url?: string | null
          expiry_date?: string | null
          freelancer_user_id?: string
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_data_unlocks: {
        Row: {
          company_user_id: string
          credits_spent: number
          freelancer_user_id: string
          id: string
          unlocked_at: string
        }
        Insert: {
          company_user_id: string
          credits_spent?: number
          freelancer_user_id: string
          id?: string
          unlocked_at?: string
        }
        Update: {
          company_user_id?: string
          credits_spent?: number
          freelancer_user_id?: string
          id?: string
          unlocked_at?: string
        }
        Relationships: []
      }
      company_plan_definitions: {
        Row: {
          created_at: string
          credit_cap: number | null
          dedicated_manager: boolean
          description: string | null
          display_order: number
          features: Json
          highlight_proposals: boolean
          id: string
          is_active: boolean
          monthly_credits: number
          name: string
          plan_type: string
          popular: boolean
          price_usd_cents: number
          priority_support: boolean
          projects_limit: number | null
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_cap?: number | null
          dedicated_manager?: boolean
          description?: string | null
          display_order?: number
          features?: Json
          highlight_proposals?: boolean
          id?: string
          is_active?: boolean
          monthly_credits?: number
          name: string
          plan_type: string
          popular?: boolean
          price_usd_cents?: number
          priority_support?: boolean
          projects_limit?: number | null
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_cap?: number | null
          dedicated_manager?: boolean
          description?: string | null
          display_order?: number
          features?: Json
          highlight_proposals?: boolean
          id?: string
          is_active?: boolean
          monthly_credits?: number
          name?: string
          plan_type?: string
          popular?: boolean
          price_usd_cents?: number
          priority_support?: boolean
          projects_limit?: number | null
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_plans: {
        Row: {
          cancel_at_period_end: boolean | null
          company_user_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_credit_grant_at: string | null
          plan_source: string
          plan_type: string
          projects_reset_at: string | null
          projects_this_month: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          company_user_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_credit_grant_at?: string | null
          plan_source?: string
          plan_type?: string
          projects_reset_at?: string | null
          projects_this_month?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          company_user_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_credit_grant_at?: string | null
          plan_source?: string
          plan_type?: string
          projects_reset_at?: string | null
          projects_this_month?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          about: string | null
          company_name: string | null
          company_size: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          document_number: string | null
          document_type: string | null
          id: string
          identity_status: string | null
          identity_verified_at: string | null
          industry: string | null
          is_verified: boolean | null
          location: string | null
          logo_url: string | null
          phone: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by_admin_id: string | null
          website: string | null
        }
        Insert: {
          about?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          id?: string
          identity_status?: string | null
          identity_verified_at?: string | null
          industry?: string | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
          website?: string | null
        }
        Update: {
          about?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          id?: string
          identity_status?: string | null
          identity_verified_at?: string | null
          industry?: string | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_wallets: {
        Row: {
          balance_cents: number
          company_user_id: string
          created_at: string
          currency: string
          id: string
          updated_at: string
        }
        Insert: {
          balance_cents?: number
          company_user_id: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          company_user_id?: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_acceptances: {
        Row: {
          accepted_at: string
          accepted_by_role: string
          accepted_by_user_id: string
          contract_id: string
          contract_snapshot_hash: string
          contract_version: string
          created_at: string
          id: string
          ip_address: string | null
          terms_version: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          accepted_by_role: string
          accepted_by_user_id: string
          contract_id: string
          contract_snapshot_hash: string
          contract_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          accepted_by_role?: string
          accepted_by_user_id?: string
          contract_id?: string
          contract_snapshot_hash?: string
          contract_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_acceptances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          accepted_at: string | null
          agreed_amount_cents: number | null
          amount_cents: number
          cancelled_at: string | null
          company_accepted_at: string | null
          company_user_id: string
          completed_at: string | null
          contract_terms_version: string | null
          created_at: string
          currency: string
          deadline: string | null
          description: string | null
          freelancer_accepted_at: string | null
          freelancer_user_id: string
          id: string
          milestones: Json | null
          original_proposal_amount_cents: number | null
          project_id: string
          proposal_id: string
          status: string
          title: string
          updated_at: string
          was_counterproposal: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          agreed_amount_cents?: number | null
          amount_cents?: number
          cancelled_at?: string | null
          company_accepted_at?: string | null
          company_user_id: string
          completed_at?: string | null
          contract_terms_version?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          freelancer_accepted_at?: string | null
          freelancer_user_id: string
          id?: string
          milestones?: Json | null
          original_proposal_amount_cents?: number | null
          project_id: string
          proposal_id: string
          status?: string
          title: string
          updated_at?: string
          was_counterproposal?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          agreed_amount_cents?: number | null
          amount_cents?: number
          cancelled_at?: string | null
          company_accepted_at?: string | null
          company_user_id?: string
          completed_at?: string | null
          contract_terms_version?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          freelancer_accepted_at?: string | null
          freelancer_user_id?: string
          id?: string
          milestones?: Json | null
          original_proposal_amount_cents?: number | null
          project_id?: string
          proposal_id?: string
          status?: string
          title?: string
          updated_at?: string
          was_counterproposal?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          company_user_id: string
          created_at: string
          freelancer_user_id: string
          id: string
          project_id: string | null
        }
        Insert: {
          company_user_id: string
          created_at?: string
          freelancer_user_id: string
          id?: string
          project_id?: string | null
        }
        Update: {
          company_user_id?: string
          created_at?: string
          freelancer_user_id?: string
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          badge_text: string | null
          bonus_credits: number
          created_at: string | null
          credits_amount: number
          currency: string
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          updated_at: string | null
        }
        Insert: {
          badge_text?: string | null
          bonus_credits?: number
          created_at?: string | null
          credits_amount: number
          currency?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents: number
          updated_at?: string | null
        }
        Update: {
          badge_text?: string | null
          bonus_credits?: number
          created_at?: string | null
          credits_amount?: number
          currency?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_paid_minor: number
          bonus_credits: number
          confirmed_at: string | null
          created_at: string
          credits_granted: number
          currency_paid: string
          id: string
          metadata: Json | null
          payment_method: string | null
          promotion_code: string | null
          status: string
          unified_payment_id: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          amount_paid_minor: number
          bonus_credits?: number
          confirmed_at?: string | null
          created_at?: string
          credits_granted?: number
          currency_paid?: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          promotion_code?: string | null
          status?: string
          unified_payment_id?: string | null
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          amount_paid_minor?: number
          bonus_credits?: number
          confirmed_at?: string | null
          created_at?: string
          credits_granted?: number
          currency_paid?: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          promotion_code?: string | null
          status?: string
          unified_payment_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_unified_payment_id_fkey"
            columns: ["unified_payment_id"]
            isOneToOne: false
            referencedRelation: "unified_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      freelancer_achievements: {
        Row: {
          achievement_key: string
          created_at: string
          description: string | null
          display_order: number
          freelancer_user_id: string
          id: string
          image_url: string | null
          required_revenue: number
          subtitle: string | null
          title: string
          unlocked: boolean
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          achievement_key: string
          created_at?: string
          description?: string | null
          display_order?: number
          freelancer_user_id: string
          id?: string
          image_url?: string | null
          required_revenue?: number
          subtitle?: string | null
          title: string
          unlocked?: boolean
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          achievement_key?: string
          created_at?: string
          description?: string | null
          display_order?: number
          freelancer_user_id?: string
          id?: string
          image_url?: string | null
          required_revenue?: number
          subtitle?: string | null
          title?: string
          unlocked?: boolean
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_achievements_freelancer_user_id_fkey"
            columns: ["freelancer_user_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "freelancer_achievements_freelancer_user_id_fkey"
            columns: ["freelancer_user_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      freelancer_plan_definitions: {
        Row: {
          created_at: string
          credit_cap: number | null
          description: string | null
          display_order: number
          features: Json
          highlight_proposals: boolean
          id: string
          is_active: boolean
          monthly_credits: number
          name: string
          plan_type: string
          popular: boolean
          price_usd_cents: number
          priority_support: boolean
          proposals_limit: number | null
          stripe_price_id: string | null
          updated_at: string
          verified_badge: boolean
        }
        Insert: {
          created_at?: string
          credit_cap?: number | null
          description?: string | null
          display_order?: number
          features?: Json
          highlight_proposals?: boolean
          id?: string
          is_active?: boolean
          monthly_credits?: number
          name: string
          plan_type: string
          popular?: boolean
          price_usd_cents?: number
          priority_support?: boolean
          proposals_limit?: number | null
          stripe_price_id?: string | null
          updated_at?: string
          verified_badge?: boolean
        }
        Update: {
          created_at?: string
          credit_cap?: number | null
          description?: string | null
          display_order?: number
          features?: Json
          highlight_proposals?: boolean
          id?: string
          is_active?: boolean
          monthly_credits?: number
          name?: string
          plan_type?: string
          popular?: boolean
          price_usd_cents?: number
          priority_support?: boolean
          proposals_limit?: number | null
          stripe_price_id?: string | null
          updated_at?: string
          verified_badge?: boolean
        }
        Relationships: []
      }
      freelancer_plans: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          freelancer_user_id: string
          id: string
          last_credit_grant_at: string | null
          plan_type: string
          proposals_reset_at: string | null
          proposals_this_month: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          freelancer_user_id: string
          id?: string
          last_credit_grant_at?: string | null
          plan_type?: string
          proposals_reset_at?: string | null
          proposals_this_month?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          freelancer_user_id?: string
          id?: string
          last_credit_grant_at?: string | null
          plan_type?: string
          proposals_reset_at?: string | null
          proposals_this_month?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      freelancer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          country_code: string | null
          created_at: string
          currency_code: string | null
          document_number: string | null
          document_type: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string
          identity_status: string | null
          identity_verified_at: string | null
          languages: string[] | null
          location: string | null
          preferred_payout_currency: string | null
          proposal_credits: number
          skills: string[] | null
          tier: string | null
          tier_source: string
          title: string | null
          total_revenue: number | null
          updated_at: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by_admin_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          document_number?: string | null
          document_type?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          identity_status?: string | null
          identity_verified_at?: string | null
          languages?: string[] | null
          location?: string | null
          preferred_payout_currency?: string | null
          proposal_credits?: number
          skills?: string[] | null
          tier?: string | null
          tier_source?: string
          title?: string | null
          total_revenue?: number | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by_admin_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          document_number?: string | null
          document_type?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          identity_status?: string | null
          identity_verified_at?: string | null
          languages?: string[] | null
          location?: string | null
          preferred_payout_currency?: string | null
          proposal_credits?: number
          skills?: string[] | null
          tier?: string | null
          tier_source?: string
          title?: string | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by_admin_id?: string | null
        }
        Relationships: []
      }
      fx_spread_change_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by_user_id: string | null
          currency_code: string
          fx_spread_config_id: string | null
          id: string
          new_spread_percent: number
          old_spread_percent: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by_user_id?: string | null
          currency_code: string
          fx_spread_config_id?: string | null
          id?: string
          new_spread_percent: number
          old_spread_percent: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by_user_id?: string | null
          currency_code?: string
          fx_spread_config_id?: string | null
          id?: string
          new_spread_percent?: number
          old_spread_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_spread_change_history_fx_spread_config_id_fkey"
            columns: ["fx_spread_config_id"]
            isOneToOne: false
            referencedRelation: "fx_spread_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_spread_configs: {
        Row: {
          created_at: string
          currency_code: string
          id: string
          is_enabled: boolean
          spread_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code: string
          id?: string
          is_enabled?: boolean
          spread_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          id?: string
          is_enabled?: boolean
          spread_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      genius_access: {
        Row: {
          access_source: string
          created_at: string
          credits_spent: number | null
          expires_at: string
          feature_type: string
          id: string
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          access_source: string
          created_at?: string
          credits_spent?: number | null
          expires_at: string
          feature_type: string
          id?: string
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          access_source?: string
          created_at?: string
          credits_spent?: number | null
          expires_at?: string
          feature_type?: string
          id?: string
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      genius_ranking_cache: {
        Row: {
          analysis_result: Json
          created_at: string
          id: string
          project_id: string
          proposals_count: number
          proposals_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_result: Json
          created_at?: string
          id?: string
          project_id: string
          proposals_count?: number
          proposals_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_result?: Json
          created_at?: string
          id?: string
          project_id?: string
          proposals_count?: number
          proposals_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      genius_usage_log: {
        Row: {
          created_at: string
          feature_type: string
          id: string
          input_tokens: number | null
          model_used: string | null
          output_tokens: number | null
          project_id: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          feature_type: string
          id?: string
          input_tokens?: number | null
          model_used?: string | null
          output_tokens?: number | null
          project_id?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          feature_type?: string
          id?: string
          input_tokens?: number | null
          model_used?: string | null
          output_tokens?: number | null
          project_id?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "genius_usage_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          identity_verification_id: string | null
          ip_address: string | null
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          identity_verification_id?: string | null
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          identity_verification_id?: string | null
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_audit_logs_identity_verification_id_fkey"
            columns: ["identity_verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_audit_logs_identity_verification_id_fkey"
            columns: ["identity_verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      identity_verification_files: {
        Row: {
          created_at: string
          file_type: string
          id: string
          identity_verification_id: string
          mime_type: string
          quality_issues: string[] | null
          quality_score: number | null
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_type: string
          id?: string
          identity_verification_id: string
          mime_type: string
          quality_issues?: string[] | null
          quality_score?: number | null
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          file_type?: string
          id?: string
          identity_verification_id?: string
          mime_type?: string
          quality_issues?: string[] | null
          quality_score?: number | null
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_files_identity_verification_id_fkey"
            columns: ["identity_verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verification_files_identity_verification_id_fkey"
            columns: ["identity_verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          admin_decision: string | null
          admin_decision_at: string | null
          admin_notes: string | null
          attempts: number
          consent_given: boolean
          consent_given_at: string | null
          country: string
          created_at: string
          document_type: string
          failure_code: string | null
          failure_reason: string | null
          id: string
          max_attempts: number
          metadata: Json | null
          provider: string
          provider_report_id: string | null
          provider_session_id: string | null
          reviewed_by_admin_id: string | null
          risk_level: string | null
          risk_score: number | null
          status: string
          subject_type: string
          updated_at: string
          user_id: string
          verification_score: number | null
          verified_at: string | null
        }
        Insert: {
          admin_decision?: string | null
          admin_decision_at?: string | null
          admin_notes?: string | null
          attempts?: number
          consent_given?: boolean
          consent_given_at?: string | null
          country?: string
          created_at?: string
          document_type: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          max_attempts?: number
          metadata?: Json | null
          provider?: string
          provider_report_id?: string | null
          provider_session_id?: string | null
          reviewed_by_admin_id?: string | null
          risk_level?: string | null
          risk_score?: number | null
          status?: string
          subject_type: string
          updated_at?: string
          user_id: string
          verification_score?: number | null
          verified_at?: string | null
        }
        Update: {
          admin_decision?: string | null
          admin_decision_at?: string | null
          admin_notes?: string | null
          attempts?: number
          consent_given?: boolean
          consent_given_at?: string | null
          country?: string
          created_at?: string
          document_type?: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          max_attempts?: number
          metadata?: Json | null
          provider?: string
          provider_report_id?: string | null
          provider_session_id?: string | null
          reviewed_by_admin_id?: string | null
          risk_level?: string | null
          risk_score?: number | null
          status?: string
          subject_type?: string
          updated_at?: string
          user_id?: string
          verification_score?: number | null
          verified_at?: string | null
        }
        Relationships: []
      }
      landing_faq_items: {
        Row: {
          answer: string
          created_at: string | null
          display_order: number
          id: string
          is_visible: boolean
          question: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          question: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          question?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      landing_sections: {
        Row: {
          background_color: string | null
          background_image_url: string | null
          content: Json | null
          created_at: string | null
          id: string
          is_visible: boolean
          section_key: string
          section_order: number
          subtitle: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          background_image_url?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean
          section_key: string
          section_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          background_image_url?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean
          section_key?: string
          section_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      landing_social_links: {
        Row: {
          created_at: string | null
          display_order: number
          icon: string
          id: string
          is_visible: boolean
          platform: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          icon: string
          id?: string
          is_visible?: boolean
          platform: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_visible?: boolean
          platform?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      landing_stats: {
        Row: {
          created_at: string | null
          display_order: number
          icon: string
          id: string
          is_visible: boolean
          label: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_visible?: boolean
          label: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_visible?: boolean
          label?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          user_type: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          user_type?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount_cents: number
          balance_after_cents: number | null
          created_at: string
          credits_after: number | null
          credits_amount: number | null
          currency: string
          direction: string
          id: string
          metadata: Json | null
          payment_id: string | null
          reason: string
          user_id: string
          user_type: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents?: number | null
          created_at?: string
          credits_after?: number | null
          credits_amount?: number | null
          currency?: string
          direction: string
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          reason: string
          user_id: string
          user_type: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number | null
          created_at?: string
          credits_after?: number | null
          credits_amount?: number | null
          currency?: string
          direction?: string
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          reason?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "unified_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          amount: number
          amount_original: number | null
          amount_usd_minor: number | null
          balance_after_credits: number | null
          balance_after_earnings: number | null
          balance_after_escrow: number | null
          context: string | null
          created_at: string
          currency: string
          currency_original: string | null
          exchange_rate: number | null
          fx_provider: string | null
          fx_rate_applied: number | null
          fx_rate_market: number | null
          fx_rate_source: string | null
          fx_spread_amount_usd_minor: number | null
          fx_spread_percent: number | null
          fx_timestamp: string | null
          gateway_provider: string | null
          id: string
          metadata: Json | null
          payment_amount_minor: number | null
          payment_currency: string | null
          payment_method: string | null
          related_contract_id: string | null
          related_payment_id: string | null
          related_withdrawal_id: string | null
          tx_type: Database["public"]["Enums"]["ledger_tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          amount_original?: number | null
          amount_usd_minor?: number | null
          balance_after_credits?: number | null
          balance_after_earnings?: number | null
          balance_after_escrow?: number | null
          context?: string | null
          created_at?: string
          currency?: string
          currency_original?: string | null
          exchange_rate?: number | null
          fx_provider?: string | null
          fx_rate_applied?: number | null
          fx_rate_market?: number | null
          fx_rate_source?: string | null
          fx_spread_amount_usd_minor?: number | null
          fx_spread_percent?: number | null
          fx_timestamp?: string | null
          gateway_provider?: string | null
          id?: string
          metadata?: Json | null
          payment_amount_minor?: number | null
          payment_currency?: string | null
          payment_method?: string | null
          related_contract_id?: string | null
          related_payment_id?: string | null
          related_withdrawal_id?: string | null
          tx_type: Database["public"]["Enums"]["ledger_tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          amount_original?: number | null
          amount_usd_minor?: number | null
          balance_after_credits?: number | null
          balance_after_earnings?: number | null
          balance_after_escrow?: number | null
          context?: string | null
          created_at?: string
          currency?: string
          currency_original?: string | null
          exchange_rate?: number | null
          fx_provider?: string | null
          fx_rate_applied?: number | null
          fx_rate_market?: number | null
          fx_rate_source?: string | null
          fx_spread_amount_usd_minor?: number | null
          fx_spread_percent?: number | null
          fx_timestamp?: string | null
          gateway_provider?: string | null
          id?: string
          metadata?: Json | null
          payment_amount_minor?: number | null
          payment_currency?: string | null
          payment_method?: string | null
          related_contract_id?: string | null
          related_payment_id?: string | null
          related_withdrawal_id?: string | null
          tx_type?: Database["public"]["Enums"]["ledger_tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_related_contract_id_fkey"
            columns: ["related_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "unified_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_withdrawal_fk"
            columns: ["related_withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      message_translations: {
        Row: {
          created_at: string
          id: string
          message_id: string
          source_lang: string
          target_lang: string
          translated_content: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          source_lang: string
          target_lang: string
          translated_content: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          source_lang?: string
          target_lang?: string
          translated_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_translations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_duration: number | null
          content: string
          conversation_id: string
          created_at: string
          file_mime: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          lang_detected: string | null
          read_at: string | null
          sender_user_id: string
          type: string | null
        }
        Insert: {
          audio_duration?: number | null
          content: string
          conversation_id: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          lang_detected?: string | null
          read_at?: string | null
          sender_user_id: string
          type?: string | null
        }
        Update: {
          audio_duration?: number | null
          content?: string
          conversation_id?: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          lang_detected?: string | null
          read_at?: string | null
          sender_user_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_fee_change_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by_user_id: string | null
          fee_config_id: string | null
          fee_key: string
          id: string
          new_fee_percent: number
          old_fee_percent: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by_user_id?: string | null
          fee_config_id?: string | null
          fee_key: string
          id?: string
          new_fee_percent: number
          old_fee_percent: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by_user_id?: string | null
          fee_config_id?: string | null
          fee_key?: string
          id?: string
          new_fee_percent?: number
          old_fee_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_fee_change_history_fee_config_id_fkey"
            columns: ["fee_config_id"]
            isOneToOne: false
            referencedRelation: "payment_fee_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_fee_configs: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          fee_key: string
          fee_percent: number
          id: string
          is_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          fee_key: string
          fee_percent?: number
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          fee_key?: string
          fee_percent?: number
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          payment_id: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          payment_id: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_tokens: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          is_default: boolean | null
          last4: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_providers: {
        Row: {
          config_encrypted: Json | null
          created_at: string
          id: string
          is_enabled: boolean
          is_sandbox: boolean
          last_tested_at: string | null
          provider: string
          test_status: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          config_encrypted?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_sandbox?: boolean
          last_tested_at?: string | null
          provider: string
          test_status?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          config_encrypted?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_sandbox?: boolean
          last_tested_at?: string | null
          provider?: string
          test_status?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          company_user_id: string | null
          created_at: string
          currency: string
          escrow_status: string | null
          freelancer_user_id: string | null
          id: string
          paid_at: string | null
          paid_out_at: string | null
          paid_out_by_admin_id: string | null
          project_id: string | null
          released_at: string | null
          released_by_admin_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          company_user_id?: string | null
          created_at?: string
          currency?: string
          escrow_status?: string | null
          freelancer_user_id?: string | null
          id?: string
          paid_at?: string | null
          paid_out_at?: string | null
          paid_out_by_admin_id?: string | null
          project_id?: string | null
          released_at?: string | null
          released_by_admin_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          company_user_id?: string | null
          created_at?: string
          currency?: string
          escrow_status?: string | null
          freelancer_user_id?: string | null
          id?: string
          paid_at?: string | null
          paid_out_at?: string | null
          paid_out_by_admin_id?: string | null
          project_id?: string | null
          released_at?: string | null
          released_by_admin_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          account: string | null
          account_type: string | null
          bank_code: string | null
          bank_name: string | null
          branch: string | null
          created_at: string
          freelancer_user_id: string
          holder_doc: string | null
          holder_name: string | null
          id: string
          is_default: boolean | null
          pix_key: string | null
          pix_key_type: string | null
          type: Database["public"]["Enums"]["payout_type"]
          updated_at: string
        }
        Insert: {
          account?: string | null
          account_type?: string | null
          bank_code?: string | null
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          freelancer_user_id: string
          holder_doc?: string | null
          holder_name?: string | null
          id?: string
          is_default?: boolean | null
          pix_key?: string | null
          pix_key_type?: string | null
          type: Database["public"]["Enums"]["payout_type"]
          updated_at?: string
        }
        Update: {
          account?: string | null
          account_type?: string | null
          bank_code?: string | null
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          freelancer_user_id?: string
          holder_doc?: string | null
          holder_name?: string | null
          id?: string
          is_default?: boolean | null
          pix_key?: string | null
          pix_key_type?: string | null
          type?: Database["public"]["Enums"]["payout_type"]
          updated_at?: string
        }
        Relationships: []
      }
      plan_credit_grants: {
        Row: {
          amount: number
          created_at: string
          grant_period_start: string
          grant_type: string
          id: string
          plan_type: string
          subscription_id: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          grant_period_start: string
          grant_type: string
          id?: string
          plan_type: string
          subscription_id?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          grant_period_start?: string
          grant_type?: string
          id?: string
          plan_type?: string
          subscription_id?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      platform_action_costs: {
        Row: {
          action_key: string
          cost_credits: number
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          action_key: string
          cost_credits?: number
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          action_key?: string
          cost_credits?: number
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_credit_transactions: {
        Row: {
          action: string
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          payment_id: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          action: string
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          action?: string
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_credit_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "unified_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_credits: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          plan_balance: number
          purchased_balance: number
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          plan_balance?: number
          purchased_balance?: number
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          plan_balance?: number
          purchased_balance?: number
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          freelancer_user_id: string
          id: string
          image_url: string | null
          project_url: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          freelancer_user_id: string
          id?: string
          image_url?: string | null
          project_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          freelancer_user_id?: string
          id?: string
          image_url?: string | null
          project_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          last_monthly_credit_grant_at: string | null
          onboarding_completed: boolean | null
          preferred_language: string
          profile_completion_bonus_claimed: boolean | null
          profile_completion_percent: number | null
          profile_completion_updated_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"] | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_monthly_credit_grant_at?: string | null
          onboarding_completed?: boolean | null
          preferred_language?: string
          profile_completion_bonus_claimed?: boolean | null
          profile_completion_percent?: number | null
          profile_completion_updated_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_monthly_credit_grant_at?: string | null
          onboarding_completed?: boolean | null
          preferred_language?: string
          profile_completion_bonus_claimed?: boolean | null
          profile_completion_percent?: number | null
          profile_completion_updated_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Relationships: []
      }
      project_actions_log: {
        Row: {
          action: string
          created_at: string
          credits_used: number | null
          id: string
          metadata: Json | null
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits_used?: number | null
          id?: string
          metadata?: Json | null
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits_used?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_actions_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_categories: {
        Row: {
          category_id: string
          created_at: string
          project_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          project_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invites: {
        Row: {
          company_user_id: string
          created_at: string
          freelancer_user_id: string
          id: string
          message: string | null
          project_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          company_user_id: string
          created_at?: string
          freelancer_user_id: string
          id?: string
          message?: string | null
          project_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          company_user_id?: string
          created_at?: string
          freelancer_user_id?: string
          id?: string
          message?: string | null
          project_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          boosted_until: string | null
          budget_ideal: number | null
          budget_max: number | null
          budget_min: number | null
          category: string | null
          company_user_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          kpis: Json | null
          primary_category_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          boosted_until?: string | null
          budget_ideal?: number | null
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          company_user_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kpis?: Json | null
          primary_category_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          boosted_until?: string | null
          budget_ideal?: number | null
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          company_user_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kpis?: Json | null
          primary_category_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          boost_credits: number | null
          company_feedback: string | null
          company_response: string | null
          company_response_at: string | null
          counterproposal_justification: string | null
          cover_letter: string | null
          created_at: string
          current_offer_by: string | null
          current_offer_cents: number | null
          freelancer_user_id: string
          highlighted_at: string | null
          id: string
          is_counterproposal: boolean
          is_highlighted: boolean
          milestones: Json | null
          negotiation_notes: string | null
          project_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          boost_credits?: number | null
          company_feedback?: string | null
          company_response?: string | null
          company_response_at?: string | null
          counterproposal_justification?: string | null
          cover_letter?: string | null
          created_at?: string
          current_offer_by?: string | null
          current_offer_cents?: number | null
          freelancer_user_id: string
          highlighted_at?: string | null
          id?: string
          is_counterproposal?: boolean
          is_highlighted?: boolean
          milestones?: Json | null
          negotiation_notes?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          boost_credits?: number | null
          company_feedback?: string | null
          company_response?: string | null
          company_response_at?: string | null
          counterproposal_justification?: string | null
          cover_letter?: string | null
          created_at?: string
          current_offer_by?: string | null
          current_offer_cents?: number | null
          freelancer_user_id?: string
          highlighted_at?: string | null
          id?: string
          is_counterproposal?: boolean
          is_highlighted?: boolean
          milestones?: Json | null
          negotiation_notes?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          company_user_id: string
          created_at: string
          freelancer_user_id: string
          id: string
          project_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          company_user_id: string
          created_at?: string
          freelancer_user_id: string
          id?: string
          project_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          company_user_id?: string
          created_at?: string
          freelancer_user_id?: string
          id?: string
          project_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_fee_overrides: {
        Row: {
          created_at: string | null
          fee_key: string
          fee_percent_override: number
          id: string
          tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fee_key: string
          fee_percent_override: number
          id?: string
          tier: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fee_key?: string
          fee_percent_override?: number
          id?: string
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      unified_payments: {
        Row: {
          amount_cents: number
          amount_usd_minor: number | null
          contract_id: string | null
          created_at: string
          credits_amount: number | null
          currency: string
          external_reference: string | null
          fx_provider: string | null
          fx_rate_applied: number | null
          fx_rate_market: number | null
          fx_rate_source: string | null
          fx_spread_amount_usd_minor: number | null
          fx_spread_percent: number | null
          fx_timestamp: string | null
          gateway_provider: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_amount_minor: number | null
          payment_currency: string | null
          payment_method: string | null
          payment_type: string
          provider: string
          provider_checkout_id: string | null
          provider_checkout_url: string | null
          provider_payment_id: string | null
          provider_preference_id: string | null
          status: string
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          amount_cents: number
          amount_usd_minor?: number | null
          contract_id?: string | null
          created_at?: string
          credits_amount?: number | null
          currency?: string
          external_reference?: string | null
          fx_provider?: string | null
          fx_rate_applied?: number | null
          fx_rate_market?: number | null
          fx_rate_source?: string | null
          fx_spread_amount_usd_minor?: number | null
          fx_spread_percent?: number | null
          fx_timestamp?: string | null
          gateway_provider?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_amount_minor?: number | null
          payment_currency?: string | null
          payment_method?: string | null
          payment_type: string
          provider: string
          provider_checkout_id?: string | null
          provider_checkout_url?: string | null
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          amount_cents?: number
          amount_usd_minor?: number | null
          contract_id?: string | null
          created_at?: string
          credits_amount?: number | null
          currency?: string
          external_reference?: string | null
          fx_provider?: string | null
          fx_rate_applied?: number | null
          fx_rate_market?: number | null
          fx_rate_source?: string | null
          fx_spread_amount_usd_minor?: number | null
          fx_spread_percent?: number | null
          fx_timestamp?: string | null
          gateway_provider?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_amount_minor?: number | null
          payment_currency?: string | null
          payment_method?: string | null
          payment_type?: string
          provider?: string
          provider_checkout_id?: string | null
          provider_checkout_url?: string | null
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          created_at: string
          credits_available: number
          currency: string
          earnings_available: number
          escrow_held: number
          id: string
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          credits_available?: number
          currency?: string
          earnings_available?: number
          escrow_held?: number
          id?: string
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          credits_available?: number
          currency?: string
          earnings_available?: number
          escrow_held?: number
          id?: string
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      user_feedbacks: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          description: string
          feedback_type: string
          id: string
          page_url: string | null
          resolved_at: string | null
          resolved_by_admin_id: string | null
          status: string
          title: string
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          description: string
          feedback_type: string
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by_admin_id?: string | null
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          description?: string
          feedback_type?: string
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by_admin_id?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_translation_settings: {
        Row: {
          auto_translate_enabled: boolean
          created_at: string
          daily_translations_reset_at: string
          daily_translations_used: number
          id: string
          preferred_lang: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_translate_enabled?: boolean
          created_at?: string
          daily_translations_reset_at?: string
          daily_translations_used?: number
          id?: string
          preferred_lang?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_translate_enabled?: boolean
          created_at?: string
          daily_translations_reset_at?: string
          daily_translations_used?: number
          id?: string
          preferred_lang?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_contracts: number
          created_at: string
          currency: string
          description: string | null
          fiat_amount: number
          id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_contracts: number
          created_at?: string
          currency?: string
          description?: string | null
          fiat_amount: number
          id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_contracts?: number
          created_at?: string
          currency?: string
          description?: string | null
          fiat_amount?: number
          id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_contracts: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_contracts?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_contracts?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          amount_usd_minor: number | null
          created_at: string
          currency: string
          freelancer_user_id: string
          fx_provider: string | null
          fx_rate_applied: number | null
          fx_rate_market: number | null
          fx_rate_source: string | null
          fx_spread_amount_usd_minor: number | null
          fx_spread_percent: number | null
          fx_timestamp: string | null
          gateway_provider: string | null
          id: string
          paid_at: string | null
          payment_amount_minor: number | null
          payment_currency: string | null
          payment_method: string | null
          payout_details: Json | null
          payout_method_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          amount_usd_minor?: number | null
          created_at?: string
          currency?: string
          freelancer_user_id: string
          fx_provider?: string | null
          fx_rate_applied?: number | null
          fx_rate_market?: number | null
          fx_rate_source?: string | null
          fx_spread_amount_usd_minor?: number | null
          fx_spread_percent?: number | null
          fx_timestamp?: string | null
          gateway_provider?: string | null
          id?: string
          paid_at?: string | null
          payment_amount_minor?: number | null
          payment_currency?: string | null
          payment_method?: string | null
          payout_details?: Json | null
          payout_method_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          amount_usd_minor?: number | null
          created_at?: string
          currency?: string
          freelancer_user_id?: string
          fx_provider?: string | null
          fx_rate_applied?: number | null
          fx_rate_market?: number | null
          fx_rate_source?: string | null
          fx_spread_amount_usd_minor?: number | null
          fx_spread_percent?: number | null
          fx_timestamp?: string | null
          gateway_provider?: string | null
          id?: string
          paid_at?: string | null
          payment_amount_minor?: number | null
          payment_currency?: string | null
          payment_method?: string | null
          payout_details?: Json | null
          payout_method_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "payout_methods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_profiles_public: {
        Row: {
          about: string | null
          company_name: string | null
          company_size: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          id: string | null
          industry: string | null
          is_verified: boolean | null
          location: string | null
          logo_url: string | null
          user_id: string | null
          verified_at: string | null
          website: string | null
        }
        Insert: {
          about?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          industry?: string | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          user_id?: string | null
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          about?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          industry?: string | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          user_id?: string | null
          verified_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      freelancer_profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string | null
          languages: string[] | null
          skills: string[] | null
          tier: string | null
          title: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string | null
          languages?: string[] | null
          skills?: string[] | null
          tier?: string | null
          title?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string | null
          languages?: string[] | null
          skills?: string[] | null
          tier?: string | null
          title?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      identity_verifications_admin: {
        Row: {
          admin_decision: string | null
          admin_decision_at: string | null
          admin_notes: string | null
          attempts: number | null
          avatar_url: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          document_type: string | null
          email: string | null
          failure_reason: string | null
          files_count: number | null
          id: string | null
          max_attempts: number | null
          provider: string | null
          reviewed_by_admin_id: string | null
          risk_level: string | null
          risk_score: number | null
          status: string | null
          subject_type: string | null
          updated_at: string | null
          user_id: string | null
          verified_at: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          created_at: string | null
          id: string | null
          onboarding_completed: boolean | null
          preferred_language: string | null
          profile_completion_percent: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
          user_type: Database["public"]["Enums"]["user_type"] | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          onboarding_completed?: boolean | null
          preferred_language?: string | null
          profile_completion_percent?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          onboarding_completed?: boolean | null
          preferred_language?: string | null
          profile_completion_percent?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_credits: {
        Args: {
          p_amount: number
          p_amount_original?: number
          p_context?: string
          p_currency_original?: string
          p_payment_id: string
          p_user_id: string
          p_user_type: string
        }
        Returns: boolean
      }
      add_freelancer_credits: {
        Args: {
          p_credits: number
          p_freelancer_user_id: string
          p_payment_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      add_platform_credits: {
        Args: {
          p_amount: number
          p_credit_type?: string
          p_description?: string
          p_payment_id?: string
          p_user_id: string
          p_user_type: string
        }
        Returns: boolean
      }
      add_sub_admin: {
        Args: { p_email: string; p_permissions: Json }
        Returns: Json
      }
      admin_delete_identity_evidence: {
        Args: { p_verification_id: string }
        Returns: Json
      }
      admin_reset_identity_verification: {
        Args: { p_notes?: string; p_verification_id: string }
        Returns: boolean
      }
      admin_review_identity: {
        Args: {
          p_decision: string
          p_notes?: string
          p_verification_id: string
        }
        Returns: boolean
      }
      boost_proposal: {
        Args: { p_boost_amount: number; p_proposal_id: string }
        Returns: Json
      }
      check_and_grant_monthly_credits: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: Json
      }
      check_and_grant_plan_credits: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: Json
      }
      check_company_can_publish_project: {
        Args: { p_company_user_id: string }
        Returns: Json
      }
      check_company_plan_limit: {
        Args: { p_company_user_id: string }
        Returns: Json
      }
      check_freelancer_can_send_proposal: {
        Args: { p_freelancer_user_id: string }
        Returns: Json
      }
      check_identity_rate_limit: {
        Args: {
          p_action: string
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_platform_credits: {
        Args: { p_action_key: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_old_analytics: { Args: never; Returns: undefined }
      consume_proposal_credit: {
        Args: { p_freelancer_user_id: string }
        Returns: boolean
      }
      create_contract_from_proposal: {
        Args: { p_company_user_id: string; p_proposal_id: string }
        Returns: Json
      }
      create_identity_session: {
        Args: {
          p_country: string
          p_document_type: string
          p_provider_session_id: string
          p_subject_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_identity_verification_with_uploads: {
        Args: {
          p_country: string
          p_document_type: string
          p_has_back_side?: boolean
          p_subject_type: string
          p_user_id: string
        }
        Returns: Json
      }
      credit_company_wallet: {
        Args: {
          p_amount_cents: number
          p_company_user_id: string
          p_payment_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      credit_wallet: {
        Args: {
          p_amount: number
          p_currency?: string
          p_fiat_amount?: number
          p_session_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      delete_identity_storage_file: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      ensure_company_wallet: {
        Args: { p_company_user_id: string }
        Returns: string
      }
      ensure_freelancer_plan_exists: {
        Args: { p_freelancer_user_id: string }
        Returns: undefined
      }
      ensure_user_balance: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: string
      }
      ensure_user_wallet: { Args: { p_user_id: string }; Returns: string }
      finalize_identity_uploads: {
        Args: { p_verification_id: string }
        Returns: Json
      }
      finalize_proposal_acceptance: {
        Args: { p_proposal_id: string }
        Returns: string
      }
      freelancer_can_view_project: {
        Args: { p_freelancer_user_id: string; p_project_id: string }
        Returns: boolean
      }
      fund_contract_escrow: {
        Args: {
          p_amount: number
          p_company_user_id: string
          p_contract_id: string
          p_payment_id: string
        }
        Returns: boolean
      }
      get_company_badges: {
        Args: { p_company_ids: string[] }
        Returns: {
          company_user_id: string
          is_verified: boolean
          plan_type: string
        }[]
      }
      get_freelancer_proposal_usage: {
        Args: { p_freelancer_user_id: string }
        Returns: Json
      }
      get_identity_files_for_review: {
        Args: { p_verification_id: string }
        Returns: {
          created_at: string
          file_id: string
          file_type: string
          quality_issues: string[]
          quality_score: number
          storage_path: string
        }[]
      }
      get_identity_status: {
        Args: { p_subject_type: string; p_user_id: string }
        Returns: Json
      }
      get_identity_verification_detail: {
        Args: { p_verification_id: string }
        Returns: Json
      }
      get_identity_verifications_admin: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status_filter?: string
        }
        Returns: {
          admin_decision: string
          admin_decision_at: string
          admin_notes: string
          attempts: number
          avatar_url: string
          country: string
          created_at: string
          display_name: string
          document_type: string
          email: string
          failure_reason: string
          files_count: number
          id: string
          max_attempts: number
          provider: string
          reviewed_by_admin_id: string
          risk_level: string
          risk_score: number
          status: string
          subject_type: string
          total_count: number
          updated_at: string
          user_id: string
          verified_at: string
        }[]
      }
      get_identity_verifications_for_cleanup: {
        Args: { p_days_old?: number }
        Returns: {
          status: string
          storage_paths: string[]
          user_id: string
          verification_id: string
        }[]
      }
      get_project_categories: {
        Args: { p_project_id: string }
        Returns: {
          id: string
          name_en: string
          name_pt: string
          slug: string
        }[]
      }
      get_projects_prefund_status: {
        Args: { project_ids: string[] }
        Returns: {
          has_verified_payment: boolean
          project_id: string
        }[]
      }
      get_proposal_queue: {
        Args: { p_project_id: string }
        Returns: {
          boost_credits: number
          created_at: string
          freelancer_avatar: string
          freelancer_name: string
          freelancer_user_id: string
          is_current_user: boolean
          proposal_id: string
          queue_position: number
        }[]
      }
      grant_plan_credits: {
        Args: {
          p_grant_type?: string
          p_plan_type: string
          p_subscription_id: string
          p_user_id: string
          p_user_type: string
        }
        Returns: Json
      }
      grant_profile_completion_bonus: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: boolean
      }
      has_admin_permission: { Args: { p_permission: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hookly_contains_phone_number: {
        Args: { p_text: string }
        Returns: boolean
      }
      increment_company_project_count: {
        Args: { p_company_user_id: string }
        Returns: boolean
      }
      increment_freelancer_proposal_count: {
        Args: { p_freelancer_user_id: string }
        Returns: Json
      }
      initialize_freelancer_achievements: {
        Args: { p_freelancer_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_owner: { Args: never; Returns: boolean }
      maybe_reset_monthly_proposals: {
        Args: { p_freelancer_user_id: string }
        Returns: undefined
      }
      process_identity_verification: {
        Args: {
          p_failure_reason?: string
          p_quality_results?: Json
          p_risk_level?: string
          p_risk_score?: number
          p_status: string
          p_verification_id: string
        }
        Returns: boolean
      }
      process_withdrawal: {
        Args: {
          p_admin_id: string
          p_admin_notes?: string
          p_new_status: Database["public"]["Enums"]["withdrawal_status"]
          p_withdrawal_id: string
        }
        Returns: boolean
      }
      publish_project: { Args: { p_project_id: string }; Returns: Json }
      register_identity_file: {
        Args: {
          p_file_type: string
          p_mime_type: string
          p_size_bytes: number
          p_storage_path: string
          p_verification_id: string
        }
        Returns: Json
      }
      release_escrow_to_earnings:
        | {
            Args: {
              p_amount: number
              p_company_user_id: string
              p_context?: string
              p_contract_id: string
              p_freelancer_user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_amount: number
              p_company_user_id: string
              p_context?: string
              p_contract_id: string
              p_freelancer_user_id: string
              p_payment_id?: string
            }
            Returns: boolean
          }
      remove_sub_admin: { Args: { p_user_id: string }; Returns: Json }
      request_withdrawal: {
        Args: {
          p_amount: number
          p_freelancer_user_id: string
          p_payout_method_id: string
        }
        Returns: string
      }
      set_project_categories: {
        Args: { p_category_ids: string[]; p_project_id: string }
        Returns: boolean
      }
      spend_credits: {
        Args: { p_amount: number; p_context?: string; p_user_id: string }
        Returns: boolean
      }
      spend_platform_credits: {
        Args: {
          p_action_key: string
          p_description?: string
          p_user_id: string
        }
        Returns: boolean
      }
      sync_freelancer_proposal_count: {
        Args: { p_freelancer_user_id: string }
        Returns: Json
      }
      update_freelancer_revenue_and_achievements: {
        Args: { p_freelancer_user_id: string }
        Returns: undefined
      }
      update_identity_from_webhook: {
        Args: {
          p_failure_code?: string
          p_failure_reason?: string
          p_metadata?: Json
          p_provider_session_id: string
          p_report_id?: string
          p_risk_level?: string
          p_score?: number
          p_status: string
        }
        Returns: boolean
      }
      update_sub_admin_permissions: {
        Args: { p_permissions: Json; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      ledger_tx_type:
        | "topup_credit"
        | "spend_credit"
        | "contract_funding"
        | "escrow_release"
        | "withdrawal_request"
        | "withdrawal_paid"
        | "refund"
        | "adjustment"
      payment_status: "pending" | "paid" | "released" | "failed"
      payout_type: "pix" | "bank"
      project_status: "draft" | "open" | "in_progress" | "completed"
      proposal_status: "sent" | "accepted" | "rejected"
      user_type: "company" | "freelancer"
      withdrawal_status: "pending_review" | "approved" | "paid" | "rejected"
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
      app_role: ["admin", "user"],
      ledger_tx_type: [
        "topup_credit",
        "spend_credit",
        "contract_funding",
        "escrow_release",
        "withdrawal_request",
        "withdrawal_paid",
        "refund",
        "adjustment",
      ],
      payment_status: ["pending", "paid", "released", "failed"],
      payout_type: ["pix", "bank"],
      project_status: ["draft", "open", "in_progress", "completed"],
      proposal_status: ["sent", "accepted", "rejected"],
      user_type: ["company", "freelancer"],
      withdrawal_status: ["pending_review", "approved", "paid", "rejected"],
    },
  },
} as const
