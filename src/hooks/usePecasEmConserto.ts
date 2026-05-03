import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Producao } from '@/entities/Producao';
import { StatusDefeitos } from '@/types/production';
import { ProducaoData } from '@/entities/Producao';
import { toast } from 'sonner';
import { FinalizarConsertoData } from '@/components/production/FinalizarConsertoModal';

export type { StatusDefeitos };

export function usePecasEmConserto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ['pecas-em-conserto', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producao')
        .select('*')
        .eq('user_id', user!.id)
        .gt('pecas_com_defeito', 0)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ProducaoData[];
    },
    staleTime: 30000,
  });

  // Count pending consertos for badge
  const pendingCount = lotes.filter(
    l => l.status_defeitos === 'pendente_conserto' || l.status_defeitos === 'em_conserto'
  ).length;

  const { mutateAsync: atualizarStatus, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusDefeitos }) =>
      Producao.atualizarStatusDefeitos(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-em-conserto'] });
      queryClient.invalidateQueries({ queryKey: ['producao'] });
    },
    onError: () => toast.error('Erro ao atualizar status do conserto'),
  });

  const { mutateAsync: devolverAprontamento, isPending: isDevolvendo } = useMutation({
    mutationFn: async (lot: ProducaoData) => {
      const result = await Producao.devolverAoAprontamento(lot.id);

      const { ProducaoLog } = await import('@/entities/ProducaoLog');
      await ProducaoLog.create({
        producao_id: lot.id,
        processo_anterior: lot.processo_atual,
        processo_novo: 'Aprontamento',
        observacao: `Devolvido para Aprontamento para conserto de ${lot.pecas_com_defeito} peça(s) com defeito`,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-em-conserto'] });
      queryClient.invalidateQueries({ queryKey: ['producao'] });
      toast.success('Lote devolvido ao Aprontamento');
    },
    onError: () => toast.error('Erro ao devolver lote ao Aprontamento'),
  });

  // ── Finalizar conserto (Option B) ─────────────────────────────────────
  // 1. Updates approved quantity
  // 2. Injects repair cost into lote_custos_itens
  // 3. Logs the operation
  const { mutateAsync: finalizarConserto, isPending: isFinalizando } = useMutation({
    mutationFn: async ({ lot, data }: { lot: ProducaoData; data: FinalizarConsertoData }) => {
      const { pecasSalvas, custoConsertoPorPeca, observacao } = data;

      const qtdAprovadaAtual = lot.quantidade_aprovada ?? lot.quantidade;
      const novaQtdAprovada = qtdAprovadaAtual + pecasSalvas;
      const pecasRefugo = (lot.pecas_com_defeito || 0) - pecasSalvas;

      // 1. Update lot fields
      await supabase
        .from('producao')
        .update({
          quantidade: novaQtdAprovada,
          quantidade_aprovada: novaQtdAprovada,
          // Keep remaining defects count (refugo), or zero if all recovered
          pecas_com_defeito: pecasRefugo > 0 ? pecasRefugo : 0,
          // Keep status as concluded; null clears it out if no more defects
          status_defeitos: 'conserto_concluido',
        } as any)
        .eq('id', lot.id);

      // 2. Inject repair cost item (valor_unitario = per APPROVED piece so CustosModal total is correct)
      if (custoConsertoPorPeca > 0 && pecasSalvas > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('lote_custos_itens').insert({
            producao_id: lot.id,
            tipo: 'Outros',
            descricao: `Conserto (${pecasSalvas} pç recuperadas)`,
            // Store cost divided by final approved qty so the modal's multiplication is correct
            valor_unitario: (pecasSalvas * custoConsertoPorPeca) / novaQtdAprovada,
            user_id: user.id,
          });
        }
      }

      // 3. Log
      const { ProducaoLog } = await import('@/entities/ProducaoLog');
      const obsParts = [
        `Conserto finalizado: ${pecasSalvas} peça(s) recuperadas`,
        pecasRefugo > 0 ? `${pecasRefugo} peça(s) em refugo` : 'Sem refugo',
        custoConsertoPorPeca > 0
          ? `Custo do conserto: R$ ${(pecasSalvas * custoConsertoPorPeca).toFixed(2)}`
          : '',
        observacao || '',
      ].filter(Boolean);

      await ProducaoLog.create({
        producao_id: lot.id,
        processo_anterior: lot.processo_atual,
        processo_novo: lot.processo_atual,
        observacao: obsParts.join(' | '),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pecas-em-conserto'] });
      queryClient.invalidateQueries({ queryKey: ['producao'] });
      toast.success('Conserto finalizado! Quantidade e custos atualizados.');
    },
    onError: (err) => {
      console.error('Erro ao finalizar conserto:', err);
      toast.error('Erro ao finalizar conserto');
    },
  });

  return {
    lotes,
    isLoading,
    pendingCount,
    atualizarStatus,
    devolverAprontamento,
    finalizarConserto,
    isUpdating,
    isDevolvendo,
    isFinalizando,
  };
}
