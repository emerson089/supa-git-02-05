import { supabase } from "@/integrations/supabase/client";
import { ChecklistAprontamento } from "@/types/production";
import { Json } from "@/integrations/supabase/types";

export type { ChecklistAprontamento };

export type PrioridadeType = 'urgente' | 'atencao' | 'normal';

export interface ProducaoData {
  id: string;
  id_producao: string;
  produto_id?: string;
  modelo_nome_cache?: string;
  quantidade: number;
  processo_atual: string;
  responsavel?: string;
  observacoes?: string;
  imagem_url?: string;
  created_date: string;
  updated_at: string;
  user_id?: string;
  integrado_estoque: boolean;
  prioridade: PrioridadeType | string;
  pecas_concluidas: number;
  checklist_aprontamento?: ChecklistAprontamento;
}

export interface ProducaoInsert {
  id_producao: string;
  produto_id?: string;
  modelo_nome_cache?: string;
  quantidade: number;
  processo_atual?: string;
  responsavel?: string;
  observacoes?: string;
  imagem_url?: string;
  prioridade?: PrioridadeType;
  pecas_concluidas?: number;
}

export interface ProducaoUpdate {
  id_producao?: string;
  produto_id?: string;
  modelo_nome_cache?: string;
  quantidade?: number;
  processo_atual?: string;
  responsavel?: string;
  observacoes?: string;
  imagem_url?: string;
  integrado_estoque?: boolean;
  prioridade?: PrioridadeType;
  pecas_concluidas?: number;
}

// Helper to convert database row to ProducaoData
function toProducaoData(row: any): ProducaoData {
  return {
    ...row,
    checklist_aprontamento: row.checklist_aprontamento as ChecklistAprontamento | undefined,
  };
}

export const Producao = {
  async getNextReference(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from("producao")
        .select("id_producao")
        .order("created_date", { ascending: false })
        .limit(200);

      if (error) {
        return String(Date.now()).slice(-6);
      }

      // Filter only numeric references and find the maximum
      const numericRefs = (data || [])
        .map(p => parseInt(p.id_producao))
        .filter(n => !isNaN(n));

      const maxRef = numericRefs.length > 0 ? Math.max(...numericRefs) : 999;
      
      return String(maxRef + 1);
    } catch {
      return String(Date.now()).slice(-6);
    }
  },

  async list(orderBy: string = "-created_date", limit: number = 100): Promise<ProducaoData[]> {
    const isDescending = orderBy.startsWith("-");
    const column = isDescending ? orderBy.slice(1) : orderBy;
    
    const { data, error } = await supabase
      .from("producao")
      .select("*")
      .order(column, { ascending: !isDescending })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []).map(toProducaoData);
  },

  async get(id: string): Promise<ProducaoData | null> {
    const { data, error } = await supabase
      .from("producao")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toProducaoData(data) : null;
  },

  async create(producao: ProducaoInsert): Promise<ProducaoData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("producao")
      .insert({ ...producao, user_id: user.id })
      .select()
      .single();

    if (error) {
      // Handle duplicate key error with user-friendly message
      if (error.code === '23505') {
        const duplicateError = new Error(`Já existe um lote com a referência "${producao.id_producao}". Por favor, use outra referência.`);
        (duplicateError as any).code = error.code;
        throw duplicateError;
      }
      throw error;
    }

    return toProducaoData(data);
  },

  async update(id: string, updates: ProducaoUpdate): Promise<ProducaoData> {
    const { data, error } = await supabase
      .from("producao")
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return toProducaoData(data);
  },

  async updateChecklist(id: string, checklist: ChecklistAprontamento): Promise<ProducaoData> {
    const { data, error } = await supabase
      .from("producao")
      .update({ checklist_aprontamento: checklist as unknown as Json })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return toProducaoData(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("producao")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }
};
