import { useState, useMemo, useRef, useEffect } from 'react';
import { Trash2, AlertCircle, ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ItemPedido {
  id: string;
  produtoId: string;
  produtoNome?: string;
  quantidade: number;
  valorUnitario: number;
  quantidadeDisponivel?: number;
}

interface ItemPedidoRowProps {
  item: ItemPedido;
  produtos: { id: string; nome: string; preco: number; quantidadeDisponivel: number; referencia?: string }[];
  onUpdate: (item: ItemPedido) => void;
  onRemove: (id: string) => void;
}

export function ItemPedidoRow({ item, produtos, onUpdate, onRemove }: ItemPedidoRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const total = item.quantidade * item.valorUnitario;
  
  // Verificar disponibilidade
  const produtoSelecionado = produtos.find(p => p.id === item.produtoId);
  const quantidadeDisponivel = produtoSelecionado?.quantidadeDisponivel || 0;
  const estoqueInsuficiente = item.produtoId && item.quantidade > quantidadeDisponivel;
  const esgotado = produtoSelecionado && quantidadeDisponivel === 0;

  // Filtrar produtos baseado na busca (nome ou referência)
  const filteredProdutos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      return produtos.filter(p => p.quantidadeDisponivel > 0 || p.id === item.produtoId);
    }
    return produtos.filter(p => {
      const matchesName = p.nome.toLowerCase().includes(term);
      const matchesRef = p.referencia?.toLowerCase().includes(term);
      const hasStock = p.quantidadeDisponivel > 0 || p.id === item.produtoId;
      return (matchesName || matchesRef) && hasStock;
    });
  }, [produtos, searchTerm, item.produtoId]);

  // Fechar dropdown ao clicar fora
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

  // Focar no input ao abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    onUpdate({
      ...item,
      produtoId,
      produtoNome: produto?.nome || '',
      valorUnitario: produto?.preco || 0,
      quantidadeDisponivel: produto?.quantidadeDisponivel || 0,
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleQuantidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const quantidade = parseInt(e.target.value) || 0;
    onUpdate({ ...item, quantidade });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorUnitario = parseFloat(e.target.value) || 0;
    onUpdate({ ...item, valorUnitario });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getDisplayText = () => {
    if (!produtoSelecionado) return '';
    const ref = produtoSelecionado.referencia || '';
    return ref ? `${ref} - ${produtoSelecionado.nome}` : produtoSelecionado.nome;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredProdutos.length > 0) {
      e.preventDefault();
      handleProdutoChange(filteredProdutos[0].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className={cn(
      "neu-card p-6 space-y-4",
      isOpen && "relative z-[100]"
    )}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Modelo - Combobox */}
        <div className="lg:col-span-5 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modelo</Label>
          <div className="relative" ref={dropdownRef}>
            {/* Trigger / Search Input */}
            <div
              className={cn(
                "h-12 rounded-xl neu-input border-0 bg-background flex items-center cursor-pointer transition-all",
                isOpen && "ring-2 ring-primary/30"
              )}
              onClick={() => setIsOpen(true)}
            >
              {isOpen ? (
                <div className="flex items-center w-full px-4 gap-2">
                  <Search size={16} className="text-muted-foreground/60 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar por nome ou referência..."
                    className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between w-full px-4">
                  <span className={cn(
                    "text-sm truncate",
                    item.produtoId ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {item.produtoId ? getDisplayText() : "Selecione um produto"}
                  </span>
                  <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
                </div>
              )}
            </div>

            {/* Dropdown */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-[200] max-h-64 overflow-y-auto">
                {filteredProdutos.length === 0 ? (
                  <div className="py-4 px-4 text-center text-muted-foreground text-sm">
                    {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                  </div>
                ) : (
                  filteredProdutos.map((produto) => (
                    <div
                      key={produto.id}
                      className={cn(
                        "px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between",
                        produto.id === item.produtoId && "bg-primary/10",
                        produto.quantidadeDisponivel === 0 && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => produto.quantidadeDisponivel > 0 && handleProdutoChange(produto.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {produto.referencia ? `${produto.referencia} - ` : ''}{produto.nome}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 ml-3 flex-shrink-0">
                        {produto.quantidadeDisponivel === 0 
                          ? 'Esgotado' 
                          : `${produto.quantidadeDisponivel} em estoque`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* Indicador discreto de disponibilidade */}
          {item.produtoId && (
            <div className="flex justify-end">
              {esgotado ? (
                <p className="text-[10px] uppercase tracking-wider text-destructive flex items-center gap-1">
                  <AlertCircle size={10} />
                  Esgotado
                </p>
              ) : estoqueInsuficiente ? (
                <p className="text-[10px] uppercase tracking-wider text-destructive flex items-center gap-1">
                  <AlertCircle size={10} />
                  Insuficiente ({quantidadeDisponivel} disp.)
                </p>
              ) : (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {quantidadeDisponivel} disponíveis
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quantidade */}
        <div className="lg:col-span-2 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qtd (peças)</Label>
          <Input
            type="number"
            min={1}
            max={quantidadeDisponivel || undefined}
            value={item.quantidade || ''}
            onChange={handleQuantidadeChange}
            placeholder="1"
            className={cn(
              "h-12 rounded-xl neu-input border-0 bg-background text-center text-lg font-semibold",
              estoqueInsuficiente && "ring-2 ring-destructive/50 border-destructive"
            )}
          />
        </div>

        {/* Valor Unitário */}
        <div className="lg:col-span-2 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Unit. (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={item.valorUnitario || ''}
            onChange={handleValorChange}
            placeholder="0.00"
            className="h-12 rounded-xl neu-input border-0 bg-background text-right text-lg font-semibold text-primary"
          />
          {item.valorUnitario > 0 && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 text-right">
              {produtoSelecionado && item.valorUnitario !== produtoSelecionado.preco 
                ? 'Valor editado' 
                : 'Auto do estoque'}
            </p>
          )}
        </div>

        {/* Valor Total */}
        <div className="lg:col-span-2 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Total</Label>
          <Input
            type="text"
            readOnly
            value={formatCurrency(total)}
            className="h-12 rounded-xl neu-input border-0 bg-background text-right cursor-default text-lg font-bold text-emerald-600"
          />
        </div>

        {/* Remove Button */}
        <div className="lg:col-span-1 flex justify-end items-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(item.id)}
            className="h-12 w-12 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
