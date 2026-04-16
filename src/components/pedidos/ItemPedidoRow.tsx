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
  valorOriginal?: number;
  quantidadeDisponivel?: number;
  // Campos opcionales para itens de grade
  tipo?: 'avulso' | 'grade';
  gradeId?: string;
  gradeNome?: string;
  quantidadeGrades?: number;      // quantas grades foram pedidas
  gradeTotalPecas?: number;       // peças por grade
  modeloId?: string;              // id do modelo pai
  modeloNome?: string;
  // Itens expandidos: preenchido ao criar pedido (uma entrada por variação)
  gradeItensExpandidos?: { variacaoId: string; tamanho: string; quantidade: number }[];
}

interface ItemPedidoRowProps {
  item: ItemPedido;
  produtos: {
    id: string;
    nome: string;
    preco: number;
    quantidadeDisponivel: number;
    referencia?: string;
    totalModelEstoque?: number;
    refBase?: string;
    tamanho?: string;
    gradeReserved?: number;
  }[];
  onUpdate: (item: ItemPedido) => void;
  onRemove: (id: string) => void;
  autoFocus?: boolean;
  onAutoFocusComplete?: () => void;
  availableOverride?: number;
}

export function ItemPedidoRow({ item, produtos, onUpdate, onRemove, autoFocus, onAutoFocusComplete, availableOverride }: ItemPedidoRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const total = item.quantidade * item.valorUnitario;

  // Verificar disponibilidade — usa availableOverride quando fornecido (desconta carrinho)
  const produtoSelecionado = produtos.find(p => p.id === item.produtoId);
  const quantidadeDisponivel = availableOverride ?? (produtoSelecionado?.quantidadeDisponivel || 0);
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

  // Auto-focus quando o item é criado (inserido no topo)
  useEffect(() => {
    if (autoFocus) {
      // Abrir dropdown e focar no input
      setIsOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
        onAutoFocusComplete?.();
      }, 50);
    }
  }, [autoFocus, onAutoFocusComplete]);

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    onUpdate({
      ...item,
      produtoId,
      produtoNome: produto?.nome || '',
      valorUnitario: produto?.preco || 0,
      valorOriginal: produto?.preco || 0,
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
    <div
      ref={rowRef}
      className={cn(
        "neu-card p-6 space-y-4",
        isOpen && "relative z-[100]"
      )}
    >
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
                <div className="flex items-center justify-between w-full px-4 h-full">
                  <div className="flex flex-col items-start min-w-0 flex-1 justify-center py-1">
                    {item.produtoId ? (
                      <>
                        <span className="text-sm font-medium text-foreground truncate w-full text-left">
                          {(() => {
                            let nomeStr = produtoSelecionado?.nome || item.produtoNome || 'Produto';
                            const t = produtoSelecionado?.tamanho || '';
                            if (t && !/^(PEÇAS)$/i.test(t) && !nomeStr.includes(t)) {
                              nomeStr = `${nomeStr} — ${t}`;
                            }
                            return nomeStr;
                          })() /* Standardized Display */}
                        </span>
                        {(produtoSelecionado?.refBase || produtoSelecionado?.referencia) && (
                          <span className="text-[10px] text-muted-foreground mt-0.5 truncate w-full text-left font-medium">
                            REF {(produtoSelecionado?.refBase || produtoSelecionado?.referencia || "").slice(-3)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Selecione um produto</span>
                    )}
                  </div>
                  <ChevronDown size={16} className="text-muted-foreground flex-shrink-0 ml-2" />
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
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {produto.nome}
                          {produto.tamanho && !/^(PEÇAS)$/i.test(produto.tamanho) && (
                            <span className="text-muted-foreground font-normal"> — {produto.tamanho}</span>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 truncate uppercase tracking-tight">
                          {(() => {
                            const refToDisplay = produto.refBase || produto.referencia || "";
                            const lastThree = refToDisplay ? refToDisplay.slice(-3) : '';
                            const refDisplay = lastThree ? `REF ${lastThree} · ` : '';
                            
                            if (produto.quantidadeDisponivel === 0) {
                              return refDisplay + (produto.gradeReserved ? 'Todos em grade' : 'Esgotado');
                            }
                            
                            const count = produto.quantidadeDisponivel;
                            const statusText = produto.gradeReserved ? 'FORA DA GRADE' : 'EM ESTOQUE';
                            
                            return (
                              <>
                                {refDisplay}
                                <span className="font-extrabold italic">
                                  <span className="text-red-600">{count}</span>
                                  <span className="text-foreground"> {statusText}</span>
                                </span>
                              </>
                            );
                          })()}
                        </span>
                      </div>
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
                  {produtoSelecionado?.gradeReserved ? 'Todos em grade' : 'Esgotado'}
                </p>
              ) : estoqueInsuficiente ? (
                <p className="text-[10px] uppercase tracking-wider text-destructive flex items-center gap-1">
                  <AlertCircle size={10} />
                  Insuficiente ({quantidadeDisponivel} disp.)
                </p>
              ) : (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {produtoSelecionado?.gradeReserved
                    ? `${quantidadeDisponivel} fora da grade`
                    : `${quantidadeDisponivel} disponíveis`}
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
