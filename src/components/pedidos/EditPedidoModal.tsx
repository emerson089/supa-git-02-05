import { useState, useMemo } from 'react';
import { Loader2, Package, DollarSign, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableItemRow, EditableItem } from './EditableItemRow';
import { AddItemSelector } from './AddItemSelector';
import { useAddPedidoItem, useUpdatePedidoItem, useRemovePedidoItem } from '@/hooks/usePedidoItensData';
import { useEstoque } from '@/contexts/EstoqueContext';
import { toast } from 'sonner';

interface PedidoData {
  id: string;
  cliente_nome: string;
  total_pecas: number;
  valor_total: number;
  itens: EditableItem[];
}

interface EditPedidoModalProps {
  pedido: PedidoData | null;
  open: boolean;
  onClose: () => void;
}

export function EditPedidoModal({ pedido, open, onClose }: EditPedidoModalProps) {
  const { itens: estoqueItens, updateItem: updateEstoqueItem } = useEstoque();
  
  const addItemMutation = useAddPedidoItem();
  const updateItemMutation = useUpdatePedidoItem();
  const removeItemMutation = useRemovePedidoItem();

  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  // Filter finished products from inventory
  const produtosAcabados = useMemo(() => {
    return estoqueItens
      .filter(item => item.tipo === 'acabado')
      .map(item => ({
        id: item.id,
        nome: item.nome,
        preco_unitario: item.precoUnitario || 0,
        quantidade: item.quantidade,
        referencia: item.localizacao || undefined,
      }));
  }, [estoqueItens]);

  // Get existing product IDs in the order
  const existingProductIds = useMemo(() => {
    if (!pedido) return [];
    return pedido.itens
      .map(item => {
        // Try to find matching product in inventory by name
        const match = produtosAcabados.find(p => p.nome === item.produto_nome);
        return match?.id;
      })
      .filter(Boolean) as string[];
  }, [pedido, produtosAcabados]);

  const isSyncing = addItemMutation.isPending || updateItemMutation.isPending || removeItemMutation.isPending;

  const handleUpdateItem = async (itemId: string, data: { quantidade?: number; valor_unitario?: number }) => {
    if (!pedido) return;
    
    const itemAtual = pedido.itens.find(i => i.id === itemId);
    if (!itemAtual) return;

    setUpdatingItemId(itemId);
    try {
      // Se a quantidade mudou, ajustar estoque
      if (data.quantidade !== undefined && data.quantidade !== itemAtual.quantidade) {
        const diferenca = itemAtual.quantidade - data.quantidade; // positivo = devolve, negativo = subtrai
        
        const produtoId = itemAtual.produto_id;
        if (produtoId) {
          const produtoEstoque = estoqueItens.find(
            p => p.tipo === 'acabado' && p.id === produtoId
          );
          if (produtoEstoque) {
            const novaQuantidadeEstoque = produtoEstoque.quantidade + diferenca;
            if (novaQuantidadeEstoque >= 0) {
              await updateEstoqueItem(produtoEstoque.id, {
                quantidade: novaQuantidadeEstoque
              });
            } else {
              toast.error(`Estoque insuficiente! Disponível: ${produtoEstoque.quantidade}`);
              setUpdatingItemId(null);
              return;
            }
          }
        }
      }

      await updateItemMutation.mutateAsync({
        id: itemId,
        pedidoId: pedido.id,
        data,
      });
      toast.success('Item atualizado!');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Erro ao atualizar item');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!pedido) return;
    
    const itemToRemove = pedido.itens.find(i => i.id === itemId);
    if (!itemToRemove) return;

    setRemovingItemId(itemId);
    try {
      // Devolver ao estoque antes de remover
      const produtoId = itemToRemove.produto_id;
      if (produtoId) {
        const produtoEstoque = estoqueItens.find(
          p => p.tipo === 'acabado' && p.id === produtoId
        );
        if (produtoEstoque) {
          await updateEstoqueItem(produtoEstoque.id, {
            quantidade: produtoEstoque.quantidade + itemToRemove.quantidade
          });
        }
      }

      await removeItemMutation.mutateAsync({
        id: itemId,
        pedidoId: pedido.id,
      });
      toast.success(`Item removido! ${itemToRemove.quantidade} peças retornaram ao estoque.`);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Erro ao remover item');
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleAddItem = async (produto: { id: string; nome: string; preco_unitario: number | null; quantidade: number }) => {
    if (!pedido) return;

    try {
      await addItemMutation.mutateAsync({
        pedido_id: pedido.id,
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: 1,
        valor_unitario: produto.preco_unitario || 0,
      });
      toast.success('Item adicionado!');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Erro ao adicionar item');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-foreground">
              Editar Pedido
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {pedido.cliente_nome}
          </p>
        </DialogHeader>

        {/* Totals Banner */}
        <div className="px-6 py-4 bg-muted/30 border-b border-border/50 flex-shrink-0">
          <div className="grid grid-cols-2 gap-4">
            {/* Total Peças */}
            <div className="flex items-center gap-3 p-4 bg-background rounded-xl shadow-sm">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Peças</p>
                <div className="flex items-center gap-2">
                  {isSyncing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <p className="text-2xl font-bold text-primary">{pedido.total_pecas}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Valor Total */}
            <div className="flex items-center gap-3 p-4 bg-background rounded-xl shadow-sm">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor Total</p>
                <div className="flex items-center gap-2">
                  {isSyncing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  ) : (
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(pedido.valor_total)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Itens do Pedido</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <span className="w-16 text-center shrink-0">Qtd</span>
                <span className="w-24 text-center shrink-0">Valor Unit.</span>
                <span className="w-28 text-right shrink-0">Subtotal</span>
                <span className="w-10 shrink-0"></span>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2 pb-4 px-6">
              {pedido.itens.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum item no pedido</p>
                </div>
              ) : (
                pedido.itens.map((item) => (
                  <EditableItemRow
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    isUpdating={updatingItemId === item.id}
                    isRemoving={removingItemId === item.id}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Add Item Section */}
        <div className="px-6 py-4 border-t border-border/50 flex-shrink-0">
          <AddItemSelector
            produtos={produtosAcabados}
            onAdd={handleAddItem}
            isAdding={addItemMutation.isPending}
            existingProductIds={existingProductIds}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
