import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProducaoLogData } from '@/entities/ProducaoLog';
import { STAGES } from '@/data/production-data';

export interface MetricaResponsavel {
  responsavel: string;
  finalizados7d: number;
  finalizados30d: number;
  transicoes7d: number;
}

export interface MetricaEtapa {
  etapa: string;
  tempoMedioHoras: number;
  amostras: number;
}

export interface MetricasProducaoData {
  porResponsavel: MetricaResponsavel[];
  porEtapa: MetricaEtapa[];
  totalTransicoes30d: number;
  totalFinalizados30d: number;
  ultimaAtualizacao: Date;
}

function horasDiff(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
}

function computeMetricas(logs: ProducaoLogData[]): MetricasProducaoData {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // --- Por responsável ---
  const responsavelMap = new Map<string, MetricaResponsavel>();

  for (const log of logs) {
    const resp = log.responsavel?.trim() || 'Sem responsável';
    if (!responsavelMap.has(resp)) {
      responsavelMap.set(resp, { responsavel: resp, finalizados7d: 0, finalizados30d: 0, transicoes7d: 0 });
    }
    const entry = responsavelMap.get(resp)!;

    if (log.created_at >= d7) entry.transicoes7d++;

    const isFinalizacao = log.processo_novo === 'Vendas';
    if (isFinalizacao) {
      if (log.created_at >= d7) entry.finalizados7d++;
      if (log.created_at >= d30) entry.finalizados30d++;
    }
  }

  const porResponsavel = Array.from(responsavelMap.values())
    .sort((a, b) => b.finalizados30d - a.finalizados30d || b.transicoes7d - a.transicoes7d);

  // --- Tempo por etapa (usando pares consecutivos de log por lote) ---
  const logsByLot = new Map<string, ProducaoLogData[]>();
  for (const log of logs) {
    if (!logsByLot.has(log.producao_id)) logsByLot.set(log.producao_id, []);
    logsByLot.get(log.producao_id)!.push(log);
  }

  const etapaAccum = new Map<string, { totalHoras: number; count: number }>();
  for (const stage of STAGES) {
    etapaAccum.set(stage.id, { totalHoras: 0, count: 0 });
  }

  for (const [, entries] of logsByLot) {
    const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 0; i + 1 < sorted.length; i++) {
      const prev = sorted[i];
      const next = sorted[i + 1];
      const stage = prev.processo_novo;
      const horas = horasDiff(prev.created_at, next.created_at);
      // ignore outliers > 60 days or negative
      if (horas > 0 && horas < 60 * 24) {
        if (etapaAccum.has(stage)) {
          const acc = etapaAccum.get(stage)!;
          acc.totalHoras += horas;
          acc.count++;
        }
      }
    }
  }

  const porEtapa: MetricaEtapa[] = [];
  for (const [etapa, acc] of etapaAccum) {
    if (acc.count > 0) {
      porEtapa.push({
        etapa,
        tempoMedioHoras: acc.totalHoras / acc.count,
        amostras: acc.count,
      });
    }
  }
  // keep STAGES order
  porEtapa.sort((a, b) => {
    const ia = STAGES.findIndex(s => s.id === a.etapa);
    const ib = STAGES.findIndex(s => s.id === b.etapa);
    return ia - ib;
  });

  const logs30d = logs.filter(l => l.created_at >= d30);

  return {
    porResponsavel,
    porEtapa,
    totalTransicoes30d: logs30d.length,
    totalFinalizados30d: logs30d.filter(l => l.processo_novo === 'Vendas').length,
    ultimaAtualizacao: now,
  };
}

export function useMetricasProducao() {
  return useQuery({
    queryKey: ['metricas-producao'],
    queryFn: async (): Promise<MetricasProducaoData> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('producao_log')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return computeMetricas((data || []) as ProducaoLogData[]);
    },
    staleTime: 5 * 60 * 1000,
  });
}
