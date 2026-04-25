import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  differenceInDays,
  addDays,
  isBefore,
  isAfter,
  getISOWeekYear,
  getISOWeek,
  format,
  subYears,
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
import { TrendMode } from "./useSalesTrendChart";

export interface RecebimentoDataPoint {
  label: string;
  bucketKey: string;
  atual: number;
  anterior: number | null;
  qtdAtual: number;
  qtdAnterior: number;
}

export function useRecebimentosTrendChart(opts: {
  mode: TrendMode;
}) {
  const { mode } = opts;
  const { user } = useAuth();
  const userId = user?.id;

  const nowSP = useMemo(() => nowInSP(), []);
  const startOfLastYearSP = startOfYearSP(subYears(nowSP, 1));
  const { gte } = getSupabaseUtcRangeSP(startOfLastYearSP, nowSP);

  const { data: records, isLoading } = useQuery({
    queryKey: ["recebimentos-trend-chart-v2", userId, gte],
    queryFn: async () => {
      const { data } = await supabase
        .from("comprovantes")
        .select("valor, created_at")
        .eq("status", "confirmado")
        .gte("created_at", gte);
      return data || [];
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
    const result: RecebimentoDataPoint[] = [];

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
        qtdAtual: 0,
        qtdAnterior: 0,
        _currDayStart: startOfDaySP(currDay),
        _prevDayStart: startOfDaySP(prevDay),
        _isPrevValid: isPrevValid
      } as any);
    }

    records.forEach((c: any) => {
      const d = toSP(c.created_at);
      const dStart = startOfDaySP(d);

      if (!isBefore(dStart, startOfDaySP(currentRange.start)) && !isAfter(dStart, startOfDaySP(currentRange.end))) {
        const daysDiff = differenceInDays(dStart, startOfDaySP(currentRange.start));
        if (result[daysDiff]) {
          result[daysDiff].atual += c.valor || 0;
          result[daysDiff].qtdAtual += 1;
        }
      }

      if (!isBefore(dStart, startOfDaySP(prevRange.start)) && !isAfter(dStart, startOfDaySP(prevRange.end))) {
        const daysDiff = differenceInDays(dStart, startOfDaySP(prevRange.start));
        if (result[daysDiff] && (result[daysDiff] as any)._isPrevValid) {
          result[daysDiff].anterior = (result[daysDiff].anterior || 0) + (c.valor || 0);
          result[daysDiff].qtdAnterior += 1;
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
  }, [records, mode, nowSP]);

  return {
    ...processedData,
    isLoading,
  };
}
