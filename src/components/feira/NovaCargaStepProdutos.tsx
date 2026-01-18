import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Truck, X, Search, Package, Loader2, Plus, Check, Minus } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Produto {
  id: string;
  nome: string;
  precoUnitario: number | null;
  imagemUrl?: string | null;
}

interface ItemCarga {
  itemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
}

interface NovaCargaStepProdutosProps {
  produtos: Produto[];
  itensCarga: ItemCarga[];
  isLoading: boolean;
  buscaProduto: string;
  onBuscaChange: (value: string) => void;
  onAddItem: (produto: Produto, quantidade: number) => boolean;
  onClose: () => void;
  getDisponivelCentral: (itemId: string) => number;
  formatCurrency: (value: number) => string;
}

export function NovaCargaStepProdutos({
  produtos,
  itensCarga,
  isLoading,
  buscaProduto,
  onBuscaChange,
  onAddItem,
  onClose,
  getDisponivelCentral,
  formatCurrency,
}: NovaCargaStepProdutosProps) {
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1);

  const handleIniciarSelecao = (produtoId: string) => {
    setProdutoSelecionado(produtoId);
    setQuantidadeSelecionada(1);
  };

  const handleCancelarSelecao = () => {
    setProdutoSelecionado(null);
    setQuantidadeSelecionada(1);
  };

  const handleConfirmarAdicao = (produto: Produto, disponivel: number) => {
    const qtdFinal = Math.min(quantidadeSelecionada, disponivel);
    const sucesso = onAddItem(produto, qtdFinal);
    
    if (sucesso) {
      toast.success(
        `${produto.nome.length > 25 ? produto.nome.slice(0, 25) + '...' : produto.nome} (${qtdFinal}x) adicionado`
      );
    }
    
    setProdutoSelecionado(null);
    setQuantidadeSelecionada(1);
  };

  const handleQuantidadeChange = (value: string, disponivel: number) => {
    const val = parseInt(value.replace(/\D/g, '')) || 1;
    if (val > disponivel) {
      toast.error(`Máximo: ${disponivel} unidades`);
      setQuantidadeSelecionada(disponivel);
    } else {
      setQuantidadeSelecionada(Math.max(1, val));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header fixo */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">Nova Carga</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          className="h-9 px-3 text-muted-foreground touch-manipulation"
          onClick={onClose}
        >
          <X className="h-4 w-4 mr-1" />
          Fechar
        </Button>
      </div>

      {/* Campo de busca fixo */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={buscaProduto}
            onChange={(e) => onBuscaChange(e.target.value)}
            autoFocus
            className="pl-9 pr-9 bg-background h-11 text-base"
          />
          {buscaProduto && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => onBuscaChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Label de contagem */}
      <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/20 shrink-0">
        Produtos ({produtos.length})
      </div>

      {/* Lista de produtos - scroll principal */}
      <div className="flex-1 overflow-y-auto pb-36">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : produtos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">Nenhum produto encontrado</p>
            {buscaProduto && (
              <p className="text-xs mt-1">Tente outro termo de busca</p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {produtos.map(produto => {
              const disponivel = getDisponivelCentral(produto.id);
              const jaAdicionado = itensCarga.some(i => i.itemId === produto.id);
              const itemNoCarrinho = itensCarga.find(i => i.itemId === produto.id);
              const semEstoque = disponivel <= 0;
              const estaSelecionado = produtoSelecionado === produto.id;
              
              return (
                <div 
                  key={produto.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors min-h-[72px]",
                    jaAdicionado && "bg-emerald-50/80 dark:bg-emerald-900/20",
                    estaSelecionado && "bg-primary/5",
                    semEstoque && "opacity-50",
                    !jaAdicionado && !semEstoque && !estaSelecionado && "active:bg-muted/50"
                  )}
                >
                  {/* Imagem */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                    <LotImage 
                      src={produto.imagemUrl} 
                      alt={produto.nome} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 leading-tight">
                      {produto.nome}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn(
                        "text-xs font-semibold",
                        disponivel > 0 ? "text-emerald-600" : "text-muted-foreground"
                      )}>
                        Disp: {disponivel}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(produto.precoUnitario || 0)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Ação */}
                  <div className="flex-shrink-0">
                    {jaAdicionado ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs px-2.5 py-1">
                        <Check size={12} className="mr-1" />
                        {itemNoCarrinho?.quantidade}x
                      </Badge>
                    ) : semEstoque ? (
                      <Badge variant="outline" className="text-muted-foreground text-xs">
                        Sem estoque
                      </Badge>
                    ) : estaSelecionado ? (
                      /* Seletor de Quantidade Inline */
                      <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 shrink-0"
                          onClick={() => setQuantidadeSelecionada(q => Math.max(1, q - 1))}
                          disabled={quantidadeSelecionada <= 1}
                        >
                          <Minus size={14} />
                        </Button>
                        
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantidadeSelecionada}
                          onChange={(e) => handleQuantidadeChange(e.target.value, disponivel)}
                          onFocus={(e) => e.target.select()}
                          className="w-12 h-8 text-center text-sm font-semibold px-1"
                        />
                        
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 shrink-0"
                          onClick={() => setQuantidadeSelecionada(q => Math.min(q + 1, disponivel))}
                          disabled={quantidadeSelecionada >= disponivel}
                        >
                          <Plus size={14} />
                        </Button>
                        
                        {/* Confirmar */}
                        <Button 
                          size="icon" 
                          className="h-8 w-8 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleConfirmarAdicao(produto, disponivel)}
                        >
                          <Check size={14} />
                        </Button>
                        
                        {/* Cancelar */}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          onClick={handleCancelarSelecao}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-10 px-3 gap-1.5 touch-manipulation font-medium"
                        onClick={() => handleIniciarSelecao(produto.id)}
                      >
                        <Plus size={16} />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
