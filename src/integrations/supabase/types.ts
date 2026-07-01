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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      children: {
        Row: {
          birth_month: number | null
          birth_year: number | null
          created_at: string
          emoji: string | null
          id: string
          name: string
          school_name: string | null
          user_id: string
        }
        Insert: {
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          school_name?: string | null
          user_id: string
        }
        Update: {
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          school_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      development_scores: {
        Row: {
          area: string
          category: string
          child_id: string
          created_at: string
          id: string
          notes: string | null
          score: string
          term: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          category?: string
          child_id: string
          created_at?: string
          id?: string
          notes?: string | null
          score?: string
          term?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          category?: string
          child_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          score?: string
          term?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_scores_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          cc_email: string | null
          created_at: string
          id: string
          morning_enabled: boolean
          morning_time: string
          night_enabled: boolean
          night_time: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cc_email?: string | null
          created_at?: string
          id?: string
          morning_enabled?: boolean
          morning_time?: string
          night_enabled?: boolean
          night_time?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cc_email?: string | null
          created_at?: string
          id?: string
          morning_enabled?: boolean
          morning_time?: string
          night_enabled?: boolean
          night_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_attachments: {
        Row: {
          created_at: string
          event_id: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string
          child_name: string | null
          created_at: string
          date: string
          description: string | null
          emoji: string | null
          excluded_dates: string[]
          id: string
          is_completed: boolean
          is_milestone: boolean
          is_recurring: boolean
          milestone_remind_days_before: number | null
          recurrence_cycle: string | null
          recurrence_days: number[] | null
          time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          child_name?: string | null
          created_at?: string
          date: string
          description?: string | null
          emoji?: string | null
          excluded_dates?: string[]
          id?: string
          is_completed?: boolean
          is_milestone?: boolean
          is_recurring?: boolean
          milestone_remind_days_before?: number | null
          recurrence_cycle?: string | null
          recurrence_days?: number[] | null
          time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          child_name?: string | null
          created_at?: string
          date?: string
          description?: string | null
          emoji?: string | null
          excluded_dates?: string[]
          id?: string
          is_completed?: boolean
          is_milestone?: boolean
          is_recurring?: boolean
          milestone_remind_days_before?: number | null
          recurrence_cycle?: string | null
          recurrence_days?: number[] | null
          time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_records: {
        Row: {
          ai_extracted: boolean
          child_id: string
          created_at: string
          event_id: string | null
          file_name: string | null
          file_url: string | null
          id: string
          improvement_area_1: string | null
          improvement_area_2: string | null
          improvement_area_3: string | null
          meeting_date: string
          overall_notes: string | null
          phase: string
          post_focus_1: string | null
          post_focus_2: string | null
          post_focus_3: string | null
          post_owner_1: string | null
          post_owner_2: string | null
          post_owner_3: string | null
          pre_child_notes: string | null
          pre_parent_notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_extracted?: boolean
          child_id: string
          created_at?: string
          event_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          improvement_area_1?: string | null
          improvement_area_2?: string | null
          improvement_area_3?: string | null
          meeting_date?: string
          overall_notes?: string | null
          phase?: string
          post_focus_1?: string | null
          post_focus_2?: string | null
          post_focus_3?: string | null
          post_owner_1?: string | null
          post_owner_2?: string | null
          post_owner_3?: string | null
          pre_child_notes?: string | null
          pre_parent_notes?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_extracted?: boolean
          child_id?: string
          created_at?: string
          event_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          improvement_area_1?: string | null
          improvement_area_2?: string | null
          improvement_area_3?: string | null
          meeting_date?: string
          overall_notes?: string | null
          phase?: string
          post_focus_1?: string | null
          post_focus_2?: string | null
          post_focus_3?: string | null
          post_owner_1?: string | null
          post_owner_2?: string | null
          post_owner_3?: string | null
          pre_child_notes?: string | null
          pre_parent_notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          display_name: string | null
          emoji_backfill_at: string | null
          id: string
          onboarding_completed: boolean
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          emoji_backfill_at?: string | null
          id?: string
          onboarding_completed?: boolean
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          emoji_backfill_at?: string | null
          id?: string
          onboarding_completed?: boolean
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_books: {
        Row: {
          child_id: string
          cover_url: string | null
          created_at: string
          id: string
          is_read: boolean
          photo_path: string
          question_1: string | null
          question_2: string | null
          question_3: string | null
          read_at: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          child_id: string
          cover_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          photo_path: string
          question_1?: string | null
          question_2?: string | null
          question_3?: string | null
          read_at?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          child_id?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          photo_path?: string
          question_1?: string | null
          question_2?: string | null
          question_3?: string | null
          read_at?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_books_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          category: string
          child_id: string | null
          created_at: string
          emoji: string | null
          expires_after: string
          id: string
          is_dismissed: boolean
          notice_date: string
          priority: string
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          child_id?: string | null
          created_at?: string
          emoji?: string | null
          expires_after: string
          id?: string
          is_dismissed?: boolean
          notice_date: string
          priority?: string
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          child_id?: string | null
          created_at?: string
          emoji?: string | null
          expires_after?: string
          id?: string
          is_dismissed?: boolean
          notice_date?: string
          priority?: string
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          calendar_connected: boolean
          calendar_last_synced_at: string | null
          created_at: string
          gmail_connected: boolean
          gmail_history_id: string | null
          gmail_last_scanned_at: string | null
          google_access_token: string | null
          google_email: string | null
          google_refresh_token: string | null
          google_token_expiry: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_connected?: boolean
          calendar_last_synced_at?: string | null
          created_at?: string
          gmail_connected?: boolean
          gmail_history_id?: string | null
          gmail_last_scanned_at?: string | null
          google_access_token?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_connected?: boolean
          calendar_last_synced_at?: string | null
          created_at?: string
          gmail_connected?: boolean
          gmail_history_id?: string | null
          gmail_last_scanned_at?: string | null
          google_access_token?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      admin_get_user_activity: {
        Args: never
        Returns: {
          child_count: number
          city: string
          completed_event_count: number
          display_name: string
          email: string
          event_count: number
          is_admin: boolean
          last_event_created_at: string
          last_sign_in_at: string
          onboarding_completed: boolean
          signed_up_at: string
          state: string
          user_id: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
