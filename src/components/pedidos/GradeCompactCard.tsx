import { useState, useCallback, useMemo } from 'react';
import { Trash2, Package2, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ItemPedido } from './ItemPedidoRow';
import { TAMANHOS_LETRAS, TAMANHOS_NUMERICOS } from '@/hooks/useModelosPadronizados';
import { cn } from '@/lib/utils';

const ORDEM_TAMANHOS = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];

interface GradeCompactCardProps {
    itens: ItemPedido[];           // todos os ItemPedido deste grupo de grade
    onUpdate: (item: ItemPedido) => void;
    onRemoveGrupo: (ids: string[]) => void;
}

export function GradeCompactCard({ itens, onUpdate, onRemoveGrupo }: GradeCompactCardProps) {
    const [expanded, setExpanded] = useState(false);

    if (itens.length === 0) return null;

    const primeiroItem = itens[0];
    const gradeNome = primeiroItem.gradeNome ?? 'Grade';
    const modeloNome = primeiroItem.modeloNome ?? '';
    const qtdGradesOriginal = primeiroItem.quantidadeGrades ?? 1;
    const gradeTotalPecas = primeiroItem.gradeTotalPecas ?? itens.reduce((s, i) => s + i.quantidade, 0);
    const valorUnitario = primeiroItem.valorUnitario;
    const valorOriginal = primeiroItem.valorOriginal ?? valorUnitario;
    const temDesconto = valorUnitario < valorOriginal;

    // Agrupar itens por tamanho para exibição agregada
    const aggregatedItens = useMemo(() => {
        const groups: Record<string, {
            tamanho: string;
            quantidadeTotal: number;
            itens: ItemPedido[];
            quantidadeDisponivel?: number;
        }> = {};

        itens.forEach(item => {
            const tamanho = item.produtoNome?.split('-').pop() ?? item.produtoNome ?? '';
            if (!groups[tamanho]) {
                groups[tamanho] = {
                    tamanho,
                    quantidadeTotal: 0,
                    itens: [],
                    quantidadeDisponivel: item.quantidadeDisponivel
                };
            }
            groups[tamanho].quantidadeTotal += item.quantidade;
            groups[tamanho].itens.push(item);
        });

        // Ordenar os grupos pela sequência canônica de tamanhos
        return Object.values(groups).sort(
            (a, b) => ORDEM_TAMANHOS.indexOf(a.tamanho) - ORDEM_TAMANHOS.indexOf(b.tamanho)
        );
    }, [itens]);

    const totalPecas = itens.reduce((s, i) => s + i.quantidade, 0);
    const subtotal = totalPecas * valorUnitario;
    
    // Quantas grades the current quantities represent
    const qtdGrades = gradeTotalPecas > 0 ? Math.round(totalPecas / gradeTotalPecas) : qtdGradesOriginal;

    // Atualizar quantidade de um tamanho (agregado)
    const handleAggregatedQtdChange = useCallback((tamanhoGroup: { itens: ItemPedido[], quantidadeTotal: number }, novaQtdTotal: number) => {
        const diff = novaQtdTotal - tamanhoGroup.quantidadeTotal;
        if (diff === 0) return;

        // Se só tem um item daquele tamanho, atualiza ele direto
        if (tamanhoGroup.itens.length === 1) {
            onUpdate({ ...tamanhoGroup.itens[0], quantidade: novaQtdTotal });
            return;
        }

        // Se tem múltiplos itens (ex: 2 grades), distribui a diferença
        // Para simplificar: tentamos manter a proporção ou apenas atualizamos o primeiro com o resto
        const baseQtdPerItem = Math.floor(novaQtdTotal / tamanhoGroup.itens.length);
        const remainder = novaQtdTotal % tamanhoGroup.itens.length;

        tamanhoGroup.itens.forEach((item, index) => {
            const extra = index < remainder ? 1 : 0;
            onUpdate({ ...item, quantidade: baseQtdPerItem + extra });
        });
    }, [onUpdate]);

    // Multiplicar todas as quantidades pelo número de grades
    const handleSetGrades = useCallback((novoN: number) => {
        if (novoN < 1 || gradeTotalPecas === 0) return;
        
        // Identificamos a estrutura de "uma grade" baseada na proporção inicial
        aggregatedItens.forEach(group => {
            const qtdPorGradeNoGrupo = Math.round(group.quantidadeTotal / qtdGrades);
            // Distribui uniformemente entre os itens do grupo
            const baseQtdPerItem = Math.floor((qtdPorGradeNoGrupo * novoN) / group.itens.length);
            const remainder = (qtdPorGradeNoGrupo * novoN) % group.itens.length;

            group.itens.forEach((item, index) => {
                const extra = index < remainder ? 1 : 0;
                onUpdate({ 
                    ...item, 
                    quantidade: baseQtdPerItem + extra,
                    quantidadeGrades: novoN 
                });
            });
        });
    }, [aggregatedItens, qtdGrades, onUpdate, gradeTotalPecas]);

    // Atualizar valor unitário de todos os itens da grade
    const handlePriceChange = useCallback((novoPreco: number) => {
        itens.forEach(item => {
            onUpdate({ ...item, valorUnitario: Math.max(0, novoPreco) });
        });
    }, [itens, onUpdate]);

    return (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/10 overflow-hidden">
            {/* ── Cabeçalho ── */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-100/60 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-900/50 gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Package2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 leading-tight truncate">
                            {modeloNome || gradeNome}
                        </p>
                        <p className="text-[11px] text-indigo-500/80 mt-0.5">
                            {totalPecas} peças ·{' '}
                            <span className="font-semibold text-emerald-600">
                                R$ {subtotal.toFixed(2)}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botão expandir/colapsar */}
                    <button
                        type="button"
                        onClick={() => setExpanded(v => !v)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-indigo-200/60 dark:hover:bg-indigo-800/40 transition-colors text-indigo-500"
                        title={expanded ? 'Colapsar' : 'Expandir detalhes'}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* Excluir grupo */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={() => onRemoveGrupo(itens.map(i => i.id))}
                        title="Remover toda a grade"
                    >
                        <Trash2 size={13} />
                    </Button>
                </div>
            </div>

            {/* ── Tabela compacta de tamanhos/quantidades ── */}
            <div className="px-4 py-3 space-y-3">
                {/* Linha de tamanhos e quantidades */}
                <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs">
                        <thead>
                            <tr>
                                {aggregatedItens.map(group => (
                                    <td key={group.tamanho} className="pb-1 px-1.5">
                                        <span className="font-mono font-bold text-muted-foreground text-[11px]">
                                            {group.tamanho}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {aggregatedItens.map(group => (
                                    <td key={group.tamanho} className="px-1">
                                        <input
                                            type="number"
                                            min={0}
                                            value={group.quantidadeTotal}
                                            onChange={e => handleAggregatedQtdChange(group, parseInt(e.target.value) || 0)}
                                            className={cn(
                                                'w-12 h-8 text-center text-sm font-bold rounded-lg border',
                                                'border-indigo-200 dark:border-indigo-800',
                                                'bg-white dark:bg-indigo-950/40',
                                                'focus:outline-none focus:ring-2 focus:ring-indigo-400',
                                                'text-foreground',
                                                group.quantidadeDisponivel !== undefined && group.quantidadeTotal > group.quantidadeDisponivel
                                                    ? 'ring-1 ring-amber-400 border-amber-300'
                                                    : ''
                                            )}
                                        />
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Multiplicador de grades */}
                <div className="flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium">Qtd de grades:</span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleSetGrades(qtdGrades - 1)}
                                disabled={qtdGrades <= 1}
                                className="h-6 w-6 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold text-sm flex items-center justify-center hover:bg-indigo-100 disabled:opacity-40 transition-colors"
                            >
                                −
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                                {qtdGrades}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleSetGrades(qtdGrades + 1)}
                                className="h-6 w-6 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold text-sm flex items-center justify-center hover:bg-indigo-100 transition-colors"
                            >
                                +
                            </button>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            = {totalPecas} peças
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter mb-0.5">Valor Unit (R$)</span>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={valorUnitario || ''}
                                    onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)}
                                    className={cn(
                                        "h-8 w-20 text-right pr-2 text-xs font-bold rounded-lg border-0 bg-white/50 dark:bg-black/20 shadow-inner",
                                        temDesconto ? "text-indigo-600 dark:text-indigo-400" : "text-foreground"
                                    )}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter mb-0.5">Total Grade</span>
                            <Badge className={cn(
                                "text-[10px] font-bold py-1 px-2 border-0 shadow-sm",
                                temDesconto 
                                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            )}>
                                R$ {subtotal.toFixed(2)}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Detalhes expandidos: estoque por tamanho */}
                {expanded && (
                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30 space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Disponibilidade em estoque</p>
                        <div className="flex flex-wrap gap-2">
                            {aggregatedItens.map(group => {
                                const disponivel = group.quantidadeDisponivel ?? 0;
                                const insuf = group.quantidadeTotal > disponivel;
                                return (
                                    <div
                                        key={group.tamanho}
                                        className={cn(
                                            'flex flex-col items-center px-2 py-1 rounded-lg border text-[10px]',
                                            insuf
                                                ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-700'
                                                : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700'
                                        )}
                                    >
                                        <span className="font-mono font-bold">{group.tamanho}</span>
                                        <span>{group.quantidadeTotal} / {disponivel}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
