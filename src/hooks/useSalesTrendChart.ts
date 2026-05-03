import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllRows } from "@/lib/supabase-utils";
import {
  differenceInDays,
  addDays,
  isBefore,
  isAfter,
  isEqual,
  getISOWeekYear,
  getISOWeek,
  format,
  subYears,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  nowInSP,
  toSP,
  startOfYearSP,
  startOfMonthSP,
  isoWeekStartSP,
  getSupabaseUtcRangeSP,
  startOfDaySP,
} from "@/utils/dateTz";
import { equivalentPrevious, Range } from "@/utils/comparativePeriods";

export type TrendGranularity = 'year' | 'month' | 'week';

export type TrendMode =
  | { granularity: 'year' }
  | { granularity: 'month'; submode: 'yoy' | 'mom' }
  | { granularity: 'week'; submode: 'wow' | 'yoy' };

export interface TrendDataPoint {
  label: string;
  bucketKey: string;
  atual: number;
  anterior: number | null;
  pedidosAtual: number;
  pecasAtual: number;
  pedidosAnterior: number;
  pecasAnterior: number;
}

export interface UseSalesTrendChartResult {
  chartData: TrendDataPoint[];
  isLoading: boolean;
  currentLabel: string;
  previousLabel: string;
  totals: { atual: number; anterior: number; deltaPct: number | null };
}

const STATUS_CANCELADOS = ["CANCELADO", "GOLPE CANCELADO", "GOLPE"];

export function useSalesTrendChart(opts: {
  excluirCancelados: boolean;
  mode: TrendMode;
}): UseSalesTrendChartResult {
  const { excluirCancelados, mode } = opts;
  const { user } = useAuth();
  const userId = user?.id;

  // Cache stable midnight to avoid excessive re-renders, but it will still update daily
  const nowSP = useMemo(() => nowInSP(), []);
  const startOfLastYearSP = startOfYearSP(subYears(nowSP, 1));
  const { gte } = getSupabaseUtcRangeSP(startOfLastYearSP, nowSP);

  const { data: records, isLoading } = useQuery({
    queryKey: ["sales-trend-chart-v2", userId, gte, excluirCancelados],
    queryFn: async () => {
      if (!userId) return [];
      const pedidosData = await fetchAllRows<any>(() =>
        supabase
          .from("pedidos")
          .select("valor_total, total_pecas, status_pagamento, status_pedido, created_at")
          .eq("user_id", userId)
          .gte("created_at", gte)
      );
      return pedidosData || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const processedData = useMemo(() => {
    if (!records) {
      return {
        chartData: [],
        currentLabel: "",
        previousLabel: "",
        totals: { atual: 0, anterior: 0, deltaPct: null },
      };
    }

    const pedidosFiltrados = excluirCancelados
      ? records.filter((p: any) => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
      : records;

    const pedidosPagos = pedidosFiltrados.filter((p: any) =>
      ["PAGO", "CONCLUIDO"].includes((p.status_pagamento || "").toUpperCase())
    );

    let currentRange: Range;
    if (mode.granularity === 'year') {
      currentRange = { start: startOfYearSP(nowSP), end: nowSP };
    } else if (mode.granularity === 'month') {
      currentRange = { start: startOfMonthSP(nowSP), end: nowSP };
    } else {
      currentRange = { start: isoWeekStartSP(nowSP), end: nowSP };
    }

    let compareMode: 'yoy' | 'mom' | 'wow' | 'wow-yoy' = 'yoy';
    if (mode.granularity === 'month' && mode.submode === 'mom') compareMode = 'mom';
    if (mode.granularity === 'week') {
      compareMode = mode.submode === 'wow' ? 'wow' : 'wow-yoy';
    }

    const prevRange = equivalentPrevious(currentRange, compareMode);

    let currentLabel = "";
    let previousLabel = "";

    if (mode.granularity === 'year') {
      currentLabel = format(currentRange.start, "yyyy", { locale: ptBR });
      previousLabel = format(prevRange.start, "yyyy", { locale: ptBR });
    } else if (mode.granularity === 'month') {
      currentLabel = format(currentRange.start, "MMM/yyyy", { locale: ptBR });
      previousLabel = format(prevRange.start, "MMM/yyyy", { locale: ptBR });
    } else if (mode.granularity === 'week') {
      currentLabel = `Semana atual (${format(currentRange.start, "dd/MMM", { locale: ptBR })})`;
      if (mode.submode === 'wow') {
        previousLabel = `Semana anterior (${format(prevRange.start, "dd/MMM", { locale: ptBR })})`;
      } else {
        const isoWk = getISOWeek(prevRange.start);
        const isoYr = getISOWeekYear(prevRange.start);
        previousLabel = `Sem ${isoWk}/${isoYr}`;
        const currIsoWk = getISOWeek(currentRange.start);
        const currIsoYr = getISOWeekYear(currentRange.start);
        currentLabel = `Sem ${currIsoWk}/${currIsoYr}`;
      }
    }

    const elapsedDays = differenceInDays(currentRange.end, currentRange.start);
    const result: TrendDataPoint[] = [];

    for (let i = 0; i <= elapsedDays; i++) {
      const currDay = addDays(currentRange.start, i);
      const prevDay = addDays(prevRange.start, i);
      const isPrevValid = !isAfter(startOfDaySP(prevDay), startOfDaySP(prevRange.end));

      let label = "";
      if (mode.granularity === 'year') {
        label = format(currDay, "MMM", { locale: ptBR });
      } else if (mode.granularity === 'month') {
        label = format(currDay, "dd", { locale: ptBR });
      } else if (mode.granularity === 'week') {
        label = format(currDay, "eee", { locale: ptBR });
      }

      let bucketKey = format(currDay, "MM-dd");

      result.push({
        label,
        bucketKey,
        atual: 0,
        anterior: isPrevValid ? 0 : null,
        pedidosAtual: 0,
        pecasAtual: 0,
        pedidosAnterior: 0,
        pecasAnterior: 0,
        _currDayStart: startOfDaySP(currDay),
        _prevDayStart: startOfDaySP(prevDay),
        _isPrevValid: isPrevValid
      } as any);
    }

    pedidosPagos.forEach((p: any) => {
      const d = toSP(p.created_at);
      const dStart = startOfDaySP(d);

      if (!isBefore(dStart, startOfDaySP(currentRange.start)) && !isAfter(dStart, startOfDaySP(currentRange.end))) {
        const daysDiff = differenceInDays(dStart, startOfDaySP(currentRange.start));
        if (result[daysDiff]) {
          result[daysDiff].atual += p.valor_total || 0;
          result[daysDiff].pedidosAtual += 1;
          result[daysDiff].pecasAtual += p.total_pecas || 0;
        }
      }

      if (!isBefore(dStart, startOfDaySP(prevRange.start)) && !isAfter(dStart, startOfDaySP(prevRange.end))) {
        const daysDiff = differenceInDays(dStart, startOfDaySP(prevRange.start));
        if (result[daysDiff] && (result[daysDiff] as any)._isPrevValid) {
          result[daysDiff].anterior = (result[daysDiff].anterior || 0) + (p.valor_total || 0);
          result[daysDiff].pedidosAnterior += 1;
          result[daysDiff].pecasAnterior += p.total_pecas || 0;
        }
      }
    });

    let totAtual = 0;
    let totAnterior = 0;
    result.forEach(r => {
      totAtual += r.atual;
      totAnterior += r.anterior || 0;
    });

    let deltaPct = null;
    if (totAnterior > 0) {
      deltaPct = ((totAtual - totAnterior) / totAnterior) * 100;
    } else if (totAtual > 0) {
      deltaPct = 100;
    }

    const finalData = result.map(({ _currDayStart, _prevDayStart, _isPrevValid, ...rest }: any) => rest);

    return {
      chartData: finalData,
      currentLabel,
      previousLabel,
      totals: { atual: totAtual, anterior: totAnterior, deltaPct },
    };
  }, [records, mode, excluirCancelados, nowSP]);

  return {
    ...processedData,
    isLoading,
  };
}
