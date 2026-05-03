import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Cada item do filtro unificado pode ser um tipo de sistema OU um tipo de ajuste
export interface FiltroMovimentacao {
  kind: 'sistema' | 'ajuste';
  value: string; // tipo do sistema (ex: 'VENDA_FEIRA') ou UUID do tipo_ajuste
  label: string;
}

export interface FiltrosSaidas {
  dataInicial: Date;
  dataFinal: Date;
  localId?: string;
  filtrosMovimentacao?: FiltroMovimentacao[];
  modeloIds?: string[];
}

export interface SaidaDetalhada {
  id: string;
  data: Date;
  itemId: string;
  modeloNome: string;
  imagemUrl: string | null;
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
  usuarioNome: string | null;
}

export interface ResumoSaidas {
  totalPecas: number;
  valorVendaTotal: number;
  valorCustoTotal: number | null; // null se não houver custo_unitario
  quantidadeSemPreco: number;
}

// Tipos de movimentação registrados no relatório (saídas + entradas por ajuste)
export const TIPOS_SAIDA = [
  'AJUSTE_SAIDA',
  'AJUSTE_ENTRADA',
  'VENDA_FEIRA',
  'ENVIO_FEIRA',
  'TRANSFERENCIA',
  'RETORNO_FEIRA',
] as const;

export const TIPO_LABELS: Record<string, string> = {
  'AJUSTE_SAIDA': 'Movimentação Saída',
  'AJUSTE_ENTRADA': 'Movimentação Entrada',
  'VENDA_FEIRA': 'Venda / Loja',
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

      // Resolver owner do local para buscar tipos corretos
      let ownerId = user.id;
      if (filtros.localId) {
        const { data: localData } = await supabase
          .from('estoque_locais')
          .select('user_id')
          .eq('id', filtros.localId)
          .maybeSingle();
        if (localData?.user_id) ownerId = localData.user_id;
      }

      // Resolver filtros unificados - agora todos são 'ajuste'
      const filtrosAtivos = filtros.filtrosMovimentacao || [];
      const tiposAjusteIds = filtrosAtivos.map(f => f.value);

      // Buscar IDs de tipos_ajuste com conta_como_venda=true (usar ownerId)
      let idsContaComoVenda: string[] = [];
      const { data: tiposVenda } = await supabase
        .from('tipos_ajuste_estoque')
        .select('id')
        .eq('user_id', ownerId)
        .eq('conta_como_venda', true);
      idsContaComoVenda = tiposVenda?.map(t => t.id) || [];

      // Verificar se algum filtro selecionado é conta_como_venda
      const filtroTemVenda = filtrosAtivos.length === 0 || tiposAjusteIds.some(id => idsContaComoVenda.includes(id));

      // Montar lista de tipos para a query
      let tiposParaQuery: string[];
      if (filtrosAtivos.length === 0) {
        // Sem filtro: todos os tipos de movimentação (saídas + entradas)
        tiposParaQuery = [...TIPOS_SAIDA];
      } else {
        // Com filtro: incluir AJUSTE_SAIDA e AJUSTE_ENTRADA (filtro pós-query determina quais aparecem)
        tiposParaQuery = ['AJUSTE_SAIDA', 'AJUSTE_ENTRADA'];
        // Se algum filtro selecionado é conta_como_venda, incluir VENDA_FEIRA
        if (filtroTemVenda) {
          tiposParaQuery.push('VENDA_FEIRA');
        }
      }

      // Buscar locais do usuário para filtrar por local_id em vez de user_id
      let meusLocaisIds: string[] = [];
      if (!filtros.localId) {
        const { data: meusLocais } = await supabase
          .from('estoque_locais')
          .select('id')
          .eq('user_id', user.id);
        meusLocaisIds = meusLocais?.map(l => l.id) || [];
      }

      // Query movimentações - filtrar por local_id em vez de user_id
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
          transferencia_id,
          tipo_ajuste_id,
          user_id
        `)
        .gte('created_at', filtros.dataInicial.toISOString())
        .lte('created_at', dataFinalAjustada.toISOString())
        .in('tipo', tiposParaQuery)
        .order('created_at', { ascending: false });

      // Filtrar por local (específico ou todos os locais do admin)
      if (filtros.localId) {
        query = query.eq('local_id', filtros.localId);
      } else if (meusLocaisIds.length > 0) {
        query = query.in('local_id', meusLocaisIds);
      }

      // Filtrar por modelos se especificado
      if (filtros.modeloIds && filtros.modeloIds.length > 0) {
        query = query.in('item_id', filtros.modeloIds);
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

      // Pós-processamento: filtrar conforme filtros selecionados
      let movFiltradas = movimentacoes;
      if (filtrosAtivos.length > 0) {
        movFiltradas = movimentacoes.filter(m => {
          if (m.tipo === 'VENDA_FEIRA') {
            // VENDA_FEIRA: incluir apenas se algum filtro selecionado é conta_como_venda
            return filtroTemVenda;
          }
          // AJUSTE_ENTRADA: incluir se tipo_ajuste_id está nos IDs selecionados
          if (m.tipo === 'AJUSTE_ENTRADA') {
            if (!m.tipo_ajuste_id) return false;
            return tiposAjusteIds.includes(m.tipo_ajuste_id);
          }
          if (m.tipo !== 'AJUSTE_SAIDA') return false; // outros tipos do sistema não aparecem com filtro ativo
          // AJUSTE_SAIDA: incluir se tipo_ajuste_id está nos IDs selecionados
          if (m.tipo_ajuste_id && tiposAjusteIds.includes(m.tipo_ajuste_id)) {
            return true;
          }
          // AJUSTE_SAIDA com conta_como_venda: incluir se filtro de venda está ativo
          if (m.tipo_ajuste_id && idsContaComoVenda.includes(m.tipo_ajuste_id) && filtroTemVenda) {
            return true;
          }
          return false;
        });
      }

      // Buscar informações dos itens
      const itemIds = [...new Set(movFiltradas.map(m => m.item_id))];
      const { data: itens } = await supabase
        .from('estoque_itens')
        .select('id, nome, preco_unitario, imagem_url')
        .in('id', itemIds);

      const itensMap = new Map(itens?.map(i => [i.id, i]) || []);

      // Buscar informações dos locais
      const localIds = [...new Set(movFiltradas.map(m => m.local_id).filter(Boolean))];
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('id, nome')
        .in('id', localIds);

      const locaisMap = new Map(locais?.map(l => [l.id, l.nome]) || []);

      // Buscar nomes dos usuários que realizaram as movimentações
      const userIds = [...new Set(movFiltradas.map(m => (m as any).user_id).filter(Boolean))];
      const usuariosMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: perfis } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .in('user_id', userIds);
        for (const p of perfis || []) {
          usuariosMap.set(p.user_id, p.nome || p.email || 'Desconhecido');
        }
      }

      // Buscar informações de transferências para obter local destino
      const transferenciaIds = [...new Set(movFiltradas.filter(m => m.transferencia_id).map(m => m.transferencia_id))];
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
      const saidas: SaidaDetalhada[] = movFiltradas.map(mov => {
        const item = itensMap.get(mov.item_id);
        const transferencia = mov.transferencia_id ? transferenciasMap.get(mov.transferencia_id) : null;

        // Prioridade de preço: preco_aplicado > preco_unitario do item
        const valorUnitario = mov.preco_aplicado ?? item?.preco_unitario ?? null;
        const valorTotal = valorUnitario !== null ? valorUnitario * mov.quantidade : null;

        // Label: AJUSTE_SAIDA com conta_como_venda mostra "Venda / Loja"
        const tipoLabel = (mov.tipo === 'AJUSTE_SAIDA' && mov.tipo_ajuste_id && idsContaComoVenda.includes(mov.tipo_ajuste_id))
          ? 'Venda / Loja'
          : TIPO_LABELS[mov.tipo] || mov.tipo;

        return {
          id: mov.id,
          data: new Date(mov.created_at),
          itemId: mov.item_id,
          modeloNome: item?.nome || 'Item não encontrado',
          imagemUrl: (item as any)?.imagem_url || null,
          quantidade: mov.quantidade,
          valorUnitario,
          valorTotal,
          tipo: mov.tipo,
          tipoLabel,
          motivo: mov.motivo,
          localId: mov.local_id,
          localNome: locaisMap.get(mov.local_id) || 'Local não encontrado',
          localDestinoId: transferencia?.destinoId,
          localDestinoNome: transferencia?.destinoNome,
          usuarioNome: (mov as any).user_id ? (usuariosMap.get((mov as any).user_id) || null) : null,
        };
      });
      // Calcular resumo — separar entradas e saídas
      const isTipoEntrada = (tipo: string) => tipo === 'AJUSTE_ENTRADA' || tipo === 'RETORNO_FEIRA';
      const saidasApenasMovs = saidas.filter(s => !isTipoEntrada(s.tipo));
      const resumo: ResumoSaidas = {
        totalPecas: saidasApenasMovs.reduce((acc, s) => acc + s.quantidade, 0),
        valorVendaTotal: saidasApenasMovs.reduce((acc, s) => acc + (s.valorTotal || 0), 0),
        valorCustoTotal: null, // TODO: implementar quando houver custo_unitario
        quantidadeSemPreco: saidasApenasMovs.filter(s => s.valorUnitario === null).length,
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

export function useModelosParaFiltro(searchTerm: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['modelos-para-filtro', user?.id, searchTerm],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('estoque_itens')
        .select('id, nome, categoria')
        .eq('user_id', user.id)
        .order('nome')
        .limit(50);

      if (searchTerm.trim()) {
        query = query.or(`nome.ilike.%${searchTerm}%,categoria.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (searchTerm.length >= 2 || searchTerm === ''),
    staleTime: 30000,
  });
}
