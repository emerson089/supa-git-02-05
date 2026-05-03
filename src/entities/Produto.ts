import { supabase } from "@/integrations/supabase/client";

export interface ProdutoData {
  id: string;
  nome: string;
  referencia: string;
  descricao?: string;
  imagem_url?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface ProdutoInsert {
  nome: string;
  referencia: string;
  descricao?: string;
  imagem_url?: string;
}

export const Produto = {
  async list(limit: number = 100): Promise<ProdutoData[]> {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("nome", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  },

  async get(id: string): Promise<ProdutoData | null> {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  },

  async create(produto: ProdutoInsert): Promise<ProdutoData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("produtos")
      .insert({ ...produto, user_id: user.id })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
};
