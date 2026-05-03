import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PedidoItemDB {
  id: string;
  user_id: string;
  pedido_id: string;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
  created_at: string;
}

export interface PedidoItemInsert {
  pedido_id: string;
  produto_id?: string | null;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
}

export interface PedidoItemUpdate {
  quantidade?: number;
  valor_unitario?: number;
}

interface PrecomputedTotals {
  total_pecas: number;
  valor_total: number;
}

// Helper function to recalculate and update pedido totals.
// If precomputed totals are passed, skips the SELECT query entirely.
async function syncPedidoTotals(
  pedidoId: string,
  precomputed?: PrecomputedTotals
): Promise<PrecomputedTotals> {
  // 1. Primeiro, buscar as configurações de ajuste do pedido pai (desconto e taxa)
  // Precisamos disso para garantir que o valor_total não seja sobrescrito pelo valor bruto
  const { data: pedidoPai, error: paiError } = await supabase
    .from('pedidos')
    .select('desconto, taxa_excursao')
    .eq('id', pedidoId)
    .maybeSingle();

  if (paiError) throw paiError;

  const desconto = Number(pedidoPai?.desconto) || 0;
  const taxaExcursao = Number(pedidoPai?.taxa_excursao) || 0;

  let totals: PrecomputedTotals;

  if (precomputed) {
    totals = precomputed;
  } else {
    const { data: itens, error: itensError } = await supabase
      .from('pedido_itens')
      .select('quantidade, valor_unitario')
      .eq('pedido_id', pedidoId);

    if (itensError) throw itensError;

    const valorItensBruto = (itens || []).reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
    
    totals = {
      total_pecas: (itens || []).reduce((sum, item) => sum + item.quantidade, 0),
      valor_total: valorItensBruto + taxaExcursao - desconto,
    };
  }

  const { error: updateError } = await supabase
    .from('pedidos')
    .update(totals)
    .eq('id', pedidoId);

  if (updateError) throw updateError;

  return totals;
}

export function useAddPedidoItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      precomputedTotals,
      ...item
    }: PedidoItemInsert & { precomputedTotals?: PrecomputedTotals }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: newItem, error: insertError } = await supabase
        .from('pedido_itens')
        .insert({
          ...item,
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const totals = await syncPedidoTotals(item.pedido_id, precomputedTotals);

      return { item: newItem as PedidoItemDB, totals };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedido_id] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
    },
  });
}

export function useUpdatePedidoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      pedidoId,
      data,
      precomputedTotals,
    }: {
      id: string;
      pedidoId: string;
      data: PedidoItemUpdate;
      precomputedTotals?: PrecomputedTotals;
    }) => {
      const { data: updatedItem, error: updateError } = await supabase
        .from('pedido_itens')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      const totals = await syncPedidoTotals(pedidoId, precomputedTotals);

      return { item: updatedItem as PedidoItemDB, totals };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
    },
  });
}

export function useRemovePedidoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      pedidoId,
      precomputedTotals,
    }: {
      id: string;
      pedidoId: string;
      precomputedTotals?: PrecomputedTotals;
    }) => {
      const { error: deleteError } = await supabase
        .from('pedido_itens')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      const totals = await syncPedidoTotals(pedidoId, precomputedTotals);

      return { totals };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
    },
  });
}
