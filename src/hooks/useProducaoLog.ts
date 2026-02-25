import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProducaoLogData, ProducaoLog } from '@/entities/ProducaoLog';
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';

export interface LogComTempoNaEtapa extends ProducaoLogData {
  tempoNaEtapa: {
    dias: number;
    horas: number;
    minutos: number;
    label: string;
  };
}

export interface EstatisticasProducao {
  totalMovimentacoes: number;
  tempoTotalProducao: {
    dias: number;
    label: string;
  };
  tempoPorEtapa: {
    etapa: string;
    dias: number;
    horas: number;
  }[];
  responsaveisPorEtapa: Record<string, string>;
}

/**
 * Hook para buscar os logs de movimentação de um lote específico
 */
export function useProducaoLogs(producaoId: string | null) {
  return useQuery({
    queryKey: ['producao-logs', producaoId],
    queryFn: async () => {
      if (!producaoId) return [];
      const logs = await ProducaoLog.listByProducao(producaoId);
      return logs;
    },
    enabled: !!producaoId,
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para buscar logs com cálculo de tempo em cada etapa
 */
export function useProducaoLogsComTempo(producaoId: string | null, dataCriacao?: string, responsavelLote?: string) {
  return useQuery({
    queryKey: ['producao-logs-tempo', producaoId],
    queryFn: async (): Promise<{ logs: LogComTempoNaEtapa[]; estatisticas: EstatisticasProducao }> => {
      if (!producaoId) return { logs: [], estatisticas: getEmptyStats() };
      
      const rawLogs = await ProducaoLog.listByProducao(producaoId);
      
      if (rawLogs.length === 0) {
        return { logs: [], estatisticas: getEmptyStats() };
      }

      // Logs vêm ordenados por created_at DESC
      // Calcular tempo que ficou em cada etapa
      const logsComTempo: LogComTempoNaEtapa[] = rawLogs.map((log, index) => {
        let tempoNaEtapa = { dias: 0, horas: 0, minutos: 0, label: '-' };
        
        if (index === 0) {
          const now = new Date();
          const logDate = new Date(log.created_at);
          const dias = differenceInDays(now, logDate);
          const horas = differenceInHours(now, logDate) % 24;
          const minutos = differenceInMinutes(now, logDate) % 60;
          tempoNaEtapa = { dias, horas, minutos, label: formatTempo(dias, horas, minutos) };
        } else {
          const logDate = new Date(log.created_at);
          const nextLogDate = new Date(rawLogs[index - 1].created_at);
          const dias = differenceInDays(nextLogDate, logDate);
          const horas = differenceInHours(nextLogDate, logDate) % 24;
          const minutos = differenceInMinutes(nextLogDate, logDate) % 60;
          tempoNaEtapa = { dias, horas, minutos, label: formatTempo(dias, horas, minutos) };
        }

        return { ...log, tempoNaEtapa };
      });

      // Calcular estatísticas
      const tempoTotalDias = dataCriacao 
        ? differenceInDays(new Date(), new Date(dataCriacao))
        : 0;

      // Agrupar tempo por etapa
      const tempoPorEtapaMap = new Map<string, { dias: number; horas: number }>();
      logsComTempo.forEach(log => {
        const existing = tempoPorEtapaMap.get(log.processo_novo) || { dias: 0, horas: 0 };
        tempoPorEtapaMap.set(log.processo_novo, {
          dias: existing.dias + log.tempoNaEtapa.dias,
          horas: existing.horas + log.tempoNaEtapa.horas,
        });
      });

      const tempoPorEtapa = Array.from(tempoPorEtapaMap.entries()).map(([etapa, tempo]) => ({
        etapa,
        dias: tempo.dias + Math.floor(tempo.horas / 24),
        horas: tempo.horas % 24,
      }));

      // Extrair responsáveis por etapa (primeiro encontrado = mais recente)
      const responsaveisPorEtapa: Record<string, string> = {};
      rawLogs.forEach(log => {
        if (log.responsavel && log.processo_novo !== 'Vendas' && !responsaveisPorEtapa[log.processo_novo]) {
          responsaveisPorEtapa[log.processo_novo] = log.responsavel;
        }
      });

      // Sem fallback para lot.responsavel pois esse campo é sobrescrito a cada etapa

      const estatisticas: EstatisticasProducao = {
        totalMovimentacoes: rawLogs.length,
        tempoTotalProducao: {
          dias: tempoTotalDias,
          label: tempoTotalDias === 1 ? '1 dia' : `${tempoTotalDias} dias`,
        },
        tempoPorEtapa,
        responsaveisPorEtapa,
      };

      return { logs: logsComTempo, estatisticas };
    },
    enabled: !!producaoId,
    staleTime: 30000,
  });
}

/**
 * Hook para contar movimentações de um lote (para exibir no card)
 */
export function useContagemMovimentacoes(producaoId: string) {
  return useQuery({
    queryKey: ['producao-log-count', producaoId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('producao_log')
        .select('*', { count: 'exact', head: true })
        .eq('producao_id', producaoId);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Mutation para criar log com observação
 */
export function useCreateLogComObservacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      producaoId: string;
      processoAnterior: string;
      processoNovo: string;
      responsavel?: string;
      observacao?: string;
    }) => {
      return ProducaoLog.create({
        producao_id: params.producaoId,
        processo_anterior: params.processoAnterior,
        processo_novo: params.processoNovo,
        responsavel: params.responsavel,
        observacao: params.observacao,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['producao-logs', variables.producaoId] });
      queryClient.invalidateQueries({ queryKey: ['producao-logs-tempo', variables.producaoId] });
      queryClient.invalidateQueries({ queryKey: ['producao-log-count', variables.producaoId] });
    },
  });
}

// Helpers
function formatTempo(dias: number, horas: number, minutos: number = 0): string {
  if (dias === 0 && horas === 0) {
    if (minutos > 0) return minutos === 1 ? '1 min' : `${minutos} min`;
    return '< 1 min';
  }
  if (dias === 0) return horas === 1 ? '1 hora' : `${horas}h`;
  if (dias === 1) return horas > 0 ? `1 dia ${horas}h` : '1 dia';
  return horas > 0 ? `${dias}d ${horas}h` : `${dias} dias`;
}

function getEmptyStats(): EstatisticasProducao {
  return {
    totalMovimentacoes: 0,
    tempoTotalProducao: { dias: 0, label: '0 dias' },
    tempoPorEtapa: [],
    responsaveisPorEtapa: {},
  };
}
