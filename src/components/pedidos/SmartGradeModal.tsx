import { useState, useMemo, useEffect, useRef } from 'react';
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
import { cn } from '@/lib/utils';
import {
    Package2,
    Layers,
    Search,
    ChevronRight,
    ArrowLeft,
    AlertTriangle,
    X,
    Plus,
    Minus,
    Tag,
    Copy,
    Check,
} from 'lucide-react';
import { useModelosPadronizados, ModeloPadronizado } from '@/hooks/useModelosPadronizados';
import { ItemPedido } from './ItemPedidoRow';

// ─────────────────────────────────────────────────────────
// Tipos e Interfaces
// ─────────────────────────────────────────────────────────

export interface ModeloAgrupado {
    id: string;
    nome: string;
    referencia: string;
    precoVenda: number;
    quantidadeTotal: number;
    isModeloPadronizado: boolean;
    tamanhos: string[];
    variacoesRaw: Array<{
        id: string;
        quantidade: number;
        tamanho: string;
        nome: string;
    }>;
    metadata: {
        grade_tamanhos: string[];
    };
}

interface SmartGradeModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (items: ItemPedido[]) => void;
    initialModelId?: string | null;
    initialQuantities?: Record<string, number>; // tamanho -> quantidade
}

// ─────────────────────────────────────────────────────────
// Auxiliares
// ─────────────────────────────────────────────────────────

const ORDEM_TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4', 'G5'];

const compararTamanhos = (a: string, b: string) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    
    const idxA = ORDEM_TAMANHOS.indexOf(a.toUpperCase());
    const idxB = ORDEM_TAMANHOS.indexOf(b.toUpperCase());
    
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    
    return a.localeCompare(b, undefined, { numeric: true });
};

function QuantityStepper({ value, onChange, min = 0, className }: { value: number, onChange: (val: number) => void, min?: number, className?: string }) {
    return (
        <div className={cn("flex items-center rounded-xl border border-indigo-100 bg-white dark:bg-slate-900 overflow-hidden shadow-sm", className)}>
            <button 
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 transition-colors border-r border-indigo-50"
            >
                <Minus size={14} />
            </button>
            <Input
                type="number"
                value={value || ''}
                onChange={e => onChange(parseInt(e.target.value) || 0)}
                className="w-12 h-9 border-0 bg-transparent text-center font-bold text-sm focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
            />
            <button 
                type="button"
                onClick={() => onChange(value + 1)}
                className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 transition-colors border-l border-indigo-50"
            >
                <Plus size={14} />
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────

export function SmartGradeModal({
    open,
    onClose,
    onAdd,
    initialModelId,
    initialQuantities
}: SmartGradeModalProps) {
    const { modelosPadronizados } = useModelosPadronizados();

    // Estados internos
    const [step, setStep] = useState<'search' | 'configure'>('search');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [numGrades, setNumGrades] = useState(0);
    const [manualQuantities, setManualQuantities] = useState<Record<string, number>>({});
    const [customPrice, setCustomPrice] = useState(0);
    const [copiedLoose, setCopiedLoose] = useState(false);

    // Mapear modelos para ModeloAgrupado
    const modelosAgrupados: ModeloAgrupado[] = useMemo(() => {
        return modelosPadronizados.map(m => {
            const variacoesOrdenadas = [...m.variacoes].sort((a, b) => compararTamanhos(a.tamanho, b.tamanho));
            const isManual = m.variacoes.length === 0;

            return {
                id: m.id,
                nome: m.nome.split(' — ')[0].trim(),
                referencia: m.meta.referencia,
                precoVenda: m.precoUnitario || 0,
                quantidadeTotal: isManual ? (m as any).quantidade : m.variacoes.reduce((s, v) => s + v.quantidade, 0),
                isModeloPadronizado: !isManual,
                tamanhos: variacoesOrdenadas.map(v => v.tamanho),
                variacoesRaw: variacoesOrdenadas.map(v => ({
                    id: v.id,
                    quantidade: v.quantidade,
                    tamanho: v.tamanho,
                    nome: v.nome
                })),
                metadata: {
                    grade_tamanhos: (m.meta.grades?.[0]?.itens.map(i => i.tamanho) || []).sort(compararTamanhos)
                }
            };
        });
    }, [modelosPadronizados]);

    const selectedModel = useMemo(() => 
        modelosAgrupados.find(m => m.id === selectedModelId), 
    [modelosAgrupados, selectedModelId]);

    // Filtrar modelos
    const filteredModels = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return modelosAgrupados;
        return modelosAgrupados.filter(m => 
            m.nome.toLowerCase().includes(term) || 
            m.referencia.toLowerCase().includes(term)
        );
    }, [modelosAgrupados, searchTerm]);

    // Inicialização (Edição)
    useEffect(() => {
        if (open) {
            if (initialModelId) {
                const model = modelosAgrupados.find(m => m.id === initialModelId);
                if (model) {
                    setSelectedModelId(initialModelId);
                    setStep('configure');
                    setCustomPrice(model.precoVenda);

                    const qtsInput = initialQuantities || {};
                    
                    // Calcular quantidade de grades iniciais
                    const gradeSizes = model.metadata.grade_tamanhos;
                    if (gradeSizes.length > 0) {
                        const qts = gradeSizes.map(t => qtsInput[t] || 0);
                        const minQ = Math.min(...qts);
                        const allEqual = qts.every(q => q === minQ && q > 0);
                        
                        if (allEqual) {
                            setNumGrades(minQ);
                            // Manual é o que sobra
                            const manual: Record<string, number> = {};
                            Object.entries(qtsInput).forEach(([t, q]) => {
                                manual[t] = q - minQ;
                            });
                            setManualQuantities(manual);
                        } else {
                            setNumGrades(0);
                            setManualQuantities(qtsInput);
                        }
                    } else {
                        setNumGrades(0);
                        setManualQuantities(qtsInput);
                    }
                }
            }
        } else {
            // Reset ao fechar
            setStep('search');
            setSearchTerm('');
            setSelectedModelId(null);
            setNumGrades(0);
            setManualQuantities({});
            setCustomPrice(0);
        }
    }, [open, initialModelId, modelosAgrupados]); // Removido initialQuantities para evitar loops

    // ── Cálculos Dinâmicos ──────────────────────────────────

    const stats = useMemo(() => {
        if (!selectedModel) return null;

        const gradeSizes = selectedModel.metadata.grade_tamanhos;
        const totalPerSize: Record<string, number> = {};
        
        // Calcular totais por tamanho
        selectedModel.tamanhos.forEach(t => {
            const isInGrade = gradeSizes.includes(t);
            totalPerSize[t] = (isInGrade ? numGrades : 0) + (manualQuantities[t] || 0);
        });

        const totalItems = Object.values(totalPerSize).reduce((s, v) => s + v, 0);

        // Detectar Grades Reais Selecionadas
        let numGradesDetected = 0;
        if (gradeSizes.length > 0) {
            numGradesDetected = Math.min(...gradeSizes.map(t => totalPerSize[t] || 0));
        }
        const numLooseDetected = totalItems - (numGradesDetected * gradeSizes.length);

        // Estoque Disponível
        const stockStatus: Record<string, {
            disponivel: number;
            looseTotal: number;
            isOverStock: boolean;
            isBreakingGrade: boolean;
            totalPescado: number;
        }> = {};

        // 1. Total de grades possíveis no estoque bruto
        const maxGradesPossible = gradeSizes.length > 0 
            ? Math.min(...gradeSizes.map(t => 
                selectedModel.variacoesRaw.find(v => v.tamanho === t)?.quantidade || 0
            ))
            : 0;

        // Caso especial: Modelo Manual (sem variações)
        if (selectedModel.variacoesRaw.length === 0) {
            const qty = manualQuantities['AVULSO'] || 0;
            const disponivel = selectedModel.quantidadeTotal;
            return {
                totalItems: qty,
                numGradesDetected: 0,
                numLooseDetected: qty,
                stockStatus: {
                    'AVULSO': {
                        disponivel,
                        looseTotal: disponivel,
                        isOverStock: qty > disponivel,
                        isBreakingGrade: false,
                        totalPescado: qty
                    }
                },
                gradesEmEstoquePosSelecao: 0,
                hasOverStock: qty > disponivel,
                gradeSizes: []
            };
        }

        selectedModel.variacoesRaw.forEach(v => {
            const t = v.tamanho;
            const totalPescado = totalPerSize[t] || 0;
            const isOverStock = totalPescado > v.quantidade;
            
            // Loose = total - grades_possiveis
            const isInGrade = gradeSizes.includes(t);
            const looseTotal = isInGrade ? v.quantidade - maxGradesPossible : v.quantidade;
            
            // Quebra grade se o excedente acima das grades selecionadas ultrapassa o looseTotal
            const surplus = Math.max(0, totalPescado - numGradesDetected);
            const isBreakingGrade = isInGrade && surplus > looseTotal;

            stockStatus[t] = {
                disponivel: v.quantidade,
                looseTotal,
                isOverStock,
                isBreakingGrade,
                totalPescado
            };
        });

        // Resumo de Grades em Estoque (após seleção)
        const gradesEmEstoquePosSelecao = gradeSizes.length > 0
            ? Math.min(...gradeSizes.map(t => 
                Math.max(0, (selectedModel.variacoesRaw.find(v => v.tamanho === t)?.quantidade || 0) - (totalPerSize[t] || 0))
            ))
            : 0;

        return {
            totalItems,
            numGradesDetected,
            numLooseDetected,
            stockStatus,
            gradesEmEstoquePosSelecao,
            hasOverStock: Object.values(stockStatus).some(s => s.isOverStock),
            gradeSizes
        };
    }, [selectedModel, numGrades, manualQuantities]);

    // ── Handlers ───────────────────────────────────────────

    const handleSelectModel = (id: string) => {
        const model = modelosAgrupados.find(m => m.id === id);
        setSelectedModelId(id);
        setStep('configure');
        setCustomPrice(model?.precoVenda || 0);
        setNumGrades(0);
        setManualQuantities({});
    };

    const handleNumGradesChange = (val: number) => {
        const n = Math.max(0, val);
        setNumGrades(n);
    };

    const handleManualChange = (tamanho: string, val: number) => {
        setManualQuantities(prev => ({
            ...prev,
            [tamanho]: Math.max(0, val)
        }));
    };

    const handleConfirm = () => {
        if (!selectedModel || !stats || stats.totalItems === 0 || stats.hasOverStock) return;

        const currentGradeId = crypto.randomUUID();
        const items: ItemPedido[] = [];
        
        if (selectedModel.variacoesRaw.length === 0) {
            // Modelo Manual
            const qty = manualQuantities['AVULSO'] || 0;
            if (qty > 0) {
                items.push({
                    id: crypto.randomUUID(),
                    produtoId: selectedModel.id,
                    produtoNome: selectedModel.nome,
                    quantidade: qty,
                    valorUnitario: customPrice,
                    valorOriginal: selectedModel.precoVenda,
                    tipo: 'avulso',
                    modeloId: selectedModel.id,
                    referencia: selectedModel.referencia,
                    metadata: {
                        referencia: selectedModel.referencia,
                        isManual: true
                    }
                });
            }
        } else {
            // Modelo Padronizado (Grade)
            selectedModel.variacoesRaw.forEach(v => {
                const qty = (selectedModel.metadata.grade_tamanhos.includes(v.tamanho) ? numGrades : 0) + (manualQuantities[v.tamanho] || 0);
                
                if (qty > 0) {
                    items.push({
                        id: crypto.randomUUID(),
                        produtoId: v.id,
                        produtoNome: `${selectedModel.nome} — ${v.tamanho}`,
                        quantidade: qty,
                        valorUnitario: customPrice,
                        valorOriginal: selectedModel.precoVenda,
                        tipo: 'grade',
                        gradeId: currentGradeId,
                        modeloId: selectedModel.id,
                        modeloNome: selectedModel.nome,
                        referencia: selectedModel.referencia,
                        metadata: {
                            model_id: selectedModel.id,
                            referencia: selectedModel.referencia,
                            tamanho: v.tamanho
                        }
                    });
                }
            });
        }

        onAdd(items);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-indigo-100 dark:border-indigo-900/50">
                
                {/* ── Header ── */}
                <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background shrink-0">
                    <div className="flex items-center gap-3">
                        {step === 'configure' && (
                            <Button variant="ghost" size="icon" onClick={() => setStep('search')} className="h-8 w-8 rounded-full">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div>
                            <DialogTitle className="text-xl font-extrabold text-indigo-950 dark:text-indigo-100 tracking-tight flex items-center gap-2">
                                <Package2 className="h-5 w-5 text-indigo-600" />
                                {step === 'search' ? 'Adicionar Modelo' : 'Configurar Seleção'}
                            </DialogTitle>
                            <DialogDescription className="text-xs font-medium text-indigo-600/60 dark:text-indigo-400/50 uppercase tracking-widest">
                                {step === 'search' ? 'Busque por nome ou referência' : `Ref: ${selectedModel?.referencia}`}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Content Area ── */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {step === 'search' ? (
                        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ex: Calça jeans clara..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-11 h-12 rounded-xl border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-background/50 shadow-sm text-base"
                                    autoFocus
                                />
                            </div>

                            <ScrollArea className="flex-1 -mx-2 px-2">
                                <div className="grid grid-cols-1 gap-2 pb-4">
                                    {filteredModels.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleSelectModel(m.id)}
                                            className="w-full group p-4 rounded-xl border border-indigo-50 dark:border-indigo-900/20 bg-white dark:bg-indigo-950/5 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-left flex items-center gap-4"
                                        >
                                            <div className="h-12 w-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Layers className="h-6 w-6 text-indigo-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-bold text-indigo-950 dark:text-indigo-100 truncate">{m.nome}</p>
                                                    <p className="text-emerald-600 font-bold text-sm">R$ {m.precoVenda.toFixed(2)}</p>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded tracking-wider uppercase">
                                                        Ref {m.referencia}
                                                    </span>
                                                    {!m.isModeloPadronizado && (
                                                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">
                                                            Manual
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-medium text-muted-foreground">
                                                        • {m.quantidadeTotal} pçs em estoque
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-indigo-200 group-hover:text-indigo-500 transition-colors" />
                                        </button>
                                    ))}
                                    {filteredModels.length === 0 && (
                                        <div className="py-20 text-center text-muted-foreground">
                                            <p className="text-sm">Nenhum modelo encontrado com "{searchTerm}"</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-6">
                                {/* Card do Modelo Selecionado */}
                                <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                                            <Package2 className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-indigo-950 dark:text-indigo-100 truncate">{selectedModel?.nome}</p>
                                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">REF {selectedModel?.referencia}</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setStep('search')} className="rounded-lg border-indigo-200 text-xs font-bold text-indigo-600 h-8">
                                        Trocar modelo
                                    </Button>
                                </div>

                                {selectedModel?.variacoesRaw.length === 0 ? (
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-xl border border-indigo-100 bg-white dark:bg-background/40 flex items-center justify-between shadow-sm">
                                            <div>
                                                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Quantidade Total</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">Estoque disponível: {selectedModel.quantidadeTotal} pçs</p>
                                            </div>
                                            <QuantityStepper 
                                                value={manualQuantities['AVULSO'] || 0}
                                                onChange={(val) => setManualQuantities({ 'AVULSO': val })}
                                                className="w-32"
                                            />
                                        </div>
                                        { (manualQuantities['AVULSO'] || 0) > selectedModel.quantidadeTotal && (
                                            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                                                <AlertTriangle size={14} />
                                                <span>Quantidade selecionada acima do estoque disponível.</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Bloco Estoque Disponível */}
                                        <div className="space-y-3">
                                            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">Estoque Disponível</h4>
                                            <div className={`grid gap-3 ${(selectedModel?.metadata.grade_tamanhos.length ?? 0) > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                {(selectedModel?.metadata.grade_tamanhos.length ?? 0) > 0 && (
                                                <div className="p-4 rounded-xl bg-white dark:bg-background/40 border border-indigo-100 dark:border-indigo-900/30">
                                                    <p className="text-2xl font-black text-indigo-600">{stats?.gradesEmEstoquePosSelecao}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Grades Livres</p>
                                                </div>
                                                )}
                                                <div className="p-4 rounded-xl bg-white dark:bg-background/40 border border-indigo-100 dark:border-indigo-900/30">
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedModel?.variacoesRaw
                                                            .filter(v => (stats?.stockStatus[v.tamanho].looseTotal || 0) > 0)
                                                            .map(v => {
                                                                const looseQty = stats?.stockStatus[v.tamanho].looseTotal || 0;
                                                                return (
                                                                    <div key={v.tamanho} className="inline-flex items-center rounded-md border border-indigo-200 dark:border-indigo-800 overflow-hidden shadow-sm">
                                                                        <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 min-w-[24px] text-center">
                                                                            {v.tamanho}
                                                                        </span>
                                                                        <span className="bg-white dark:bg-slate-900 text-indigo-600 text-[11px] font-bold px-2 py-0.5">
                                                                            {looseQty}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        {selectedModel?.variacoesRaw.filter(v => (stats?.stockStatus[v.tamanho].looseTotal || 0) > 0).length === 0 && (
                                                            <span className="text-[10px] text-muted-foreground italic px-1">Nenhuma peça avulsa</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Peças Avulsas em Estoque</p>
                                                        {(() => {
                                                            const avulsas = selectedModel?.variacoesRaw.filter(v => (stats?.stockStatus[v.tamanho].looseTotal || 0) > 0) || [];
                                                            if (avulsas.length === 0) return null;
                                                            const handleCopy = () => {
                                                                const texto = `*${selectedModel?.nome}* — Peças avulsas disponíveis:\n` +
                                                                    avulsas.map(v => `  Tam. ${v.tamanho}: ${stats?.stockStatus[v.tamanho].looseTotal} pç`).join('\n');
                                                                navigator.clipboard.writeText(texto);
                                                                setCopiedLoose(true);
                                                                setTimeout(() => setCopiedLoose(false), 2000);
                                                            };
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCopy}
                                                                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-600 transition-colors"
                                                                    title="Copiar disponibilidade"
                                                                >
                                                                    {copiedLoose ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                                                    <span>{copiedLoose ? 'Copiado!' : 'Copiar'}</span>
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Inserir Grades Completas — só exibe se o modelo tem grade configurada */}
                                        {(selectedModel?.metadata.grade_tamanhos.length ?? 0) > 0 && (
                                        <div className="space-y-3">
                                            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">Inserir Grades Completas</Label>
                                            <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/20">
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Grade Padrão</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        Tamanhos: {selectedModel?.metadata.grade_tamanhos.join(', ')}
                                                    </p>
                                                </div>
                                                <div className="w-auto">
                                                    <QuantityStepper
                                                        value={numGrades}
                                                        onChange={handleNumGradesChange}
                                                        className="w-32"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        )}

                                        {/* Grid Ajuste de Peças */}
                                        <div className="space-y-3">
                                            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">Ajuste de Peças por Tamanho</Label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {selectedModel?.variacoesRaw.map(v => {
                                                    const s = stats?.stockStatus[v.tamanho];
                                                    const isInGrade = selectedModel.metadata.grade_tamanhos.includes(v.tamanho);
                                                    const baseQty = isInGrade ? numGrades : 0;
                                                    const manualQty = manualQuantities[v.tamanho] || 0;
                                                    const total = baseQty + manualQty;

                                                    return (
                                                        <div 
                                                            key={v.tamanho} 
                                                            className={cn(
                                                                "p-3 rounded-xl border transition-all",
                                                                s?.isOverStock 
                                                                    ? "border-red-500 bg-red-50 dark:bg-red-950/20" 
                                                                    : s?.isBreakingGrade 
                                                                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                                                                        : "border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-background/20"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-black text-indigo-950 dark:text-indigo-100">{v.tamanho}</span>
                                                                    {isInGrade && <Layers className="h-3 w-3 text-indigo-400" />}
                                                                </div>
                                                                <span className="text-[9px] font-bold text-muted-foreground">Estoque: {v.quantidade}</span>
                                                            </div>
                                                            <QuantityStepper 
                                                                value={total}
                                                                onChange={newTotal => {
                                                                    const m = Math.max(0, newTotal - baseQty);
                                                                    if (newTotal < baseQty) {
                                                                        setManualQuantities(prev => ({ ...prev, [v.tamanho]: Math.max(0, newTotal - (isInGrade ? numGrades : 0)) }));
                                                                    } else {
                                                                        handleManualChange(v.tamanho, m);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "h-10 w-full",
                                                                    s?.isOverStock ? "border-red-300" : "border-indigo-100"
                                                                )}
                                                            />
                                                            {s?.isOverStock ? (
                                                                <p className="text-[9px] text-red-600 font-bold mt-1 text-center uppercase tracking-tighter">Estoque insuficiente</p>
                                                            ) : s?.isBreakingGrade ? (
                                                                <p className="text-[9px] text-amber-600 font-bold mt-1 text-center uppercase tracking-tighter">Quebra grade</p>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* ── Footer ── */}
                <DialogFooter className="p-6 border-t bg-white dark:bg-indigo-950/10 shrink-0">
                    <div className="flex flex-col w-full gap-4">
                        {step === 'configure' && (() => {
                            const precoOriginal = selectedModel?.precoVenda || 0;
                            const descPorPeca = Math.max(0, precoOriginal - customPrice);
                            const descontoTotal = descPorPeca * (stats?.totalItems || 0);
                            const totalFinal = (stats?.totalItems || 0) * customPrice;
                            return (
                                <div className="flex flex-col gap-2 px-2">
                                    {/* Linha peças + preço editável */}
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                                            {stats?.totalItems} peças
                                            <span className="text-muted-foreground font-medium ml-1">
                                                ({stats?.numGradesDetected} grades + {stats?.numLooseDetected} avulsas)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-3.5 w-3.5 text-indigo-400" />
                                            <span className="text-xs text-muted-foreground">R$</span>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={customPrice || ''}
                                                onChange={e => setCustomPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                                className="w-20 text-right border-b-2 border-indigo-300 focus:border-indigo-600 outline-none text-base font-black text-indigo-950 dark:text-indigo-100 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="text-[10px] text-muted-foreground">/peça</span>
                                        </div>
                                    </div>
                                    {/* Linha desconto + total */}
                                    <div className="flex items-center justify-between">
                                        {descontoTotal > 0 ? (
                                            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                                                <span className="line-through text-muted-foreground font-normal">
                                                    R$ {(precoOriginal).toFixed(2)}/peça
                                                </span>
                                                <span>— desconto de R$ {descontoTotal.toFixed(2)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Preço de tabela</span>
                                        )}
                                        <div className="text-lg font-black text-emerald-600">
                                            R$ {totalFinal.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold border-indigo-100">
                                Cancelar
                            </Button>
                            {step === 'configure' && (
                                <Button
                                    onClick={handleConfirm}
                                    disabled={!stats || stats.totalItems === 0 || stats.hasOverStock}
                                    className={cn(
                                        "flex-[2] h-12 rounded-xl font-black uppercase tracking-widest transition-all",
                                        stats?.hasOverStock 
                                            ? "bg-red-500 hover:bg-red-600 text-white" 
                                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                                    )}
                                >
                                    {stats?.hasOverStock ? "Estoque Insuficiente" : `Adicionar ${stats?.totalItems} Peças`}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
