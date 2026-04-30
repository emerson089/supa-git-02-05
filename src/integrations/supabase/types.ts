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
      blacklist: {
        Row: {
          created_at: string
          id: string
          motivo: string
          origem: string
          telefone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string
          origem?: string
          telefone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          origem?: string
          telefone?: string
          user_id?: string
        }
        Relationships: []
      }
      campanhas_historico: {
        Row: {
          catalogo_id: string | null
          data_disparo: string
          falhas: number
          filtros_aplicados: Json
          id: string
          nome_campanha: string
          sucessos: number
          total_contatos: number
          user_id: string
          velocidade: string
        }
        Insert: {
          catalogo_id?: string | null
          data_disparo?: string
          falhas?: number
          filtros_aplicados?: Json
          id?: string
          nome_campanha: string
          sucessos?: number
          total_contatos?: number
          user_id: string
          velocidade?: string
        }
        Update: {
          catalogo_id?: string | null
          data_disparo?: string
          falhas?: number
          filtros_aplicados?: Json
          id?: string
          nome_campanha?: string
          sucessos?: number
          total_contatos?: number
          user_id?: string
          velocidade?: string
        }
        Relationships: []
      }
      catalogo_envios: {
        Row: {
          catalogo_id: string
          cliente_id: string
          enviado_em: string
          id: string
          user_id: string
        }
        Insert: {
          catalogo_id: string
          cliente_id: string
          enviado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          catalogo_id?: string
          cliente_id?: string
          enviado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      catalogos: {
        Row: {
          ativo: boolean
          created_at: string
          file_path: string
          id: string
          mensagem: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          file_path: string
          id?: string
          mensagem?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          file_path?: string
          id?: string
          mensagem?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      cliente_contatos: {
        Row: {
          canal: string
          cliente_id: string
          contatado_em: string
          id: string
          user_id: string
        }
        Insert: {
          canal: string
          cliente_id: string
          contatado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          canal?: string
          cliente_id?: string
          contatado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_feedbacks: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          motivo: string
          observacao: string | null
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          motivo: string
          observacao?: string | null
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          motivo?: string
          observacao?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_feedbacks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cidade: string
          created_at: string
          estado: string
          excluir_cobranca_automatica: boolean
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
          excluir_cobranca_automatica?: boolean
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
          excluir_cobranca_automatica?: boolean
          excursao?: string
          id?: string
          nome?: string
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cobrancas_enviadas: {
        Row: {
          cliente_nome: string
          enviado_at: string
          erro: string | null
          id: string
          mensagem: string
          pedido_id: string
          status: string
          telefone: string
          tentativa: number
          valor_total: number
        }
        Insert: {
          cliente_nome: string
          enviado_at?: string
          erro?: string | null
          id?: string
          mensagem?: string
          pedido_id: string
          status?: string
          telefone: string
          tentativa: number
          valor_total?: number
        }
        Update: {
          cliente_nome?: string
          enviado_at?: string
          erro?: string | null
          id?: string
          mensagem?: string
          pedido_id?: string
          status?: string
          telefone?: string
          tentativa?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_enviadas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      comprovantes: {
        Row: {
          banco_origem: string | null
          categoria: Database["public"]["Enums"]["comprovante_categoria"]
          chave_pix: string | null
          created_at: string
          dados_brutos: Json | null
          data_pagamento: string | null
          grupo_whatsapp: string | null
          id: string
          imagem_url: string
          nome_pagador: string | null
          numero_remetente: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["comprovante_status"]
          tipo_pagamento: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          banco_origem?: string | null
          categoria?: Database["public"]["Enums"]["comprovante_categoria"]
          chave_pix?: string | null
          created_at?: string
          dados_brutos?: Json | null
          data_pagamento?: string | null
          grupo_whatsapp?: string | null
          id?: string
          imagem_url: string
          nome_pagador?: string | null
          numero_remetente?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["comprovante_status"]
          tipo_pagamento?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          banco_origem?: string | null
          categoria?: Database["public"]["Enums"]["comprovante_categoria"]
          chave_pix?: string | null
          created_at?: string
          dados_brutos?: Json | null
          data_pagamento?: string | null
          grupo_whatsapp?: string | null
          id?: string
          imagem_url?: string
          nome_pagador?: string | null
          numero_remetente?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["comprovante_status"]
          tipo_pagamento?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      contagem_itens: {
        Row: {
          contagem_id: string
          created_at: string | null
          id: string
          item_id: string
          preco_aplicado: number
          quantidade_contada: number
          quantidade_sistema: number
          user_id: string
        }
        Insert: {
          contagem_id: string
          created_at?: string | null
          id?: string
          item_id: string
          preco_aplicado?: number
          quantidade_contada?: number
          quantidade_sistema?: number
          user_id: string
        }
        Update: {
          contagem_id?: string
          created_at?: string | null
          id?: string
          item_id?: string
          preco_aplicado?: number
          quantidade_contada?: number
          quantidade_sistema?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contagem_itens_contagem_id_fkey"
            columns: ["contagem_id"]
            isOneToOne: false
            referencedRelation: "contagens_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      contagens_estoque: {
        Row: {
          created_at: string | null
          data_contagem: string
          id: string
          local_id: string
          observacoes: string | null
          total_pecas: number
          user_id: string
          valor_total: number
        }
        Insert: {
          created_at?: string | null
          data_contagem?: string
          id?: string
          local_id: string
          observacoes?: string | null
          total_pecas?: number
          user_id: string
          valor_total?: number
        }
        Update: {
          created_at?: string | null
          data_contagem?: string
          id?: string
          local_id?: string
          observacoes?: string | null
          total_pecas?: number
          user_id?: string
          valor_total?: number
        }
        Relationships: []
      }
      curvas_mensais: {
        Row: {
          anos_considerados: number | null
          created_at: string | null
          dia: number
          id: string
          mes: number
          percentual_esperado: number
          total_faturamento_base: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          anos_considerados?: number | null
          created_at?: string | null
          dia: number
          id?: string
          mes: number
          percentual_esperado: number
          total_faturamento_base?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          anos_considerados?: number | null
          created_at?: string | null
          dia?: number
          id?: string
          mes?: number
          percentual_esperado?: number
          total_faturamento_base?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      custos_padrao: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          ordem: number
          tipo: string
          updated_at: string
          user_id: string
          valor_unitario: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          tipo: string
          updated_at?: string
          user_id: string
          valor_unitario?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_unitario?: number
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          categoria: string
          created_at: string
          custo_medio: number | null
          id: string
          imagem_url: string | null
          localizacao: string | null
          nome: string
          preco_unitario: number | null
          producao_id: string | null
          qtd_com_custo: number | null
          quantidade: number
          quantidade_inicial: number | null
          quantidade_minima: number
          tipo: string
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          custo_medio?: number | null
          id?: string
          imagem_url?: string | null
          localizacao?: string | null
          nome: string
          preco_unitario?: number | null
          producao_id?: string | null
          qtd_com_custo?: number | null
          quantidade?: number
          quantidade_inicial?: number | null
          quantidade_minima?: number
          tipo: string
          unidade: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          custo_medio?: number | null
          id?: string
          imagem_url?: string | null
          localizacao?: string | null
          nome?: string
          preco_unitario?: number | null
          producao_id?: string | null
          qtd_com_custo?: number | null
          quantidade?: number
          quantidade_inicial?: number | null
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
          custo_aplicado: number | null
          estoque_antes: number | null
          estoque_depois: number | null
          id: string
          item_id: string
          local_id: string | null
          motivo: string | null
          preco_aplicado: number | null
          producao_id: string | null
          quantidade: number
          source_id: string | null
          source_type: string | null
          tipo: string
          tipo_ajuste_id: string | null
          transferencia_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          custo_aplicado?: number | null
          estoque_antes?: number | null
          estoque_depois?: number | null
          id?: string
          item_id: string
          local_id?: string | null
          motivo?: string | null
          preco_aplicado?: number | null
          producao_id?: string | null
          quantidade: number
          source_id?: string | null
          source_type?: string | null
          tipo: string
          tipo_ajuste_id?: string | null
          transferencia_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          custo_aplicado?: number | null
          estoque_antes?: number | null
          estoque_depois?: number | null
          id?: string
          item_id?: string
          local_id?: string | null
          motivo?: string | null
          preco_aplicado?: number | null
          producao_id?: string | null
          quantidade?: number
          source_id?: string | null
          source_type?: string | null
          tipo?: string
          tipo_ajuste_id?: string | null
          transferencia_id?: string | null
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
            foreignKeyName: "estoque_movimentacoes_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_tipo_ajuste_id_fkey"
            columns: ["tipo_ajuste_id"]
            isOneToOne: false
            referencedRelation: "tipos_ajuste_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
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
      excursoes: {
        Row: {
          ativo: boolean
          contato: string | null
          created_at: string | null
          id: string
          localizacao: string | null
          nome: string
          origem: string | null
          taxa: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          contato?: string | null
          created_at?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          origem?: string | null
          taxa?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          contato?: string | null
          created_at?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          origem?: string | null
          taxa?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grupos_comprovantes: {
        Row: {
          aceita_pdf: boolean
          ativo: boolean
          categoria_padrao: Database["public"]["Enums"]["comprovante_categoria"]
          cor: string
          created_at: string
          emoji: string
          group_whatsapp_id: string
          id: string
          nome: string
          pedir_legenda_ja: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          aceita_pdf?: boolean
          ativo?: boolean
          categoria_padrao?: Database["public"]["Enums"]["comprovante_categoria"]
          cor?: string
          created_at?: string
          emoji?: string
          group_whatsapp_id: string
          id?: string
          nome: string
          pedir_legenda_ja?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          aceita_pdf?: boolean
          ativo?: boolean
          categoria_padrao?: Database["public"]["Enums"]["comprovante_categoria"]
          cor?: string
          created_at?: string
          emoji?: string
          group_whatsapp_id?: string
          id?: string
          nome?: string
          pedir_legenda_ja?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      metas_mensais: {
        Row: {
          ano: number
          created_at: string | null
          faturamento_realizado: number | null
          id: string
          media_base: number
          mes: number
          percentual_crescimento: number
          updated_at: string | null
          user_id: string
          valor_meta: number
        }
        Insert: {
          ano: number
          created_at?: string | null
          faturamento_realizado?: number | null
          id?: string
          media_base?: number
          mes: number
          percentual_crescimento?: number
          updated_at?: string | null
          user_id: string
          valor_meta?: number
        }
        Update: {
          ano?: number
          created_at?: string | null
          faturamento_realizado?: number | null
          id?: string
          media_base?: number
          mes?: number
          percentual_crescimento?: number
          updated_at?: string | null
          user_id?: string
          valor_meta?: number
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
          desconto: number | null
          estado: string | null
          estorno_realizado: boolean | null
          excluir_cobranca_automatica: boolean
          excursao: string | null
          excursao_id: string | null
          forma_pagamento: string | null
          id: string
          infinitepay_link: string | null
          infinitepay_nsu: string | null
          notificado_no_carro: boolean | null
          notificado_separado: boolean | null
          observacoes: string | null
          paid_at: string | null
          status: string | null
          status_entrega: string | null
          status_pagamento: string | null
          status_pedido: string | null
          taxa_excursao: number | null
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
          desconto?: number | null
          estado?: string | null
          estorno_realizado?: boolean | null
          excluir_cobranca_automatica?: boolean
          excursao?: string | null
          excursao_id?: string | null
          forma_pagamento?: string | null
          id?: string
          infinitepay_link?: string | null
          infinitepay_nsu?: string | null
          notificado_no_carro?: boolean | null
          notificado_separado?: boolean | null
          observacoes?: string | null
          paid_at?: string | null
          status?: string | null
          status_entrega?: string | null
          status_pagamento?: string | null
          status_pedido?: string | null
          taxa_excursao?: number | null
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
          desconto?: number | null
          estado?: string | null
          estorno_realizado?: boolean | null
          excluir_cobranca_automatica?: boolean
          excursao?: string | null
          excursao_id?: string | null
          forma_pagamento?: string | null
          id?: string
          infinitepay_link?: string | null
          infinitepay_nsu?: string | null
          notificado_no_carro?: boolean | null
          notificado_separado?: boolean | null
          observacoes?: string | null
          paid_at?: string | null
          status?: string | null
          status_entrega?: string | null
          status_pagamento?: string | null
          status_pedido?: string | null
          taxa_excursao?: number | null
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
          {
            foreignKeyName: "pedidos_excursao_id_fkey"
            columns: ["excursao_id"]
            isOneToOne: false
            referencedRelation: "excursoes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_configuracoes: {
        Row: {
          limite_diario_mensagens: number
          pausa_inteligente: boolean
          saudacoes_personalizadas: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          limite_diario_mensagens?: number
          pausa_inteligente?: boolean
          saudacoes_personalizadas?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          limite_diario_mensagens?: number
          pausa_inteligente?: boolean
          saudacoes_personalizadas?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      precos_por_local: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          local_id: string
          preco_venda: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          local_id: string
          preco_venda: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          local_id?: string
          preco_venda?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          etapa_iniciada_em: string | null
          id: string
          id_producao: string
          imagem_url: string | null
          integrado_estoque: boolean
          modelo_nome_cache: string | null
          observacoes: string | null
          pecas_com_defeito: number | null
          pecas_concluidas: number | null
          posted_to_stock_at: string | null
          prioridade: string | null
          processo_atual: string
          produto_id: string | null
          quantidade: number
          quantidade_aprovada: number | null
          quantidade_final: number | null
          responsavel: string | null
          status_defeitos: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          checklist_aprontamento?: Json | null
          created_date?: string
          etapa_iniciada_em?: string | null
          id?: string
          id_producao: string
          imagem_url?: string | null
          integrado_estoque?: boolean
          modelo_nome_cache?: string | null
          observacoes?: string | null
          pecas_com_defeito?: number | null
          pecas_concluidas?: number | null
          posted_to_stock_at?: string | null
          prioridade?: string | null
          processo_atual?: string
          produto_id?: string | null
          quantidade?: number
          quantidade_aprovada?: number | null
          quantidade_final?: number | null
          responsavel?: string | null
          status_defeitos?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          checklist_aprontamento?: Json | null
          created_date?: string
          etapa_iniciada_em?: string | null
          id?: string
          id_producao?: string
          imagem_url?: string | null
          integrado_estoque?: boolean
          modelo_nome_cache?: string | null
          observacoes?: string | null
          pecas_com_defeito?: number | null
          pecas_concluidas?: number | null
          posted_to_stock_at?: string | null
          prioridade?: string | null
          processo_atual?: string
          produto_id?: string | null
          quantidade?: number
          quantidade_aprovada?: number | null
          quantidade_final?: number | null
          responsavel?: string | null
          status_defeitos?: string | null
          total_cost?: number | null
          unit_cost?: number | null
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
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          last_sign_in_at: string | null
          must_change_password: boolean | null
          nome: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          last_sign_in_at?: string | null
          must_change_password?: boolean | null
          nome?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          last_sign_in_at?: string | null
          must_change_password?: boolean | null
          nome?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_change_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_role: string
          old_role: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_role: string
          old_role?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_role?: string
          old_role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      templates_cobranca: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          mensagem: string
          tentativa: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem: string
          tentativa: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem?: string
          tentativa?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tipos_ajuste_estoque: {
        Row: {
          ativo: boolean
          conta_como_venda: boolean | null
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          conta_como_venda?: boolean | null
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          conta_como_venda?: boolean | null
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      transferencia_itens: {
        Row: {
          created_at: string | null
          id: string
          imagem_url_produto: string | null
          item_id: string | null
          nome_produto: string | null
          preco_unitario: number | null
          quantidade_enviada: number
          quantidade_retornada: number | null
          transferencia_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          imagem_url_produto?: string | null
          item_id?: string | null
          nome_produto?: string | null
          preco_unitario?: number | null
          quantidade_enviada?: number
          quantidade_retornada?: number | null
          transferencia_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          imagem_url_produto?: string | null
          item_id?: string | null
          nome_produto?: string | null
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
          concluido_por: string | null
          created_at: string | null
          data_conclusao: string | null
          data_retorno: string | null
          data_saida: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          id: string
          local_destino_id: string
          local_origem_id: string
          motivo: string | null
          observacoes: string | null
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          concluido_por?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_retorno?: string | null
          data_saida?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          local_destino_id: string
          local_origem_id: string
          motivo?: string | null
          observacoes?: string | null
          status?: string
          tipo: string
          user_id: string
        }
        Update: {
          concluido_por?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_retorno?: string | null
          data_saida?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          local_destino_id?: string
          local_origem_id?: string
          motivo?: string | null
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
      user_locations: {
        Row: {
          can_adjust_stock: boolean
          can_edit_price: boolean
          can_view: boolean
          created_at: string | null
          id: string
          local_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_adjust_stock?: boolean
          can_edit_price?: boolean
          can_view?: boolean
          created_at?: string | null
          id?: string
          local_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_adjust_stock?: boolean
          can_edit_price?: boolean
          can_view?: boolean
          created_at?: string | null
          id?: string
          local_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_eventos_brutos: {
        Row: {
          caption: string | null
          chat_name: string | null
          created_at: string
          group_whatsapp_id: string | null
          id: string
          message_type: string | null
          payload: Json | null
          sender: string | null
        }
        Insert: {
          caption?: string | null
          chat_name?: string | null
          created_at?: string
          group_whatsapp_id?: string | null
          id?: string
          message_type?: string | null
          payload?: Json | null
          sender?: string | null
        }
        Update: {
          caption?: string | null
          chat_name?: string | null
          created_at?: string
          group_whatsapp_id?: string | null
          id?: string
          message_type?: string | null
          payload?: Json | null
          sender?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_curva_mes:
        | {
            Args: { p_mes: number; p_user_id: string }
            Returns: {
              dia: number
              faturamento_acumulado: number
              percentual_acumulado: number
            }[]
          }
        | {
            Args: {
              p_excluir_cancelados?: boolean
              p_mes: number
              p_user_id: string
            }
            Returns: {
              dia: number
              faturamento_acumulado: number
              percentual_acumulado: number
            }[]
          }
      get_faturamento_periodo: {
        Args: { p_fim: string; p_inicio: string; p_user_id: string }
        Returns: number
      }
      get_media_mes_anos_anteriores:
        | {
            Args: { p_limite_anos?: number; p_mes: number; p_user_id: string }
            Returns: {
              anos_usados: number[]
              faturamentos_por_ano: Json
              media_faturamento: number
            }[]
          }
        | {
            Args: {
              p_excluir_cancelados?: boolean
              p_limite_anos?: number
              p_mes: number
              p_user_id: string
            }
            Returns: {
              anos_usados: number[]
              faturamentos_por_ano: Json
              media_faturamento: number
            }[]
          }
      get_my_profile: {
        Args: never
        Returns: {
          email: string
          id: string
          last_sign_in_at: string
          must_change_password: boolean
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }[]
      }
      get_user_allowed_locations: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_location_access: {
        Args: { _local_id: string; _permission?: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_password_changed: { Args: never; Returns: undefined }
      rpc_ajustar_estoque_local: {
        Args: {
          p_item_id: string
          p_local_id: string
          p_motivo: string
          p_nova_quantidade: number
          p_preco_aplicado?: number
          p_tipo_ajuste_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      rpc_cancelar_transferencia: {
        Args: { p_transferencia_id: string; p_user_id: string }
        Returns: undefined
      }
      rpc_concluir_transferencia: {
        Args: { p_transferencia_id: string; p_user_id: string }
        Returns: undefined
      }
      rpc_criar_transferencia: {
        Args: {
          p_destino_local_id: string
          p_itens: Json
          p_motivo?: string
          p_observacoes?: string
          p_origem_local_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "gerente" | "vendedor" | "vendedor_loja"
      comprovante_categoria: "jeans" | "alfaiataria" | "nao_classificado"
      comprovante_status: "confirmado" | "pendente_revisao" | "rejeitado"
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
      app_role: ["admin", "gerente", "vendedor", "vendedor_loja"],
      comprovante_categoria: ["jeans", "alfaiataria", "nao_classificado"],
      comprovante_status: ["confirmado", "pendente_revisao", "rejeitado"],
    },
  },
} as const
