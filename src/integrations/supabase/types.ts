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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          inspection_id: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          inspection_id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          inspection_id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_checks: {
        Row: {
          confidence: number | null
          consumer_id: string | null
          created_at: string
          findings: Json
          id: string
          package_image_url: string | null
          product_id: string | null
          product_name: string | null
          status: string | null
        }
        Insert: {
          confidence?: number | null
          consumer_id?: string | null
          created_at?: string
          findings?: Json
          id?: string
          package_image_url?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string | null
        }
        Update: {
          confidence?: number | null
          consumer_id?: string | null
          created_at?: string
          findings?: Json
          id?: string
          package_image_url?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumer_checks_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_checks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["decision_type"]
          id: string
          inspection_id: string
          note: string | null
          officer_id: string | null
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["decision_type"]
          id?: string
          inspection_id: string
          note?: string | null
          officer_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["decision_type"]
          id?: string
          inspection_id?: string
          note?: string | null
          officer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          classification: Json
          confidence: number | null
          created_at: string
          district: string | null
          id: string
          inspection_date: string
          inspector_id: string | null
          is_demo: boolean
          latitude: number | null
          local_id: string | null
          location_accuracy: number | null
          longitude: number | null
          package_image_url: string | null
          payload: Json
          product_id: string | null
          product_name: string | null
          seller_id: string | null
          seller_name: string | null
          status: Database["public"]["Enums"]["inspection_status"]
          system_status: Database["public"]["Enums"]["inspection_status"] | null
          updated_at: string
        }
        Insert: {
          classification?: Json
          confidence?: number | null
          created_at?: string
          district?: string | null
          id?: string
          inspection_date?: string
          inspector_id?: string | null
          is_demo?: boolean
          latitude?: number | null
          local_id?: string | null
          location_accuracy?: number | null
          longitude?: number | null
          package_image_url?: string | null
          payload?: Json
          product_id?: string | null
          product_name?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          system_status?:
            | Database["public"]["Enums"]["inspection_status"]
            | null
          updated_at?: string
        }
        Update: {
          classification?: Json
          confidence?: number | null
          created_at?: string
          district?: string | null
          id?: string
          inspection_date?: string
          inspector_id?: string | null
          is_demo?: boolean
          latitude?: number | null
          local_id?: string | null
          location_accuracy?: number | null
          longitude?: number | null
          package_image_url?: string | null
          payload?: Json
          product_id?: string | null
          product_name?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          system_status?:
            | Database["public"]["Enums"]["inspection_status"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          created_at: string
          document_url: string | null
          gazette_reference: string | null
          id: string
          ingested: boolean
          published_on: string | null
          source_id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          gazette_reference?: string | null
          id?: string
          ingested?: boolean
          published_on?: string | null
          source_id: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_url?: string | null
          gazette_reference?: string | null
          id?: string
          ingested?: boolean
          published_on?: string | null
          source_id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          title: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_results: {
        Row: {
          bounding_box: Json | null
          confidence: number | null
          created_at: string
          detected_value: string | null
          evidence_url: string | null
          field_name: string
          id: string
          inspection_id: string
          status: string | null
        }
        Insert: {
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string
          detected_value?: string | null
          evidence_url?: string | null
          field_name: string
          id?: string
          inspection_id: string
          status?: string | null
        }
        Update: {
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string
          detected_value?: string | null
          evidence_url?: string | null
          field_name?: string
          id?: string
          inspection_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_results_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          manufacturer: string | null
          package_type: string | null
          product_name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          package_type?: string | null
          product_name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          package_type?: string | null
          product_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          district: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string
          phone: string | null
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          district?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          district?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          inspection_id: string
          report_number: string | null
          report_url: string | null
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          inspection_id: string
          report_number?: string | null
          report_url?: string | null
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          inspection_id?: string
          report_number?: string | null
          report_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_checks: {
        Row: {
          confidence: number | null
          created_at: string
          evidence: string | null
          id: string
          inspection_id: string
          reason: string | null
          result: Database["public"]["Enums"]["rule_check_result"]
          rule_id: string | null
          rule_key: string | null
          rule_version: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evidence?: string | null
          id?: string
          inspection_id: string
          reason?: string | null
          result: Database["public"]["Enums"]["rule_check_result"]
          rule_id?: string | null
          rule_key?: string | null
          rule_version?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evidence?: string | null
          id?: string
          inspection_id?: string
          reason?: string | null
          result?: Database["public"]["Enums"]["rule_check_result"]
          rule_id?: string | null
          rule_key?: string | null
          rule_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_checks_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_checks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_exemptions: {
        Row: {
          conditions: Json
          created_at: string
          effective_from: string
          effective_to: string | null
          exemption_key: string
          explanation: string | null
          id: string
          rule_keys: Json
          source_document: string | null
          title: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          effective_from: string
          effective_to?: string | null
          exemption_key: string
          explanation?: string | null
          id?: string
          rule_keys?: Json
          source_document?: string | null
          title: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          exemption_key?: string
          explanation?: string | null
          id?: string
          rule_keys?: Json
          source_document?: string | null
          title?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          amendment_note: string | null
          applicability: Json
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          effective_from: string
          effective_to: string | null
          field: string | null
          human_review_required: boolean
          id: string
          legal_requirement: string | null
          machine_checkability: string | null
          provenance: string | null
          required_evidence: Json
          rule_key: string
          rule_number: string
          severity: string | null
          source_document: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["rule_status"]
          sub_rule: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          amendment_note?: string | null
          applicability?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from: string
          effective_to?: string | null
          field?: string | null
          human_review_required?: boolean
          id?: string
          legal_requirement?: string | null
          machine_checkability?: string | null
          provenance?: string | null
          required_evidence?: Json
          rule_key: string
          rule_number: string
          severity?: string | null
          source_document?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["rule_status"]
          sub_rule?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          amendment_note?: string | null
          applicability?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          field?: string | null
          human_review_required?: boolean
          id?: string
          legal_requirement?: string | null
          machine_checkability?: string | null
          provenance?: string | null
          required_evidence?: Json
          rule_key?: string
          rule_number?: string
          severity?: string | null
          source_document?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["rule_status"]
          sub_rule?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          address: string | null
          contact_phone: string | null
          created_at: string
          district: string | null
          id: string
          name: string
          risk_score: number
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          id?: string
          name: string
          risk_score?: number
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          id?: string
          name?: string
          risk_score?: number
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_rule_version: {
        Args: {
          _amendment_note?: string
          _description: string
          _effective_from: string
          _legal_requirement: string
          _rule_key: string
          _rule_number: string
          _source_document?: string
          _title: string
        }
        Returns: {
          amendment_note: string | null
          applicability: Json
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          effective_from: string
          effective_to: string | null
          field: string | null
          human_review_required: boolean
          id: string
          legal_requirement: string | null
          machine_checkability: string | null
          provenance: string | null
          required_evidence: Json
          rule_key: string
          rule_number: string
          severity: string | null
          source_document: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["rule_status"]
          sub_rule: string | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_reviewer: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      decision_type:
        | "confirm_compliant"
        | "confirm_non_compliant"
        | "request_rescan"
        | "mark_not_applicable"
        | "send_for_review"
      inspection_status:
        | "pending"
        | "compliant"
        | "non_compliant"
        | "manual_review"
        | "rescan_required"
        | "partially_verified"
        | "insufficient_evidence"
      rule_check_result:
        | "pass"
        | "fail"
        | "manual_review"
        | "not_applicable"
        | "rescan_required"
        | "insufficient_evidence"
      rule_status: "draft" | "in_force" | "superseded" | "future" | "archived"
      user_role: "admin" | "inspector" | "enforcement_officer" | "consumer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      decision_type: [
        "confirm_compliant",
        "confirm_non_compliant",
        "request_rescan",
        "mark_not_applicable",
        "send_for_review",
      ],
      inspection_status: [
        "pending",
        "compliant",
        "non_compliant",
        "manual_review",
        "rescan_required",
        "partially_verified",
        "insufficient_evidence",
      ],
      rule_check_result: [
        "pass",
        "fail",
        "manual_review",
        "not_applicable",
        "rescan_required",
        "insufficient_evidence",
      ],
      rule_status: ["draft", "in_force", "superseded", "future", "archived"],
      user_role: ["admin", "inspector", "enforcement_officer", "consumer"],
    },
  },
} as const
