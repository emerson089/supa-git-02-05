import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllRows } from "@/lib/supabase-utils";
import { format, startOfMonth, startOfYear, subYears, getDaysInMonth, endOfMonth, endOfYear, getMonth, parseISO, getDate, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

export type TrendGranularity = "mes" | "ano";

export interface TrendDataPoint {
    label: string;
    dataOriginal?: Date; // For sorting or precise formatting if needed
    atual: number;
    anterior: number;
    // extras for tooltip
    pedidosAtual: number;
    pecasAtual: number;
    pedidosAnterior: number;
    pecasAnterior: number;
    isFuture: boolean; // to not draw line for future dates/months
}

const STATUS_CANCELADOS = ["CANCELADO", "GOLPE CANCELADO", "GOLPE"];


export function useSalesTrendChart(excluirCancelados: boolean) {
    const { user } = useAuth();
    const userId = user?.id;
    const [granularity, setGranularity] = useState<TrendGranularity>("mes");
    const now = new Date();

    // To cover both 'ano' and 'mes', and previous years, we fetch from start of LAST year to end of CURRENT year/month
    // If granularity === 'ano', we need start of last year to end of this year
    // If granularity === 'mes', we need start of this month last year to end of this month this year
    // To keep it simple and switch instantly, we can just fetch from start of last year to now. 
    // It might be a lot of data if the user has many years, but for 2 years it's usually fine.
    const startDate = startOfYear(subYears(now, 1)).toISOString();

    const { data: pedidos, isLoading } = useQuery({
        queryKey: ["sales-trend-chart", userId, startDate],
        queryFn: async () => {
            if (!userId) return [];

            const data = await fetchAllRows<any>(() =>
                supabase
                    .from("pedidos")
                    .select("valor_total, total_pecas, status_pagamento, status_pedido, created_at")
                    .eq("user_id", userId)
                    .gte("created_at", startDate)
            );

            return data || [];
        },
        enabled: !!userId,
    });

    const chartData = useMemo(() => {
        if (!pedidos) return [];

        const pedidosFiltrados = excluirCancelados
            ? pedidos.filter((p: any) => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
            : pedidos;

        const pedidosPagos = pedidosFiltrados.filter((p: any) =>
            ["PAGO", "CONCLUIDO"].includes((p.status_pagamento || "").toUpperCase())
        );

        const result: TrendDataPoint[] = [];
        const currentYear = now.getFullYear();
        const previousYear = currentYear - 1;

        if (granularity === "mes") {
            const currentMonth = now.getMonth();
            const daysInMonth = getDaysInMonth(now);

            // Initialize array for 1 to daysInMonth
            for (let i = 1; i <= daysInMonth; i++) {
                const dateThisYear = new Date(currentYear, currentMonth, i);
                result.push({
                    label: String(i).padStart(2, '0'),
                    dataOriginal: dateThisYear,
                    atual: 0,
                    anterior: 0,
                    pedidosAtual: 0,
                    pecasAtual: 0,
                    pedidosAnterior: 0,
                    pecasAnterior: 0,
                    isFuture: isAfter(dateThisYear, now),
                });
            }

            pedidosPagos.forEach((p: any) => {
                const d = parseISO(p.created_at);
                if (d.getMonth() === currentMonth) {
                    const day = d.getDate();
                    const point = result[day - 1];
                    if (point) {
                        if (d.getFullYear() === currentYear) {
                            point.atual += p.valor_total || 0;
                            point.pedidosAtual += 1;
                            point.pecasAtual += p.total_pecas || 0;
                        } else if (d.getFullYear() === previousYear) {
                            point.anterior += p.valor_total || 0;
                            point.pedidosAnterior += 1;
                            point.pecasAnterior += p.total_pecas || 0;
                        }
                    }
                }
            });

        } else {
            // granularity === "ano"
            const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            for (let i = 0; i < 12; i++) {
                const dateThisYear = new Date(currentYear, i, 1);
                // It's future if it's strictly AFTER the current month
                const isFuture = i > now.getMonth();

                result.push({
                    label: months[i],
                    dataOriginal: dateThisYear,
                    atual: 0,
                    anterior: 0,
                    pedidosAtual: 0,
                    pecasAtual: 0,
                    pedidosAnterior: 0,
                    pecasAnterior: 0,
                    isFuture,
                });
            }

            pedidosPagos.forEach((p: any) => {
                const d = parseISO(p.created_at);
                const month = d.getMonth();
                const point = result[month];
                if (point) {
                    if (d.getFullYear() === currentYear) {
                        point.atual += p.valor_total || 0;
                        point.pedidosAtual += 1;
                        point.pecasAtual += p.total_pecas || 0;
                    } else if (d.getFullYear() === previousYear) {
                        point.anterior += p.valor_total || 0;
                        point.pedidosAnterior += 1;
                        point.pecasAnterior += p.total_pecas || 0;
                    }
                }
            });
        }

        return result;
    }, [pedidos, granularity, excluirCancelados, now]);

    return {
        granularity,
        setGranularity,
        chartData,
        isLoading,
        currentYear: now.getFullYear(),
        previousYear: now.getFullYear() - 1,
    };
}
