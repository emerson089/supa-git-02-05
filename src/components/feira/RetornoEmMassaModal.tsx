import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LotImage } from '@/components/production/LotImage';
import { TransferenciaComItens } from '@/hooks/useTransferencias';
import { Loader2, Check, X, Search, Package, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseProductName } from '@/utils/productNameUtils';

interface RetornoEmMassaItem {
    transferenciaId: string;
    titulo: string;
    horario: string;
    itens: {
        itemId: string;
        produtoNome: string;
        produtoImagem: string | null;
        quantidadeEnviada: number;
    }[];
}

interface RetornoEmMassaModalProps {
    open: boolean;
    cargas: RetornoEmMassaItem[];
    onClose: () => void;
    onConfirmar: (retornos: { transferenciaId: string; itens: { itemId: string; quantidadeRetornada: number }[] }[]) => Promise<void>;
    isLoading: boolean;
}

type RetornosState = Record<string, Record<string, string>>; // transferenciaId -> itemId -> qty string

export function RetornoEmMassaModal({ open, cargas, onClose, onConfirmar, isLoading }: RetornoEmMassaModalProps) {
    const [retornos, setRetornos] = useState<RetornosState>({});
    const [busca, setBusca] = useState('');

    // Initialize state when cargas change
    const retornosInit: RetornosState = useMemo(() => {
        const init: RetornosState = {};
        cargas.forEach(c => {
            if (!init[c.transferenciaId]) init[c.transferenciaId] = {};
            c.itens.forEach(i => {
                init[c.transferenciaId][i.itemId] = '';
            });
        });
        return init;
    }, [cargas]);

    const getValue = (transferenciaId: string, itemId: string) =>
        (retornos[transferenciaId]?.[itemId] ?? retornosInit[transferenciaId]?.[itemId] ?? '');

    const setValue = (transferenciaId: string, itemId: string, val: string) => {
        setRetornos(prev => ({
            ...prev,
            [transferenciaId]: { ...prev[transferenciaId], [itemId]: val },
        }));
    };

    // Count total unfilled fields
    const totalCampos = cargas.reduce((sum, c) => sum + c.itens.length, 0);
    const camposPreenchidos = cargas.reduce((sum, c) =>
        sum + c.itens.filter(i => {
            const v = getValue(c.transferenciaId, i.itemId);
            return v !== '' && /^\d+$/.test(v);
        }).length, 0);
    const todoPreenchido = camposPreenchidos === totalCampos && totalCampos > 0;
    const pendentes = totalCampos - camposPreenchidos;

    const handleConfirmar = async () => {
        const result = cargas.map(c => ({
            transferenciaId: c.transferenciaId,
            itens: c.itens.map(i => ({
                itemId: i.itemId,
                quantidadeRetornada: Math.max(0, Math.min(i.quantidadeEnviada, parseInt(getValue(c.transferenciaId, i.itemId) || '0', 10) || 0)),
            })),
        }));
        await onConfirmar(result);
        setRetornos({});
    };

    const cargasFiltradas = useMemo(() => {
        if (!busca.trim()) return cargas;
        const t = busca.toLowerCase();
        return cargas.map(c => ({
            ...c,
            itens: c.itens.filter(i => i.produtoNome.toLowerCase().includes(t)),
        })).filter(c => c.itens.length > 0 || c.titulo.toLowerCase().includes(t));
    }, [cargas, busca]);

    return (
        <Dialog open={open} onOpenChange={open => !open && onClose()}>
            <DialogContent className="max-w-lg h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <RotateCcw className="h-5 w-5 text-primary" />
                        Retorno em Massa
                        <Badge variant="secondary" className="ml-1">{cargas.length} cargas</Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Preencha o retorno de todas as cargas ativas de uma vez. Deixe 0 para itens 100% vendidos.
                    </DialogDescription>
                </DialogHeader>

                {/* Progress bar */}
                <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{camposPreenchidos}/{totalCampos} campos preenchidos</span>
                        {pendentes > 0 && (
                            <span className="text-xs text-amber-600 font-medium">{pendentes} pendente(s)</span>
                        )}
                        {todoPreenchido && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                <Check className="h-3 w-3" /> Tudo preenchido
                            </span>
                        )}
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all", todoPreenchido ? "bg-emerald-500" : "bg-primary")}
                            style={{ width: `${totalCampos > 0 ? (camposPreenchidos / totalCampos) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 py-2.5 border-b shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Filtrar por produto..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                        {busca && (
                            <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setBusca('')}>
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="divide-y">
                        {cargasFiltradas.map(carga => (
                            <div key={carga.transferenciaId} className="pb-2">
                                {/* Carga header */}
                                <div className="sticky top-0 z-10 px-4 py-2 bg-muted/60 backdrop-blur-sm border-b flex items-center gap-2">
                                    <span className="text-xs font-semibold text-primary uppercase tracking-wide truncate">
                                        {carga.titulo || `Carga ${carga.horario}`}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{carga.horario}</span>
                                    <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                                        {carga.itens.length} itens
                                    </Badge>
                                </div>

                                {/* Items */}
                                {carga.itens.map(item => {
                                    const val = getValue(carga.transferenciaId, item.itemId);
                                    const campoVazio = val === '' || val === undefined;
                                    const retornado = parseInt(val || '0', 10) || 0;
                                    const vendido = item.quantidadeEnviada - retornado;

                                    return (
                                        <div key={item.itemId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                                <LotImage src={item.produtoImagem} alt={item.produtoNome} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {parseProductName(item.produtoNome, item.itemId).nomeExibicao}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-blue-600 font-semibold w-8 text-right">{item.quantidadeEnviada}</span>
                                                <span className="text-xs text-muted-foreground">→</span>
                                                {/* Return input */}
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    placeholder="—"
                                                    value={val}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        if (v === '' || /^\d+$/.test(v)) setValue(carga.transferenciaId, item.itemId, v);
                                                    }}
                                                    onBlur={() => {
                                                        if (val !== '') {
                                                            const n = Math.max(0, Math.min(item.quantidadeEnviada, parseInt(val, 10) || 0));
                                                            setValue(carga.transferenciaId, item.itemId, String(n));
                                                        }
                                                    }}
                                                    className={cn(
                                                        "w-12 h-7 text-center text-sm font-semibold border-2 px-0",
                                                        campoVazio ? "border-amber-400" : "border-input"
                                                    )}
                                                />
                                                <span className="text-xs text-muted-foreground">ret</span>
                                                <span className={cn(
                                                    "text-xs font-semibold w-8 text-right",
                                                    campoVazio ? "text-muted-foreground" : "text-emerald-600"
                                                )}>
                                                    {campoVazio ? '—' : `${vendido}v`}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="border-t px-4 py-3 shrink-0 bg-muted/30 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={isLoading || !todoPreenchido}
                        className="flex-1"
                    >
                        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Registrando...</> : <><Check className="h-4 w-4 mr-2" />Confirmar Todos</>}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
