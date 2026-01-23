import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FiltrosSaidas {
  dataInicial: Date;
  dataFinal: Date;
  localId?: string;
  tiposMovimento?: string[];
}

export interface SaidaDetalhada {
  id: string;
  data: Date;
  itemId: string;
  modeloNome: string;
  quantidade: number;
  valorUnitario: number | null;
  valorTotal: number | null;
  tipo: string;
  tipoLabel: string;
  motivo: string | null;
  localId: string;
  localNome: string;
  localDestinoId?: string;
  localDestinoNome?: string;
}

export interface ResumoSaidas {
  totalPecas: number;
  valorVendaTotal: number;
  valorCustoTotal: number | null; // null se não houver custo_unitario
  quantidadeSemPreco: number;
}

// Tipos de movimentação que são saídas
export const TIPOS_SAIDA = [
  'AJUSTE_SAIDA',
  'VENDA_FEIRA',
  'ENVIO_FEIRA',
  'TRANSFERENCIA',
  'RETORNO_FEIRA',
] as const;

export const TIPO_LABELS: Record<string, string> = {
  'AJUSTE_SAIDA': 'Ajuste/Venda',
  'VENDA_FEIRA': 'Venda Feira',
  'ENVIO_FEIRA': 'Envio Feira',
  'TRANSFERENCIA': 'Transferência',
  'RETORNO_FEIRA': 'Retorno Feira',
};

export function useRelatorioSaidas(filtros: FiltrosSaidas | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['relatorio-saidas', filtros, user?.id],
    queryFn: async (): Promise<{ saidas: SaidaDetalhada[]; resumo: ResumoSaidas }> => {
      if (!user || !filtros) {
        return {
          saidas: [],
          resumo: { totalPecas: 0, valorVendaTotal: 0, valorCustoTotal: null, quantidadeSemPreco: 0 },
        };
      }

      // Ajustar data final para incluir o dia inteiro
      const dataFinalAjustada = new Date(filtros.dataFinal);
      dataFinalAjustada.setHours(23, 59, 59, 999);

      // Query movimentações
      let query = supabase
        .from('estoque_movimentacoes')
        .select(`
          id,
          created_at,
          item_id,
          quantidade,
          tipo,
          motivo,
          local_id,
          preco_aplicado,
          transferencia_id
        `)
        .eq('user_id', user.id)
        .gte('created_at', filtros.dataInicial.toISOString())
        .lte('created_at', dataFinalAjustada.toISOString())
        .order('created_at', { ascending: false });

      // Filtrar por tipos (apenas saídas)
      const tiposParaFiltrar = filtros.tiposMovimento && filtros.tiposMovimento.length > 0
        ? filtros.tiposMovimento
        : TIPOS_SAIDA;
      
      query = query.in('tipo', tiposParaFiltrar);

      // Filtrar por local se especificado
      if (filtros.localId) {
        query = query.eq('local_id', filtros.localId);
      }

      const { data: movimentacoes, error } = await query;

      if (error) {
        console.error('Erro ao buscar movimentações:', error);
        throw error;
      }

      if (!movimentacoes || movimentacoes.length === 0) {
        return {
          saidas: [],
          resumo: { totalPecas: 0, valorVendaTotal: 0, valorCustoTotal: null, quantidadeSemPreco: 0 },
        };
      }

      // Buscar informações dos itens
      const itemIds = [...new Set(movimentacoes.map(m => m.item_id))];
      const { data: itens } = await supabase
        .from('estoque_itens')
        .select('id, nome, preco_unitario')
        .in('id', itemIds);

      const itensMap = new Map(itens?.map(i => [i.id, i]) || []);

      // Buscar informações dos locais
      const localIds = [...new Set(movimentacoes.map(m => m.local_id).filter(Boolean))];
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('id, nome')
        .in('id', localIds);

      const locaisMap = new Map(locais?.map(l => [l.id, l.nome]) || []);

      // Buscar informações de transferências para obter local destino
      const transferenciaIds = [...new Set(movimentacoes.filter(m => m.transferencia_id).map(m => m.transferencia_id))];
      const transferenciasMap = new Map<string, { origemId: string; destinoId: string; destinoNome: string }>();
      
      if (transferenciaIds.length > 0) {
        const { data: transferencias } = await supabase
          .from('transferencias')
          .select('id, local_origem_id, local_destino_id')
          .in('id', transferenciaIds);

        if (transferencias) {
          const destinoIds = [...new Set(transferencias.map(t => t.local_destino_id))];
          const { data: locaisDestino } = await supabase
            .from('estoque_locais')
            .select('id, nome')
            .in('id', destinoIds);

          const locaisDestinoMap = new Map(locaisDestino?.map(l => [l.id, l.nome]) || []);

          for (const t of transferencias) {
            transferenciasMap.set(t.id, {
              origemId: t.local_origem_id,
              destinoId: t.local_destino_id,
              destinoNome: locaisDestinoMap.get(t.local_destino_id) || 'Desconhecido',
            });
          }
        }
      }

      // Montar dados detalhados
      const saidas: SaidaDetalhada[] = movimentacoes.map(mov => {
        const item = itensMap.get(mov.item_id);
        const transferencia = mov.transferencia_id ? transferenciasMap.get(mov.transferencia_id) : null;
        
        // Prioridade de preço: preco_aplicado > preco_unitario do item
        const valorUnitario = mov.preco_aplicado ?? item?.preco_unitario ?? null;
        const valorTotal = valorUnitario !== null ? valorUnitario * mov.quantidade : null;

        return {
          id: mov.id,
          data: new Date(mov.created_at),
          itemId: mov.item_id,
          modeloNome: item?.nome || 'Item não encontrado',
          quantidade: mov.quantidade,
          valorUnitario,
          valorTotal,
          tipo: mov.tipo,
          tipoLabel: TIPO_LABELS[mov.tipo] || mov.tipo,
          motivo: mov.motivo,
          localId: mov.local_id,
          localNome: locaisMap.get(mov.local_id) || 'Local não encontrado',
          localDestinoId: transferencia?.destinoId,
          localDestinoNome: transferencia?.destinoNome,
        };
      });

      // Calcular resumo
      const resumo: ResumoSaidas = {
        totalPecas: saidas.reduce((acc, s) => acc + s.quantidade, 0),
        valorVendaTotal: saidas.reduce((acc, s) => acc + (s.valorTotal || 0), 0),
        valorCustoTotal: null, // TODO: implementar quando houver custo_unitario
        quantidadeSemPreco: saidas.filter(s => s.valorUnitario === null).length,
      };

      return { saidas, resumo };
    },
    enabled: !!user && !!filtros,
    staleTime: 30000,
  });
}

export function useLocaisParaFiltro() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['locais-para-filtro', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('estoque_locais')
        .select('id, nome, tipo')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
