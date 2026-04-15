import { useRef, useState } from 'react';
import { Camera, Package, Layers, Eye, Trash2, AlertTriangle, Pencil, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

interface ModeloPadronizadoCardProps {
    modelo: ModeloPadronizado;
    onVerDetalhes: (modelo: ModeloPadronizado) => void;
    onImageUpdate?: (productId: string, file: File) => void;
    vendasSemana?: number;
}

function ModeloImage({
    imagemUrl,
    nome,
    onImageClick,
}: {
    imagemUrl?: string;
    nome: string;
    onImageClick: () => void;
}) {
    const { signedUrl, loading } = useSignedUrl(imagemUrl);

    return (
        <div
            className="relative aspect-[3/4] w-full overflow-hidden rounded-t-2xl bg-muted/30 group cursor-pointer"
            onClick={onImageClick}
        >
            {loading ? (
                <div className="w-full h-full bg-muted/50 animate-pulse flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground/30" />
                </div>
            ) : imagemUrl && signedUrl ? (
                <LazyImage
                    src={signedUrl}
                    alt={nome}
                    className="w-full h-full object-cover object-center block"
                    containerClassName="w-full h-full"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-indigo-500/10">
                    <div className="text-muted-foreground/50 text-center">
                        <Camera size={32} className="mx-auto mb-2 opacity-50" />
                        <span className="text-xs">Sem imagem</span>
                    </div>
                </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center rounded-t-2xl">
                <Camera className="w-8 h-8 text-white mb-2" />
                <span className="text-white text-sm font-medium">Trocar Foto</span>
            </div>
        </div>
    );
}

export function ModeloPadronizadoCard({
    modelo,
    onVerDetalhes,
    onImageUpdate,
    vendasSemana = 0,
}: ModeloPadronizadoCardProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { excluirModeloPadronizado } = useModelosPadronizados();

    const { meta, variacoes: variacoesRaw, nome, precoUnitario } = modelo;

    // Ordenar variações pela sequência canônica de tamanhos
    const ORDEM_TAMANHOS = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];
    const variacoes = [...variacoesRaw].sort(
        (a, b) => ORDEM_TAMANHOS.indexOf(a.tamanho) - ORDEM_TAMANHOS.indexOf(b.tamanho)
    );

    const totalPecas = variacoes.reduce((s, v) => s + v.quantidade, 0);
    const totalProduzido = variacoes.reduce((s, v) => s + (v.quantidadeInicial || v.quantidade), 0);
    const totalVendas = Math.max(0, totalProduzido - totalPecas);
    const tamanhosEsgotados = variacoes.filter(v => v.quantidade <= 0).map(v => v.tamanho);

    // Status geral
    const statusColor =
        totalPecas <= 0
            ? 'bg-red-500'
            : variacoes.some(v => v.quantidade <= 0)
                ? 'bg-amber-500'
                : 'bg-emerald-500';

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

    return (
        <>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-purple-100 dark:border-purple-900/30 shadow-soft transition-all duration-300 hover:shadow-lg relative flex flex-col h-full">
                {/* Indicador de status */}
                <div
                    className={cn('absolute top-3 right-3 w-3 h-3 rounded-full z-10 shadow-sm', statusColor)}
                    title={totalPecas === 0 ? 'Esgotado' : 'Disponível'}
                />

                {/* Hidden file input */}
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />

                {/* Imagem */}
                <ModeloImage imagemUrl={modelo.imagemUrl} nome={nome} onImageClick={handleImageClick} />

                {/* Conteúdo */}
                <div className="p-4 flex flex-col flex-1 gap-3">
                    {/* Head */}
                    <div className="space-y-1">
                        <h3 className="font-bold text-base text-foreground line-clamp-2 leading-tight">
                            {nome.split('—')[0].trim()}
                        </h3>
                        <p className="text-sm text-foreground/80 font-medium line-clamp-1">{meta.referencia}</p>
                        <p className="text-xs text-muted-foreground">{TIPO_GARMENT_LABELS[meta.tipo]}</p>
                    </div>

                    {/* Coleção */}
                    {meta.colecao && (
                        <p className="text-xs text-muted-foreground/70 italic">{meta.colecao}</p>
                    )}

                    {/* Tamanhos */}
                    <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                            {variacoes.map(v => (
                                <span
                                    key={v.id}
                                    className={cn(
                                        'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                                        v.quantidade > 0
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-red-50 text-red-600 border-red-200 opacity-60'
                                    )}
                                    title={`${v.tamanho}: ${v.quantidade} peças`}
                                >
                                    {v.tamanho}
                                </span>
                            ))}
                        </div>
                        {tamanhosEsgotados.length > 0 && (
                            <p className="text-[10px] text-muted-foreground/60">
                                Esgotados: {tamanhosEsgotados.join(', ')}
                            </p>
                        )}
                    </div>

                    {/* Dados numéricos */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Quantidade</p>
                            <p className="font-bold text-lg">{totalPecas} <span className="text-xs font-normal text-muted-foreground">peças</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preço de Venda</p>
                            <p className="font-bold text-emerald-600">R$ {(precoUnitario ?? 0).toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-1 pb-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Vendidas Semana</span>
                        <span className={cn(
                        "text-sm font-semibold flex items-center gap-1.5",
                        vendasSemana > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                        )}>
                            <ShoppingBag size={14} />
                            {vendasSemana} peças
                        </span>
                    </div>

                    {/* Histórico acumulado e Vendas totais agrupadas */}
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">Volume Total</span>
                            <span className="text-sm font-bold text-foreground">
                                {totalProduzido} <span className="text-[10px] font-normal opacity-70">pçs</span>
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">Vendas Totais</span>
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {totalVendas} <span className="text-[10px] font-normal opacity-70">pçs</span>
                            </span>
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 mt-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2 h-9 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                            onClick={() => onVerDetalhes(modelo)}
                        >
                            <Eye size={14} />
                            Ver Detalhes
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-gray-200 dark:border-gray-600"
                            onClick={() => setShowEdit(true)}
                            title="Editar modelo"
                        >
                            <Pencil size={14} />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 border-gray-200 dark:border-gray-600"
                            onClick={() => setShowConfirmDelete(true)}
                            title="Excluir modelo e todas as variações"
                        >
                            <Trash2 size={14} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal de Edição */}
            <EditarModeloPadronizadoModal
                modelo={modelo}
                open={showEdit}
                onClose={() => setShowEdit(false)}
            />

            {/* Modal de confirmação de exclusão */}
            <Dialog open={showConfirmDelete} onOpenChange={v => { if (!v && !deleting) setShowConfirmDelete(false); }}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle size={20} />
                            Excluir Modelo Padronizado
                        </DialogTitle>
                        <DialogDescription>
                            Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-3 space-y-3">
                        {/* Info do modelo */}
                        <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                            <p className="font-bold text-foreground">{meta.referencia}</p>
                            <p className="text-sm text-muted-foreground">{nome.split('—')[0].trim()}</p>
                            <p className="text-xs text-muted-foreground">{variacoes.length} variação(ões) · {totalPecas} peças no estoque</p>
                        </div>

                        {/* Alerta */}
                        <div className="flex gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive/80">
                                Todas as <strong>{variacoes.length} variações</strong> e os estoques vinculados
                                ({totalPecas} peças) serão <strong>permanentemente removidos</strong>.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirmDelete(false)}
                            disabled={deleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                            className="gap-2"
                        >
                            {deleting ? (
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Trash2 size={14} />
                            )}
                            {deleting ? 'Excluindo…' : 'Excluir Modelo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
