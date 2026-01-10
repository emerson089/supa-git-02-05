import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemPedidoRow, ItemPedido } from './ItemPedidoRow';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useMemo } from 'react';

interface ItensPedidoCardProps {
  items: ItemPedido[];
  onAddItem: () => void;
  onUpdateItem: (item: ItemPedido) => void;
  onRemoveItem: (id: string) => void;
}

export function ItensPedidoCard({ items, onAddItem, onUpdateItem, onRemoveItem }: ItensPedidoCardProps) {
  const { getProdutosAcabados } = useEstoque();
  
  // Obter produtos acabados do estoque e transformar para o formato esperado
  const produtos = useMemo(() => {
    const produtosAcabados = getProdutosAcabados();
    return produtosAcabados.map(item => ({
      id: item.id,
      nome: item.nome,
      preco: item.precoUnitario,
      quantidadeDisponivel: item.quantidade
    }));
  }, [getProdutosAcabados]);

  return (
    <div className="neu-card p-7">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/30">
        <h2 className="text-lg font-bold text-foreground">Itens do Pedido</h2>
        <Button
          type="button"
          variant="outline"
          onClick={onAddItem}
          className="h-10 rounded-xl border-border bg-background hover:bg-muted/50 text-foreground font-medium"
        >
          <Plus size={16} className="mr-2" />
          Adicionar Item
        </Button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <p className="text-sm">Nenhum item adicionado</p>
          <p className="text-xs mt-1.5 text-muted-foreground/70">Clique em "Adicionar Item" para começar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ItemPedidoRow
              key={item.id}
              item={item}
              produtos={produtos}
              onUpdate={onUpdateItem}
              onRemove={onRemoveItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
