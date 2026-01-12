import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EditableItem {
  id: string;
  produto_id?: string | null;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
}

interface EditableItemRowProps {
  item: EditableItem;
  onUpdate: (id: string, data: { quantidade?: number; valor_unitario?: number }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  isUpdating: boolean;
  isRemoving: boolean;
}

export function EditableItemRow({ item, onUpdate, onRemove, isUpdating, isRemoving }: EditableItemRowProps) {
  const [quantidade, setQuantidade] = useState(item.quantidade);
  const [valorUnitario, setValorUnitario] = useState(item.valor_unitario);
  const [pendingUpdate, setPendingUpdate] = useState<NodeJS.Timeout | null>(null);

  const subtotal = quantidade * valorUnitario;

  // Sync local state when item changes
  useEffect(() => {
    setQuantidade(item.quantidade);
    setValorUnitario(item.valor_unitario);
  }, [item.quantidade, item.valor_unitario]);

  // Debounced update
  const debouncedUpdate = useCallback((field: 'quantidade' | 'valor_unitario', value: number) => {
    if (pendingUpdate) {
      clearTimeout(pendingUpdate);
    }

    const timeout = setTimeout(() => {
      const data = field === 'quantidade' 
        ? { quantidade: value } 
        : { valor_unitario: value };
      onUpdate(item.id, data);
    }, 500);

    setPendingUpdate(timeout);
  }, [item.id, onUpdate, pendingUpdate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pendingUpdate) {
        clearTimeout(pendingUpdate);
      }
    };
  }, [pendingUpdate]);

  const handleQuantidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    if (value >= 0) {
      setQuantidade(value);
      if (value > 0) {
        debouncedUpdate('quantidade', value);
      }
    }
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    if (value >= 0) {
      setValorUnitario(value);
      debouncedUpdate('valor_unitario', value);
    }
  };

  const handleRemove = async () => {
    await onRemove(item.id);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isDisabled = isUpdating || isRemoving;

  return (
    <div className={cn(
      "py-3 px-2 sm:px-3 rounded-xl transition-all",
      "bg-muted/30 hover:bg-muted/50",
      isDisabled && "opacity-60"
    )}>
      {/* Compact Layout - Mobile/Tablet (< lg) */}
      <div className="lg:hidden space-y-2 overflow-hidden">
        {/* Linha 1: Nome + Lixeira */}
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium text-foreground truncate flex-1 text-sm min-w-0">
            {item.produto_nome}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={isDisabled}
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
          >
            {isRemoving || isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Linha 2: Qtd × Valor = Subtotal */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={handleQuantidadeChange}
            disabled={isDisabled}
            className="w-11 h-8 text-center text-sm font-semibold shrink-0 rounded-lg border-border/50 px-1"
          />
          <span className="text-muted-foreground text-xs shrink-0">×</span>
          <div className="relative flex-1 min-w-[65px]">
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={valorUnitario}
              onChange={handleValorChange}
              disabled={isDisabled}
              className="h-8 pl-6 pr-1 text-right text-sm font-semibold rounded-lg border-border/50 w-full"
            />
          </div>
          <span className="text-muted-foreground text-xs shrink-0">=</span>
          <p className="font-bold text-emerald-600 text-sm whitespace-nowrap shrink-0">
            R$ {formatCurrency(subtotal)}
          </p>
        </div>
      </div>

      {/* Desktop Layout (>= lg) */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Product Name - Limited width to ensure other columns fit */}
        <div className="flex-1 min-w-0 max-w-[350px]">
          <p className="font-medium text-foreground truncate">{item.produto_nome}</p>
        </div>

        {/* Quantity Input */}
        <div className="w-14 shrink-0">
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={handleQuantidadeChange}
            disabled={isDisabled}
            className="h-9 text-center text-sm font-semibold rounded-lg border-border/50"
          />
        </div>

        {/* Unit Value Input */}
        <div className="w-20 shrink-0">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={valorUnitario}
              onChange={handleValorChange}
              disabled={isDisabled}
              className="h-9 pl-7 text-right text-sm font-semibold rounded-lg border-border/50"
            />
          </div>
        </div>

        {/* Subtotal */}
        <div className="w-24 text-right shrink-0">
          <p className="font-bold text-emerald-600 text-sm">
            R$ {formatCurrency(subtotal)}
          </p>
        </div>

        {/* Actions - Delete Button */}
        <div className="w-9 flex justify-center shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={isDisabled}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
          >
            {isRemoving || isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
