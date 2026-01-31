import { Button } from '@/components/ui/button';

interface ResumoCardProps {
  totalPecas: number;
  valorItens: number;
  taxaExcursao: number;
  nomeExcursao?: string;
  valorTotal: number;
  quantidadeModelos: number;
  onLimpar: () => void;
  onCriarPedido: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ResumoCard({
  totalPecas,
  valorItens,
  taxaExcursao,
  nomeExcursao,
  valorTotal,
  quantidadeModelos,
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
      {/* Métricas em grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8 mb-6">
        {/* Quantidade total de peças */}
        <div>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
            Quantidade total de peças
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-primary">
            {totalPecas} <span className="text-sm font-normal text-muted-foreground">peças</span>
          </p>
        </div>

        {/* Quantidade de modelos */}
        <div>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
            Quantidade de modelos
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-violet-600">
            {quantidadeModelos} <span className="text-sm font-normal text-muted-foreground">
              {quantidadeModelos === 1 ? 'modelo' : 'modelos'}
            </span>
          </p>
        </div>

        {/* Subtotal dos itens */}
        <div>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
            Subtotal dos itens
          </p>
          <p className="text-xl lg:text-2xl font-semibold text-foreground">
            {formatCurrency(valorItens)}
          </p>
        </div>

        {/* Taxa Excursão - condicional */}
        {taxaExcursao > 0 && (
          <div>
            <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
              Taxa Excursão {nomeExcursao && <span className="normal-case">({nomeExcursao})</span>}
            </p>
            <p className="text-xl lg:text-2xl font-semibold text-amber-600">
              + {formatCurrency(taxaExcursao)}
            </p>
          </div>
        )}

        {/* Valor total do pedido */}
        <div>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
            Valor total do pedido
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-emerald-600">
            {formatCurrency(valorTotal)}
          </p>
        </div>
      </div>

      {/* Botões alinhados à direita */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-border/30">
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
  );
}