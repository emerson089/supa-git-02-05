import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay, subDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sincronizarEstoqueTotal } from './useTransferencias';
export type PeriodoTipo = 'hoje' | 'ontem' | '7dias' | '30dias' | 'custom';

export interface PeriodoFeira {
  tipo: PeriodoTipo;
  inicio: Date;
  fim: Date;
}

export interface ResumoFeiraPeriodo {
  totalCarga: number;
  totalRetorno: number;
  totalVendido: number;
  valorVendido: number;
  quantidadeCargas: number;
  cargasAtivas: number;
  cargasConcluidas: number;
}

export interface TransferenciaItemComProduto {
  id: string;
  itemId: string;
  quantidadeEnviada: number;
  quantidadeRetornada: number | null;
  precoUnitario: number | null;
  produtoNome: string | null;
  produtoPreco: number | null;
}

export interface TransferenciaComItensHistorico {
  id: string;
  localOrigemId: string;
  localDestinoId: string;
  tipo: string;
  status: string;
  dataSaida: string;
  dataRetorno: string | null;
  observacoes: string | null;
  createdAt: string;
  itens: TransferenciaItemComProduto[];
}

export interface CargaDiaAgrupada {
  data: string;
  dataFormatada: string;
  diaSemana: string;
  totalCargas: number;
  totalEnviado: number;
  totalRetornado: number;
  totalVendido: number;
  valorVendido: number;
  cargas: TransferenciaComItensHistorico[];
}

// Helper: calcula datas baseado no tipo de período
export function calcularPeriodo(tipo: PeriodoTipo, customInicio?: Date, customFim?: Date): { inicio: Date; fim: Date } {
  const hoje = startOfDay(new Date());
  switch (tipo) {
    case 'hoje':
      return { inicio: hoje, fim: endOfDay(hoje) };
    case 'ontem':
      return { inicio: startOfDay(subDays(hoje, 1)), fim: endOfDay(subDays(hoje, 1)) };
    case '7dias':
      return { inicio: startOfDay(subDays(hoje, 6)), fim: endOfDay(hoje) };
    case '30dias':
      return { inicio: startOfDay(subDays(hoje, 29)), fim: endOfDay(hoje) };
    case 'custom':
      return {
        inicio: customInicio ? startOfDay(customInicio) : hoje,
        fim: customFim ? endOfDay(customFim) : endOfDay(hoje),
      };
    default:
      return { inicio: hoje, fim: endOfDay(hoje) };
  }
}

// Helper: calcular totais de uma carga de forma robusta (anti-NaN)
function calcularTotaisCarga(itens: TransferenciaItemComProduto[]): {
  enviado: number;
  retornado: number;
  vendido: number;
  valor: number;
} {
  let enviado = 0;
  let retornado = 0;
  let vendido = 0;
  let valor = 0;

  for (const item of itens) {
    const qtdEnviada = Number(item.quantidadeEnviada) || 0;
    const qtdRetornada = Number(item.quantidadeRetornada) || 0;
    const qtdVendida = Math.max(0, qtdEnviada - qtdRetornada);
    const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;

    enviado += qtdEnviada;
    retornado += qtdRetornada;
    vendido += qtdVendida;
    valor += qtdVendida * preco;
  }

  return { enviado, retornado, vendido, valor };
}

// Helper: obter data de referência da carga
function getDataReferencia(carga: TransferenciaComItensHistorico): Date {
  // Para concluídas: usar data_retorno, fallback para data_saida
  // Para em andamento: usar data_saida
  if (carga.status === 'concluida' && carga.dataRetorno) {
    return new Date(carga.dataRetorno);
  }
  return new Date(carga.dataSaida);
}

// Helper: mapear dados do banco para interface
function mapDbToTransferenciaHistorico(db: any): TransferenciaComItensHistorico {
  return {
    id: db.id,
    localOrigemId: db.local_origem_id,
    localDestinoId: db.local_destino_id,
    tipo: db.tipo,
    status: db.status,
    dataSaida: db.data_saida,
    dataRetorno: db.data_retorno,
    observacoes: db.observacoes,
    createdAt: db.created_at,
    itens: (db.transferencia_itens || []).map((item: any) => ({
      id: item.id,
      itemId: item.item_id,
      quantidadeEnviada: Number(item.quantidade_enviada) || 0,
      quantidadeRetornada: item.quantidade_retornada !== null ? Number(item.quantidade_retornada) : null,
      precoUnitario: item.preco_unitario !== null ? Number(item.preco_unitario) : null,
      produtoNome: item.estoque_itens?.nome || null,
      produtoPreco: item.estoque_itens?.preco_unitario !== null ? Number(item.estoque_itens?.preco_unitario) : null,
    })),
  };
}

// Hook: buscar cargas por período
export function useCargasPorPeriodo(inicio: Date, fim: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cargas-periodo', user?.id, inicio.toISOString(), fim.toISOString()],
    queryFn: async () => {
      if (!user) return [];

      // Buscar todas as cargas do período
      // Para concluídas: filtrar por data_retorno OU data_saida
      // Para em_andamento: filtrar por data_saida
      const { data, error } = await supabase
        .from('transferencias')
        .select(`
          *,
          transferencia_itens (
            *,
            estoque_itens (nome, preco_unitario)
          )
        `)
        .eq('tipo', 'carga_feira')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('data_saida', { ascending: false });

      if (error) throw error;

      // Filtrar no cliente baseado na data de referência correta
      const cargas = (data || [])
        .map(mapDbToTransferenciaHistorico)
        .filter(carga => {
          const dataRef = getDataReferencia(carga);
          return dataRef >= inicio && dataRef <= fim;
        });

      return cargas;
    },
    enabled: !!user,
  });
}

// Hook: buscar TODAS as cargas ativas (independente do período)
export function useTodasCargasAtivas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['todas-cargas-ativas', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('transferencias')
        .select(`
          *,
          transferencia_itens (
            *,
            estoque_itens (nome, preco_unitario)
          )
        `)
        .eq('tipo', 'carga_feira')
        .eq('status', 'em_andamento')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('data_saida', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapDbToTransferenciaHistorico);
    },
    enabled: !!user,
  });
}

// Hook: calcular resumo do período
export function useResumoFeiraPeriodo(inicio: Date, fim: Date) {
  const { data: cargas, isLoading } = useCargasPorPeriodo(inicio, fim);

  const calcularResumo = (): ResumoFeiraPeriodo => {
    if (!cargas || cargas.length === 0) {
      return {
        totalCarga: 0,
        totalRetorno: 0,
        totalVendido: 0,
        valorVendido: 0,
        quantidadeCargas: 0,
        cargasAtivas: 0,
        cargasConcluidas: 0,
      };
    }

    let totalCarga = 0;
    let totalRetorno = 0;
    let valorVendido = 0;
    let cargasAtivas = 0;
    let cargasConcluidas = 0;

    cargas.forEach(carga => {
      if (carga.status === 'em_andamento') cargasAtivas++;
      if (carga.status === 'concluida') cargasConcluidas++;

      const totais = calcularTotaisCarga(carga.itens);
      totalCarga += totais.enviado;
      totalRetorno += totais.retornado;
      valorVendido += totais.valor;
    });

    return {
      totalCarga,
      totalRetorno,
      totalVendido: Math.max(0, totalCarga - totalRetorno),
      valorVendido,
      quantidadeCargas: cargas.length,
      cargasAtivas,
      cargasConcluidas,
    };
  };

  return {
    resumo: calcularResumo(),
    cargas: cargas || [],
    isLoading,
  };
}

// Hook: histórico agrupado por data
export function useHistoricoAgrupado(inicio: Date, fim: Date) {
  const { data: cargas, isLoading } = useCargasPorPeriodo(inicio, fim);

  const agruparPorData = (): CargaDiaAgrupada[] => {
    if (!cargas || cargas.length === 0) return [];

    const grupos = new Map<string, CargaDiaAgrupada>();

    for (const carga of cargas) {
      const dataRef = getDataReferencia(carga);
      const dataKey = format(dataRef, 'yyyy-MM-dd');

      if (!grupos.has(dataKey)) {
        grupos.set(dataKey, {
          data: dataKey,
          dataFormatada: format(dataRef, 'dd/MM/yyyy'),
          diaSemana: format(dataRef, 'EEEE', { locale: ptBR }),
          totalCargas: 0,
          totalEnviado: 0,
          totalRetornado: 0,
          totalVendido: 0,
          valorVendido: 0,
          cargas: [],
        });
      }

      const grupo = grupos.get(dataKey)!;
      grupo.totalCargas++;
      grupo.cargas.push(carga);

      // Calcular totais da carga
      const totais = calcularTotaisCarga(carga.itens);
      grupo.totalEnviado += totais.enviado;
      grupo.totalRetornado += totais.retornado;
      grupo.totalVendido += totais.vendido;
      grupo.valorVendido += totais.valor;
    }

    // Ordenar por data mais recente
    return Array.from(grupos.values()).sort((a, b) => b.data.localeCompare(a.data));
  };

  return {
    historico: agruparPorData(),
    isLoading,
  };
}

// Helper: calcular totais de uma carga específica
export function calcularTotaisCargaPublic(itens: TransferenciaItemComProduto[]) {
  return calcularTotaisCarga(itens);
}

// Helper: verificar se data é hoje
export function isDataHoje(dataStr: string): boolean {
  return isToday(new Date(dataStr));
}

// REMOVIDO: sincronizarTotalGeral foi substituído por sincronizarEstoqueTotal exportado de useTransferencias
// Regra unificada: estoque_itens.quantidade = SOMENTE Central

// Hook: excluir carga da feira (soft delete) com reversão de estoque
// REGRA: Apenas cargas em_andamento podem ser excluídas. Cargas concluídas devem ser ESTORNADAS.
export function useExcluirCargaFeira() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
      motivo,
    }: {
      transferenciaId: string;
      motivo?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Buscar a carga com itens
      const { data: carga, error: cargaError } = await supabase
        .from('transferencias')
        .select(`
          *,
          transferencia_itens (*)
        `)
        .eq('id', transferenciaId)
        .single();

      if (cargaError || !carga) throw new Error('Carga não encontrada');
      if (carga.deleted_at) throw new Error('Esta carga já foi excluída');
      
      // VALIDAÇÃO DE STATUS: Apenas cargas em_andamento podem ser excluídas
      if (carga.status === 'concluida') {
        throw new Error('Cargas concluídas não podem ser excluídas. Use a opção "Estornar" para reverter a venda.');
      }
      if (carga.status === 'estornada') {
        throw new Error('Esta carga já foi estornada anteriormente.');
      }
      if (carga.status === 'cancelada') {
        throw new Error('Esta carga já foi cancelada anteriormente.');
      }
      if (carga.status !== 'em_andamento') {
        throw new Error(`Não é possível excluir carga com status "${carga.status}".`);
      }

      // 2. Buscar locais Central e Banca
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('*')
        .eq('user_id', user.id)
        .in('tipo', ['central', 'banca']);

      const central = locais?.find(l => l.tipo === 'central');
      const banca = locais?.find(l => l.tipo === 'banca');

      if (!central || !banca) throw new Error('Locais Central/Banca não configurados');

      // 3. VALIDAR: Para cada item, verificar se Banca tem saldo suficiente
      for (const item of carga.transferencia_itens) {
        const enviado = Number(item.quantidade_enviada) || 0;
        const retornado = Number(item.quantidade_retornada) || 0;
        const delta = enviado - retornado; // Quantidade que precisa "voltar" da Banca

        if (delta > 0) {
          // Verificar se Banca tem saldo suficiente
          const { data: estoqueBanca } = await supabase
            .from('estoque_por_local')
            .select('quantidade')
            .eq('item_id', item.item_id)
            .eq('local_id', banca.id)
            .single();

          const qtdBanca = Number(estoqueBanca?.quantidade) || 0;

          if (qtdBanca < delta) {
            // Buscar nome do item para mensagem de erro
            const { data: itemInfo } = await supabase
              .from('estoque_itens')
              .select('nome')
              .eq('id', item.item_id)
              .single();

            throw new Error(
              `Não é possível excluir: "${itemInfo?.nome || 'Item'}" tem apenas ${qtdBanca} na Banca, mas precisa de ${delta} para reverter.`
            );
          }
        }
      }

      // 4. REVERTER estoque de cada item
      for (const item of carga.transferencia_itens) {
        const enviado = Number(item.quantidade_enviada) || 0;
        const retornado = Number(item.quantidade_retornada) || 0;
        const delta = enviado - retornado;

        // Central += delta (devolve o que saiu)
        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', item.item_id)
          .eq('local_id', central.id)
          .single();

        if (estoqueCentral) {
          await supabase
            .from('estoque_por_local')
            .update({
              quantidade: Number(estoqueCentral.quantidade) + delta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueCentral.id);
        }

        // Banca -= delta (remove o que ficou)
        const { data: estoqueBanca } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', item.item_id)
          .eq('local_id', banca.id)
          .single();

        if (estoqueBanca) {
          await supabase
            .from('estoque_por_local')
            .update({
              quantidade: Math.max(0, Number(estoqueBanca.quantidade) - delta),
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueBanca.id);
        }

        // Sincronizar estoque_itens.quantidade (usando função unificada)
        await sincronizarEstoqueTotal(item.item_id, user.id);
      }

      // 5. Marcar transferência como deletada (soft delete)
      const { error: updateError } = await supabase
        .from('transferencias')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          deleted_reason: motivo || null,
        })
        .eq('id', transferenciaId);

      if (updateError) throw updateError;

      // 6. Deletar transferencia_itens para liberar FK do estoque_itens
      const { error: deleteItensError } = await supabase
        .from('transferencia_itens')
        .delete()
        .eq('transferencia_id', transferenciaId);

      if (deleteItensError) {
        console.error('[useExcluirCargaFeira] Erro ao deletar transferencia_itens:', deleteItensError);
        // Não lançar erro aqui, pois a carga já foi soft-deleted com sucesso
      }
    },
    onSuccess: () => {
      // Invalidar todas as queries relevantes para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}

// Hook: excluir carga DEFINITIVAMENTE do histórico (hard delete)
// REGRA: Apenas cargas estornadas ou canceladas podem ser excluídas do histórico
// (não afeta estoque, pois já foi tratado)
export function useExcluirHistoricoCarga() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
    }: {
      transferenciaId: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Buscar a carga
      const { data: carga, error: cargaError } = await supabase
        .from('transferencias')
        .select('*')
        .eq('id', transferenciaId)
        .single();

      if (cargaError || !carga) throw new Error('Carga não encontrada');

      // VALIDAÇÃO DE STATUS: Apenas cargas finalizadas podem ser excluídas do histórico
      const statusPermitidos = ['estornada', 'cancelada'];
      if (!statusPermitidos.includes(carga.status)) {
        throw new Error(
          `Apenas cargas estornadas ou canceladas podem ser excluídas do histórico. ` +
          `Status atual: "${carga.status}".`
        );
      }

      // 2. Deletar estoque_movimentacoes primeiro (FK para transferencias)
      const { error: deleteMovError } = await supabase
        .from('estoque_movimentacoes')
        .delete()
        .eq('transferencia_id', transferenciaId);

      if (deleteMovError) {
        console.error('[useExcluirHistoricoCarga] Erro ao deletar movimentações:', deleteMovError);
        throw new Error('Erro ao excluir movimentações de estoque');
      }

      // 3. Deletar transferencia_itens (FK para transferencias)
      const { error: deleteItensError } = await supabase
        .from('transferencia_itens')
        .delete()
        .eq('transferencia_id', transferenciaId);

      if (deleteItensError) {
        console.error('[useExcluirHistoricoCarga] Erro ao deletar itens:', deleteItensError);
        throw new Error('Erro ao excluir itens da carga');
      }

      // 4. Deletar a transferência (hard delete)
      const { error: deleteError } = await supabase
        .from('transferencias')
        .delete()
        .eq('id', transferenciaId);

      if (deleteError) {
        console.error('[useExcluirHistoricoCarga] Erro ao deletar transferência:', deleteError);
        throw new Error('Erro ao excluir carga do histórico');
      }

      return { transferenciaId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}
