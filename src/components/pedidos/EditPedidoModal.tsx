import { useState, useMemo } from 'react';
import { Loader2, Package, DollarSign, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableItemRow, EditableItem } from './EditableItemRow';
import { AddItemSelector } from './AddItemSelector';
import { useAddPedidoItem, useUpdatePedidoItem, useRemovePedidoItem } from '@/hooks/usePedidoItensData';
import { GradeCompactCardEditable } from './GradeCompactCardEditable';
import { useEstoque } from '@/contexts/EstoqueContext';
import { supabase } from '@/integrations/supabase/client';
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

    setUpdatingItemId(itemId);
    try {
      // Buscar o item atual diretamente do banco para garantir dados corretos
      const { data: itemDB, error: itemError } = await supabase
        .from('pedido_itens')
        .select('id, produto_id, produto_nome, quantidade')
        .eq('id', itemId)
        .maybeSingle();

      if (itemError || !itemDB) {
        console.error('Erro ao buscar item do pedido:', itemError);
        toast.error('Erro ao buscar dados do item');
        setUpdatingItemId(null);
        return;
      }

      // Se a quantidade mudou, ajustar estoque
      if (data.quantidade !== undefined && data.quantidade !== itemDB.quantidade) {
        const diferenca = itemDB.quantidade - data.quantidade; // positivo = devolve, negativo = subtrai

        let produtoId = itemDB.produto_id;

        // Fallback: se não tem produto_id, tentar encontrar pelo nome
        if (!produtoId) {
          const { data: estoqueByName } = await supabase
            .from('estoque_itens')
            .select('id')
            .eq('tipo', 'acabado')
            .ilike('nome', itemDB.produto_nome)
            .maybeSingle();

          if (estoqueByName) {
            produtoId = estoqueByName.id;
          }
        }

        if (produtoId) {
          // Buscar quantidade atual do estoque diretamente do banco
          const { data: estoqueAtual, error: estoqueError } = await supabase
            .from('estoque_itens')
            .select('id, quantidade')
            .eq('id', produtoId)
            .maybeSingle();

          if (estoqueError) {
            console.error('Erro ao buscar estoque:', estoqueError);
            toast.error('Erro ao verificar estoque');
            setUpdatingItemId(null);
            return;
          }

          if (estoqueAtual) {
            const novaQuantidadeEstoque = estoqueAtual.quantidade + diferenca;
            if (novaQuantidadeEstoque >= 0) {
              await updateEstoqueItem(estoqueAtual.id, {
                quantidade: novaQuantidadeEstoque
              });
            } else {
              toast.error(`Estoque insuficiente! Disponível: ${estoqueAtual.quantidade}`);
              setUpdatingItemId(null);
              return;
            }
          }
        } else {
          console.warn('Produto não encontrado no estoque para ajuste:', itemDB.produto_nome);
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

    setRemovingItemId(itemId);
    try {
      // Buscar o item atual diretamente do banco
      const { data: itemDB, error: itemError } = await supabase
        .from('pedido_itens')
        .select('id, produto_id, produto_nome, quantidade')
        .eq('id', itemId)
        .maybeSingle();

      if (itemError || !itemDB) {
        console.error('Erro ao buscar item do pedido:', itemError);
        toast.error('Erro ao buscar dados do item');
        setRemovingItemId(null);
        return;
      }

      let produtoId = itemDB.produto_id;

      // Fallback: se não tem produto_id, tentar encontrar pelo nome
      if (!produtoId) {
        const { data: estoqueByName } = await supabase
          .from('estoque_itens')
          .select('id')
          .eq('tipo', 'acabado')
          .ilike('nome', itemDB.produto_nome)
          .maybeSingle();

        if (estoqueByName) {
          produtoId = estoqueByName.id;
        }
      }

      // Devolver ao estoque antes de remover
      if (produtoId) {
        const { data: estoqueAtual, error: estoqueError } = await supabase
          .from('estoque_itens')
          .select('id, quantidade')
          .eq('id', produtoId)
          .maybeSingle();

        if (!estoqueError && estoqueAtual) {
          await updateEstoqueItem(estoqueAtual.id, {
            quantidade: estoqueAtual.quantidade + itemDB.quantidade
          });
        }
      }

      await removeItemMutation.mutateAsync({
        id: itemId,
        pedidoId: pedido.id,
      });
      toast.success(`Item removido! ${itemDB.quantidade} peças retornaram ao estoque.`);
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
      // Buscar quantidade atual diretamente do banco
      const { data: estoqueAtual, error: estoqueError } = await supabase
        .from('estoque_itens')
        .select('id, quantidade, tipo')
        .eq('id', produto.id)
        .eq('tipo', 'acabado')
        .maybeSingle();

      if (estoqueError) {
        console.error('Erro ao buscar estoque:', estoqueError);
        toast.error('Erro ao verificar estoque');
        return;
      }

      if (!estoqueAtual || estoqueAtual.quantidade < 1) {
        toast.error('Estoque insuficiente para este produto!');
        return;
      }

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
      });
      toast.success('Item adicionado! 1 peça deduzida do estoque.');
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
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
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

            {/* Valor Total */}
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 bg-background rounded-lg sm:rounded-xl shadow-sm">
              <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-emerald-500/10">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Valor Total</p>
                <div className="flex items-center gap-2">
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-emerald-600" />
                  ) : (
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600">{formatCurrency(pedido.valor_total)}</p>
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
                      nomeModelo = nomeModelo.replace(` — ${refStr}`, '').trim();
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
                            displayName = `${parsed.nomeModelo} — Tamanho ${parsed.tamanho} | REF: ${parsed.refStr}`;
                          } else {
                            const produtoId = item.produto_id || '';
                            const produto = estoqueItens.find(p => p.id === produtoId);
                            if (produto && produto.nome) displayName = produto.nome;
                          }

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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border/50 flex-shrink-0">
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
