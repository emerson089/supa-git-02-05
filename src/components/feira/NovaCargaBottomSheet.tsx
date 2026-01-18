import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingBag, Minus, Plus, Trash2, Truck, Loader2 } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ItemCarga {
  itemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
}

interface NovaCargaBottomSheetProps {
  itensCarga: ItemCarga[];
  onUpdateQtd: (itemId: string, novaQuantidade: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCriarCarga: () => void;
  isPending: boolean;
  formatCurrency: (value: number) => string;
}

export function NovaCargaBottomSheet({
  itensCarga,
  onUpdateQtd,
  onRemoveItem,
  onCriarCarga,
  isPending,
  formatCurrency,
}: NovaCargaBottomSheetProps) {
  const qtdItens = itensCarga.length;
  const totalPecas = itensCarga.reduce((sum, i) => sum + i.quantidade, 0);
  const valorTotal = itensCarga.reduce((sum, i) => sum + (i.quantidade * i.precoUnitario), 0);

  if (qtdItens === 0) return null;

  const handleQuantityChange = (item: ItemCarga, newValue: string) => {
    const val = parseInt(newValue.replace(/\D/g, '')) || 0;
    
    if (val > item.disponivelCentral) {
      toast.warning(`Máximo disponível: ${item.disponivelCentral} unidades`);
      onUpdateQtd(item.itemId, item.disponivelCentral);
      return;
    }
    
    onUpdateQtd(item.itemId, val);
  };

  const handleQuantityBlur = (item: ItemCarga, value: string) => {
    const val = parseInt(value) || 1;
    if (val < 1) {
      onUpdateQtd(item.itemId, 1);
    }
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          className="fixed bottom-[88px] right-4 h-14 w-14 rounded-full shadow-xl z-40 touch-manipulation"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <ShoppingBag className="h-6 w-6" />
          <Badge 
            className="absolute -top-1 -right-1 h-6 min-w-6 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground border-2 border-background"
          >
            {qtdItens}
          </Badge>
        </Button>
      </DrawerTrigger>
      
      <DrawerContent className="max-h-[75vh] flex flex-col">
        <DrawerHeader className="border-b pb-3">
          <DrawerTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Carrinho ({qtdItens} {qtdItens === 1 ? 'item' : 'itens'})
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {totalPecas} pç
            </span>
          </DrawerTitle>
        </DrawerHeader>
        
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-3">
            {itensCarga.map(item => (
              <div 
                key={item.itemId} 
                className="flex flex-col gap-3 p-3 rounded-lg border bg-card"
              >
                {/* Row 1: Image + Name + Remove */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                    <LotImage 
                      src={item.imagemUrl} 
                      alt={item.nome} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 leading-tight">
                      {item.nome}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(item.precoUnitario)} / un
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive touch-manipulation"
                    onClick={() => onRemoveItem(item.itemId)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
                
                {/* Row 2: Quantity controls + Subtotal */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="h-10 w-10 touch-manipulation" 
                      onClick={() => onUpdateQtd(item.itemId, Math.max(1, item.quantidade - 1))} 
                      disabled={item.quantidade <= 1}
                    >
                      <Minus size={18} />
                    </Button>
                    
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.quantidade}
                      onChange={(e) => handleQuantityChange(item, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => handleQuantityBlur(item, e.target.value)}
                      className="w-16 h-10 text-center text-lg font-semibold px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="h-10 w-10 touch-manipulation" 
                      onClick={() => {
                        if (item.quantidade >= item.disponivelCentral) {
                          toast.warning(`Máximo disponível: ${item.disponivelCentral}`);
                          return;
                        }
                        onUpdateQtd(item.itemId, item.quantidade + 1);
                      }}
                      disabled={item.quantidade >= item.disponivelCentral}
                    >
                      <Plus size={18} />
                    </Button>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-base font-bold text-primary tabular-nums">
                      {formatCurrency(item.precoUnitario * item.quantidade)}
                    </p>
                    {item.quantidade > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {item.quantidade} × {formatCurrency(item.precoUnitario)}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Stock warning */}
                {item.quantidade >= item.disponivelCentral && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                    Estoque máximo: {item.disponivelCentral} un
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="border-t p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-bold text-primary tabular-nums">
              {formatCurrency(valorTotal)}
            </span>
          </div>
          
          <Button 
            onClick={onCriarCarga}
            disabled={isPending}
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
            ) : (
              <>
                <Truck className="h-5 w-5" />
                Criar Carga
              </>
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
