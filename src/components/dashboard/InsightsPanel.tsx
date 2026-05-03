import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, TrendingDown, TrendingUp, AlertTriangle, Package, CheckCircle, ChevronDown, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightItem } from "@/hooks/useInsightsDashboard";

interface InsightsPanelProps {
  insights: InsightItem[];
  resumoExecutivo: string;
  sugestaoFoco: string | null;
}

const STORAGE_KEY = "dashboard-insights-open";

const ICON_MAP = {
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  alert: AlertTriangle,
  package: Package,
  check: CheckCircle,
} as const;

const COLOR_MAP: Record<InsightItem["tipo"], string> = {
  alerta: "text-amber-600 dark:text-amber-400",
  positivo: "text-emerald-600 dark:text-emerald-400",
  info: "text-blue-600 dark:text-blue-400",
  neutro: "text-muted-foreground",
};

const BG_MAP: Record<InsightItem["tipo"], string> = {
  alerta: "bg-amber-100 dark:bg-amber-900/30",
  positivo: "bg-emerald-100 dark:bg-emerald-900/30",
  info: "bg-blue-100 dark:bg-blue-900/30",
  neutro: "bg-muted/50",
};

const BADGE_MAP: Record<InsightItem["prioridade"], { label: string; className: string }> = {
  critico: {
    label: "Crítico",
    className: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  },
  atencao: {
    label: "Atenção",
    className: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
  },
  contexto: {
    label: "Contexto",
    className: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
  },
};

export function InsightsPanel({ insights, resumoExecutivo, sugestaoFoco }: InsightsPanelProps) {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(open));
  }, [open]);

  if (!insights || insights.length === 0) return null;

  return (
    <Card className="neu-card mb-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-4 sm:px-6 sm:py-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                Insights do Período
              </span>
              <span className="text-xs text-muted-foreground">
                ({insights.length})
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 sm:px-6 sm:pb-5">
            {/* Resumo Executivo */}
            <p className="text-sm text-muted-foreground mb-3">
              {resumoExecutivo}
            </p>

            {/* Sugestão de Foco */}
            {sugestaoFoco && (
              <div className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg bg-primary/5 border border-primary/20 mb-3">
                <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-foreground">
                  {sugestaoFoco}
                </p>
              </div>
            )}

            {/* Insights */}
            <div className="space-y-2">
              {insights.map((insight) => {
                const Icon = ICON_MAP[insight.icone];
                const badge = BADGE_MAP[insight.prioridade];
                return (
                  <div
                    key={insight.id}
                    className="flex items-start gap-3 py-2 px-3 rounded-lg bg-muted/20"
                  >
                    <div
                      className={cn(
                        "p-1 rounded-md flex-shrink-0 mt-0.5",
                        BG_MAP[insight.tipo]
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", COLOR_MAP[insight.tipo])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {insight.mensagem}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
