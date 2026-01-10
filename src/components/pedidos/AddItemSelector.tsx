import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Produto {
  id: string;
  nome: string;
  preco_unitario: number | null;
  quantidade: number;
  referencia?: string;
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

  // Filter products: only finished products with stock, not already in order
  const availableProdutos = useMemo(() => {
    return produtos.filter(p => 
      p.quantidade > 0 && 
      !existingProductIds.includes(p.id)
    );
  }, [produtos, existingProductIds]);

  // Filter by search term
  const filteredProdutos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return availableProdutos;
    
    return availableProdutos.filter(p => {
      const matchesName = p.nome.toLowerCase().includes(term);
      const matchesRef = p.referencia?.toLowerCase().includes(term);
      return matchesName || matchesRef;
    });
  }, [availableProdutos, searchTerm]);

  // Close dropdown on outside click
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

  // Focus input when opened
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

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isAdding || availableProdutos.length === 0}
        className={cn(
          "w-full h-12 justify-between rounded-xl border-dashed border-2 border-primary/30",
          "hover:border-primary hover:bg-primary/5 transition-all",
          isOpen && "border-primary bg-primary/5"
        )}
      >
        <span className="flex items-center gap-2 text-primary">
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isAdding ? 'Adicionando...' : 'Adicionar Modelo'}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 text-primary transition-transform",
          isOpen && "rotate-180"
        )} />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar por nome ou referência..."
                className="w-full h-10 pl-9 pr-4 bg-muted/50 rounded-lg border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Products List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredProdutos.length === 0 ? (
              <div className="py-6 px-4 text-center text-muted-foreground text-sm">
                {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
              </div>
            ) : (
              filteredProdutos.map((produto) => (
                <div
                  key={produto.id}
                  className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/30 last:border-0"
                  onClick={() => handleSelect(produto)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {produto.referencia ? `${produto.referencia} - ` : ''}{produto.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {produto.quantidade} em estoque
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-semibold text-primary">
                      {produto.preco_unitario ? formatCurrency(produto.preco_unitario) : 'Sem preço'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
