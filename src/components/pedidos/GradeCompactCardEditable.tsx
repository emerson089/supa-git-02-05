import { useState, useCallback, useEffect } from 'react';
import { Trash2, Package2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditableItem } from './EditableItemRow';
import { cn } from '@/lib/utils';
import { TAMANHOS_LETRAS, TAMANHOS_NUMERICOS } from '@/hooks/useModelosPadronizados';

const ORDEM_TAMANHOS = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];

interface GradeCompactCardEditableProps {
    grupo: {
        refBase: string;
        nomeModelo: string;
        itens: Array<{ item: EditableItem; tamanho: string }>;
    };
    onUpdate: (id: string, data: { quantidade?: number; valor_unitario?: number }) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
    hasPendingUpdates: boolean;
    hasRemovingUpdates: boolean;
}

export function GradeCompactCardEditable({
    grupo,
    onUpdate,
    onRemove,
    hasPendingUpdates,
    hasRemovingUpdates,
}: GradeCompactCardEditableProps) {
    const [localQuantities, setLocalQuantities] = useState<Record<string, number>>({});
    const [pendingUpdate, setPendingUpdate] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Sync local quantities on mount or when items change externally
    useEffect(() => {
        const qtys: Record<string, number> = {};
        grupo.itens.forEach(({ item }) => {
            qtys[item.id] = item.quantidade;
        });
        setLocalQuantities(qtys);
    }, [grupo.itens]);

    const totalPecas = Object.values(localQuantities).reduce((acc, q) => acc + q, 0);
    const valorUnitario = grupo.itens[0]?.item.valor_unitario || 0;
    const subtotal = totalPecas * valorUnitario;

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (pendingUpdate) clearTimeout(pendingUpdate);
        };
    }, [pendingUpdate]);

    const debouncedUpdate = useCallback(
        (id: string, value: number) => {
            if (pendingUpdate) clearTimeout(pendingUpdate);

            const timeout = setTimeout(() => {
                onUpdate(id, { quantidade: value });
            }, 500);

            setPendingUpdate(timeout);
        },
        [onUpdate, pendingUpdate]
    );

    const handleQtdChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value) || 0;
        if (value >= 0) {
            setLocalQuantities(prev => ({ ...prev, [id]: value }));
            debouncedUpdate(id, value);
        }
    };

    const handleRemoveGrupo = async () => {
        // Sequentially or Promise.all removing items
        // Since there's a global loading state, Promise.all is faster
        await Promise.all(grupo.itens.map(({ item }) => onRemove(item.id)));
    };

    const isDisabled = hasPendingUpdates || hasRemovingUpdates;

    // Sort sizes canonically
    const itensSorted = [...grupo.itens].sort(
        (a, b) => ORDEM_TAMANHOS.indexOf(a.tamanho) - ORDEM_TAMANHOS.indexOf(b.tamanho)
    );

    return (
        <div
            className={cn(
                'rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/10 overflow-hidden transition-opacity',
                hasRemovingUpdates && 'opacity-60 pointer-events-none'
            )}
        >
            {/* ── Cabeçalho ── */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-100/60 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-900/50 gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Package2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1 flex flex-col pt-0.5">
                        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 leading-tight break-words">
                            {grupo.nomeModelo}
                        </p>
                        <p className="text-[11px] font-mono text-indigo-600/80 dark:text-indigo-400/70 border border-indigo-200 dark:border-indigo-800 px-1.5 rounded bg-white/50 dark:bg-black/20">
                            {grupo.refBase}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold leading-tight">Subtotal</p>
                        <p className="text-xs font-bold text-emerald-600 leading-tight">
                            R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveGrupo}
                        disabled={isDisabled}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                        title="Remover toda a grade"
                    >
                        {hasRemovingUpdates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* ── Tabela compacta de tamanhos/quantidades ── */}
            <div className="px-4 py-3 bg-white/40 dark:bg-indigo-950/20">
                <div className="overflow-x-auto pb-1">
                    <table className="w-full text-center text-xs">
                        <thead>
                            <tr>
                                {itensSorted.map(({ tamanho }) => (
                                    <td key={tamanho} className="pb-1.5 px-1.5 min-w-[3rem]">
                                        <span className="font-mono font-bold text-muted-foreground text-[11px]">
                                            {tamanho}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {itensSorted.map(({ item }) => (
                                    <td key={item.id} className="px-1 relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            value={localQuantities[item.id] ?? item.quantidade}
                                            onChange={e => handleQtdChange(item.id, e)}
                                            disabled={hasRemovingUpdates}
                                            className={cn(
                                                'w-12 h-8 mx-auto text-center text-sm font-bold rounded-lg border',
                                                'bg-white dark:bg-background',
                                                localQuantities[item.id] !== item.quantidade && 'border-indigo-400 text-indigo-600',
                                                'focus-visible:ring-indigo-400 focus-visible:ring-offset-0 focus-visible:border-indigo-400'
                                            )}
                                        />
                                        {hasPendingUpdates && localQuantities[item.id] !== item.quantidade && (
                                            <span className="absolute -top-1 -right-0.5 z-10 bg-background rounded-full pointer-events-none">
                                                <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                                            </span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-indigo-100 dark:border-indigo-900/30 pt-2">
                    <span>
                        Total: <strong className="text-foreground">{totalPecas}</strong> peças
                    </span>
                    <span>
                        Valor unit.: R$ {valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>
    );
}
