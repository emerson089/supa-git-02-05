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

// Helper function to recalculate and update pedido totals
async function syncPedidoTotals(pedidoId: string): Promise<{ total_pecas: number; valor_total: number }> {
  // Fetch all items for this pedido
  const { data: itens, error: itensError } = await supabase
    .from('pedido_itens')
    .select('quantidade, valor_unitario')
    .eq('pedido_id', pedidoId);

  if (itensError) throw itensError;

  // Calculate new totals
  const total_pecas = (itens || []).reduce((sum, item) => sum + item.quantidade, 0);
  const valor_total = (itens || []).reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);

  // Update the pedido with new totals
  const { error: updateError } = await supabase
    .from('pedidos')
    .update({ total_pecas, valor_total })
    .eq('id', pedidoId);

  if (updateError) throw updateError;

  return { total_pecas, valor_total };
}

export function useAddPedidoItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: PedidoItemInsert) => {
      if (!user) throw new Error('User not authenticated');

      // Insert the new item
      const { data: newItem, error: insertError } = await supabase
        .from('pedido_itens')
        .insert({
          ...item,
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Sync totals
      const totals = await syncPedidoTotals(item.pedido_id);

      return { item: newItem as PedidoItemDB, totals };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedido_id] });
    },
  });
}

export function useUpdatePedidoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, pedidoId, data }: { id: string; pedidoId: string; data: PedidoItemUpdate }) => {
      // Update the item
      const { data: updatedItem, error: updateError } = await supabase
        .from('pedido_itens')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Sync totals
      const totals = await syncPedidoTotals(pedidoId);

      return { item: updatedItem as PedidoItemDB, totals };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedidoId] });
    },
  });
}

export function useRemovePedidoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, pedidoId }: { id: string; pedidoId: string }) => {
      // Delete the item
      const { error: deleteError } = await supabase
        .from('pedido_itens')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Sync totals
      const totals = await syncPedidoTotals(pedidoId);

      return { totals };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', variables.pedidoId] });
    },
  });
}
