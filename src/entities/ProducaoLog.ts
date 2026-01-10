import { supabase } from "@/integrations/supabase/client";

export interface ProducaoLogData {
  id: string;
  producao_id: string;
  processo_anterior?: string;
  processo_novo: string;
  responsavel?: string;
  observacao?: string;
  created_at: string;
  user_id?: string;
}

export interface ProducaoLogInsert {
  producao_id: string;
  processo_anterior?: string;
  processo_novo: string;
  responsavel?: string;
  observacao?: string;
}

export const ProducaoLog = {
  async listByProducao(producaoId: string): Promise<ProducaoLogData[]> {
    const { data, error } = await supabase
      .from("producao_log")
      .select("*")
      .eq("producao_id", producaoId)
      .order("created_at", { ascending: false });

    if (error) {
      if (import.meta.env.DEV) console.error("Error fetching producao_log:", error);
      throw error;
    }

    return data || [];
  },

  async create(log: ProducaoLogInsert): Promise<ProducaoLogData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("producao_log")
      .insert({ ...log, user_id: user.id })
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error("Error creating producao_log:", error);
      throw error;
    }

    return data;
  }
};
