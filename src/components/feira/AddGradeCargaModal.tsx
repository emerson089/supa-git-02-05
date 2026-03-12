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
import { cn } from '@/lib/utils';
import {
    Package2,
    Layers,
    Search,
    ChevronRight,
    ArrowLeft,
    AlertTriangle,
    CheckCircle2,
    Truck,
    Plus,
} from 'lucide-react';

interface ItemCarga {
    itemId: string;
    nome: string;
    quantidade: number;
    precoUnitario: number;
    disponivelCentral: number;
    imagemUrl: string | null;
}

interface AddGradeCargaModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (items: ItemCarga[]) => void;
    getDisponivelCentral: (itemId: string) => number;
}

type Step = 'select-model' | 'select-grade';

export function AddGradeCargaModal({ open, onClose, onAdd, getDisponivelCentral }: AddGradeCargaModalProps) {
    const { modelosPadronizados } = useModelosPadronizados();

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

    // Calcular disponibilidade por variação para a grade selecionada (BASEADO NO CENTRAL)
    const analiseEstoque = useMemo(() => {
        if (!gradeSelecionada || !modeloSelecionado) return null;

        return gradeSelecionada.itens.map(item => {
            const variacao = modeloSelecionado.variacoes.find(v => v.tamanho === item.tamanho);
            const disponivel = variacao ? getDisponivelCentral(variacao.id) : 0;
            const necessario = item.quantidade * quantidadeGrades;
            return {
                tamanho: item.tamanho,
                qtdPorGrade: item.quantidade,
                necessario,
                disponivel,
                ok: disponivel >= necessario,
                variacaoId: variacao?.id ?? '',
                imagemUrl: variacao?.imagemUrl ?? modeloSelecionado.imagemUrl
            };
        });
    }, [gradeSelecionada, modeloSelecionado, quantidadeGrades, getDisponivelCentral]);

    const estoqueInsuficiente = analiseEstoque?.some(a => !a.ok) ?? false;
    const totalPecas = gradeSelecionada
        ? gradeSelecionada.totalPecas * quantidadeGrades
        : 0;

    const handleConfirmar = () => {
        if (!gradeSelecionada || !modeloSelecionado || !analiseEstoque) return;

        // Criar um ItemCarga para cada variação da grade
        const novosItens: ItemCarga[] = analiseEstoque
            .filter(a => a.variacaoId && a.necessario > 0)
            .map(a => ({
                itemId: a.variacaoId,
                nome: `${modeloSelecionado.nome.split('—')[0].trim()} — ${a.tamanho}`,
                quantidade: a.necessario,
                precoUnitario: modeloSelecionado.precoUnitario ?? 0,
                disponivelCentral: a.disponivel,
                imagemUrl: a.imagemUrl ?? null
            }));

        onAdd(novosItens);
        handleClose();
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0 z-[1000]">
                <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-gradient-to-r from-blue-500/5 to-primary/10 shrink-0">
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
                            <DialogTitle className="text-base font-bold flex items-center gap-2 text-primary">
                                <Truck className="h-4 w-4" />
                                {step === 'select-model' ? 'Adicionar Carga por Grade' : `Grade para Carga — ${modeloSelecionado?.meta.referencia}`}
                            </DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">
                                {step === 'select-model'
                                    ? 'Selecione um modelo para carregar grades completas'
                                    : 'A disponibilidade reflete o estoque CENTRAL'}
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
                                    className="pl-8 h-10 text-sm bg-muted/20"
                                    autoFocus
                                />
                            </div>

                            {modelos.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Package2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        {search ? 'Nenhum modelo encontrado' : 'Nenhum modelo com grades definidas'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {modelos.map(m => {
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => handleSelectModelo(m)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                                            >
                                                <Layers className="h-8 w-8 text-primary shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate">{m.nome.split('—')[0].trim()}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] font-mono text-muted-foreground uppercase">{m.meta.referencia}</span>
                                                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                                            {m.meta.grades!.length} grade(s)
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
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
                                    Grades Disponíveis
                                </Label>
                                {modeloSelecionado.meta.grades!.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => setGradeSelecionada(g)}
                                        className={cn(
                                            'w-full p-3 rounded-xl border-2 text-left transition-all',
                                            gradeSelecionada?.id === g.id
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border bg-background hover:border-primary/30'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm">{g.nome}</span>
                                            <Badge variant="secondary" className="text-[10px]">{g.totalPecas} peças</Badge>
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
                                            <Label className="text-sm font-semibold">Quantas grades carregar?</Label>
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
                                                    value={quantidadeGrades}
                                                    onChange={e => setQuantidadeGrades(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="h-8 w-16 text-center font-bold"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => setQuantidadeGrades(q => q + 1)}
                                                >+</Button>
                                            </div>
                                        </div>

                                        {/* Resumo */}
                                        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itens da Carga</p>
                                                <span className="text-xs font-bold text-primary">{totalPecas} peças total</span>
                                            </div>
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
                                        </div>

                                        {/* Alerta de estoque insuficiente */}
                                        {estoqueInsuficiente && (
                                            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                                    Estoque do CENTRAL insuficiente para alguns tamanhos. A carga será criada apenas com o disponível ou conforme sua confirmação.
                                                </p>
                                            </div>
                                        )}
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
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Adicionar {totalPecas} Peças
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
