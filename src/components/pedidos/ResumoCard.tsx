import { Button } from '@/components/ui/button';

interface ResumoCardProps {
  totalPecas: number;
  valorTotal: number;
  onLimpar: () => void;
  onCriarPedido: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ResumoCard({
  totalPecas,
  valorTotal,
  onLimpar,
  onCriarPedido,
  isLoading = false,
  disabled = false,
}: ResumoCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="neu-card p-7">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Summary Stats */}
        <div className="flex items-start gap-14">
          <div>
            <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
              Quantidade total de peças
            </p>
            <p className="text-3xl font-bold text-primary">{totalPecas} <span className="text-base font-normal text-muted-foreground">peças</span></p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
              Valor total do pedido
            </p>
            <p className="text-3xl font-bold text-emerald-600">{formatCurrency(valorTotal)}</p>
          </div>
        </div>

        {/* Action Buttons - Only Limpar and Criar Pedido */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onLimpar}
            className="h-12 px-8 rounded-xl border-border bg-background hover:bg-muted/50 text-foreground font-medium"
          >
            Limpar Formulário
          </Button>
          <Button
            type="button"
            onClick={onCriarPedido}
            disabled={isLoading || disabled}
            className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Criando...' : disabled ? 'Estoque Insuficiente' : 'Criar Pedido'}
          </Button>
        </div>
      </div>
    </div>
  );
}
