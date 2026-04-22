import { useState, useCallback } from 'react';
import { Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemPedidoRow, ItemPedido } from './ItemPedidoRow';
import { GradeCompactCard } from './GradeCompactCard';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useMemo } from 'react';
import { SmartGradeModal } from './SmartGradeModal';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useModelosPadronizados } from '@/hooks/useModelosPadronizados';
import { parseProductName } from '@/utils/productNameUtils';

interface ItensPedidoCardProps {
  items: ItemPedido[];
  onUpdateItem: (item: ItemPedido) => void;
  onRemoveItem: (id: string) => void;
  onAddGradeItems: (items: ItemPedido[]) => void;
  newItemId?: string | null;
  onNewItemFocused?: () => void;
}

export function ItensPedidoCard({ items, onUpdateItem, onRemoveItem, onAddGradeItems, newItemId, onNewItemFocused }: ItensPedidoCardProps) {
  const { getProdutosAcabados } = useEstoque();
  const { modelosPadronizados } = useModelosPadronizados();
  const [showAddGrade, setShowAddGrade] = useState(false);

  // Remove todos os itens de um grupo de grade de uma vez
  const handleRemoveGrupo = useCallback((ids: string[]) => {
    ids.forEach(id => onRemoveItem(id));
  }, [onRemoveItem]);

  // Estado para edição de grade
  const [editingGrade, setEditingGrade] = useState<{ modelId: string, quantities: Record<string, number> } | null>(null);

  const handleEditGrade = useCallback((modelId: string, itens: ItemPedido[]) => {
    const quantities: Record<string, number> = {};
    itens.forEach(it => {
      const tamanho = it.metadata?.tamanho || it.produtoNome?.split(' — ').pop() || '';
      if (tamanho) quantities[tamanho] = it.quantidade;
    });
    setEditingGrade({ modelId, quantities });
    setShowAddGrade(true);
  }, []);

  const handleAddOrReplaceItems = useCallback((novosItens: ItemPedido[]) => {
    if (editingGrade) {
      // Remover itens antigos do mesmo modelo
      const idsToRemove = items
        .filter(it => it.metadata?.model_id === editingGrade.modelId || it.modeloId === editingGrade.modelId)
        .map(it => it.id);
      
      idsToRemove.forEach(id => onRemoveItem(id));
    }
    
    onAddGradeItems(novosItens);
    setEditingGrade(null);
  }, [editingGrade, items, onAddGradeItems, onRemoveItem]);

  // Para cada variação que pertence a uma grade, calcula quantas peças estão reservadas
  // para grades completas e quantas estão livres para venda avulsa.
  const gradeInfoMap = useMemo(() => {
    const map: Record<string, { gradeReservado: number; livreParaAvulso: number }> = {};
    for (const modelo of modelosPadronizados) {
      if (!modelo.meta.grades?.length) continue;
      const grade = modelo.meta.grades[0]; // usa a primeira grade como referência
      let maxGrades = Infinity;
      for (const gradeItem of grade.itens) {
        if (gradeItem.quantidade <= 0) continue;
        const variacao = modelo.variacoes.find(v => v.tamanho === gradeItem.tamanho);
        const stock = variacao?.quantidade ?? 0;
        maxGrades = Math.min(maxGrades, Math.floor(stock / gradeItem.quantidade));
      }
      if (!isFinite(maxGrades)) maxGrades = 0;
      for (const gradeItem of grade.itens) {
        const variacao = modelo.variacoes.find(v => v.tamanho === gradeItem.tamanho);
        if (!variacao) continue;
        const gradeReservado = maxGrades * gradeItem.quantidade;
        map[variacao.id] = {
          gradeReservado,
          livreParaAvulso: Math.max(0, variacao.quantidade - gradeReservado),
        };
      }
    }
    return map;
  }, [modelosPadronizados]);

  // Obter produtos acabados do estoque e transformar para o formato esperado
  const produtos = useMemo(() => {
    const todosAcabados = getProdutosAcabados();
    
    // 1. Dicionário de quantidades por modelo pai (Padronizado)
    const estoquePorModeloId = new Map<string, number>();
    todosAcabados
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
    todosAcabados
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

    return todosAcabados
      .filter(item => item.categoria !== 'Modelo Padronizado')
      .map(item => {
        let ref = '';
        let modeloId: string | undefined;
        let tamanho: string | undefined;
        let totalModelEstoque = item.quantidade;
        let refBase = '';

        try {
          if (item.localizacao) {
            const loc = JSON.parse(item.localizacao);
            ref = loc.referencia || '';
            modeloId = loc.modeloId;
            tamanho = loc.tamanho;
          }
        } catch (e) { }

        // Agrupamento igual ao EditPedidoModal
        if (item.categoria === 'Variação Padronizada' && modeloId) {
          totalModelEstoque = estoquePorModeloId.get(modeloId) || item.quantidade;
          if (ref) refBase = getRefBaseLegacy(ref);
        } else if (ref) {
          refBase = getRefBaseLegacy(ref);
          totalModelEstoque = estoquePorRefBase.get(refBase) || item.quantidade;
        }

        // Limpeza de nome para exibir no seletor usando utilitário padronizado
        const info = parseProductName(item.nome, ref);
        const cleanName = info.nomeBase;

        const gradeInfo = gradeInfoMap[item.id];
        return {
          id: item.id,
          nome: cleanName.trim(),
          preco: item.precoUnitario,
          // Para variações em grade: mostra apenas o sobrante (fora da grade)
          quantidadeDisponivel: gradeInfo?.livreParaAvulso ?? item.quantidade,
          referencia: ref,
          totalModelEstoque,
          refBase: refBase || ref,
          tamanho,
          gradeReserved: gradeInfo?.gradeReservado,
        };
      });
  }, [getProdutosAcabados, gradeInfoMap]);

  // Agrupar itens para exibição mantendo a ordem de inserção (intercalado)
  const groupedBlocks = useMemo(() => {
    const blocks: ({ type: 'grade', gradeId: string, modeloId: string, itens: ItemPedido[] } | { type: 'avulso', item: ItemPedido })[] = [];
    
    // Conjunto para rastrear grades que já foram processadas para não repetir blocos de grade
    // se por algum motivo os itens não estiverem contínuos (embora devam estar)
    const processedGrades = new Set<string>();

    items.forEach(item => {
      // Chave única para agrupamento: prioriza gradeId (agrupamento atômico da seleção), 
      // mas aceita modeloId como fallback para itens que devem estar juntos.
      const gradeKey = item.tipo === 'grade' && item.gradeId 
        ? `${item.gradeId}-${item.modeloId}` 
        : item.modeloId 
          ? `auto-${item.modeloId}-${item.valorUnitario}` 
          : null;

      if (gradeKey) {
        if (processedGrades.has(gradeKey)) return;

        // Se for grade, busca TODOS os itens deste grupo no array total
        const gradeItens = items.filter(i => {
          if (item.tipo === 'grade' && item.gradeId) {
            return i.tipo === 'grade' && i.gradeId === item.gradeId && i.modeloId === item.modeloId;
          }
          return i.modeloId === item.modeloId && i.valorUnitario === item.valorUnitario;
        });

        // Enriquecer itens com referência se faltar
        const enrichedGradeItens = gradeItens.map(i => {
          if (i.metadata?.referencia) return i;
          const p = produtos.find(prod => prod.id === i.produtoId);
          if (p?.referencia) {
            return {
              ...i,
              referencia: p.referencia,
              metadata: {
                ...(i.metadata || {}),
                referencia: p.referencia
              }
            };
          }
          return i;
        });

        blocks.push({
          type: 'grade',
          gradeId: item.gradeId || 'auto',
          modeloId: item.modeloId!,
          itens: enrichedGradeItens
        });
        processedGrades.add(gradeKey);
      } else {
        // Se for avulso sem qualquer vínculo de modelo, adiciona como bloco individual
        blocks.push({
          type: 'avulso',
          item
        });
      }
    });

    return blocks;
  }, [items, produtos]);

  return (
    <>
      <div className="neu-card p-4 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/30">
          <h2 className="text-lg font-bold text-foreground">Itens do Pedido</h2>
          {/* Botão Adicionar Itens (Smart Grade) */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAddGrade(true)}
            className="h-11 sm:h-12 w-full sm:w-auto rounded-xl border-2 border-dashed border-indigo-400/40 hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 font-bold px-6 text-sm transition-all flex items-center justify-center gap-2"
          >
            <Package2 size={18} className="text-indigo-600" />
            Adicionar Itens
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">Nenhum item adicionado</p>
            <p className="text-xs mt-1.5 text-muted-foreground/70">
              Clique em "Adicionar Itens" para selecionar um modelo
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              <span>Modelo / Detalhamento</span>
              <span>Total</span>
            </div>
            {/* ── Seção: Itens por Grade ── */}
            {groupedBlocks.map((block, index) => {
              if (block.type === 'grade') {
                return (
                  <GradeCompactCard
                    key={`grade-${block.gradeId}-${block.modeloId}`}
                    itens={block.itens}
                    onUpdate={onUpdateItem}
                    onRemoveGrupo={handleRemoveGrupo}
                    onClick={() => handleEditGrade(block.modeloId, block.itens)}
                  />
                );
              }

              const { item } = block;
              // Soma apenas os avulsos do mesmo produto para cálculo de estoque
              const avulsoCommitted = items
                .filter(ci => ci.tipo !== 'grade' && ci.produtoId === item.produtoId)
                .reduce((s, ci) => s + ci.quantidade, 0);
              const produto = item.produtoId ? produtos.find(p => p.id === item.produtoId) : null;
              const availableOverride = produto
                ? Math.max(0, produto.quantidadeDisponivel - (avulsoCommitted - item.quantidade))
                : undefined;

              return (
                <ItemPedidoRow
                  key={item.id}
                  item={item}
                  produtos={produtos}
                  onUpdate={onUpdateItem}
                  onRemove={onRemoveItem}
                  autoFocus={item.id === newItemId}
                  onAutoFocusComplete={onNewItemFocused}
                  availableOverride={availableOverride}
                />
              );
            })}
          </div>
        )}
      </div>

      <SmartGradeModal
        open={showAddGrade}
        onClose={() => {
          setShowAddGrade(false);
          setEditingGrade(null);
        }}
        onAdd={handleAddOrReplaceItems}
        initialModelId={editingGrade?.modelId}
        initialQuantities={editingGrade?.quantities}
      />
    </>
  );
}
