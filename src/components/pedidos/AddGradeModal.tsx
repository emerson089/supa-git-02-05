import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useModelosPadronizados, GradeAtacado, ModeloPadronizado } from '@/hooks/useModelosPadronizados';
import { ItemPedido } from './ItemPedidoRow';
import { cn } from '@/lib/utils';
import {
    Package2,
    Layers,
    Search,
    ChevronRight,
    ArrowLeft,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react';
import { useEstoque } from '@/contexts/EstoqueContext';

interface AddGradeModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (items: ItemPedido[]) => void;
    existingItems?: ItemPedido[];
}

type Step = 'select-model' | 'select-grade';

export function AddGradeModal({ open, onClose, onAdd, existingItems = [] }: AddGradeModalProps) {
    const { modelosPadronizados } = useModelosPadronizados();
    const { itens } = useEstoque();

    const [step, setStep] = useState<Step>('select-model');
    const [search, setSearch] = useState('');
    const [modeloSelecionado, setModeloSelecionado] = useState<ModeloPadronizado | null>(null);
    const [gradeSelecionada, setGradeSelecionada] = useState<GradeAtacado | null>(null);
    const [quantidadeGrades, setQuantidadeGrades] = useState(1);

    // Filtra modelos com pelo menos uma grade definida
    const modelos = useMemo(() => {
        const s = search.toLowerCase();
        return modelosPadronizados.filter(m =>
            (m.meta.grades?.length ?? 0) > 0 &&
            (m.nome.toLowerCase().includes(s) || m.meta.referencia.toLowerCase().includes(s))
        );
    }, [modelosPadronizados, search]);

    const handleSelectModelo = (m: ModeloPadronizado) => {
        setModeloSelecionado(m);
        setGradeSelecionada(null);
        setQuantidadeGrades(1);
        setStep('select-grade');
    };

    const handleBack = () => {
        setStep('select-model');
        setModeloSelecionado(null);
        setGradeSelecionada(null);
    };

    const handleClose = () => {
        setStep('select-model');
        setModeloSelecionado(null);
        setGradeSelecionada(null);
        setSearch('');
        setQuantidadeGrades(1);
        onClose();
    };

    // Calcular disponibilidade por variação para a grade selecionada
    // Desconta o que já está no carrinho (existingItems) para mostrar disponível real
    const analiseEstoque = useMemo(() => {
        if (!gradeSelecionada || !modeloSelecionado) return null;

        const qtdNoCarrinho: Record<string, number> = {};
        for (const ci of existingItems) {
            if (!ci.produtoId) continue;
            qtdNoCarrinho[ci.produtoId] = (qtdNoCarrinho[ci.produtoId] || 0) + ci.quantidade;
        }

        return gradeSelecionada.itens.map(item => {
            const variacao = modeloSelecionado.variacoes.find(v => v.tamanho === item.tamanho);
            const estoqueReal = variacao?.quantidade ?? 0;
            const jaNoCarrinho = qtdNoCarrinho[variacao?.id ?? ''] ?? 0;
            const disponivel = Math.max(0, estoqueReal - jaNoCarrinho);
            const necessario = item.quantidade * quantidadeGrades;
            return {
                tamanho: item.tamanho,
                qtdPorGrade: item.quantidade,
                necessario,
                disponivel,
                ok: disponivel >= necessario,
                variacaoId: variacao?.id ?? '',
            };
        });
    }, [gradeSelecionada, modeloSelecionado, quantidadeGrades, existingItems]);

    const estoqueInsuficiente = analiseEstoque?.some(a => !a.ok) ?? false;

    // Máximo de grades completas possíveis com o estoque disponível (já descontando carrinho)
    const maxGradesDisponiveis = useMemo(() => {
        if (!gradeSelecionada || !analiseEstoque) return 0;
        const mins = analiseEstoque
            .filter(a => a.qtdPorGrade > 0)
            .map(a => Math.floor(a.disponivel / a.qtdPorGrade));
        return mins.length > 0 ? Math.min(...mins) : 0;
    }, [gradeSelecionada, analiseEstoque]);
    const totalPecas = gradeSelecionada
        ? gradeSelecionada.totalPecas * quantidadeGrades
        : 0;
    const valorTotal = gradeSelecionada
        ? gradeSelecionada.precoSugerido * quantidadeGrades
        : 0;

    const handleConfirmar = () => {
        if (!gradeSelecionada || !modeloSelecionado || !analiseEstoque) return;

        // Criar um ItemPedido para cada variação da grade
        const novosItens: ItemPedido[] = analiseEstoque
            .filter(a => a.variacaoId && a.necessario > 0)
            .map(a => ({
                id: crypto.randomUUID(),
                tipo: 'grade' as const,
                produtoId: a.variacaoId,
                produtoNome: `${modeloSelecionado.meta.referencia}-${a.tamanho}`,
                quantidade: a.necessario,
                valorUnitario: modeloSelecionado.precoUnitario ?? 0,
                quantidadeDisponivel: a.disponivel,
                gradeId: gradeSelecionada.id,
                gradeNome: gradeSelecionada.nome,
                quantidadeGrades,
                gradeTotalPecas: gradeSelecionada.totalPecas,
                modeloId: modeloSelecionado.id,
                modeloNome: modeloSelecionado.nome.split('—')[0].trim(),
            }));

        onAdd(novosItens);
        handleClose();
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-gradient-to-r from-indigo-500/5 to-purple-500/10 shrink-0">
                    <div className="flex items-center gap-3">
                        {step === 'select-grade' && (
                            <button
                                onClick={handleBack}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                        )}
                        <div>
                            <DialogTitle className="text-base font-bold flex items-center gap-2">
                                <Package2 className="h-4 w-4 text-indigo-600" />
                                {step === 'select-model' ? 'Adicionar por Grade' : `Grade — ${modeloSelecionado?.meta.referencia}`}
                            </DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">
                                {step === 'select-model'
                                    ? 'Selecione um modelo padronizado com grades definidas'
                                    : 'Escolha a grade e informe quantas grades pediu'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-auto">
                    {/* ── Passo 1: Selecionar Modelo ── */}
                    {step === 'select-model' && (
                        <div className="px-6 py-4 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar modelo ou referência..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-8 h-9 text-sm shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                    autoFocus
                                />
                            </div>

                            {modelos.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Package2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        {search ? 'Nenhum modelo encontrado' : 'Nenhum modelo com grades definidas'}
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                        Defina grades no cadastro do modelo padronizado
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {modelos.map(m => {
                                        const totalQtd = m.variacoes.reduce((s, v) => s + v.quantidade, 0);
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => handleSelectModelo(m)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all text-left group"
                                            >
                                                <Layers className="h-8 w-8 text-indigo-500 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate">{m.nome.split('—')[0].trim()}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] font-mono text-muted-foreground">{m.meta.referencia}</span>
                                                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                                            {m.meta.grades!.length} grade(s)
                                                        </Badge>
                                                        <span className="text-[11px] text-muted-foreground">{totalQtd} pçs</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600 shrink-0 transition-colors" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Passo 2: Selecionar Grade ── */}
                    {step === 'select-grade' && modeloSelecionado && (
                        <div className="px-6 py-4 space-y-4">
                            {/* Grades disponíveis */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Grades do Modelo
                                </Label>
                                {modeloSelecionado.meta.grades!.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => setGradeSelecionada(g)}
                                        className={cn(
                                            'w-full p-3 rounded-xl border-2 text-left transition-all',
                                            gradeSelecionada?.id === g.id
                                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                                                : 'border-border bg-background hover:border-indigo-300'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm">{g.nome}</span>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px]">{g.totalPecas} peças</Badge>
                                                <span className="text-xs font-bold text-emerald-600">R$ {g.precoSugerido.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        {/* mini tabela de itens */}
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {g.itens.map(i => (
                                                <span key={i.tamanho} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">
                                                    {i.tamanho}×{i.quantidade}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Quantidade de grades */}
                            {gradeSelecionada && (
                                <>
                                    <Separator />
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <Label className="text-sm font-semibold">Quantas grades?</Label>
                                                {maxGradesDisponiveis > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        máx. {maxGradesDisponiveis} grade(s) disponível(is)
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => setQuantidadeGrades(q => Math.max(1, q - 1))}
                                                    disabled={quantidadeGrades <= 1}
                                                >−</Button>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={maxGradesDisponiveis || undefined}
                                                    value={quantidadeGrades}
                                                    onChange={e => {
                                                        const parsed = Math.max(1, parseInt(e.target.value) || 1);
                                                        setQuantidadeGrades(maxGradesDisponiveis > 0 ? Math.min(parsed, maxGradesDisponiveis) : parsed);
                                                    }}
                                                    className="h-8 w-16 text-center font-bold shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => setQuantidadeGrades(q => q + 1)}
                                                    disabled={maxGradesDisponiveis > 0 && quantidadeGrades >= maxGradesDisponiveis}
                                                >+</Button>
                                            </div>
                                        </div>

                                        {/* Resumo */}
                                        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo do pedido</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                {analiseEstoque?.map(a => (
                                                    <div key={a.tamanho} className="flex items-center justify-between text-sm">
                                                        <span className="font-mono font-semibold text-xs">{a.tamanho}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold">{a.necessario}×</span>
                                                            {a.ok ? (
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                            ) : (
                                                                <span className="text-[10px] text-amber-600 font-medium">({a.disponivel} disp.)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Total de peças</span>
                                                <span className="font-bold">{totalPecas}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Valor total</span>
                                                <span className="font-bold text-emerald-600">R$ {valorTotal.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Alerta de estoque */}
                                        {maxGradesDisponiveis === 0 ? (
                                            <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                                <p className="text-xs text-destructive font-medium">
                                                    Estoque insuficiente para adicionar esta grade.
                                                </p>
                                            </div>
                                        ) : estoqueInsuficiente ? (
                                            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                                    Quantidade solicitada ultrapassa o estoque disponível para alguns tamanhos.
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </ScrollArea>

                {step === 'select-grade' && gradeSelecionada && (
                    <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0">
                        <Button variant="outline" onClick={handleBack}>Voltar</Button>
                        <Button
                            onClick={handleConfirmar}
                            disabled={maxGradesDisponiveis === 0 || quantidadeGrades > maxGradesDisponiveis}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white gap-2"
                        >
                            <Package2 className="h-4 w-4" />
                            Adicionar {quantidadeGrades}× {gradeSelecionada.nome}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
