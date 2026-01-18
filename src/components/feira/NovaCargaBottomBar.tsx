import { Button } from '@/components/ui/button';
import { Truck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NovaCargaBottomBarProps {
  qtdItens: number;
  totalPecas: number;
  valorTotal: string;
  onCriarCarga: () => void;
  isPending: boolean;
  disabled: boolean;
}

export function NovaCargaBottomBar({
  qtdItens,
  totalPecas,
  valorTotal,
  onCriarCarga,
  isPending,
  disabled,
}: NovaCargaBottomBarProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-background border-t shadow-lg">
      <div className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
        {/* Resumo compacto */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              <strong className="text-foreground tabular-nums">{qtdItens}</strong> {qtdItens === 1 ? 'item' : 'itens'}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground tabular-nums">{totalPecas}</strong> pç
            </span>
          </div>
          <span className="text-base font-bold text-primary tabular-nums">{valorTotal}</span>
        </div>
        
        {/* CTA Principal */}
        <Button 
          onClick={onCriarCarga}
          disabled={disabled || isPending}
          className={cn(
            "w-full h-12 text-base font-semibold touch-manipulation gap-2",
            isPending && "opacity-80"
          )}
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Criando...
            </>
          ) : disabled ? (
            'Selecione produtos'
          ) : (
            <>
              <Truck className="h-5 w-5" />
              Criar Carga
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
