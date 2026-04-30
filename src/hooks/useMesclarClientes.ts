import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MesclarClientesParams {
  fonteId: string;
  destinoId: string;
}

interface MesclarClientesResult {
  pedidosTransferidos: number;
}

export function useMesclarClientes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<MesclarClientesResult, Error, MesclarClientesParams>({
    mutationFn: async ({ fonteId, destinoId }) => {
      if (!user?.id) throw new Error('Usuário não autenticado.');
      if (fonteId === destinoId) throw new Error('Os clientes devem ser diferentes.');

      // 0. Buscar dados dos clientes para preencher campos vazios
      const { data: fonteData } = await supabase.from('clientes').select('*').eq('id', fonteId).single();
      const { data: destinoData } = await supabase.from('clientes').select('*').eq('id', destinoId).single();

      if (!fonteData || !destinoData) throw new Error('Clientes não encontrados.');

      // 1. Transferir pedidos e atualizar dados desnormalizados
      const { data: pedidosTransferidos, error: pedidosError } = await supabase
        .from('pedidos')
        .update({ 
          cliente_id: destinoId,
          cliente_nome: destinoData.nome,
          telefone: destinoData.telefone,
          cidade: destinoData.cidade,
          estado: destinoData.estado,
          excursao: destinoData.excursao
        })
        .eq('cliente_id', fonteId)
        .eq('user_id', user.id)
        .select('id');

      if (pedidosError) throw pedidosError;

      const qtdPedidos = pedidosTransferidos?.length ?? 0;

      // 2. Transferir envios de catálogo
      const { error: catEnviosError } = await supabase
        .from('catalogo_envios')
        .update({ cliente_id: destinoId })
        .eq('cliente_id', fonteId);

      if (catEnviosError) throw catEnviosError;

      // 3. Transferir contatos — evitar conflito de unique constraint
      const { data: contatosFonte } = await supabase
        .from('cliente_contatos')
        .select('id, canal')
        .eq('cliente_id', fonteId);

      if (contatosFonte && contatosFonte.length > 0) {
        const { data: contatosDestino } = await supabase
          .from('cliente_contatos')
          .select('canal')
          .eq('cliente_id', destinoId);

        const canaisDestino = new Set((contatosDestino || []).map((c) => c.canal));
        const seguros = contatosFonte.filter((c) => !canaisDestino.has(c.canal));
        const conflitantes = contatosFonte.filter((c) => canaisDestino.has(c.canal));

        if (conflitantes.length > 0) {
          await supabase.from('cliente_contatos').delete().in('id', conflitantes.map(c => c.id));
        }

        if (seguros.length > 0) {
          await supabase
            .from('cliente_contatos')
            .update({ cliente_id: destinoId })
            .in('id', seguros.map((c) => c.id));
        }
      }

      // 4. Copiar campos se o destino estiver vazio
      const updates: any = {};
      if (!destinoData.excursao && fonteData.excursao) updates.excursao = fonteData.excursao;
      if (!destinoData.cidade && fonteData.cidade) updates.cidade = fonteData.cidade;
      if (!destinoData.estado && fonteData.estado) updates.estado = fonteData.estado;
      if (!destinoData.telefone && fonteData.telefone) updates.telefone = fonteData.telefone;

      // 5. Recalcular total_comprado do destino
      const { data: pedidosDestino } = await supabase
        .from('pedidos')
        .select('valor_total')
        .eq('cliente_id', destinoId)
        .eq('user_id', user.id)
        .eq('status_pagamento', 'PAGO');

      const novoTotal = (pedidosDestino || []).reduce(
        (acc, p) => acc + (Number(p.valor_total) || 0),
        0
      );
      updates.total_comprado = novoTotal;

      await supabase
        .from('clientes')
        .update(updates)
        .eq('id', destinoId);

      // 6. Excluir o cliente fonte
      const { error: deleteClienteError } = await supabase
        .from('clientes')
        .delete()
        .eq('id', fonteId);

      if (deleteClienteError) throw deleteClienteError;

      return { pedidosTransferidos: qtdPedidos };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-crm'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}
