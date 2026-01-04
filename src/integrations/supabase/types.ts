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
          created_at: string
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          phone: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          about?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          about?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
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
      freelancer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          hourly_rate: number | null
          id: string
          languages: string[] | null
          location: string | null
          skills: string[] | null
          title: string | null
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: string[] | null
          location?: string | null
          skills?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: string[] | null
          location?: string | null
          skills?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id?: string
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
      payments: {
        Row: {
          amount: number
          company_user_id: string | null
          created_at: string
          currency: string
          freelancer_user_id: string | null
          id: string
          project_id: string | null
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
          freelancer_user_id?: string | null
          id?: string
          project_id?: string | null
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
          freelancer_user_id?: string | null
          id?: string
          project_id?: string | null
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
          preferred_language: string
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
          preferred_language?: string
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
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"]
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          company_user_id: string
          created_at: string
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
          id: string
          milestones: Json | null
          project_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          freelancer_user_id: string
          id?: string
          milestones?: Json | null
          project_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          freelancer_user_id?: string
          id?: string
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
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      payment_status: "pending" | "paid" | "released" | "failed"
      payout_type: "pix" | "bank"
      project_status: "draft" | "open" | "in_progress" | "completed"
      proposal_status: "sent" | "accepted" | "rejected"
      user_type: "company" | "freelancer"
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
      payment_status: ["pending", "paid", "released", "failed"],
      payout_type: ["pix", "bank"],
      project_status: ["draft", "open", "in_progress", "completed"],
      proposal_status: ["sent", "accepted", "rejected"],
      user_type: ["company", "freelancer"],
    },
  },
} as const
