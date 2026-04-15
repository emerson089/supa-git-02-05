import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageCircle } from 'lucide-react';

interface ResumoCardProps {
  totalPecas: number;
  valorItens: number;
  taxaExcursao: number;
  nomeExcursao?: string;
  valorTotal: number;
  desconto: number;
  descontoItens?: number;
  onDescontoChange: (value: number) => void;
  quantidadeModelos: number;
  onLimpar: () => void;
  onCriarPedido: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  enviarWhatsApp?: boolean;
  onEnviarWhatsAppChange?: (value: boolean) => void;
}

export function ResumoCard({
  totalPecas,
  valorItens,
  taxaExcursao,
  nomeExcursao,
  valorTotal,
  desconto,
  descontoItens = 0,
  onDescontoChange,
  quantidadeModelos,
  onLimpar,
  onCriarPedido,
  isLoading = false,
  disabled = false,
  enviarWhatsApp = false,
  onEnviarWhatsAppChange,
}: ResumoCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const descontoTotal = desconto + descontoItens;
  const valorSemDesconto = valorItens + descontoItens + taxaExcursao;
  const temDesconto = descontoTotal > 0;

  return (
    <div className="neu-card p-4 sm:p-7">
      {/* Linha auxiliar: Subtotal e Taxa Excursão */}
      {(taxaExcursao > 0 || valorItens > 0) && (
        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
          <span>Subtotal: <strong className="text-foreground">{formatCurrency(valorItens + descontoItens)}</strong></span>
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
              value={(descontoTotal || 0).toFixed(2)}
              onChange={(e) => onDescontoChange(Math.max(0, Number(e.target.value) - descontoItens))}
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
                - {formatCurrency(descontoTotal)} de desconto
              </Badge>
            </div>
          ) : (
            <p className="text-2xl font-semibold leading-tight text-emerald-600">
              {formatCurrency(valorTotal)}
            </p>
          )}
        </div>
      </div>

      {/* WhatsApp toggle + Botões */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-border/30">
        {/* WhatsApp toggle */}
        {onEnviarWhatsAppChange && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Switch
              id="enviar-whatsapp"
              checked={enviarWhatsApp}
              onCheckedChange={onEnviarWhatsAppChange}
            />
            <Label htmlFor="enviar-whatsapp" className="flex items-center gap-2 text-sm cursor-pointer font-medium">
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              Enviar resumo via WhatsApp
            </Label>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onLimpar}
            className="h-12 w-full sm:w-auto px-8 rounded-xl border-border bg-background hover:bg-muted/50 text-foreground font-medium order-2 sm:order-1"
          >
            Limpar Formulário
          </Button>
          <Button
            type="button"
            onClick={onCriarPedido}
            disabled={isLoading || disabled}
            className="h-12 w-full sm:w-auto px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 shadow-lg shadow-primary/20"
          >
            {isLoading ? 'Criando...' : disabled ? 'Estoque Insuficiente' : 'Criar Pedido'}
          </Button>
        </div>
      </div>
    </div>
  );
}

