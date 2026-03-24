import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Package, DollarSign, X, Percent, Check, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableItemRow, EditableItem } from './EditableItemRow';
import { AddItemSelector } from './AddItemSelector';
import { AddGradeModal } from './AddGradeModal';
import { useAddPedidoItem, useUpdatePedidoItem, useRemovePedidoItem } from '@/hooks/usePedidoItensData';
import { GradeCompactCardEditable } from './GradeCompactCardEditable';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useAuth } from '@/contexts/AuthContext';
import { ItemPedido } from './ItemPedidoRow';
import { toast } from 'sonner';

interface PedidoData {
  id: string;
  cliente_nome: string;
  total_pecas: number;
  valor_total: number;
  desconto: number;
  itens: EditableItem[];
}

interface EditPedidoModalProps {
  pedido: PedidoData | null;
  open: boolean;
  onClose: () => void;
}

export function EditPedidoModal({ pedido, open, onClose }: EditPedidoModalProps) {
  const { itens: estoqueItens, updateItem: updateEstoqueItem } = useEstoque();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const addItemMutation = useAddPedidoItem();
  const updateItemMutation = useUpdatePedidoItem();
  const removeItemMutation = useRemovePedidoItem();

  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [localDesconto, setLocalDesconto] = useState(pedido?.desconto ?? 0);
  const [isSavingDesconto, setIsSavingDesconto] = useState(false);
  const [gradeModalOpen, setGradeModalOpen] = useState(false);

  useEffect(() => {
    setLocalDesconto(pedido?.desconto ?? 0);
  }, [pedido?.id, pedido?.desconto]);

  // Filter and group finished products from inventory
  const produtosAcabados = useMemo(() => {
    const acabadosOnly = estoqueItens.filter(item => item.tipo === 'acabado');
    
    // 1. Dicionário de quantidades por modelo pai (Padronizado)
    const estoquePorModeloId = new Map<string, number>();
    acabadosOnly
      .filter(i => i.categoria === 'Modelo Padronizado')
      .forEach(m => estoquePorModeloId.set(m.id, m.quantidade));

    // 2. Dicionário de quantidades por ref base (Legado)
    const estoquePorRefBase = new Map<string, number>();
    const getRefBaseLegacy = (ref: string) => {
      const parts = ref.split('-');
      if (parts.length > 1) return parts.slice(0, -1).join('-');
      return ref;
    };

    // Pré-calcular estoque total para itens legados
    acabadosOnly
      .filter(i => i.categoria !== 'Modelo Padronizado' && i.categoria !== 'Variação Padronizada')
      .forEach(item => {
        let ref = '';
        try {
          if (item.localizacao) {
            const loc = JSON.parse(item.localizacao);
            ref = loc.referencia || '';
          }
        } catch(e) {}
        
        if (ref) {
          const base = getRefBaseLegacy(ref);
          estoquePorRefBase.set(base, (estoquePorRefBase.get(base) || 0) + item.quantidade);
        }
      });

    return acabadosOnly
      .filter(item => item.categoria !== 'Modelo Padronizado')
      .map(item => {
        let referencia: string | undefined;
        let tamanho: string | undefined;
        let modeloId: string | undefined;
        let totalModelEstoque = item.quantidade;
        let refBase = '';

        if (item.localizacao) {
          try {
            const loc = JSON.parse(item.localizacao);
            referencia = loc.referencia || undefined;
            const t = loc.tamanho as string | undefined;
            if (t && !/^(PEÇAS)$/i.test(t)) tamanho = t;
            modeloId = loc.modeloId;
          } catch { }
        }

        // Se for variação padronizada
        if (item.categoria === 'Variação Padronizada' && modeloId) {
          totalModelEstoque = estoquePorModeloId.get(modeloId) || item.quantidade;
          if (referencia) refBase = getRefBaseLegacy(referencia);
        } else if (referencia) {
          refBase = getRefBaseLegacy(referencia);
          totalModelEstoque = estoquePorRefBase.get(refBase) || item.quantidade;
        }

        // Use cleaned name for display
        let cleanName = item.nome
          .replace(/\s*—\s*Tamanho\s+/gi, ' — ');
          
        if (referencia) {
           cleanName = cleanName.replace(new RegExp(`\\s*—\\s*${referencia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '');
        }
        
        return {
          id: item.id,
          nome: cleanName.trim(),
          preco_unitario: item.precoUnitario || 0,
          quantidade: item.quantidade,
          referencia: referencia,
          tamanho,
          totalModelEstoque,
          refBase: refBase || referencia
        };
      });
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

  // Helper to refetch pedido data after mutations
  const refetchPedido = async () => {
    if (!pedido) return;
    await queryClient.refetchQueries({ queryKey: ['pedido', pedido.id] });
    queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
  };

  const isSyncing = addItemMutation.isPending || updateItemMutation.isPending || removeItemMutation.isPending;

  const handleSaveDesconto = async () => {
    if (!pedido) return;
    const descontoDelta = (pedido.desconto ?? 0) - localDesconto;
    const newValorTotal = pedido.valor_total + descontoDelta;
    setIsSavingDesconto(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ desconto: localDesconto, valor_total: newValorTotal })
        .eq('id', pedido.id);
      if (error) throw error;
      toast.success('Desconto atualizado!');
      queryClient.invalidateQueries({ queryKey: ['pedido', pedido.id] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
    } catch {
      toast.error('Erro ao salvar desconto');
    } finally {
      setIsSavingDesconto(false);
    }
  };

  const handleUpdateItem = async (itemId: string, data: { quantidade?: number; valor_unitario?: number }) => {
    if (!pedido) return;

    setUpdatingItemId(itemId);
    try {
      // Usar dados do item já disponíveis nos props (evita fetch ao DB)
      const itemLocal = pedido.itens.find(i => i.id === itemId);
      if (!itemLocal) {
        toast.error('Item não encontrado');
        setUpdatingItemId(null);
        return;
      }

      // Pré-calcular totais localmente (evita SELECT de todos os itens em syncPedidoTotals)
      const newQtd = data.quantidade ?? itemLocal.quantidade;
      const newValor = data.valor_unitario ?? itemLocal.valor_unitario;
      const precomputedTotals = {
        total_pecas: pedido.total_pecas - itemLocal.quantidade + newQtd,
        valor_total: pedido.valor_total - (itemLocal.quantidade * itemLocal.valor_unitario) + (newQtd * newValor),
      };

      // Se a quantidade mudou, ajustar estoque
      if (data.quantidade !== undefined && data.quantidade !== itemLocal.quantidade) {
        const diferenca = itemLocal.quantidade - data.quantidade; // positivo = devolve, negativo = subtrai

        let produtoId = itemLocal.produto_id;

        // Fallback: se não tem produto_id, buscar pelo nome no contexto de estoque
        if (!produtoId) {
          const estoqueByName = estoqueItens.find(
            e => e.tipo === 'acabado' && e.nome.toLowerCase() === itemLocal.produto_nome.toLowerCase()
          );
          if (estoqueByName) produtoId = estoqueByName.id;
        }

        if (produtoId) {
          // Usar quantidade do contexto ao invés de buscar do DB
          const estoqueAtual = estoqueItens.find(e => e.id === produtoId);
          if (estoqueAtual) {
            // A disponibilidade real é o que tem no estoque MAIS o que já está reservado neste item do pedido
            const estoqueDisponivelTotal = estoqueAtual.quantidade + itemLocal.quantidade;
            
            if (newQtd <= estoqueDisponivelTotal) {
              const novaQuantidadeEstoque = estoqueDisponivelTotal - newQtd;
              await updateEstoqueItem(estoqueAtual.id, { quantidade: novaQuantidadeEstoque });
            } else {
              toast.error(`Estoque insuficiente! Disponível no Central: ${estoqueAtual.quantidade}. Máximo permitido considerando este pedido: ${estoqueDisponivelTotal}`);
              setUpdatingItemId(null);
              return;
            }
          }
        } else {
          console.warn('Produto não encontrado no estoque para ajuste:', itemLocal.produto_nome);
        }
      }

      await updateItemMutation.mutateAsync({
        id: itemId,
        pedidoId: pedido.id,
        data,
        precomputedTotals,
      });
      await refetchPedido();
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

    setRemovingItemId(itemId);
    try {
      // Usar dados do item já disponíveis nos props (evita fetch ao DB)
      const itemLocal = pedido.itens.find(i => i.id === itemId);
      if (!itemLocal) {
        toast.error('Item não encontrado');
        setRemovingItemId(null);
        return;
      }

      // Pré-calcular totais sem este item
      const precomputedTotals = {
        total_pecas: pedido.total_pecas - itemLocal.quantidade,
        valor_total: pedido.valor_total - (itemLocal.quantidade * itemLocal.valor_unitario),
      };

      let produtoId = itemLocal.produto_id;

      // Fallback: se não tem produto_id, buscar pelo nome no contexto de estoque
      if (!produtoId) {
        const estoqueByName = estoqueItens.find(
          e => e.tipo === 'acabado' && e.nome.toLowerCase() === itemLocal.produto_nome.toLowerCase()
        );
        if (estoqueByName) produtoId = estoqueByName.id;
      }

      // Devolver ao estoque
      if (produtoId) {
        const estoqueAtual = estoqueItens.find(e => e.id === produtoId);
        if (estoqueAtual) {
          await updateEstoqueItem(estoqueAtual.id, {
            quantidade: estoqueAtual.quantidade + itemLocal.quantidade
          });
        }
      }

      await removeItemMutation.mutateAsync({
        id: itemId,
        pedidoId: pedido.id,
        precomputedTotals,
      });
      await refetchPedido();
      toast.success(`Item removido! ${itemLocal.quantidade} peças retornaram ao estoque.`);
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
      // Usar dados do contexto de estoque ao invés de buscar do DB
      const estoqueAtual = estoqueItens.find(e => e.id === produto.id && e.tipo === 'acabado');

      if (!estoqueAtual || estoqueAtual.quantidade < 1) {
        toast.error('Estoque insuficiente para este produto!');
        return;
      }

      const precomputedTotals = {
        total_pecas: pedido.total_pecas + 1,
        valor_total: pedido.valor_total + (produto.preco_unitario || 0),
      };

      // Deduzir 1 unidade do estoque
      await updateEstoqueItem(estoqueAtual.id, {
        quantidade: estoqueAtual.quantidade - 1
      });

      // Adicionar item ao pedido
      await addItemMutation.mutateAsync({
        pedido_id: pedido.id,
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: 1,
        valor_unitario: produto.preco_unitario || 0,
        precomputedTotals,
      });
      await refetchPedido();
      toast.success('Item adicionado! 1 peça deduzida do estoque.');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Erro ao adicionar item');
    }
  };

  // Handle adding a full grade from AddGradeModal
  const handleAddGrade = async (gradeItems: ItemPedido[]) => {
    if (!pedido) return;

    try {
      let addedPecas = 0;
      let addedValor = 0;

      for (const item of gradeItems) {
        // Deduct from stock
        const estoqueAtual = estoqueItens.find(e => e.id === item.produtoId && e.tipo === 'acabado');
        if (estoqueAtual) {
          if (estoqueAtual.quantidade < item.quantidade) {
            toast.error(`Estoque insuficiente para ${item.produtoNome}!`);
            continue;
          }
          await updateEstoqueItem(estoqueAtual.id, {
            quantidade: estoqueAtual.quantidade - item.quantidade,
          });
        }

        addedPecas += item.quantidade;
        addedValor += item.quantidade * item.valorUnitario;

        const precomputedTotals = {
          total_pecas: pedido.total_pecas + addedPecas,
          valor_total: pedido.valor_total + addedValor,
        };

        await addItemMutation.mutateAsync({
          pedido_id: pedido.id,
          produto_id: item.produtoId,
          produto_nome: item.produtoNome || '',
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          precomputedTotals,
        });
      }

      await refetchPedido();
      toast.success(`Grade adicionada! ${addedPecas} peças no total.`);
    } catch (error) {
      console.error('Error adding grade:', error);
      toast.error('Erro ao adicionar grade');
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
      <DialogContent className="w-full max-w-[100vw] sm:w-[95vw] sm:max-w-3xl h-[100dvh] sm:h-[85vh] min-h-0 flex flex-col p-0 gap-0 rounded-none sm:rounded-xl overflow-hidden [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                Editar Pedido
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {pedido.cliente_nome}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Totals Banner */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-muted/30 border-b border-border/50 flex-shrink-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Total Peças */}
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 bg-background rounded-lg sm:rounded-xl shadow-sm">
              <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary/10">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Total Peças</p>
                <div className="flex items-center gap-2">
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary" />
                  ) : (
                    <p className="text-lg sm:text-2xl font-bold text-primary">{pedido.total_pecas}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Desconto (Interno) */}
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 bg-background rounded-lg sm:rounded-xl shadow-sm">
              <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-rose-500/10 flex-shrink-0">
                <Percent className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Desconto</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-rose-600">-</span>
                  <input
                    type="number"
                    min={0}
                    value={localDesconto || ''}
                    onChange={(e) => setLocalDesconto(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-16 sm:w-20 bg-transparent border-b border-border focus:border-rose-500 outline-none text-base sm:text-lg font-bold text-rose-600 placeholder:text-rose-300"
                  />
                  {localDesconto !== (pedido.desconto ?? 0) && (
                    <button
                      onClick={handleSaveDesconto}
                      disabled={isSavingDesconto}
                      className="flex-shrink-0 p-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 disabled:opacity-50 transition-colors"
                      title="Salvar desconto"
                    >
                      {isSavingDesconto
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Check className="h-3 w-3" />
                      }
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Valor Total */}
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 bg-background rounded-lg sm:rounded-xl shadow-sm">
              <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-emerald-500/10 flex-shrink-0">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Valor Total</p>
                <div className="flex items-center gap-2">
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-emerald-600" />
                  ) : (
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600">
                      {formatCurrency(pedido.valor_total + (pedido.desconto ?? 0) - localDesconto)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items List - Native scroll for better flexbox compatibility */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0 overscroll-contain touch-pan-y">
          <div className="px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0 sticky top-0 bg-background z-10 border-b border-border/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">Itens do Pedido</h3>
              <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <span className="w-14 text-center shrink-0">Qtd</span>
                <span className="w-20 text-center shrink-0">Valor Unit.</span>
                <span className="w-24 text-right shrink-0">Subtotal</span>
                <span className="w-9 shrink-0"></span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pb-6 px-3 sm:px-6 w-full max-w-full">
            {pedido.itens.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum item no pedido</p>
              </div>
            ) : (
              (() => {
                // Grouping Logic
                const parseItem = (item: EditableItem) => {
                  const produtoId = item.produto_id || '';
                  const produto = estoqueItens.find(p => p.id === produtoId);
                  let refStr = '';

                  if (produto) {
                    try {
                      if (produto.localizacao) {
                        const loc = JSON.parse(produto.localizacao);
                        if (loc.referencia) refStr = loc.referencia;
                      }
                    } catch (e) { }
                  } else if (item.produto_nome.includes(' | REF: ')) {
                    refStr = item.produto_nome.split(' | REF: ')[1] || '';
                  }

                  if (refStr) {
                    const m = refStr.match(/^(.+)-(P|M|G|GG|G1|G2|G3|XGG|\d{2})$/);
                    if (m) {
                      const refBase = m[1];
                      const tamanho = m[2];
                      let nomeModelo = item.produto_nome;
                      if (produto && produto.nome) nomeModelo = produto.nome;
                      if (nomeModelo.includes(' | REF: ')) nomeModelo = nomeModelo.split(' | REF: ')[0];
                      nomeModelo = nomeModelo.replace(/\s*—\s*Tamanho\s+/gi, ' — ').trim();
                      return { refBase, tamanho, nomeModelo, refStr };
                    }
                  }
                  return null;
                };

                const gradeGroups = new Map<string, { refBase: string; nomeModelo: string; itens: Array<{ item: EditableItem; tamanho: string }> }>();
                const avulsosItems: EditableItem[] = [];

                pedido.itens.forEach(item => {
                  const parsed = parseItem(item);
                  if (parsed) {
                    const key = `${parsed.refBase}|${item.valor_unitario}`;
                    if (!gradeGroups.has(key)) {
                      gradeGroups.set(key, { refBase: parsed.refBase, nomeModelo: parsed.nomeModelo, itens: [] });
                    }
                    gradeGroups.get(key)!.itens.push({ item, tamanho: parsed.tamanho });
                  } else {
                    avulsosItems.push(item);
                  }
                });

                const gradeGroupsFinal: typeof gradeGroups = new Map();
                gradeGroups.forEach((v, k) => {
                  if (v.itens.length >= 2) gradeGroupsFinal.set(k, v);
                  else avulsosItems.push(v.itens[0].item);
                });

                const hasGrades = gradeGroupsFinal.size > 0;
                const hasAvulsos = avulsosItems.length > 0;

                return (
                  <div className="space-y-4">
                    {/* ── GRADES ── */}
                    {hasGrades && (
                      <div className="space-y-3">
                        {hasAvulsos && (
                          <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                            Grades
                          </p>
                        )}
                        {Array.from(gradeGroupsFinal.entries()).map(([key, grupo]) => {
                          // Check if any item in group is updating/removing
                          const hasPendingUpdates = grupo.itens.some(({ item }) => updatingItemId === item.id);
                          const hasRemovingUpdates = grupo.itens.some(({ item }) => removingItemId === item.id);

                          return (
                            <GradeCompactCardEditable
                              key={key}
                              grupo={grupo}
                              onUpdate={handleUpdateItem}
                              onRemove={handleRemoveItem}
                              hasPendingUpdates={hasPendingUpdates}
                              hasRemovingUpdates={hasRemovingUpdates}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Separador */}
                    {hasGrades && hasAvulsos && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avulso</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                    )}

                    {/* ── AVULSOS ── */}
                    {hasAvulsos && (
                      <div className="space-y-2">
                        {avulsosItems.map((item) => {
                          const parsed = parseItem(item);
                          let displayName = item.produto_nome;

                           if (parsed) {
                            displayName = `${parsed.nomeModelo} — ${parsed.tamanho} | REF: ${parsed.refStr}`;
                          } else {
                            const produtoId = item.produto_id || '';
                            const produto = estoqueItens.find(p => p.id === produtoId);
                            if (produto && produto.nome) displayName = produto.nome;
                          }

                          // Remove unwanted labels for display
                          displayName = displayName
                            .replace(/\s*—\s*Tamanho\s+/gi, ' — ');

                          const enhancedItem = { ...item, produto_nome: displayName };

                          return (
                            <EditableItemRow
                              key={item.id}
                              item={enhancedItem}
                              onUpdate={handleUpdateItem}
                              onRemove={handleRemoveItem}
                              isUpdating={updatingItemId === item.id}
                              isRemoving={removingItemId === item.id}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Add Item Section */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border/50 flex-shrink-0 space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGradeModalOpen(true)}
              disabled={addItemMutation.isPending}
              className="h-11 flex-1 rounded-xl border-dashed border-2 border-indigo-400/30 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all"
            >
              <Layers className="h-4 w-4 mr-2 text-indigo-600" />
              <span className="text-indigo-600 font-medium">Adicionar Grade</span>
            </Button>
          </div>
          <AddItemSelector
            produtos={produtosAcabados}
            onAdd={handleAddItem}
            isAdding={addItemMutation.isPending}
            existingProductIds={existingProductIds}
          />
        </div>
      </DialogContent>
    </Dialog>

    {/* Add Grade Modal */}
    <AddGradeModal
      open={gradeModalOpen}
      onClose={() => setGradeModalOpen(false)}
      onAdd={handleAddGrade}
      existingItems={pedido.itens.map(i => ({
        id: i.id,
        produtoId: i.produto_id || '',
        produtoNome: i.produto_nome,
        quantidade: i.quantidade,
        valorUnitario: i.valor_unitario,
      }))}
    />
    </>
  );
}
