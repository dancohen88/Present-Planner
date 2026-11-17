export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      gifts: {
        Row: {
          created_at: string
          id: string
          person_id: string
          plan_id: string
          price_pence: number | null
          purchaser_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          person_id: string
          plan_id: string
          price_pence?: number | null
          purchaser_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          person_id?: string
          plan_id?: string
          price_pence?: number | null
          purchaser_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'gifts_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gifts_plan_id_person_id_fkey'
            columns: ['plan_id', 'person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['plan_id', 'id']
          },
          {
            foreignKeyName: 'gifts_plan_id_purchaser_id_fkey'
            columns: ['plan_id', 'purchaser_id']
            isOneToOne: false
            referencedRelation: 'purchasers'
            referencedColumns: ['plan_id', 'id']
          },
        ]
      }
      people: {
        Row: {
          budget_pence: number | null
          created_at: string
          id: string
          member_user_id: string | null
          name: string
          plan_id: string
        }
        ComputedFields: never
        Insert: {
          budget_pence?: number | null
          created_at?: string
          id?: string
          member_user_id?: string | null
          name: string
          plan_id: string
        }
        Update: {
          budget_pence?: number | null
          created_at?: string
          id?: string
          member_user_id?: string | null
          name?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'people_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'people_plan_id_member_user_id_fkey'
            columns: ['plan_id', 'member_user_id']
            isOneToOne: false
            referencedRelation: 'plan_members'
            referencedColumns: ['plan_id', 'user_id']
          },
        ]
      }
      plan_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          plan_id: string
          token: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string
          expires_at?: string
          plan_id: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          plan_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_invites_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
        ]
      }
      plan_members: {
        Row: {
          display_name: string
          joined_at: string
          plan_id: string
          role: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          display_name: string
          joined_at?: string
          plan_id: string
          role?: string
          user_id: string
        }
        Update: {
          display_name?: string
          joined_at?: string
          plan_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_members_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      purchasers: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_id: string
          slot: number
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_id: string
          slot: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_id?: string
          slot?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'purchasers_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchasers_plan_id_user_id_fkey'
            columns: ['plan_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'plan_members'
            referencedColumns: ['plan_id', 'user_id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_plan: {
        Args: { p_display_name: string; p_name: string }
        Returns: string
      }
      invite_details: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          invited_by: string
          plan_id: string
          plan_name: string
        }[]
      }
      is_my_gift_recipient: { Args: { p_person_id: string }; Returns: boolean }
      is_plan_member: { Args: { p_plan_id: string }; Returns: boolean }
      is_plan_owner: { Args: { p_plan_id: string }; Returns: boolean }
      join_plan: {
        Args: { p_display_name: string; p_token: string }
        Returns: string
      }
      next_purchaser_slot: { Args: { p_plan_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
