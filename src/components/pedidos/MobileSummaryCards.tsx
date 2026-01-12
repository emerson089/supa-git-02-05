import { ShoppingBag, DollarSign, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileSummaryCardsProps {
  totalPedidos: number;
  totalValor: number;
  totalPecas: number;
  filterModelo?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

export function MobileSummaryCards({
  totalPedidos,
  totalValor,
  totalPecas,
  filterModelo,
}: MobileSummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Total Pedidos */}
      <div className="neu-card p-3 flex flex-col items-center text-center">
        <div className="p-2 rounded-lg bg-primary/10 mb-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">Pedidos</p>
        <p className="text-lg font-bold text-primary">{formatNumber(totalPedidos)}</p>
        {filterModelo && (
          <Badge variant="outline" className="text-[8px] text-primary border-primary mt-1 px-1">
            "{filterModelo}"
          </Badge>
        )}
      </div>

      {/* Total Valor */}
      <div className="neu-card p-3 flex flex-col items-center text-center">
        <div className="p-2 rounded-lg bg-emerald-500/10 mb-2">
          <DollarSign className="h-4 w-4 text-emerald-600" />
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">Valor</p>
        <p className="text-base font-bold text-emerald-600">{formatCurrency(totalValor)}</p>
      </div>

      {/* Total Peças */}
      <div className="neu-card p-3 flex flex-col items-center text-center">
        <div className="p-2 rounded-lg bg-primary/10 mb-2">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">Peças</p>
        <p className="text-lg font-bold text-primary">{formatNumber(totalPecas)}</p>
      </div>
    </div>
  );
}
