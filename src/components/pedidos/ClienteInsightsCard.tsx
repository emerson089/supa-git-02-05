import { Package, DollarSign, ShoppingBag, AlertTriangle, Star } from 'lucide-react';
import { useClienteInsights } from '@/hooks/useClienteInsights';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ClienteInsightsCardProps {
  clienteId: string | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function ClienteInsightsCard({ clienteId }: ClienteInsightsCardProps) {
  const { data: insights, isLoading } = useClienteInsights(clienteId);

  // Não renderiza se não houver cliente selecionado
  if (!clienteId) return null;

  // Loading state
  if (isLoading) {
    return (
      <div className="neu-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-muted/30">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Primeira compra (cliente novo sem histórico)
  if (!insights || insights.totalPedidos === 0) {
    return (
      <div className="neu-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Histórico do Cliente</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Star className="h-6 w-6 text-primary" />
          </div>
          <p className="text-lg font-medium text-foreground">Primeira Compra</p>
          <p className="text-sm text-muted-foreground mt-1">
            Este cliente ainda não possui pedidos anteriores
          </p>
        </div>
      </div>
    );
  }

  // Determinar nível de risco
  const getRiskLevel = (cancelados: number) => {
    if (cancelados >= 3) return { label: 'Alto Risco', color: 'text-destructive', bg: 'bg-destructive/10' };
    if (cancelados >= 1) return { label: 'Atenção', color: 'text-amber-600', bg: 'bg-amber-500/10' };
    return null;
  };

  const riskLevel = getRiskLevel(insights.pedidosCancelados);

  const stats = [
    {
      icon: Package,
      value: insights.totalPedidos,
      label: 'Pedidos Pagos',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: DollarSign,
      value: formatCurrency(insights.valorAcumulado),
      label: 'Total Pago',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: ShoppingBag,
      value: insights.totalPecas,
      label: 'Peças Compradas',
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: AlertTriangle,
      value: insights.pedidosCancelados,
      label: 'Cancelados',
      color: insights.pedidosCancelados > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: insights.pedidosCancelados > 0 ? 'bg-destructive/10' : 'bg-muted/30',
      risk: riskLevel,
    },
  ];

  return (
    <div className="neu-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-foreground">Histórico do Cliente</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={cn(
              "p-4 rounded-xl transition-all",
              "shadow-[2px_2px_6px_hsl(var(--muted)/0.4),-2px_-2px_6px_hsl(var(--background))]",
              stat.bgColor
            )}
          >
            <div className="flex items-start justify-between">
              <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
              {stat.risk && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  stat.risk.bg,
                  stat.risk.color
                )}>
                  {stat.risk.label}
                </span>
              )}
            </div>
            <p className={cn("text-2xl font-bold mt-3", stat.color)}>
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
