import { Button } from '@/components/ui/button';

interface ResumoCardProps {
  totalPecas: number;
  valorItens: number;
  taxaExcursao: number;
  nomeExcursao?: string;
  valorTotal: number;
  desconto: number;
  onDescontoChange: (value: number) => void;
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
  desconto,
  onDescontoChange,
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
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Quantidade total de peças
          </p>
          <p className="text-2xl font-semibold leading-tight text-primary">
            {totalPecas} <span className="text-sm font-normal text-muted-foreground">peças</span>
          </p>
        </div>

        {/* Quantidade de modelos */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Quantidade de modelos
          </p>
          <p className="text-2xl font-semibold leading-tight text-violet-600">
            {quantidadeModelos} <span className="text-sm font-normal text-muted-foreground">
              {quantidadeModelos === 1 ? 'modelo' : 'modelos'}
            </span>
          </p>
        </div>

        {/* Subtotal dos itens */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Subtotal dos itens
          </p>
          <p className="text-2xl font-semibold leading-tight text-foreground">
            {formatCurrency(valorItens)}
          </p>
        </div>

        {/* Taxa Excursão - condicional */}
        {taxaExcursao > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
              Taxa Excursão {nomeExcursao && <span className="normal-case">({nomeExcursao})</span>}
            </p>
            <p className="text-2xl font-semibold leading-tight text-amber-600">
              + {formatCurrency(taxaExcursao)}
            </p>
          </div>
        )}

        {/* Campo de Desconto (Interno) */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Desconto (Interno)
          </p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-rose-600">-</span>
            <input
              type="number"
              value={desconto || ''}
              onChange={(e) => onDescontoChange(Number(e.target.value) || 0)}
              placeholder="R$ 0,00"
              className="w-24 bg-transparent border-b border-border focus:border-rose-500 outline-none text-xl font-semibold text-rose-600 placeholder:text-rose-300"
            />
          </div>
        </div>

        {/* Valor total do pedido */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Valor total do pedido
          </p>
          <p className="text-2xl font-semibold leading-tight text-emerald-600">
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