import { useState, useCallback } from 'react';
import { Plus, Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemPedidoRow, ItemPedido } from './ItemPedidoRow';
import { GradeCompactCard } from './GradeCompactCard';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useMemo } from 'react';
import { AddGradeModal } from './AddGradeModal';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useModelosPadronizados } from '@/hooks/useModelosPadronizados';

interface ItensPedidoCardProps {
  items: ItemPedido[];
  onAddItem: () => void;
  onUpdateItem: (item: ItemPedido) => void;
  onRemoveItem: (id: string) => void;
  onAddGradeItems: (items: ItemPedido[]) => void;
  newItemId?: string | null;
  onNewItemFocused?: () => void;
}

export function ItensPedidoCard({ items, onAddItem, onUpdateItem, onRemoveItem, onAddGradeItems, newItemId, onNewItemFocused }: ItensPedidoCardProps) {
  const { getProdutosAcabados } = useEstoque();
  const { modelosPadronizados } = useModelosPadronizados();
  const [showAddGrade, setShowAddGrade] = useState(false);

  // Remove todos os itens de um grupo de grade de uma vez
  const handleRemoveGrupo = useCallback((ids: string[]) => {
    ids.forEach(id => onRemoveItem(id));
  }, [onRemoveItem]);

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

        // Limpeza de nome para exibir no seletor
        let cleanName = item.nome.replace(/\s*—\s*Tamanho\s+/gi, ' — ');
        if (ref) {
          cleanName = cleanName.replace(new RegExp(`\\s*—\\s*${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '');
        }

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

  // Separar itens por grade e avulsos para exibição
  const itensGrade = items.filter(i => i.tipo === 'grade');
  const itensAvulsos = items.filter(i => i.tipo !== 'grade');

  // Agrupar itens de grade por gradeId+gradeNome para exibição agrupada
  const gruposGrade = useMemo(() => {
    const grupos = new Map<string, { gradeNome: string; modeloNome: string; quantidadeGrades: number; totalPecas: number; itens: ItemPedido[] }>();
    itensGrade.forEach(item => {
      const key = `${item.gradeId}-${item.modeloId}`;
      const existing = grupos.get(key);
      if (existing) {
        existing.itens.push(item);
        existing.totalPecas += item.quantidade;
      } else {
        grupos.set(key, {
          gradeNome: item.gradeNome ?? 'Grade',
          modeloNome: item.modeloNome ?? item.produtoNome ?? '',
          quantidadeGrades: item.quantidadeGrades ?? 1,
          totalPecas: item.quantidade,
          itens: [item],
        });
      }
    });
    return Array.from(grupos.values());
  }, [itensGrade]);

  return (
    <>
      <div className="neu-card p-7">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/30">
          <h2 className="text-lg font-bold text-foreground">Itens do Pedido</h2>
          <div className="flex gap-2">
            {/* Botão Grade */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddGrade(true)}
              className="h-10 rounded-xl border-indigo-200 dark:border-indigo-800 bg-background hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 font-medium"
            >
              <Package2 size={15} className="mr-2" />
              Por Grade
            </Button>
            {/* Botão Avulso */}
            <Button
              type="button"
              variant="outline"
              onClick={onAddItem}
              className="h-10 rounded-xl border-border bg-background hover:bg-muted/50 text-foreground font-medium"
            >
              <Plus size={16} className="mr-2" />
              Avulso
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">Nenhum item adicionado</p>
            <p className="text-xs mt-1.5 text-muted-foreground/70">
              Use "Por Grade" para atacado ou "Avulso" para peças individuais
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Seção: Itens por Grade ── */}
            {gruposGrade.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package2 className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    Por Grade
                  </span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                    {gruposGrade.length} grade(s)
                  </Badge>
                </div>

                {gruposGrade.map((grupo, gi) => (
                  <GradeCompactCard
                    key={gi}
                    itens={grupo.itens}
                    onUpdate={onUpdateItem}
                    onRemoveGrupo={handleRemoveGrupo}
                  />
                ))}
              </div>
            )}

            {/* Separador entre grade e avulso */}
            {gruposGrade.length > 0 && itensAvulsos.length > 0 && (
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground font-medium">Avulsos</span>
                <Separator className="flex-1" />
              </div>
            )}

            {/* ── Seção: Itens Avulsos ── */}
            {itensAvulsos.map(item => {
              // Soma apenas os avulsos do mesmo produto (grade já está em gradeReservado)
              const avulsoCommitted = itensAvulsos
                .filter(ci => ci.produtoId === item.produtoId)
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

      <AddGradeModal
        open={showAddGrade}
        onClose={() => setShowAddGrade(false)}
        onAdd={onAddGradeItems}
        existingItems={items}
      />
    </>
  );
}
