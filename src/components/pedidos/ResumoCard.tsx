import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

  const valorSemDesconto = valorItens + taxaExcursao;
  const temDesconto = desconto > 0;

  return (
    <div className="neu-card p-7">
      {/* Linha auxiliar: Subtotal e Taxa Excursão */}
      {(taxaExcursao > 0 || valorItens > 0) && (
        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
          <span>Subtotal: <strong className="text-foreground">{formatCurrency(valorItens)}</strong></span>
          {taxaExcursao > 0 && (
            <span>Taxa Excursão{nomeExcursao ? ` (${nomeExcursao})` : ''}: <strong className="text-amber-600">+ {formatCurrency(taxaExcursao)}</strong></span>
          )}
        </div>
      )}

      {/* Grid principal: 4 colunas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 mb-6">
        {/* Total de Peças */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Total de Peças
          </p>
          <p className="text-2xl font-semibold leading-tight text-primary">
            {totalPecas} <span className="text-sm font-normal text-muted-foreground">peças</span>
          </p>
        </div>

        {/* Quantidade de Modelos */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Qtd de Modelos
          </p>
          <p className="text-2xl font-semibold leading-tight text-violet-600">
            {quantidadeModelos} <span className="text-sm font-normal text-muted-foreground">
              {quantidadeModelos === 1 ? 'modelo' : 'modelos'}
            </span>
          </p>
        </div>

        {/* Desconto (Interno) */}
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

        {/* Valor Total */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Valor Total
          </p>
          {temDesconto ? (
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-muted-foreground line-through">
                {formatCurrency(valorSemDesconto)}
              </p>
              <p className="text-2xl font-semibold leading-tight text-emerald-600">
                {formatCurrency(valorTotal)}
              </p>
              <Badge className="w-fit bg-rose-100 text-rose-700 border-rose-200 text-xs font-medium">
                - {formatCurrency(desconto)} de desconto
              </Badge>
            </div>
          ) : (
            <p className="text-2xl font-semibold leading-tight text-emerald-600">
              {formatCurrency(valorTotal)}
            </p>
          )}
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

