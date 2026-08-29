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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      body_parts: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      equipment_types: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      exercise_defaults: {
        Row: {
          bar_weight: number | null
          created_at: string | null
          exercise_id: string | null
          id: string
          rep_increment: number | null
          reps: number | null
          sets: number | null
          updated_at: string | null
          user_id: string | null
          weight: number | null
          weight_increment: number | null
        }
        Insert: {
          bar_weight?: number | null
          created_at?: string | null
          exercise_id?: string | null
          id?: string
          rep_increment?: number | null
          reps?: number | null
          sets?: number | null
          updated_at?: string | null
          user_id?: string | null
          weight?: number | null
          weight_increment?: number | null
        }
        Update: {
          bar_weight?: number | null
          created_at?: string | null
          exercise_id?: string | null
          id?: string
          rep_increment?: number | null
          reps?: number | null
          sets?: number | null
          updated_at?: string | null
          user_id?: string | null
          weight?: number | null
          weight_increment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_defaults_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_logs: {
        Row: {
          completed: boolean | null
          created_at: string | null
          failed_reps: number | null
          id: string
          recommend_increase: boolean | null
          reps: number | null
          set_number: number
          status: string
          updated_at: string | null
          weight: number | null
          workout_exercise_id: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          failed_reps?: number | null
          id?: string
          recommend_increase?: boolean | null
          reps?: number | null
          set_number: number
          status?: string
          updated_at?: string | null
          weight?: number | null
          workout_exercise_id?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          failed_reps?: number | null
          id?: string
          recommend_increase?: boolean | null
          reps?: number | null
          set_number?: number
          status?: string
          updated_at?: string | null
          weight?: number | null
          workout_exercise_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscle_groups: {
        Row: {
          created_at: string | null
          exercise_id: string
          is_primary: boolean | null
          muscle_group_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          is_primary?: boolean | null
          muscle_group_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          is_primary?: boolean | null
          muscle_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscle_groups_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscle_groups_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          body_part_id: string | null
          created_at: string | null
          description: string | null
          equipment_type_id: string | null
          id: string
          is_compound: boolean | null
          is_plate_loaded: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          body_part_id?: string | null
          created_at?: string | null
          description?: string | null
          equipment_type_id?: string | null
          id?: string
          is_compound?: boolean | null
          is_plate_loaded?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          body_part_id?: string | null
          created_at?: string | null
          description?: string | null
          equipment_type_id?: string | null
          id?: string
          is_compound?: boolean | null
          is_plate_loaded?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_body_part_id_fkey"
            columns: ["body_part_id"]
            isOneToOne: false
            referencedRelation: "body_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_groups: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      storage: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      template_exercises: {
        Row: {
          created_at: string | null
          default_reps: number | null
          default_sets: number | null
          default_weight: number | null
          exercise_id: string | null
          id: string
          order_index: number
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_reps?: number | null
          default_sets?: number | null
          default_weight?: number | null
          exercise_id?: string | null
          id?: string
          order_index: number
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_reps?: number | null
          default_sets?: number | null
          default_weight?: number | null
          exercise_id?: string | null
          id?: string
          order_index?: number
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          auto_start_timer: boolean | null
          available_plates_kg: Json | null
          available_plates_lb: Json | null
          created_at: string | null
          dark_mode: boolean | null
          first_name: string | null
          goal_weekday_start: number | null
          height: number | null
          id: string
          is_admin: boolean | null
          last_name: string | null
          recent_workouts_count: number | null
          rest_timer_duration: number | null
          show_consistency_tracker: boolean | null
          show_exercise_timer: boolean | null
          show_volume_graph: boolean | null
          show_workout_timer: boolean | null
          updated_at: string | null
          use_metric: boolean | null
          user_id: string
          username: string | null
          weekly_workout_goal: number | null
          weight: number | null
          weight_unit: string
        }
        Insert: {
          auto_start_timer?: boolean | null
          available_plates_kg?: Json | null
          available_plates_lb?: Json | null
          created_at?: string | null
          dark_mode?: boolean | null
          first_name?: string | null
          goal_weekday_start?: number | null
          height?: number | null
          id?: string
          is_admin?: boolean | null
          last_name?: string | null
          recent_workouts_count?: number | null
          rest_timer_duration?: number | null
          show_consistency_tracker?: boolean | null
          show_exercise_timer?: boolean | null
          show_volume_graph?: boolean | null
          show_workout_timer?: boolean | null
          updated_at?: string | null
          use_metric?: boolean | null
          user_id: string
          username?: string | null
          weekly_workout_goal?: number | null
          weight?: number | null
          weight_unit?: string
        }
        Update: {
          auto_start_timer?: boolean | null
          available_plates_kg?: Json | null
          available_plates_lb?: Json | null
          created_at?: string | null
          dark_mode?: boolean | null
          first_name?: string | null
          goal_weekday_start?: number | null
          height?: number | null
          id?: string
          is_admin?: boolean | null
          last_name?: string | null
          recent_workouts_count?: number | null
          rest_timer_duration?: number | null
          show_consistency_tracker?: boolean | null
          show_exercise_timer?: boolean | null
          show_volume_graph?: boolean | null
          show_workout_timer?: boolean | null
          updated_at?: string | null
          use_metric?: boolean | null
          user_id?: string
          username?: string | null
          weekly_workout_goal?: number | null
          weight?: number | null
          weight_unit?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string | null
          exercise_id: string | null
          id: string
          order_index: number
          workout_id: string | null
        }
        Insert: {
          created_at?: string | null
          exercise_id?: string | null
          id?: string
          order_index: number
          workout_id?: string | null
        }
        Update: {
          created_at?: string | null
          exercise_id?: string | null
          id?: string
          order_index?: number
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          is_hidden: boolean | null
          name: string
          template_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          is_hidden?: boolean | null
          name: string
          template_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          is_hidden?: boolean | null
          name?: string
          template_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          name: string
          notes: string | null
          start_time: string | null
          template_id: string | null
          template_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          name: string
          notes?: string | null
          start_time?: string | null
          template_id?: string | null
          template_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_time?: string | null
          template_id?: string | null
          template_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      copy_user_defaults: {
        Args: { source_user_id: string; target_user_id: string }
        Returns: undefined
      }
      get_user_details: {
        Args: { user_email: string }
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      set_user_data_as_default: {
        Args: { admin_user_id: string }
        Returns: undefined
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
