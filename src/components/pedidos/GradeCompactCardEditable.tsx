import { useMemo } from 'react';
import { Trash2, Layers, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EditableItem } from './EditableItemRow';
import { cn } from '@/lib/utils';

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
    onClick?: () => void;
}

export function GradeCompactCardEditable({
    grupo,
    onRemove,
    hasRemovingUpdates,
    onClick,
}: GradeCompactCardEditableProps) {
    const totalPecas = grupo.itens.reduce((acc, { item }) => acc + item.quantidade, 0);
    const valorUnitario = grupo.itens[0]?.item.valor_unitario || 0;
    const subtotal = totalPecas * valorUnitario;

    const handleRemoveGrupo = async () => {
        await Promise.all(grupo.itens.map(({ item }) => onRemove(item.id)));
    };

    // Agrupar e ordenar tamanhos
    const aggregated = useMemo(() => {
        const groups: Record<string, number> = {};
        grupo.itens.forEach(({ item, tamanho }) => {
            groups[tamanho] = (groups[tamanho] || 0) + item.quantidade;
        });
        return Object.entries(groups).sort((a, b) => compararTamanhos(a[0], b[0]));
    }, [grupo.itens]);

    const detailString = aggregated.map(([t, q]) => `${q}x ${t}`).join(' · ');

    return (
        <div 
            className={cn(
                "group relative bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer mb-3 last:mb-0",
                hasRemovingUpdates && "opacity-50 pointer-events-none"
            )}
            onClick={onClick}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {grupo.nomeModelo}
                        </h4>
                        <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-none text-[10px] py-0 px-2 h-5 flex items-center gap-1 font-semibold">
                            <Layers size={10} />
                            Editar Grade
                        </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                        {detailString} · <span className="text-slate-400">{totalPecas} peças</span>
                    </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm font-bold text-emerald-600">
                        R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveGrupo();
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                    >
                        {hasRemovingUpdates ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
