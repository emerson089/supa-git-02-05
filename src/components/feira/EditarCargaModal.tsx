import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Search, X, Plus, Trash2, Loader2, Package, Check, Layers, AlertTriangle } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { TransferenciaComItensHistorico } from '@/hooks/useFeiraHistorico';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { groupItensByModel, parseProductName } from '@/utils/productNameUtils';
import { AddGradeCargaModal } from './AddGradeCargaModal';

interface ItemEdicao {
  itemId: string;
  nome: string;
  quantidade: number;
  quantidadeOriginal: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
  isNovo: boolean;
  modeloId?: string | null;
}

interface Produto {
  id: string;
  nome: string;
  quantidade?: number;
  precoUnitario: number | null;
  imagemUrl?: string | null;
  modeloId?: string | null;
}

interface EditarCargaModalProps {
  carga: TransferenciaComItensHistorico | null;
  produtos: Produto[];
  getDisponivelCentral: (itemId: string) => number;
  onClose: () => void;
  onSalvar: (transferenciaId: string, itens: ItemEdicao[], observacoes: string) => void;
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
  const [observacoes, setObservacoes] = useState('');
  const [addGradeOpen, setAddGradeOpen] = useState(false);
  const [showDraftAlert, setShowDraftAlert] = useState(false);
  
  // STORAGE KEY
  const STORAGE_KEY = carga ? `df_edit_carga_${carga.id}` : null;

  // Retorna o disponível no central com fallback para estoque_itens quando não há
  // registro em estoque_por_local (evita "Máximo disponível: 0" por dessincronização)
  const getDisponivel = (itemId: string): number => {
    const fromLocal = getDisponivelCentral(itemId);
    if (fromLocal > 0) return fromLocal;
    return produtos.find(p => p.id === itemId)?.quantidade ?? 0;
  };

  // Inicializar itens quando a carga muda (sem getDisponivelCentral na deps para
  // evitar reset do estado a cada re-render do pai)
  useEffect(() => {
    if (carga && STORAGE_KEY) {
      // 1. Sempre carregar os dados oficiais inicialmente
      const serverItens = carga.itens.map((item) => ({
        itemId: item.itemId,
        nome: item.produtoNome || `Item #${item.itemId.slice(0, 8)}`,
        quantidade: item.quantidadeEnviada,
        quantidadeOriginal: item.quantidadeEnviada,
        precoUnitario: item.precoUnitario ?? item.produtoPreco ?? 0,
        disponivelCentral: getDisponivel(item.itemId) + item.quantidadeEnviada,
        imagemUrl: item.produtoImagem ?? null,
        isNovo: false,
        modeloId: item.modeloId,
      }));

      setItensEdicao(serverItens);
      setObservacoes(carga.observacoes || '');
      setBuscaProduto('');

      // 2. Verificar se existe rascunho divergente
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          const draftItens = data.itens || [];
          
          // Comparação simples: se a quantidade de itens ou a soma de peças for diferente, mostramos o alerta
          const serverTotal = serverItens.reduce((sum, i) => sum + i.quantidade, 0);
          const draftTotal = draftItens.reduce((sum, i: any) => sum + i.quantidade, 0);
          
          if (serverTotal !== draftTotal || serverItens.length !== draftItens.length) {
            setShowDraftAlert(true);
          }
        } catch (e) {
          console.error('Erro ao verificar rascunho:', e);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carga, STORAGE_KEY]);

  // Função para recuperar rascunho
  const handleRecoverDraft = () => {
    if (!STORAGE_KEY) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setItensEdicao(data.itens || []);
        setObservacoes(data.observacoes || '');
        setShowDraftAlert(false);
        toast.success('Alterações não salvas foram recuperadas!');
      } catch (e) {
        toast.error('Erro ao recuperar rascunho');
      }
    }
  };

  // Função para descartar rascunho
  const handleDiscardDraft = () => {
    if (STORAGE_KEY) {
      localStorage.removeItem(STORAGE_KEY);
      setShowDraftAlert(false);
      toast.info('Rascunho descartado');
    }
  };

  // Salvar rascunho no localStorage
  useEffect(() => {
    if (STORAGE_KEY && (itensEdicao.length > 0 || observacoes)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        itens: itensEdicao,
        observacoes
      }));
    }
  }, [itensEdicao, observacoes, STORAGE_KEY]);

  // Funçao para limpar rascunho local
  const clearDraft = () => {
    if (STORAGE_KEY) localStorage.removeItem(STORAGE_KEY);
  };

  // Agrupar itens para exibição (fonte de verdade continua sendo itensEdicao)
  const gruposExibicao = useMemo(() =>
    groupItensByModel(itensEdicao, {
      getItemId: (i) => i.itemId,
      getItemNome: (i) => i.nome,
      getItemPreco: (i) => i.precoUnitario,
      getItemQtd: (i) => i.quantidade,
      getItemImagem: (i) => i.imagemUrl,
      getItemReferencia: (i) => i.nome,
      getItemModeloId: (i) => i.modeloId,
    }),
    [itensEdicao]
  );

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
    const disponivel = getDisponivel(produto.id);
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
        quantidadeOriginal: 0,
        precoUnitario: produto.precoUnitario || 0,
        disponivelCentral: disponivel,
        imagemUrl: produto.imagemUrl ?? null,
        isNovo: true,
        modeloId: produto.modeloId,
      },
    ]);
    toast.success(`${produto.nome} adicionado`);
  };

  const handleAddByGrade = (items: { itemId: string; nome: string; quantidade: number; precoUnitario: number; disponivelCentral: number; imagemUrl: string | null; modeloId?: string | null }[]) => {
    setItensEdicao(prev => {
      const result = [...prev];
      items.forEach(item => {
        const existingIdx = result.findIndex(i => i.itemId === item.itemId);
        if (existingIdx >= 0) {
          const existing = result[existingIdx];
          const maxQtd = getDisponivel(item.itemId) + existing.quantidadeOriginal;
          result[existingIdx] = { ...existing, quantidade: Math.min(existing.quantidade + item.quantidade, maxQtd) };
        } else {
          result.push({
            itemId: item.itemId,
            nome: item.nome,
            quantidade: item.quantidade,
            quantidadeOriginal: 0,
            precoUnitario: item.precoUnitario,
            disponivelCentral: item.disponivelCentral,
            imagemUrl: item.imagemUrl,
            isNovo: true,
            modeloId: item.modeloId,
          });
        }
      });
      return result;
    });
    setAddGradeOpen(false);
    toast.success(`${items.length} variações adicionadas por grade`);
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

  const handleRemoveGrupo = (ids: string[]) => {
    setItensEdicao((prev) => prev.filter(i => !ids.includes(i.itemId)));
  };

  const handleSalvar = () => {
    if (!carga || itensEdicao.length === 0) return;

    const itensInvalidos = itensEdicao.filter((i) => i.quantidade < 1);
    if (itensInvalidos.length > 0) {
      toast.error('Todos os itens devem ter quantidade mínima de 1');
      return;
    }

    clearDraft();
    onSalvar(carga.id, itensEdicao, observacoes);
  };

  const totalPecas = itensEdicao.reduce((sum, i) => sum + i.quantidade, 0);
  const valorTotal = itensEdicao.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0);

  const temMudancas = useMemo(() => {
    if (!carga) return false;
    const temNovos = itensEdicao.some((i) => i.isNovo);
    if (temNovos) return true;
    const idsAtuais = new Set(itensEdicao.map((i) => i.itemId));
    if (carga.itens.some((i) => !idsAtuais.has(i.itemId))) return true;
    if (observacoes.trim() !== (carga.observacoes || '').trim()) return true;
    return itensEdicao.some((i) => i.quantidade !== i.quantidadeOriginal);
  }, [carga, itensEdicao, observacoes]);

  if (!carga) return null;

  return (
    <>
      <Dialog open={!!carga} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl sm:h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Carga
            </DialogTitle>
            <DialogDescription>
              Adicione, remova ou altere quantidades dos itens da carga
            </DialogDescription>
          </DialogHeader>

          {showDraftAlert && (
            <div className="mx-6 mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                <AlertTriangle size={18} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-none">Rascunho Detectado</p>
                  <p className="text-[10px] mt-1 leading-tight opacity-90">Você tem alterações não salvas que divergem dos dados desta carga.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] bg-white dark:bg-background border-amber-300 hover:bg-amber-100" 
                  onClick={handleRecoverDraft}
                >
                  Recuperar Alterações
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-[10px] text-amber-700 dark:text-amber-500 hover:bg-amber-100" 
                  onClick={handleDiscardDraft}
                >
                  Descartar
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Campo de Nome da Carga */}
            <div className="px-4 py-3 border-b bg-primary/5 flex flex-col gap-1.5">
              <label htmlFor="carga-nome" className="text-[10px] uppercase font-bold text-primary tracking-wider">
                Nome / Título da Carga
              </label>
              <div className="relative">
                <Pencil className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary opacity-50" />
                <Input
                  id="carga-nome"
                  placeholder="Ex: Carga 001, Feira de Quarta..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="pl-9 bg-background h-9 text-sm font-semibold border-primary/20 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            {/* Barra de ações: busca + adicionar por grade */}
            <div className="px-4 py-3 border-b bg-muted/30 flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto avulso para adicionar..."
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => setAddGradeOpen(true)}
              >
                <Layers className="h-4 w-4" />
                Por Grade
              </Button>
            </div>

            {/* Lista de produtos para adicionar (busca individual) */}
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

            {/* Itens da Carga agrupados por modelo */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between border-b bg-primary/5 sticky top-0 z-10">
                <span className="text-xs font-medium text-primary uppercase tracking-wide">
                  Itens na Carga ({gruposExibicao.length} modelo{gruposExibicao.length !== 1 ? 's' : ''})
                </span>
                <span className="text-xs text-muted-foreground">
                  {gruposExibicao.length} mod • {totalPecas} pç • {formatCurrency(valorTotal)}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
                {gruposExibicao.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">Nenhum item na carga</p>
                    <p className="text-xs">Use a busca ou "Por Grade" para adicionar</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {gruposExibicao.map((grupo) => {
                      const temNovo = (grupo.itens as ItemEdicao[]).some(i => i.isNovo);
                      return (
                        <div key={`${grupo.refBase}-${grupo.valorUnitario}`} className="px-4 py-3 bg-card">
                          <div className="flex items-start gap-3">
                            {/* Imagem */}
                            <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0 border relative mt-0.5">
                              <LotImage src={grupo.imagemUrl} alt={grupo.nomeBase} className="w-full h-full object-cover" eager={true} />
                              {temNovo && (
                                <Badge className="absolute -top-1 -right-1 h-4 px-1 text-[10px] bg-emerald-500">Novo</Badge>
                              )}
                            </div>

                            {/* Nome + chips de tamanho */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{grupo.nomeExibicao}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {(grupo.itens as ItemEdicao[]).map(item => {
                                  const info = parseProductName(item.nome, item.nome);
                                  const tam = info.tamanho
                                    || item.nome.split(/[-–—]/).pop()?.trim()
                                    || '?';
                                  return (
                                    <div
                                      key={item.itemId}
                                      className="flex items-center gap-0.5 bg-muted rounded px-1.5 py-0.5"
                                    >
                                      <span className="text-[10px] font-mono font-bold text-muted-foreground">TAM</span>
                                      <span className="text-[10px] font-mono font-bold text-primary">{tam}</span>
                                      <span className="text-[10px] text-muted-foreground mx-0.5">•</span>
                                      <span className="text-[10px] font-mono font-bold text-muted-foreground italic">QTD</span>
                                      <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={item.quantidade || ''}
                                        onChange={e => {
                                          const v = e.target.value.replace(/\D/g, '');
                                          handleUpdateQuantidade(item.itemId, v === '' ? 0 : parseInt(v));
                                        }}
                                        onBlur={e => {
                                          if ((parseInt(e.target.value) || 0) < 1) handleUpdateQuantidade(item.itemId, 1);
                                        }}
                                        onFocus={e => e.target.select()}
                                        onClick={e => e.stopPropagation()}
                                        className="w-8 h-5 text-center text-[10px] border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Subtotal + lixeira */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-semibold text-primary">
                                {formatCurrency(grupo.subtotal)}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleRemoveGrupo(grupo.ids);
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

      <AddGradeCargaModal
        open={addGradeOpen}
        onClose={() => setAddGradeOpen(false)}
        onAdd={handleAddByGrade}
        getDisponivelCentral={getDisponivelCentral}
      />
    </>
  );
}
