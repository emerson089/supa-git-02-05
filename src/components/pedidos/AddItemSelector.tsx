import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, ChevronDown, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Produto {
  id: string;
  nome: string;
  preco_unitario: number | null;
  quantidade: number;
  referencia?: string;
  tamanho?: string;
  totalModelEstoque?: number;
  refBase?: string;
}

interface AddItemSelectorProps {
  produtos: Produto[];
  onAdd: (produto: Produto) => Promise<void>;
  isAdding: boolean;
  existingProductIds: string[];
}

export function AddItemSelector({ produtos, onAdd, isAdding, existingProductIds }: AddItemSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableProdutos = useMemo(() => {
    return produtos.filter(p =>
      p.quantidade > 0 &&
      !existingProductIds.includes(p.id)
    );
  }, [produtos, existingProductIds]);

  const filteredProdutos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return availableProdutos;
    return availableProdutos.filter(p =>
      p.nome.toLowerCase().includes(term) ||
      p.referencia?.toLowerCase().includes(term) ||
      p.tamanho?.toLowerCase().includes(term)
    );
  }, [availableProdutos, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = async (produto: Produto) => {
    await onAdd(produto);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredProdutos.length > 0) {
      e.preventDefault();
      handleSelect(filteredProdutos[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isAdding || availableProdutos.length === 0}
        className={cn(
          "w-full h-11 justify-between rounded-xl border-dashed border-2 border-primary/30",
          "hover:border-primary hover:bg-primary/5 transition-all",
          isOpen && "border-primary bg-primary/5"
        )}
      >
        <span className="flex items-center gap-2 text-primary font-medium">
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isAdding ? 'Adicionando...' : `Adicionar item${availableProdutos.length > 0 ? ` (${availableProdutos.length} disponíveis)` : ''}`}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-primary/60 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar por nome, referência ou tamanho..."
                className="w-full h-9 pl-9 pr-4 bg-muted/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto overscroll-contain">
            {filteredProdutos.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                <Package className="h-8 w-8 opacity-30" />
                <p className="text-sm">{searchTerm ? 'Nenhum item encontrado' : 'Nenhum item disponível'}</p>
              </div>
            ) : (
              filteredProdutos.map((produto) => {
                const cleanTamanho = produto.tamanho && !/^(PEÇAS)$/i.test(produto.tamanho)
                  ? produto.tamanho
                  : undefined;
                  
                const refToDisplay = produto.refBase || produto.referencia;
                const totalModelEstoque = produto.totalModelEstoque ?? produto.quantidade;

                return (
                <button
                  key={produto.id}
                  type="button"
                  onClick={() => handleSelect(produto)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/20 last:border-0 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {produto.nome}
                      {cleanTamanho && (
                        <span className="text-muted-foreground font-normal"> — {cleanTamanho}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                      {refToDisplay && `ref ${refToDisplay} · `}{totalModelEstoque} em estoque
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <p className="text-sm font-bold text-primary">
                      {produto.preco_unitario ? formatCurrency(produto.preco_unitario) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      {produto.quantidade} disponível
                    </p>
                  </div>
                </button>
                );
              })
            )}
          </div>

          {filteredProdutos.length > 0 && (
            <div className="px-4 py-2 border-t border-border/50 bg-muted/20">
              <p className="text-xs text-muted-foreground text-center">
                {filteredProdutos.length} {filteredProdutos.length === 1 ? 'item' : 'itens'} — Enter para adicionar o primeiro
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
