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
      "py-3 px-3 rounded-xl transition-all",
      "bg-muted/30 hover:bg-muted/50",
      isDisabled && "opacity-60"
    )}>
      {/* Compact Layout (mobile/tablet < lg) */}
      <div className="lg:hidden space-y-2">
        {/* First line: Product Name + Delete */}
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-foreground truncate flex-1 text-sm">
            {item.produto_nome}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={isDisabled}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
          >
            {isRemoving || isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Second line: Qty x Value = Subtotal using grid for guaranteed spacing */}
        <div className="grid grid-cols-[50px_16px_1fr_16px_auto] items-center gap-1">
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={handleQuantidadeChange}
            disabled={isDisabled}
            className="h-8 text-center text-sm font-semibold rounded-lg border-border/50"
          />
          <span className="text-muted-foreground text-sm text-center">x</span>
          <div className="relative min-w-0">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={valorUnitario}
              onChange={handleValorChange}
              disabled={isDisabled}
              className="h-8 pl-7 text-right text-sm font-semibold rounded-lg border-border/50 w-full"
            />
          </div>
          <span className="text-muted-foreground text-sm text-center">=</span>
          <p className="font-bold text-emerald-600 text-sm whitespace-nowrap">
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
