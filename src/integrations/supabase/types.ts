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
      company_profiles: {
        Row: {
          about: string | null
          company_name: string | null
          company_size: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          id: string
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
          id?: string
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
          id?: string
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
      contracts: {
        Row: {
          accepted_at: string | null
          amount_cents: number
          cancelled_at: string | null
          company_user_id: string
          completed_at: string | null
          created_at: string
          currency: string
          description: string | null
          freelancer_user_id: string
          id: string
          milestones: Json | null
          project_id: string
          proposal_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          amount_cents?: number
          cancelled_at?: string | null
          company_user_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          freelancer_user_id: string
          id?: string
          milestones?: Json | null
          project_id: string
          proposal_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          amount_cents?: number
          cancelled_at?: string | null
          company_user_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          freelancer_user_id?: string
          id?: string
          milestones?: Json | null
          project_id?: string
          proposal_id?: string
          status?: string
          title?: string
          updated_at?: string
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
        ]
      }
      freelancer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          country_code: string | null
          created_at: string
          currency_code: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string
          languages: string[] | null
          location: string | null
          preferred_payout_currency: string | null
          proposal_credits: number
          skills: string[] | null
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
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: string[] | null
          location?: string | null
          preferred_payout_currency?: string | null
          proposal_credits?: number
          skills?: string[] | null
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
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: string[] | null
          location?: string | null
          preferred_payout_currency?: string | null
          proposal_credits?: number
          skills?: string[] | null
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
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
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
          onboarding_completed: boolean | null
          preferred_language: string
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
          onboarding_completed?: boolean | null
          preferred_language?: string
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
          onboarding_completed?: boolean | null
          preferred_language?: string
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
          budget_max: number | null
          budget_min: number | null
          category: string | null
          company_user_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          kpis: Json | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          company_user_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kpis?: Json | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          company_user_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kpis?: Json | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          cover_letter: string | null
          created_at: string
          freelancer_user_id: string
          highlighted_at: string | null
          id: string
          is_highlighted: boolean
          milestones: Json | null
          project_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          freelancer_user_id: string
          highlighted_at?: string | null
          id?: string
          is_highlighted?: boolean
          milestones?: Json | null
          project_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          freelancer_user_id?: string
          highlighted_at?: string | null
          id?: string
          is_highlighted?: boolean
          milestones?: Json | null
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
      [_ in never]: never
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
          p_description?: string
          p_payment_id?: string
          p_user_id: string
          p_user_type: string
        }
        Returns: boolean
      }
      check_platform_credits: {
        Args: { p_action_key: string; p_user_id: string }
        Returns: boolean
      }
      consume_proposal_credit: {
        Args: { p_freelancer_user_id: string }
        Returns: boolean
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
      ensure_company_wallet: {
        Args: { p_company_user_id: string }
        Returns: string
      }
      ensure_user_balance: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: string
      }
      ensure_user_wallet: { Args: { p_user_id: string }; Returns: string }
      fund_contract_escrow: {
        Args: {
          p_amount: number
          p_company_user_id: string
          p_contract_id: string
          p_payment_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_freelancer_achievements: {
        Args: { p_freelancer_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      process_withdrawal: {
        Args: {
          p_admin_id: string
          p_admin_notes?: string
          p_new_status: Database["public"]["Enums"]["withdrawal_status"]
          p_withdrawal_id: string
        }
        Returns: boolean
      }
      release_escrow_to_earnings: {
        Args: {
          p_amount: number
          p_company_user_id: string
          p_context?: string
          p_contract_id: string
          p_freelancer_user_id: string
        }
        Returns: boolean
      }
      request_withdrawal: {
        Args: {
          p_amount: number
          p_freelancer_user_id: string
          p_payout_method_id: string
        }
        Returns: string
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
      update_freelancer_revenue_and_achievements: {
        Args: { p_freelancer_user_id: string }
        Returns: undefined
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
