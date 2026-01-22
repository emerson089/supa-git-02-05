import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Search, X, Plus, Trash2, Loader2, Package, Check } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { TransferenciaComItensHistorico } from '@/hooks/useFeiraHistorico';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ItemEdicao {
  itemId: string;
  nome: string;
  quantidade: number;
  quantidadeOriginal: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
  isNovo: boolean;
}

interface Produto {
  id: string;
  nome: string;
  precoUnitario: number | null;
  imagemUrl?: string | null;
}

interface EditarCargaModalProps {
  carga: TransferenciaComItensHistorico | null;
  produtos: Produto[];
  getDisponivelCentral: (itemId: string) => number;
  onClose: () => void;
  onSalvar: (transferenciaId: string, itens: ItemEdicao[]) => void;
  isPending: boolean;
  formatCurrency: (value: number) => string;
}

export function EditarCargaModal({
  carga,
  produtos,
  getDisponivelCentral,
  onClose,
  onSalvar,
  isPending,
  formatCurrency,
}: EditarCargaModalProps) {
  const [itensEdicao, setItensEdicao] = useState<ItemEdicao[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');

  // Inicializar itens quando a carga muda
  useEffect(() => {
    if (carga) {
      setItensEdicao(
        carga.itens.map((item) => ({
          itemId: item.itemId,
          nome: item.produtoNome || `Item #${item.itemId.slice(0, 8)}`,
          quantidade: item.quantidadeEnviada,
          quantidadeOriginal: item.quantidadeEnviada,
          precoUnitario: item.precoUnitario ?? item.produtoPreco ?? 0,
          disponivelCentral: getDisponivelCentral(item.itemId) + item.quantidadeEnviada, // Disponível = Central + já na carga
          imagemUrl: item.produtoImagem ?? null,
          isNovo: false,
        }))
      );
      setBuscaProduto('');
    }
  }, [carga, getDisponivelCentral]);

  // Produtos filtrados que ainda não estão na carga
  const produtosFiltrados = useMemo(() => {
    const idsNaCarga = new Set(itensEdicao.map((i) => i.itemId));
    let filtered = produtos.filter((p) => !idsNaCarga.has(p.id));

    if (buscaProduto.trim()) {
      const termo = buscaProduto.toLowerCase().trim();
      filtered = filtered.filter((p) => p.nome.toLowerCase().includes(termo));
    }

    return filtered;
  }, [produtos, itensEdicao, buscaProduto]);

  const handleAddItem = (produto: Produto) => {
    const disponivel = getDisponivelCentral(produto.id);
    if (disponivel <= 0) {
      toast.error('Produto sem estoque disponível no Central');
      return;
    }

    setItensEdicao((prev) => [
      ...prev,
      {
        itemId: produto.id,
        nome: produto.nome,
        quantidade: 1,
        quantidadeOriginal: 0, // Novo item, não existia antes
        precoUnitario: produto.precoUnitario || 0,
        disponivelCentral: disponivel,
        imagemUrl: produto.imagemUrl ?? null,
        isNovo: true,
      },
    ]);
    toast.success(`${produto.nome} adicionado`);
  };

  const handleUpdateQuantidade = (itemId: string, novaQuantidade: number) => {
    setItensEdicao((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          if (isNaN(novaQuantidade) || novaQuantidade < 0) {
            return { ...item, quantidade: 0 };
          }
          if (novaQuantidade > item.disponivelCentral) {
            toast.warning(`Máximo disponível: ${item.disponivelCentral}`);
            return { ...item, quantidade: item.disponivelCentral };
          }
          return { ...item, quantidade: novaQuantidade };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItensEdicao((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  const handleSalvar = () => {
    if (!carga || itensEdicao.length === 0) return;

    // Validar quantidades mínimas
    const itensInvalidos = itensEdicao.filter((i) => i.quantidade < 1);
    if (itensInvalidos.length > 0) {
      toast.error('Todos os itens devem ter quantidade mínima de 1');
      return;
    }

    onSalvar(carga.id, itensEdicao);
  };

  const totalPecas = itensEdicao.reduce((sum, i) => sum + i.quantidade, 0);
  const valorTotal = itensEdicao.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0);

  // Detectar mudanças
  const temMudancas = useMemo(() => {
    if (!carga) return false;

    // Verificar se tem itens novos
    const temNovos = itensEdicao.some((i) => i.isNovo);
    if (temNovos) return true;

    // Verificar se algum item foi removido
    const idsOriginais = new Set(carga.itens.map((i) => i.itemId));
    const idsAtuais = new Set(itensEdicao.map((i) => i.itemId));
    if (carga.itens.some((i) => !idsAtuais.has(i.itemId))) return true;

    // Verificar se quantidades mudaram
    return itensEdicao.some((i) => i.quantidade !== i.quantidadeOriginal);
  }, [carga, itensEdicao]);

  if (!carga) return null;

  return (
    <Dialog open={!!carga} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl sm:h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Carga
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Adicione, remova ou altere quantidades dos itens da carga
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Campo de Busca para adicionar novos produtos */}
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto para adicionar..."
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                className="pl-9 pr-9 bg-background"
              />
              {buscaProduto && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setBuscaProduto('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Lista de produtos para adicionar */}
          {buscaProduto && (
            <div className="border-b">
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/20">
                Produtos Disponíveis ({produtosFiltrados.length})
              </div>
              <ScrollArea className="h-[150px]">
                {produtosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <Package className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Nenhum produto encontrado</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {produtosFiltrados.slice(0, 10).map((produto) => {
                      const disponivel = getDisponivelCentral(produto.id);
                      const semEstoque = disponivel <= 0;

                      return (
                        <div
                          key={produto.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 transition-all',
                            semEstoque && 'opacity-50 cursor-not-allowed',
                            !semEstoque && 'hover:bg-muted/30 cursor-pointer'
                          )}
                          onClick={() => !semEstoque && handleAddItem(produto)}
                        >
                          <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0 border">
                            <LotImage src={produto.imagemUrl} alt={produto.nome} className="w-full h-full object-cover" eager={true} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{produto.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn('text-xs font-medium', disponivel > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                                Disp: {disponivel}
                              </span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">{formatCurrency(produto.precoUnitario || 0)}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {semEstoque ? (
                              <Badge variant="outline" className="text-muted-foreground">Sem estoque</Badge>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary">
                                <Plus size={18} />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Itens da Carga */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-4 py-2 flex items-center justify-between border-b bg-primary/5 sticky top-0 z-10">
              <span className="text-xs font-medium text-primary uppercase tracking-wide">
                Itens na Carga ({itensEdicao.length})
              </span>
              <span className="text-xs text-muted-foreground">
                {totalPecas} pç • {formatCurrency(valorTotal)}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
              {itensEdicao.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">Nenhum item na carga</p>
                  <p className="text-xs">Use a busca acima para adicionar produtos</p>
                </div>
              ) : (
                <div className="divide-y">
                  {itensEdicao.map((item) => (
                    <div key={item.itemId} className="flex items-center gap-3 px-4 py-2.5 bg-card">
                      <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0 border relative">
                        <LotImage src={item.imagemUrl} alt={item.nome} className="w-full h-full object-cover" eager={true} />
                        {item.isNovo && (
                          <Badge className="absolute -top-1 -right-1 h-4 px-1 text-[10px] bg-emerald-500">Novo</Badge>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.precoUnitario)} × {item.quantidade}
                          {item.quantidadeOriginal > 0 && item.quantidade !== item.quantidadeOriginal && (
                            <span className="ml-2 text-amber-600">
                              (era {item.quantidadeOriginal})
                            </span>
                          )}
                        </p>
                      </div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.quantidade || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          handleUpdateQuantidade(item.itemId, val === '' ? 0 : parseInt(val));
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          if (val < 1) handleUpdateQuantidade(item.itemId, 1);
                        }}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 h-8 text-center text-base md:text-sm font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm font-semibold text-primary w-20 text-right">
                        {formatCurrency(item.precoUnitario * item.quantidade)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.itemId);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3 bg-muted/30 gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={itensEdicao.length === 0 || !temMudancas || isPending}
            className="min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : !temMudancas ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Sem alterações
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
