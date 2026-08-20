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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      deal_notes: {
        Row: {
          author: string
          body: string
          created_at: string
          deal_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string
          body?: string
          created_at?: string
          deal_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          deal_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          caller_id: string | null
          caller_name: string
          cold_note: string
          company_name: string
          contact_name: string
          created_at: string
          email: string
          followup_at: string | null
          followup_done: boolean
          followup_note: string
          id: string
          lead_id: string | null
          phone: string
          position: number
          stage: string
          updated_at: string
          user_id: string
          website_url: string
        }
        Insert: {
          caller_id?: string | null
          caller_name?: string
          cold_note?: string
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          followup_at?: string | null
          followup_done?: boolean
          followup_note?: string
          id?: string
          lead_id?: string | null
          phone?: string
          position?: number
          stage?: string
          updated_at?: string
          user_id: string
          website_url?: string
        }
        Update: {
          caller_id?: string | null
          caller_name?: string
          cold_note?: string
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          followup_at?: string | null
          followup_done?: boolean
          followup_note?: string
          id?: string
          lead_id?: string | null
          phone?: string
          position?: number
          stage?: string
          updated_at?: string
          user_id?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          actor_id: string | null
          actor_name: string
          created_at: string
          deal_id: string | null
          detail: string
          id: string
          lead_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          deal_id?: string | null
          detail?: string
          id?: string
          lead_id?: string | null
          type?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          deal_id?: string | null
          detail?: string
          id?: string
          lead_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          call_answered: boolean
          company_name: string
          contact_name: string
          created_at: string
          email: string
          followup_at: string | null
          id: string
          list_id: string | null
          note: string
          phone: string
          previous_user_id: string | null
          reengage_at: string | null
          rejected_at: string | null
          status: string
          updated_at: string
          user_id: string
          website_url: string
        }
        Insert: {
          call_answered?: boolean
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          followup_at?: string | null
          id?: string
          list_id?: string | null
          note?: string
          phone?: string
          previous_user_id?: string | null
          reengage_at?: string | null
          rejected_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website_url?: string
        }
        Update: {
          call_answered?: boolean
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          followup_at?: string | null
          id?: string
          list_id?: string | null
          note?: string
          phone?: string
          previous_user_id?: string | null
          reengage_at?: string | null
          rejected_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lead_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          cadence_days: number
          created_at: string
          created_by: string | null
          deal_id: string | null
          detail: string
          done: boolean
          due_at: string
          id: string
          kind: string
          lead_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence_days?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          detail?: string
          done?: boolean
          due_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence_days?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          detail?: string
          done?: boolean
          due_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      create_rebook_task: {
        Args: { _deal_id: string }
        Returns: {
          cadence_days: number
          created_at: string
          created_by: string | null
          deal_id: string | null
          detail: string
          done: boolean
          due_at: string
          id: string
          kind: string
          lead_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_lead: {
        Args: { _lead_id: string }
        Returns: {
          call_answered: boolean
          company_name: string
          contact_name: string
          created_at: string
          email: string
          followup_at: string | null
          id: string
          list_id: string | null
          note: string
          phone: string
          previous_user_id: string | null
          reengage_at: string | null
          rejected_at: string | null
          status: string
          updated_at: string
          user_id: string
          website_url: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "cold_caller"
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
      app_role: ["admin", "cold_caller"],
    },
  },
} as const
