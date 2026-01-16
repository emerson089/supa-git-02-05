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
      clientes: {
        Row: {
          cidade: string
          created_at: string
          estado: string
          excursao: string
          id: string
          nome: string
          telefone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cidade?: string
          created_at?: string
          estado?: string
          excursao?: string
          id?: string
          nome: string
          telefone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cidade?: string
          created_at?: string
          estado?: string
          excursao?: string
          id?: string
          nome?: string
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          categoria: string
          created_at: string
          id: string
          imagem_url: string | null
          localizacao: string | null
          nome: string
          preco_unitario: number | null
          producao_id: string | null
          quantidade: number
          quantidade_minima: number
          tipo: string
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          imagem_url?: string | null
          localizacao?: string | null
          nome: string
          preco_unitario?: number | null
          producao_id?: string | null
          quantidade?: number
          quantidade_minima?: number
          tipo: string
          unidade: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          imagem_url?: string | null
          localizacao?: string | null
          nome?: string
          preco_unitario?: number | null
          producao_id?: string | null
          quantidade?: number
          quantidade_minima?: number
          tipo?: string
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_itens_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producao"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_locais: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          tipo: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          tipo: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          id: string
          item_id: string
          motivo: string | null
          producao_id: string | null
          quantidade: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          motivo?: string | null
          producao_id?: string | null
          quantidade: number
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          motivo?: string | null
          producao_id?: string | null
          quantidade?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producao"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_por_local: {
        Row: {
          id: string
          item_id: string
          local_id: string
          quantidade: number
          quantidade_reservada: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          local_id: string
          quantidade?: number
          quantidade_reservada?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          local_id?: string
          quantidade?: number
          quantidade_reservada?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_por_local_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_por_local_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_custos_config: {
        Row: {
          created_at: string
          id: string
          metros_corte: number | null
          preco_venda: number | null
          producao_id: string
          updated_at: string
          user_id: string | null
          valor_metro: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          metros_corte?: number | null
          preco_venda?: number | null
          producao_id: string
          updated_at?: string
          user_id?: string | null
          valor_metro?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          metros_corte?: number | null
          preco_venda?: number | null
          producao_id?: string
          updated_at?: string
          user_id?: string | null
          valor_metro?: number | null
        }
        Relationships: []
      }
      lote_custos_itens: {
        Row: {
          created_at: string
          data_pagamento: string | null
          descricao: string
          id: string
          is_paid: boolean
          producao_id: string
          tipo: string
          updated_at: string
          user_id: string | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          descricao: string
          id?: string
          is_paid?: boolean
          producao_id: string
          tipo: string
          updated_at?: string
          user_id?: string | null
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          descricao?: string
          id?: string
          is_paid?: boolean
          producao_id?: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
          valor_unitario?: number
        }
        Relationships: []
      }
      pedido_itens: {
        Row: {
          created_at: string
          id: string
          pedido_id: string
          produto_id: string | null
          produto_nome: string
          quantidade: number
          user_id: string
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_id: string
          produto_id?: string | null
          produto_nome: string
          quantidade?: number
          user_id: string
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          id?: string
          pedido_id?: string
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          user_id?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cidade: string | null
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          estado: string | null
          estorno_realizado: boolean | null
          excursao: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          status: string | null
          status_entrega: string | null
          status_pagamento: string | null
          status_pedido: string | null
          telefone: string | null
          total_pecas: number | null
          updated_at: string
          user_id: string
          valor_total: number | null
        }
        Insert: {
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome: string
          created_at?: string
          estado?: string | null
          estorno_realizado?: boolean | null
          excursao?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          status_entrega?: string | null
          status_pagamento?: string | null
          status_pedido?: string | null
          telefone?: string | null
          total_pecas?: number | null
          updated_at?: string
          user_id: string
          valor_total?: number | null
        }
        Update: {
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          estado?: string | null
          estorno_realizado?: boolean | null
          excursao?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          status_entrega?: string | null
          status_pagamento?: string | null
          status_pedido?: string | null
          telefone?: string | null
          total_pecas?: number | null
          updated_at?: string
          user_id?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      prestadores_servico: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          etapas: string[]
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          etapas: string[]
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          etapas?: string[]
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      producao: {
        Row: {
          checklist_aprontamento: Json | null
          created_date: string
          id: string
          id_producao: string
          imagem_url: string | null
          integrado_estoque: boolean
          modelo_nome_cache: string | null
          observacoes: string | null
          pecas_concluidas: number | null
          prioridade: string | null
          processo_atual: string
          produto_id: string | null
          quantidade: number
          responsavel: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          checklist_aprontamento?: Json | null
          created_date?: string
          id?: string
          id_producao: string
          imagem_url?: string | null
          integrado_estoque?: boolean
          modelo_nome_cache?: string | null
          observacoes?: string | null
          pecas_concluidas?: number | null
          prioridade?: string | null
          processo_atual?: string
          produto_id?: string | null
          quantidade?: number
          responsavel?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          checklist_aprontamento?: Json | null
          created_date?: string
          id?: string
          id_producao?: string
          imagem_url?: string | null
          integrado_estoque?: boolean
          modelo_nome_cache?: string | null
          observacoes?: string | null
          pecas_concluidas?: number | null
          prioridade?: string | null
          processo_atual?: string
          produto_id?: string | null
          quantidade?: number
          responsavel?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_log: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          processo_anterior: string | null
          processo_novo: string
          producao_id: string
          responsavel: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          processo_anterior?: string | null
          processo_novo: string
          producao_id: string
          responsavel?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          processo_anterior?: string | null
          processo_novo?: string
          producao_id?: string
          responsavel?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_log_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producao"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string | null
          nome: string
          referencia: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          nome: string
          referencia: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          referencia?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transferencia_itens: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          preco_unitario: number | null
          quantidade_enviada: number
          quantidade_retornada: number | null
          transferencia_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          preco_unitario?: number | null
          quantidade_enviada?: number
          quantidade_retornada?: number | null
          transferencia_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          preco_unitario?: number | null
          quantidade_enviada?: number
          quantidade_retornada?: number | null
          transferencia_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencia_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencia_itens_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          created_at: string | null
          data_retorno: string | null
          data_saida: string | null
          id: string
          local_destino_id: string
          local_origem_id: string
          observacoes: string | null
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_retorno?: string | null
          data_saida?: string | null
          id?: string
          local_destino_id: string
          local_origem_id: string
          observacoes?: string | null
          status?: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_retorno?: string | null
          data_saida?: string | null
          id?: string
          local_destino_id?: string
          local_origem_id?: string
          observacoes?: string | null
          status?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_local_destino_id_fkey"
            columns: ["local_destino_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_local_origem_id_fkey"
            columns: ["local_origem_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
