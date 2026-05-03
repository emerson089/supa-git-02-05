import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
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
import { useIsMobile } from '@/hooks/use-mobile';
import {
    Package,
    Printer,
    Shirt,
    DollarSign,
    Check,
    X,
    Loader2,
    Plus,
    PackagePlus,
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
    const isMobile = useIsMobile();
    const [showEtiquetas, setShowEtiquetas] = useState(false);
    const [localVariacoes, setLocalVariacoes] = useState<VariacaoModelo[]>([]);
    const [saving, setSaving] = useState(false);
    const [qtdGrade, setQtdGrade] = useState('');
    const [addingSize, setAddingSize] = useState(false);
    const [newSize, setNewSize] = useState('');
    const [newSizeQtd, setNewSizeQtd] = useState('');
    const [reposicaoMode, setReposicaoMode] = useState(false);
    const [reposicaoQtd, setReposicaoQtd] = useState<Record<string, string>>({});
    const [pendingChanges, setPendingChanges] = useState<Record<string, { qtd: number; qtdIni: number }>>({});

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
            setPendingChanges({});
        }
    }, [modelo?.id, modelo?.variacoes]);

    if (!modelo) return null;
    const { meta, nome, precoUnitario } = modelo;

    const totalPecas = localVariacoes.reduce((s, v) => {
        const pending = pendingChanges[v.id];
        return s + (pending ? pending.qtd : v.quantidade);
    }, 0);

    const handleFieldChange = (id: string, field: 'qtd' | 'qtdIni', value: string) => {
        const numValue = parseInt(value, 10) || 0;
        const currentVar = localVariacoes.find(v => v.id === id);
        if (!currentVar) return;

        setPendingChanges(prev => {
            const existing = prev[id] || { 
                qtd: currentVar.quantidade, 
                qtdIni: currentVar.quantidadeInicial ?? currentVar.quantidade 
            };
            return {
                ...prev,
                [id]: { ...existing, [field]: numValue }
            };
        });
    };

    const hasChanges = Object.keys(pendingChanges).length > 0;

    const saveAllChanges = async () => {
        if (!hasChanges) return;
        setSaving(true);
        
        try {
            const promises = Object.entries(pendingChanges).map(async ([id, changes]) => {
                const original = localVariacoes.find(v => v.id === id);
                if (!original) return;

                const diff = changes.qtd - original.quantidade;
                const changedQtdIni = changes.qtdIni !== (original.quantidadeInicial ?? original.quantidade);

                if (diff !== 0 || changedQtdIni) {
                    await updateItem({ 
                        id, 
                        quantidade: changes.qtd, 
                        quantidadeInicial: changes.qtdIni 
                    });

                    // Só gera log se a quantidade física mudou
                    if (diff !== 0) {
                        await addMovimentacao({
                            itemId: id,
                            tipo: diff > 0 ? 'entrada' : 'saida',
                            quantidade: Math.abs(diff),
                            motivo: `Auditoria de Segunda - Tam ${original.tamanho}`,
                            producaoId: null
                        });
                    }
                }
            });

            await Promise.all(promises);
            toast.success('Estoque atualizado com sucesso!');
            setPendingChanges({});
            queryClient.invalidateQueries({ queryKey: ['modelos-padronizados', user?.id] });
            onClose(); 
        } catch (err) {
            toast.error('Erro ao salvar algumas alterações.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleApplyGrade = async () => {
        const valorGrade = parseInt(qtdGrade, 10);
        if (isNaN(valorGrade) || valorGrade < 0) return;

        const newPending = { ...pendingChanges };
        localVariacoes.forEach(v => {
            const currentQtdIni = pendingChanges[v.id]?.qtdIni ?? (v.quantidadeInicial || v.quantidade);
            const diff = valorGrade - v.quantidade;
            const suggestedQtdIni = diff > 0 ? currentQtdIni + diff : currentQtdIni;
            
            newPending[v.id] = {
                qtd: valorGrade,
                qtdIni: suggestedQtdIni
            };
        });
        
        setPendingChanges(newPending);
        setQtdGrade('');
        toast.info('Grade aplicada! Não esqueça de Salvar Alterações.');
    };

    const handleReposicao = async () => {
        const newPending = { ...pendingChanges };
        Object.entries(reposicaoQtd).forEach(([id, val]) => {
            const chegaram = parseInt(val, 10) || 0;
            if (chegaram <= 0) return;
            
            const v = localVariacoes.find(varItem => varItem.id === id);
            if (!v) return;

            const current = newPending[id] || { 
                qtd: v.quantidade, 
                qtdIni: v.quantidadeInicial ?? v.quantidade 
            };

            newPending[id] = {
                qtd: current.qtd + chegaram,
                qtdIni: current.qtdIni + chegaram
            };
        });

        setPendingChanges(newPending);
        setReposicaoMode(false);
        setReposicaoQtd({});
        toast.success('Reposição adicionada à lista de alterações.');
    };

    const handleAddSize = async () => {
        if (!newSize.trim()) return;
        const qtd = parseInt(newSizeQtd, 10) || 0;

        setSaving(true);
        try {
            const novaVar = await adicionarVariacao(modelo.id, newSize.trim().toUpperCase(), qtd);
            
            if (qtd > 0) {
                await addMovimentacao({
                    itemId: novaVar.id,
                    tipo: 'entrada',
                    quantidade: qtd,
                    motivo: `Criação de variação esquecida - Tam ${newSize}`,
                    producaoId: null
                });
            }

            toast.success(`Tamanho ${newSize} adicionado!`);
            setAddingSize(false);
            setNewSize('');
            setNewSizeQtd('');
            queryClient.invalidateQueries({ queryKey: ['modelos-padronizados', user?.id] });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erro ao adicionar tamanho');
        } finally {
            setSaving(false);
        }
    };

    const modalContent = (
        <div className="px-5 sm:px-6 py-4 space-y-6 pb-32 sm:pb-6">
            {/* Imagem + Dados principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ModeloImage imagemUrl={modelo.imagemUrl} nome={nome} />

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Shirt className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Tipo:</span>
                        <span className="font-semibold">{TIPO_GARMENT_LABELS[meta.tipo]}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span className="text-muted-foreground">Venda:</span>
                        <span className="font-bold text-emerald-600">
                            R$ {(precoUnitario ?? 0).toFixed(2)}
                        </span>
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold mb-1 opacity-70">Total em Estoque</p>
                                <p className="text-3xl font-black text-primary leading-none tracking-tight">
                                    {totalPecas} <span className="text-xs font-bold opacity-60 uppercase">pçs</span>
                                </p>
                            </div>
                            {hasChanges && <Badge className="bg-amber-500 text-white border-0 animate-pulse">Pendentes</Badge>}
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Tabela de variações */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-3 px-4 rounded-xl bg-primary/5 border border-primary/10 shadow-sm">
                    <div className="space-y-1.5 flex-1 w-full sm:max-w-[280px]">
                        <Label htmlFor="qtd-grade" className="text-[10px] uppercase font-bold text-primary tracking-widest">
                            Zerar ou Igualar Grade Inteira
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="qtd-grade"
                                type="number"
                                min={0}
                                placeholder="Ex: 50"
                                className="h-10 shadow-sm bg-background border-primary/20"
                                value={qtdGrade}
                                onChange={e => setQtdGrade(e.target.value)}
                            />
                            <Button
                                size="sm"
                                variant="secondary"
                                className="gap-2 shrink-0 h-10 px-4 font-bold"
                                onClick={handleApplyGrade}
                            >
                                Aplicar
                            </Button>
                        </div>
                    </div>
                    {!reposicaoMode && (
                        <Button
                            variant="outline"
                            onClick={() => { setReposicaoQtd({}); setReposicaoMode(true); }}
                            className="gap-2 h-10 border-emerald-200 text-emerald-700 font-bold rounded-xl w-full sm:w-auto"
                        >
                            <PackagePlus className="h-4 w-4" />
                            Adicionar Reposição
                        </Button>
                    )}
                </div>

                {reposicaoMode && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                                <PackagePlus className="h-4 w-4" />
                                Chegou mercadoria nova?
                            </h4>
                            <Button variant="ghost" size="icon" onClick={() => setReposicaoMode(false)} className="h-8 w-8 text-emerald-600">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {localVariacoes.map(v => (
                                <div key={v.id} className="flex items-center gap-2 bg-white dark:bg-black/20 rounded-lg p-2 border border-emerald-100">
                                    <span className="font-black text-sm w-6">{v.tamanho}</span>
                                    <Input
                                        type="number"
                                        placeholder="+0"
                                        value={reposicaoQtd[v.id] || ''}
                                        onChange={e => setReposicaoQtd(prev => ({ ...prev, [v.id]: e.target.value }))}
                                        className="h-8 text-center border-emerald-100"
                                    />
                                </div>
                            ))}
                        </div>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handleReposicao}>
                            Confirmar e Somar ao Atual
                        </Button>
                    </div>
                )}

                <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[320px]">
                            <thead>
                                <tr className="bg-muted/40 border-b border-border">
                                    <th className="text-left px-4 sm:px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Tam</th>
                                    <th className="text-center px-4 sm:px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-primary">Estoque ATU</th>
                                    <th className="text-center px-4 sm:px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 hidden sm:table-cell">Histórico TOT</th>
                                    <th className="text-right px-4 sm:px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localVariacoes.map((v, idx) => {
                                    const pending = pendingChanges[v.id];
                                    const valQtd = pending ? pending.qtd : v.quantidade;
                                    const valQtdIni = pending ? pending.qtdIni : (v.quantidadeInicial ?? v.quantidade);
                                    const isChanged = !!pending;

                                    return (
                                        <tr key={v.id} className={cn('border-b border-border/50 last:border-0 transition-colors', isChanged ? 'bg-amber-500/5' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/10')}>
                                            <td className="px-4 sm:px-5 py-4">
                                                <span className="font-black text-lg sm:text-xl">{v.tamanho}</span>
                                            </td>
                                            <td className="px-4 sm:px-5 py-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        className={cn("w-16 sm:w-20 h-10 text-center font-black text-lg rounded-xl border-2 transition-all", isChanged ? "border-amber-500 bg-white" : "border-transparent bg-muted/20 hover:bg-muted/40")}
                                                        value={valQtd}
                                                        onChange={e => handleFieldChange(v.id, 'qtd', e.target.value)}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground sm:hidden">Tot: {valQtdIni}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-5 py-4 hidden sm:table-cell">
                                                <div className="flex justify-center">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        className={cn("w-20 h-9 text-center text-xs font-bold rounded-lg border transition-all", isChanged ? "border-amber-500/50 bg-white" : "border-transparent bg-primary/5")}
                                                        value={valQtdIni}
                                                        onChange={e => handleFieldChange(v.id, 'qtdIni', e.target.value)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-5 py-4 text-right">
                                                <Badge className={cn('text-[9px] sm:text-[10px] border font-bold uppercase px-1 sm:px-2', getStockColor(valQtd))}>
                                                    {valQtd === 0 ? 'Off' : valQtd <= 3 ? 'Low' : 'OK'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="p-4 bg-muted/20 border-t border-border">
                        {addingSize ? (
                            <div className="flex items-end gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1.5 flex-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Tam</Label>
                                    <Input placeholder="Ex: 46" className="h-9" value={newSize} onChange={e => setNewSize(e.target.value)} autoFocus />
                                </div>
                                <div className="space-y-1.5 w-16 sm:w-24">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Qtd</Label>
                                    <Input type="number" placeholder="0" className="h-9" value={newSizeQtd} onChange={e => setNewSizeQtd(e.target.value)} />
                                </div>
                                <div className="flex gap-1 sm:gap-2">
                                    <Button size="sm" onClick={handleAddSize} disabled={saving} className="h-9 font-bold px-2 sm:px-4">Add</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setAddingSize(false)} className="h-9 px-2 sm:px-4 text-muted-foreground">X</Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="ghost" size="sm" onClick={() => setAddingSize(true)} className="w-full h-9 border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary gap-2 font-bold">
                                <Plus className="h-4 w-4" /> Adicionar Numeração
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const footerAction = hasChanges && (
        <div className="p-4 sm:p-6 bg-gradient-to-t from-background to-background/90 flex justify-center w-full">
            <Button onClick={saveAllChanges} disabled={saving} className="w-full sm:w-80 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-2xl shadow-xl gap-2 transition-all active:scale-95">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Salvar Todas as Alterações
            </Button>
        </div>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DrawerContent className="max-h-[96vh] flex flex-col bg-background rounded-t-[32px] overflow-hidden">
                    <DrawerHeader className="px-6 pt-4 pb-2 border-b shrink-0">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Detalhes do Modelo</span>
                                <h2 className="text-xl font-black text-foreground tracking-tight truncate leading-tight">
                                    {nome}
                                </h2>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 w-10 p-0 border-indigo-200 text-indigo-700 rounded-xl font-bold shrink-0 shadow-sm"
                                onClick={() => setShowEtiquetas(true)}
                            >
                                <Printer className="h-4 w-4" />
                            </Button>
                        </div>
                    </DrawerHeader>
                    
                    <div className="flex-1 overflow-y-auto overscroll-contain px-2 sm:px-0">
                        {modalContent}
                    </div>

                    {footerAction && (
                        <div className="shrink-0">
                            {footerAction}
                        </div>
                    )}

                    <EtiquetasModal
                        open={showEtiquetas}
                        onClose={() => setShowEtiquetas(false)}
                        variacoes={localVariacoes}
                        nomeModelo={nome}
                        precoVenda={precoUnitario ?? 0}
                    />
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <>
            <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0 rounded-3xl border-0 shadow-2xl bg-background">
                    <DialogHeader className="px-8 pt-6 pb-5 border-b border-border bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent shrink-0">
                        <div className="flex items-center justify-between gap-6">
                            <DialogTitle className="text-2xl font-black text-foreground leading-tight tracking-tight">
                                {nome}
                            </DialogTitle>
                            
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold transition-all shadow-sm"
                                    onClick={() => setShowEtiquetas(true)}
                                >
                                    <Printer className="h-4 w-4" />
                                    Etiquetas
                                </Button>
                                {hasChanges && (
                                    <Button
                                        onClick={saveAllChanges}
                                        disabled={saving}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-emerald-500/20 gap-2 transition-all"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Salvar Alterações
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 h-full">
                        {modalContent}
                    </ScrollArea>
                    
                    {hasChanges && (
                        <div className="p-4 border-t border-border bg-amber-500/5 flex justify-center shrink-0">
                            <Button onClick={saveAllChanges} disabled={saving} className="w-full sm:w-80 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-2xl shadow-xl gap-2 transition-all active:scale-95">
                                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                Salvar Todas as Alterações
                            </Button>
                        </div>
                    )}
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
