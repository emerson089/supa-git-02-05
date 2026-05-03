import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GradeAtacado } from '@/hooks/useModelosPadronizados';
import { cn } from '@/lib/utils';
import { Plus, X, Trash2, Package2, Wand2, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';

interface GradesEditorProps {
    tamanhosSelecionados: string[];
    precoUnitario: number;
    grades: GradeAtacado[];
    onChange: (grades: GradeAtacado[]) => void;
}

function calcularTotal(itens: GradeAtacado['itens']): number {
    return itens.reduce((s, i) => s + i.quantidade, 0);
}

function calcularPreco(itens: GradeAtacado['itens'], precoUnitario: number): number {
    return itens.reduce((s, i) => s + i.quantidade * precoUnitario, 0);
}

/** Gera sugestões automáticas baseadas nos tamanhos selecionados */
function gerarSugestoes(tamanhos: string[], precoUnitario: number): GradeAtacado[] {
    if (tamanhos.length === 0) return [];

    const numericos = tamanhos.filter(t => !isNaN(Number(t)));
    const letras = tamanhos.filter(t => isNaN(Number(t)));
    const numericos_plus = numericos.filter(t => Number(t) >= 48);
    const numericos_padrao = numericos.filter(t => Number(t) <= 46);

    const sugestoes: GradeAtacado[] = [];

    if (letras.length > 0) {
        const itens = letras.map(t => ({ tamanho: t, quantidade: 1 }));
        sugestoes.push({
            id: crypto.randomUUID(),
            nome: 'GRADE',
            itens,
            totalPecas: calcularTotal(itens),
            precoSugerido: calcularPreco(itens, precoUnitario),
        });
    }

    if (numericos_padrao.length > 0) {
        const itens = numericos_padrao.map(t => ({ tamanho: t, quantidade: 1 }));
        sugestoes.push({
            id: crypto.randomUUID(),
            nome: 'GRADE',
            itens,
            totalPecas: calcularTotal(itens),
            precoSugerido: calcularPreco(itens, precoUnitario),
        });
    }

    if (numericos_plus.length > 0) {
        const itens = numericos_plus.map(t => ({ tamanho: t, quantidade: 1 }));
        sugestoes.push({
            id: crypto.randomUUID(),
            nome: 'GRADE',
            itens,
            totalPecas: calcularTotal(itens),
            precoSugerido: calcularPreco(itens, precoUnitario),
        });
    }

    if (tamanhos.length > 0 && sugestoes.length < 1) {
        const itens = tamanhos.map(t => ({ tamanho: t, quantidade: 1 }));
        sugestoes.push({
            id: crypto.randomUUID(),
            nome: 'GRADE',
            itens,
            totalPecas: calcularTotal(itens),
            precoSugerido: calcularPreco(itens, precoUnitario),
        });
    }

    return sugestoes;
}

/** Editor de uma única grade */
function GradeItemEditor({
    grade,
    precoUnitario,
    tamanhosSelecionados,
    onUpdate,
    onDelete,
}: {
    grade: GradeAtacado;
    precoUnitario: number;
    tamanhosSelecionados: string[];
    onUpdate: (g: GradeAtacado) => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [editingNome, setEditingNome] = useState(false);
    const [nomeTemp, setNomeTemp] = useState(grade.nome);

    const updateItem = (tamanho: string, qtd: number) => {
        const newItens = grade.itens.map(i =>
            i.tamanho === tamanho ? { ...i, quantidade: Math.max(0, qtd) } : i
        );
        const totalPecas = calcularTotal(newItens);
        const precoSugerido = calcularPreco(newItens, precoUnitario);
        onUpdate({ ...grade, itens: newItens, totalPecas, precoSugerido });
    };

    const removeItem = (tamanho: string) => {
        const newItens = grade.itens.filter(i => i.tamanho !== tamanho);
        onUpdate({ ...grade, itens: newItens, totalPecas: calcularTotal(newItens), precoSugerido: calcularPreco(newItens, precoUnitario) });
    };

    const addItem = (tamanho: string) => {
        const newItens = [...grade.itens, { tamanho, quantidade: 1 }];
        onUpdate({ ...grade, itens: newItens, totalPecas: calcularTotal(newItens), precoSugerido: calcularPreco(newItens, precoUnitario) });
    };

    const saveNome = () => {
        onUpdate({ ...grade, nome: nomeTemp.trim() || grade.nome });
        setEditingNome(false);
    };

    const totalPecas = calcularTotal(grade.itens);
    const precoTotal = grade.precoSugerido;
    const tamanhosDisponiveis = tamanhosSelecionados.filter(
        t => !grade.itens.some(i => i.tamanho === t)
    );

    return (
        <div className="rounded-xl border border-border overflow-hidden">
            {/* Header da grade */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 border-b border-border/50">
                {editingNome ? (
                    <div className="flex-1 flex items-center gap-2">
                        <Input
                            value={nomeTemp}
                            onChange={e => setNomeTemp(e.target.value)}
                            className="h-7 text-sm border-primary/30 focus-visible:ring-primary/30"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveNome(); if (e.key === 'Escape') setEditingNome(false); }}
                        />
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={saveNome}>
                            <Check className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm truncate">{grade.nome}</span>
                        <button
                            type="button"
                            onClick={() => { setNomeTemp(grade.nome); setEditingNome(true); }}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <Pencil className="h-3 w-3" />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] font-bold">
                        {totalPecas} peças
                    </Badge>
                    <span className="text-[11px] font-bold text-emerald-600">
                        R$ {precoTotal.toFixed(2)}
                    </span>
                    <button type="button" onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={onDelete} className="text-destructive/70 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Itens da grade */}
            {expanded && (
                <div className="p-3 space-y-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {grade.itens.map(item => (
                            <div key={item.tamanho} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        {item.tamanho}
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.tamanho)}
                                        className="text-muted-foreground/50 hover:text-destructive"
                                        title={`Remover ${item.tamanho}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                                <Input
                                    type="number"
                                    min={0}
                                    value={item.quantidade}
                                    onChange={e => updateItem(item.tamanho, parseInt(e.target.value) || 0)}
                                    className="h-8 text-center text-sm shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Adicionar tamanho disponível */}
                    {tamanhosDisponiveis.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/30">
                            <span className="text-[10px] text-muted-foreground shrink-0">+ Adicionar:</span>
                            {tamanhosDisponiveis.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => addItem(t)}
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-dashed border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Preço editável */}
                    <div className="flex items-center gap-3 pt-1 border-t border-border/30">
                        <span className="text-xs text-muted-foreground flex-1">Preço da grade (R$)</span>
                        <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={grade.precoSugerido}
                            onChange={e => onUpdate({ ...grade, precoSugerido: parseFloat(e.target.value) || 0 })}
                            className="h-7 w-28 text-right text-sm font-semibold shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export function GradesEditor({
    tamanhosSelecionados,
    precoUnitario,
    grades,
    onChange,
}: GradesEditorProps) {
    const [sugestoesMostradas, setSugestoesMostradas] = useState(false);

    // Gerar sugestões quando tamanhos mudam (apenas se não há grades ainda)
    useEffect(() => {
        if (tamanhosSelecionados.length > 0 && grades.length === 0 && !sugestoesMostradas) {
            // não auto-popular — usuário clica "Usar Sugestão"
        }
    }, [tamanhosSelecionados, grades.length, sugestoesMostradas]);

    const handleUsarSugestao = () => {
        const sugestoes = gerarSugestoes(tamanhosSelecionados, precoUnitario);
        onChange(sugestoes);
        setSugestoesMostradas(true);
    };

    const handleAddGrade = () => {
        const novaGrade: GradeAtacado = {
            id: crypto.randomUUID(),
            nome: `Grade ${grades.length + 1}`,
            itens: tamanhosSelecionados.map(t => ({ tamanho: t, quantidade: 1 })),
            totalPecas: tamanhosSelecionados.length,
            precoSugerido: tamanhosSelecionados.length * precoUnitario,
        };
        onChange([...grades, novaGrade]);
    };

    const handleUpdateGrade = (id: string, updated: GradeAtacado) => {
        onChange(grades.map(g => g.id === id ? updated : g));
    };

    const handleDeleteGrade = (id: string) => {
        onChange(grades.filter(g => g.id !== id));
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Package2 className="h-3.5 w-3.5" />
                    Grades de Atacado
                    <span className="text-muted-foreground/50 font-normal normal-case tracking-normal">(opcional)</span>
                </Label>
                <div className="flex items-center gap-2">
                    {tamanhosSelecionados.length > 0 && grades.length === 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-dashed border-primary/30 text-primary hover:bg-primary/5"
                            onClick={handleUsarSugestao}
                        >
                            <Wand2 className="h-3 w-3" />
                            Usar Sugestão
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={handleAddGrade}
                        disabled={tamanhosSelecionados.length === 0}
                    >
                        <Plus className="h-3 w-3" />
                        Nova Grade
                    </Button>
                </div>
            </div>

            {/* Vazio */}
            {grades.length === 0 && (
                <div className={cn(
                    'rounded-xl border border-dashed border-border p-4 text-center',
                    tamanhosSelecionados.length === 0 ? 'opacity-40' : ''
                )}>
                    <Package2 className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">
                        {tamanhosSelecionados.length === 0
                            ? 'Selecione tamanhos primeiro'
                            : 'Nenhuma grade definida. Clique em "Usar Sugestão" ou "Nova Grade".'}
                    </p>
                </div>
            )}

            {/* Lista de grades */}
            <div className="space-y-3">
                {grades.map(grade => (
                    <GradeItemEditor
                        key={grade.id}
                        grade={grade}
                        precoUnitario={precoUnitario}
                        tamanhosSelecionados={tamanhosSelecionados}
                        onUpdate={updated => handleUpdateGrade(grade.id, updated)}
                        onDelete={() => handleDeleteGrade(grade.id)}
                    />
                ))}
            </div>

            {/* Resumo */}
            {grades.length > 0 && (
                <p className="text-[11px] text-muted-foreground text-right">
                    {grades.length} grade(s) definida(s) · mín.{' '}
                    {Math.min(...grades.map(g => g.totalPecas))}–{Math.max(...grades.map(g => g.totalPecas))} peças/grade
                </p>
            )}
        </div>
    );
}
