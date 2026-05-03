import { useRef, useState } from 'react';
import { Camera, Package, Eye, Trash2, AlertTriangle, Pencil, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/ui/lazy-image';
import { ModeloPadronizado, TIPO_GARMENT_LABELS, TAMANHOS_LETRAS, TAMANHOS_NUMERICOS, useModelosPadronizados } from '@/hooks/useModelosPadronizados';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EditarModeloPadronizadoModal } from './EditarModeloPadronizadoModal';
import { parseProductName } from '@/utils/productNameUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check } from 'lucide-react';
import { useUpdateItem, useAddMovimentacao } from '@/hooks/useEstoqueData';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface ModeloPadronizadoCardProps {
    modelo: ModeloPadronizado;
    onVerDetalhes: (modelo: ModeloPadronizado) => void;
    onImageUpdate?: (productId: string, file: File) => void;
    vendasSemana?: number;
    vendasSemanaAnterior?: number;
    modoAuditoria?: boolean;
    conferidoHoje?: boolean;
    onAuditSuccess?: () => void;
}

function ModeloImage({ imagemUrl, nome, onImageClick }: { imagemUrl?: string; nome: string; onImageClick: () => void }) {
    const { signedUrl, loading } = useSignedUrl(imagemUrl);
    return (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-2xl bg-muted/30 group cursor-pointer" onClick={onImageClick}>
            {loading ? (
                <div className="w-full h-full bg-muted/50 animate-pulse flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground/30" />
                </div>
            ) : imagemUrl && signedUrl ? (
                <LazyImage src={signedUrl} alt={nome} className="w-full h-full object-cover object-center block" containerClassName="w-full h-full" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20">
                    <div className="text-muted-foreground/40 text-center">
                        <Camera size={28} className="mx-auto mb-1.5 opacity-50" />
                        <span className="text-[10px] font-medium tracking-wide uppercase">Sem imagem</span>
                    </div>
                </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center rounded-t-2xl">
                <Camera className="w-7 h-7 text-white mb-1.5" />
                <span className="text-white text-xs font-semibold tracking-wide">Trocar Foto</span>
            </div>
        </div>
    );
}

export function ModeloPadronizadoCard({ 
    modelo, 
    onVerDetalhes, 
    onImageUpdate, 
    vendasSemana = 0, 
    vendasSemanaAnterior = 0,
    modoAuditoria = false,
    conferidoHoje = false,
    onAuditSuccess
}: ModeloPadronizadoCardProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, { qtd: number; qtdIni: number }>>({});
    const [qtdGrade, setQtdGrade] = useState('');

    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { mutateAsync: updateItem } = useUpdateItem();
    const { mutateAsync: addMovimentacao } = useAddMovimentacao();
    const { excluirModeloPadronizado } = useModelosPadronizados();

    const { meta, variacoes: variacoesRaw, nome, precoUnitario } = modelo;

    const ORDEM_TAMANHOS = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];
    const variacoes = [...variacoesRaw].sort((a, b) => ORDEM_TAMANHOS.indexOf(a.tamanho) - ORDEM_TAMANHOS.indexOf(b.tamanho));

    const totalPecas = variacoes.reduce((s, v) => s + v.quantidade, 0);
    const totalProduzidoRaw = variacoes.reduce((s, v) => s + (v.quantidadeInicial || v.quantidade), 0);
    const totalProduzido = Math.max(totalProduzidoRaw, totalPecas);
    const tamanhosEsgotados = variacoes.filter(v => v.quantidade <= 0).map(v => v.tamanho);
    const hasEsgotados = tamanhosEsgotados.length > 0;

    // Performance metrics
    const taxaGiro = totalProduzido > 0 ? Math.max(0, Math.min(100, ((totalProduzido - totalPecas) / totalProduzido) * 100)) : 0;
    const cobertura = vendasSemana > 0 ? Math.ceil(totalPecas / vendasSemana) : null;
    const tendencia = vendasSemanaAnterior > 0
        ? ((vendasSemana - vendasSemanaAnterior) / vendasSemanaAnterior) * 100
        : vendasSemana > 0 ? 100 : null;

    // Color mappings
    const giroColor = taxaGiro >= 70 ? 'bg-emerald-500' : taxaGiro >= 30 ? 'bg-amber-500' : 'bg-red-500';
    const giroTextColor = taxaGiro >= 70 ? 'text-emerald-600' : taxaGiro >= 30 ? 'text-amber-600' : 'text-red-500';
    const coberturaColor = cobertura === null ? 'text-muted-foreground' : cobertura <= 2 ? 'text-red-500 font-black' : cobertura <= 4 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold';

    // Status dot
    const isEsgotado = totalPecas <= 0;
    const statusDot = isEsgotado ? 'bg-red-500' : hasEsgotados ? 'bg-amber-500' : 'bg-emerald-500';

    const handleImageClick = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onImageUpdate) onImageUpdate(modelo.id, file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmDelete = async () => {
        setDeleting(true);
        try {
            await excluirModeloPadronizado(modelo.id);
            toast.success(`Modelo "${meta.referencia}" e todas as variações foram removidos.`);
            setShowConfirmDelete(false);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao excluir modelo');
        } finally {
            setDeleting(false);
        }
    };
    const handleFieldChange = (id: string, field: 'qtd' | 'qtdIni', value: string) => {
        const numValue = parseInt(value, 10) || 0;
        const currentVar = variacoes.find(v => v.id === id);
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

    const handleApplyGrade = () => {
        const valorGrade = parseInt(qtdGrade, 10);
        if (isNaN(valorGrade) || valorGrade < 0) return;

        const newPending = { ...pendingChanges };
        variacoes.forEach(v => {
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
        toast.info('Grade aplicada! Confirme para salvar.');
    };

    const saveChanges = async () => {
        const ids = Object.keys(pendingChanges);
        if (ids.length === 0) return;
        setSaving(true);
        try {
            const promises = ids.map(async (id) => {
                const changes = pendingChanges[id];
                const original = variacoes.find(v => v.id === id);
                if (!original) return;

                const diff = changes.qtd - original.quantidade;
                const changedQtdIni = changes.qtdIni !== (original.quantidadeInicial ?? original.quantidade);

                if (diff !== 0 || changedQtdIni) {
                    await updateItem({ id, quantidade: changes.qtd, quantidadeInicial: changes.qtdIni });
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
            if (onAuditSuccess) onAuditSuccess();
            toast.success(`Estoque de "${meta.referencia}" atualizado!`);
            setPendingChanges({});
            queryClient.invalidateQueries({ queryKey: ['modelos-padronizados', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
        } catch (err) {
            toast.error('Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className={cn(
                "overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border shadow-[4px_4px_14px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background)/0.8)] transition-all duration-250 hover:shadow-[6px_6px_20px_hsl(var(--muted)/0.5),-2px_-2px_10px_hsl(var(--background))] hover:-translate-y-0.5 relative flex flex-col h-full",
                isEsgotado ? "border-red-200/60 dark:border-red-900/30" : hasEsgotados ? "border-amber-200/60 dark:border-amber-900/30" : "border-border/50 dark:border-gray-700/50"
            )}>
                {/* Status indicator dot */}
                <div className={cn('absolute top-3 right-3 w-2.5 h-2.5 rounded-full z-10 shadow-sm ring-2 ring-white/80 dark:ring-gray-800/80', statusDot)} title={isEsgotado ? 'Esgotado' : hasEsgotados ? 'Tamanhos esgotados' : 'Disponível'} />

                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                <ModeloImage imagemUrl={modelo.imagemUrl} nome={nome} onImageClick={handleImageClick} />

                <div className="p-3.5 flex flex-col flex-1 gap-2.5">
                    {/* — Identification row — */}
                    <div className="space-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className={cn("font-bold text-sm text-foreground leading-snug flex-1", modoAuditoria ? "line-clamp-1" : "line-clamp-2")}>
                                {parseProductName(nome, meta.referencia).nomeExibicao}
                            </h3>
                            <div className="flex gap-1 items-center">
                                {conferidoHoje && (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 h-5 px-1.5 uppercase font-black gap-1">
                                        <Check size={10} strokeWidth={3} />
                                        OK
                                    </Badge>
                                )}
                                {modoAuditoria && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 h-5 px-1.5 uppercase font-black">
                                        Audit
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground font-mono font-medium">{meta.referencia}</p>
                            {!modoAuditoria && (
                                <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <p className="text-[10px] text-muted-foreground/70">{TIPO_GARMENT_LABELS[meta.tipo]}</p>
                                </>
                            )}
                        </div>
                    </div>

                    {modoAuditoria ? (
                        /* — Audit Mode View — */
                        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex gap-1.5 items-end">
                                <div className="flex-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">Igualar Grade</Label>
                                    <Input
                                        type="number"
                                        placeholder="Qtd"
                                        className="h-8 text-xs font-bold"
                                        value={qtdGrade}
                                        onChange={e => setQtdGrade(e.target.value)}
                                    />
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="h-8 px-2 text-[10px] font-bold uppercase"
                                    onClick={handleApplyGrade}
                                >
                                    Aplicar
                                </Button>
                            </div>

                            <div className="grid grid-cols-4 gap-1.5">
                                {variacoes.map(v => {
                                    const pending = pendingChanges[v.id];
                                    const val = pending ? pending.qtd : v.quantidade;
                                    const isChanged = !!pending;
                                    return (
                                        <div key={v.id} className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-center block text-muted-foreground">{v.tamanho}</Label>
                                            <Input
                                                type="number"
                                                className={cn(
                                                    "h-8 text-center p-0 font-black text-xs transition-all",
                                                    isChanged ? "border-amber-500 bg-amber-50 shadow-sm" : "border-border/50 bg-muted/20"
                                                )}
                                                value={val}
                                                onChange={e => handleFieldChange(v.id, 'qtd', e.target.value)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <Button 
                                onClick={saveChanges}
                                disabled={saving || Object.keys(pendingChanges).length === 0}
                                className={cn(
                                    "w-full h-9 font-bold text-xs gap-2 transition-all shadow-md",
                                    Object.keys(pendingChanges).length > 0 
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20" 
                                        : "bg-muted text-muted-foreground shadow-none grayscale opacity-50"
                                )}
                            >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                {saving ? "Salvando..." : "Confirmar Contagem"}
                            </Button>
                        </div>
                    ) : (
                        /* — Normal Mode View — */
                        <>
                            {/* — Key numbers: Estoque + Preço — */}
                            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/30">
                                <div>
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Estoque</p>
                                    <p className={cn("font-extrabold text-lg leading-none tabular-nums", isEsgotado ? 'text-red-600' : hasEsgotados ? 'text-amber-600' : 'text-foreground')}>
                                        {totalPecas}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">peças</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Preço de Venda</p>
                                    <p className="font-extrabold text-lg leading-none tabular-nums text-emerald-600">
                                        R${(precoUnitario ?? 0).toFixed(2)}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">por peça</p>
                                </div>
                            </div>

                            {/* — Sizes grid — */}
                            <div>
                                <div className="flex flex-wrap gap-1">
                                    {variacoes.map(v => (
                                        <span
                                            key={v.id}
                                            className={cn(
                                                'text-[9px] font-bold px-1.5 py-0.5 rounded-md border transition-colors',
                                                v.quantidade > 0
                                                    ? 'bg-background text-foreground/80 border-border/50'
                                                    : 'bg-red-50 text-red-500 border-red-200/60 line-through opacity-60 dark:bg-red-950/20 dark:text-red-400'
                                            )}
                                            title={`${v.tamanho}: ${v.quantidade} peças`}
                                        >
                                            {v.tamanho}
                                        </span>
                                    ))}
                                </div>
                                {hasEsgotados && (
                                    <p className="text-[9px] text-red-500/70 mt-1 font-medium">
                                        Esgotados: {tamanhosEsgotados.join(' · ')}
                                    </p>
                                )}
                            </div>

                            {/* — Performance metrics — */}
                            <div className="space-y-2 pt-1 border-t border-border/20">
                                {/* Vendas semana + tendência */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Vendas Semana</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn('text-sm font-bold tabular-nums', vendasSemana > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
                                            {vendasSemana} pçs
                                        </span>
                                        {tendencia !== null && (
                                            <span className={cn('flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded', tendencia > 0 ? 'text-emerald-700 bg-emerald-100' : tendencia < 0 ? 'text-red-600 bg-red-100' : 'text-muted-foreground')}>
                                                {tendencia > 0 ? <ArrowUp size={9} /> : tendencia < 0 ? <ArrowDown size={9} /> : null}
                                                {tendencia > 0 ? '+' : ''}{tendencia.toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Giro do Lote */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Giro do Lote</span>
                                        <span className={cn('text-[10px] font-extrabold', giroTextColor)}>{taxaGiro.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                                        <div className={cn('h-full rounded-full transition-all duration-500', giroColor)} style={{ width: `${taxaGiro}%` }} />
                                    </div>
                                </div>

                                {/* Cobertura */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Cobertura</span>
                                    <span className={cn('text-[11px]', coberturaColor)}>
                                        {cobertura === null ? (
                                            <span className="text-muted-foreground font-normal">—</span>
                                        ) : cobertura === 1 ? '1 semana' : `${cobertura} semanas`}
                                    </span>
                                </div>
                            </div>

                            {/* — Actions — */}
                            <div className="flex gap-1.5 mt-auto pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-1.5 h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors"
                                    onClick={() => onVerDetalhes(modelo)}
                                >
                                    <Eye size={12} />
                                    Ver Detalhes
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 border-border/50 transition-colors"
                                    onClick={() => setShowEdit(true)}
                                    title="Editar modelo"
                                >
                                    <Pencil size={13} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 border-border/50 transition-colors"
                                    onClick={() => setShowConfirmDelete(true)}
                                    title="Excluir modelo e todas as variações"
                                >
                                    <Trash2 size={13} />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <EditarModeloPadronizadoModal modelo={modelo} open={showEdit} onClose={() => setShowEdit(false)} />

            <Dialog open={showConfirmDelete} onOpenChange={v => { if (!v && !deleting) setShowConfirmDelete(false); }}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle size={20} />
                            Excluir Modelo Padronizado
                        </DialogTitle>
                        <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
                    </DialogHeader>
                    <div className="py-3 space-y-3">
                        <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                            <p className="font-bold text-foreground">{meta.referencia}</p>
                            <p className="text-sm text-muted-foreground">{nome.split('—')[0].trim()}</p>
                            <p className="text-xs text-muted-foreground">{variacoes.length} variação(ões) · {totalPecas} peças no estoque</p>
                        </div>
                        <div className="flex gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive/80">
                                Todas as <strong>{variacoes.length} variações</strong> e os estoques vinculados ({totalPecas} peças) serão <strong>permanentemente removidos</strong>.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmDelete(false)} disabled={deleting}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting} className="gap-2">
                            {deleting ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={14} />}
                            {deleting ? 'Excluindo…' : 'Excluir Modelo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
