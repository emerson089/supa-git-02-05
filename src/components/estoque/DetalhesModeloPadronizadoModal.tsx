import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
    useModelosPadronizados,
    ModeloPadronizado,
    VariacaoModelo,
    TIPO_GARMENT_LABELS,
    TAMANHOS_LETRAS,
    TAMANHOS_NUMERICOS,
} from '@/hooks/useModelosPadronizados';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useUpdateItem, useAddMovimentacao } from '@/hooks/useEstoqueData';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
    Package,
    Tag,
    Tags,
    Printer,
    Shirt,
    DollarSign,
    Palette,
    Hash,
    Layers,
    Pencil,
    Check,
    X,
    Loader2,
    Plus,
} from 'lucide-react';
import { EtiquetasModal } from './EtiquetasModal';
import { toast } from 'sonner';

interface Props {
    modelo: ModeloPadronizado | null;
    open: boolean;
    onClose: () => void;
}

function ModeloImage({ imagemUrl, nome }: { imagemUrl?: string; nome: string }) {
    const { signedUrl, loading } = useSignedUrl(imagemUrl);
    if (!imagemUrl) {
        return (
            <div className="w-full h-48 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 flex items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground/30" />
            </div>
        );
    }
    if (loading) {
        return <div className="w-full h-48 rounded-xl bg-muted/50 animate-pulse" />;
    }
    return (
        <img
            src={signedUrl || imagemUrl}
            alt={nome}
            className="w-full h-48 rounded-xl object-cover shadow-md"
        />
    );
}

function getStockColor(qtd: number) {
    if (qtd === 0) return 'bg-red-100 text-red-700 border-red-200';
    if (qtd <= 3) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

export function DetalhesModeloPadronizadoModal({ modelo, open, onClose }: Props) {
    const [showEtiquetas, setShowEtiquetas] = useState(false);
    const [localVariacoes, setLocalVariacoes] = useState<VariacaoModelo[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingQtd, setEditingQtd] = useState('');
    const [editingQtdIni, setEditingQtdIni] = useState('');
    const [saving, setSaving] = useState(false);
    const [qtdGrade, setQtdGrade] = useState('');
    const [applyingGrade, setApplyingGrade] = useState(false);
    const [addingSize, setAddingSize] = useState(false);
    const [newSize, setNewSize] = useState('');
    const [newSizeQtd, setNewSizeQtd] = useState('');

    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { mutateAsync: updateItem } = useUpdateItem();
    const { mutateAsync: addMovimentacao } = useAddMovimentacao();
    const { adicionarVariacao } = useModelosPadronizados();

    useEffect(() => {
        if (modelo) {
            const ORDEM = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];
            const sorted = [...modelo.variacoes].sort(
                (a, b) => ORDEM.indexOf(a.tamanho) - ORDEM.indexOf(b.tamanho)
            );
            setLocalVariacoes(sorted);
            setEditingId(null);
        }
    }, [modelo?.id]);

    if (!modelo) return null;
    const { meta, nome, precoUnitario } = modelo;

    const totalPecas = localVariacoes.reduce((s, v) => s + v.quantidade, 0);
    const totalProduzido = localVariacoes.reduce((s, v) => s + (v.quantidadeInicial ?? v.quantidade), 0);

    const startEdit = (v: VariacaoModelo) => {
        setEditingId(v.id);
        setEditingQtd(String(v.quantidade));
        setEditingQtdIni(String(v.quantidadeInicial ?? v.quantidade));
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingQtd('');
        setEditingQtdIni('');
    };

    const saveEdit = async (v: VariacaoModelo) => {
        const novaQtd = parseInt(editingQtd, 10);
        const novaQtdIni = parseInt(editingQtdIni, 10);
        if (isNaN(novaQtd) || novaQtd < 0) return;
        if (isNaN(novaQtdIni) || novaQtdIni < 0) return;

        const diff = novaQtd - v.quantidade;
        if (diff === 0 && novaQtdIni === v.quantidadeInicial) {
            setEditingId(null);
            return;
        }

        setSaving(true);
        try {
            await updateItem({ id: v.id, quantidade: novaQtd, quantidadeInicial: novaQtdIni });
            await addMovimentacao({
                itemId: v.id,
                tipo: diff > 0 ? 'entrada' : 'saida',
                quantidade: Math.abs(diff),
                motivo: `Ajuste manual (Individual) - Tam ${v.tamanho}`,
                producaoId: null
            });

            setLocalVariacoes(prev =>
                prev.map(lv => lv.id === v.id ? { ...lv, quantidade: novaQtd, quantidadeInicial: novaQtdIni } : lv)
            );
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['modelos-padronizados', user?.id] });
        } finally {
            setSaving(false);
        }
    };

    const handleApplyGrade = async () => {
        const valorGrade = parseInt(qtdGrade, 10);
        if (isNaN(valorGrade) || valorGrade < 0) return;

        setApplyingGrade(true);
        try {
            for (const v of localVariacoes) {
                const diff = valorGrade - v.quantidade;
                if (diff !== 0) {
                    await updateItem({ id: v.id, quantidade: valorGrade });
                    await addMovimentacao({
                        itemId: v.id,
                        tipo: diff > 0 ? 'entrada' : 'saida',
                        quantidade: Math.abs(diff),
                        motivo: `Ajuste manual (Grade) - Tam ${v.tamanho}`,
                        producaoId: null
                    });
                }
            }

            setLocalVariacoes(prev => prev.map(v => ({ ...v, quantidade: valorGrade })));
            setQtdGrade('');
            queryClient.invalidateQueries({ queryKey: ['modelos-padronizados', user?.id] });
        } finally {
            setApplyingGrade(false);
        }
    };

    const handleAddSize = async () => {
        if (!newSize.trim()) return;
        const qtd = parseInt(newSizeQtd, 10) || 0;

        setSaving(true);
        try {
            const novaVar = await adicionarVariacao(modelo.id, newSize.trim().toUpperCase(), qtd);
            
            // Adicionar movimentação de entrada inicial
            if (qtd > 0) {
                await addMovimentacao({
                    itemId: novaVar.id,
                    tipo: 'entrada',
                    quantidade: qtd,
                    motivo: `Criação de variação esquecida - Tam ${newSize}`,
                    producaoId: null
                });
            }

            toast.success(`Tamanho ${newSize} adicionado com sucesso!`);
            setAddingSize(false);
            setNewSize('');
            setNewSizeQtd('');
            
            // Recarregar variações
            const ORDEM = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];
            const novasVars = [...localVariacoes, { 
                ...novaVar, 
                tamanho: newSize.trim().toUpperCase(), 
                referencia: `${meta.referencia}-${newSize.trim().toUpperCase()}`,
                modeloId: modelo.id 
            } as VariacaoModelo].sort(
                (a, b) => ORDEM.indexOf(a.tamanho) - ORDEM.indexOf(b.tamanho)
            );
            setLocalVariacoes(novasVars);
            
            queryClient.invalidateQueries({ queryKey: ['modelos-padronizados', user?.id] });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erro ao adicionar tamanho');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 rounded-2xl sm:rounded-3xl border-0 shadow-2xl">
                    <DialogHeader className="px-5 sm:px-8 pt-6 pb-5 border-b border-border bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
                            <div className="flex-1 min-w-0 space-y-2">
                                <DialogTitle className="text-xl sm:text-2xl font-black text-foreground leading-tight tracking-tight break-words">
                                    {nome}
                                </DialogTitle>
                            </div>
                            
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto h-10 sm:h-9 gap-2 shrink-0 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl font-bold shadow-sm"
                                onClick={() => setShowEtiquetas(true)}
                            >
                                <Printer className="h-4 w-4" />
                                <span className="sm:text-xs">Imprimir Etiquetas</span>
                            </Button>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-auto">
                        <div className="px-6 py-4 space-y-6">
                            {/* Imagem + Dados principais */}
                            <div className="grid grid-cols-2 gap-6">
                                <ModeloImage imagemUrl={modelo.imagemUrl} nome={nome} />

                                <div className="space-y-3">
                                    {/* Tipo */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <Shirt className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Tipo:</span>
                                        <span className="font-semibold">{TIPO_GARMENT_LABELS[meta.tipo]}</span>
                                    </div>

                                    {/* Preço */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <DollarSign className="h-4 w-4 text-emerald-600" />
                                        <span className="text-muted-foreground">Venda:</span>
                                        <span className="font-bold text-emerald-600">
                                            R$ {(precoUnitario ?? 0).toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Custo */}
                                    {meta.custoProducao > 0 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Tag className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">Custo:</span>
                                            <span className="font-semibold">R$ {meta.custoProducao.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {/* Coleção */}
                                    {meta.colecao && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Palette className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">Coleção:</span>
                                            <span className="font-semibold">{meta.colecao}</span>
                                        </div>
                                    )}

                                    {/* Composição */}
                                    {meta.composicao && (
                                        <div className="flex items-start gap-2 text-sm">
                                            <Layers className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground">Composição:</span>
                                                <p className="font-semibold text-xs mt-0.5">{meta.composicao}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Total e Desempenho */}
                                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm space-y-4">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold mb-1 opacity-70">Estoque Atual</p>
                                            <p className="text-3xl font-black text-primary leading-none tracking-tight">
                                                {totalPecas} <span className="text-xs font-bold opacity-60 uppercase">pçs</span>
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary/10">
                                            <div>
                                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Volume Total</p>
                                                <p className="text-lg font-black text-foreground/80">
                                                    {totalProduzido}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-emerald-600 uppercase tracking-widest font-bold mb-1">Vendas Totais</p>
                                                <p className="text-lg font-black text-emerald-600">
                                                    {Math.max(0, totalProduzido - totalPecas)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <p className="text-[10px] text-muted-foreground italic">
                                            Métricas agregadas de {localVariacoes.length} variação(ões)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Tabela de variações */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-3 px-4 rounded-xl bg-primary/5 border border-primary/10 shadow-sm">
                                    <div className="space-y-1.5 flex-1 max-w-[280px]">
                                        <Label htmlFor="qtd-grade" className="text-[10px] uppercase font-bold text-primary tracking-widest">
                                            QTD para TODAS as numerações
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="qtd-grade"
                                                type="number"
                                                min={0}
                                                placeholder="Ex: 34"
                                                className="h-10 shadow-sm bg-background border-primary/20"
                                                value={qtdGrade}
                                                onChange={e => setQtdGrade(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleApplyGrade()}
                                            />
                                            <Button
                                                size="sm"
                                                className="gap-2 shrink-0 h-10 px-4"
                                                onClick={handleApplyGrade}
                                                disabled={applyingGrade || !qtdGrade}
                                            >
                                                {applyingGrade ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                Aplicar
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1 opacity-70">Total Atual</p>
                                        <p className="text-3xl font-black text-primary leading-none tracking-tight">{totalPecas} <span className="text-sm font-bold opacity-50 uppercase">pçs</span></p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm flex items-center gap-2 px-1">
                                        <Tags className="h-4 w-4 text-primary" />
                                        Estoque por Tamanho
                                    </h3>

                                    <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
                                        <div className="p-4 bg-muted/20 border-b border-border">
                                            {addingSize ? (
                                                <div className="flex items-end gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-1.5 flex-1">
                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Novo Tamanho</Label>
                                                        <Input 
                                                            placeholder="Ex: 46" 
                                                            className="h-9 shadow-sm"
                                                            value={newSize}
                                                            onChange={e => setNewSize(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 w-24">
                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Qtd Inicial</Label>
                                                        <Input 
                                                            type="number" 
                                                            placeholder="0" 
                                                            className="h-9 shadow-sm"
                                                            value={newSizeQtd}
                                                            onChange={e => setNewSizeQtd(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button size="sm" onClick={handleAddSize} disabled={saving} className="h-9">
                                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                            Salvar
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setAddingSize(false)} disabled={saving} className="h-9">
                                                            Cancelar
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => setAddingSize(true)}
                                                    className="w-full h-9 border border-dashed border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary gap-2 font-bold"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Adicionar Numeração que faltou
                                                </Button>
                                            )}
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/40 border-b border-border">
                                                    <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Tamanho</th>
                                                    <th className="text-right px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Atual</th>
                                                    <th className="text-right px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Histórico</th>
                                                    <th className="text-right px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Status</th>
                                                </tr>
                                            </thead>
                                        <tbody>
                                            {localVariacoes.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        Nenhuma variação cadastrada
                                                    </td>
                                                </tr>
                                            ) : (
                                                localVariacoes.map((v, idx) => (
                                                    <tr
                                                        key={v.id}
                                                        className={cn(
                                                            'border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20',
                                                            idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                                                        )}
                                                    >
                                                        <td className="px-5 py-4">
                                                            <span className="font-black text-xl">{v.tamanho}</span>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            {editingId === v.id ? (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-1">
                                                                            <Label className="text-[9px] uppercase opacity-50 w-8">Atu</Label>
                                                                            <Input
                                                                                type="number"
                                                                                min={0}
                                                                                className="w-16 h-7 text-right text-xs px-2 bg-background border-primary/20"
                                                                                value={editingQtd}
                                                                                onChange={e => setEditingQtd(e.target.value)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter') saveEdit(v);
                                                                                    if (e.key === 'Escape') cancelEdit();
                                                                                }}
                                                                                autoFocus
                                                                                disabled={saving}
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <Label className="text-[9px] uppercase opacity-50 w-8">Tot</Label>
                                                                            <Input
                                                                                type="number"
                                                                                min={0}
                                                                                className="w-16 h-7 text-right text-xs px-2 bg-primary/5 border-primary/20 font-bold"
                                                                                value={editingQtdIni}
                                                                                onChange={e => setEditingQtdIni(e.target.value)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter') saveEdit(v);
                                                                                    if (e.key === 'Escape') cancelEdit();
                                                                                }}
                                                                                disabled={saving}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => saveEdit(v)} disabled={saving}>
                                                                        {saving ? <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : <Check className="h-3.5 w-3.5" />}
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={cancelEdit} disabled={saving}>
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-1 group/cell">
                                                                    <span className="font-bold">{v.quantidade}</span>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-6 w-6 opacity-0 group-hover/cell:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                                                        onClick={() => startEdit(v)}
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-1 group/tot">
                                                                <span className="text-xs font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                                                                    {v.quantidadeInicial || v.quantidade}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <Badge className={cn('text-[10px] border font-bold uppercase', getStockColor(v.quantidade))}>
                                                                {v.quantidade === 0 ? 'Esgotado' : v.quantidade <= 3 ? 'Baixo' : 'Em Dia'}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                </DialogContent>
            </Dialog>

            <EtiquetasModal
                open={showEtiquetas}
                onClose={() => setShowEtiquetas(false)}
                variacoes={localVariacoes}
                nomeModelo={nome}
                precoVenda={precoUnitario ?? 0}
            />
        </>
    );
}

// ── Mini visualização de barcode inline ─────────────────
function BarcodeInline({ value }: { value: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const load = async () => {
            if (!canvasRef.current || !value) return;
            try {
                const JsBarcode = (await import('jsbarcode')).default;
                JsBarcode(canvasRef.current, value, {
                    format: 'CODE128',
                    width: 1.2,
                    height: 28,
                    displayValue: false,
                    margin: 2,
                });
            } catch (e) {
                console.warn('JsBarcode não carregado:', e);
            }
        };
        load();
    }, [value]);

    return <canvas ref={canvasRef} style={{ maxWidth: 100, height: 32 }} />;
}
