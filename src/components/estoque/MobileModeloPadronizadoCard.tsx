import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { MoreVertical, Pencil, Trash2, Camera, ShoppingBag, Package, Eye, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ModeloPadronizado, TAMANHOS_LETRAS, TAMANHOS_NUMERICOS, useModelosPadronizados } from '@/hooks/useModelosPadronizados';
import { EditarModeloPadronizadoModal } from './EditarModeloPadronizadoModal';
import { parseProductName } from '@/utils/productNameUtils';

interface MobileModeloPadronizadoCardProps {
    modelo: ModeloPadronizado;
    onVerDetalhes: (modelo: ModeloPadronizado) => void;
    onImageUpdate?: (productId: string, file: File) => void;
    vendasSemana?: number;
}

function HeroImage({ 
  imagemUrl, 
  nome, 
  onImageClick,
  statusColor
}: { 
  imagemUrl?: string; 
  nome: string;
  onImageClick?: () => void;
  statusColor: string;
}) {
  const { signedUrl, loading } = useSignedUrl(imagemUrl);

  return (
    <div 
      className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-muted cursor-pointer group shadow-sm"
      onClick={onImageClick}
    >
      {loading ? (
        <div className="w-full h-full flex items-center justify-center animate-pulse">
          <Package className="h-8 w-8 text-muted-foreground/30" />
        </div>
      ) : signedUrl ? (
        <LazyImage
          src={signedUrl}
          alt={nome}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          containerClassName="w-full h-full"
          showPlaceholderIcon={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center hover:bg-muted/80 transition-colors">
          <Camera className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      
      {/* Status Dot Overlay */}
      <div className={cn(
        "absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-white shadow-md z-10",
        statusColor
      )} />

      {/* Camera Overlay on Hover */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="h-6 w-6 text-white drop-shadow-md" />
      </div>
    </div>
  );
}

export function MobileModeloPadronizadoCard({
    modelo,
    onVerDetalhes,
    onImageUpdate,
    vendasSemana = 0,
}: MobileModeloPadronizadoCardProps) {
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

    // Status geral
    const statusColor =
        totalPecas === 0
            ? 'bg-red-500'
            : variacoes.some(v => v.quantidade === 0)
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
            toast.success(`Modelo "${meta.referencia}" removido.`);
            setShowConfirmDelete(false);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao excluir modelo');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <Card className="p-3 bg-white dark:bg-card border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none rounded-[2rem] flex flex-col gap-4 overflow-hidden">
                {/* Hidden file input */}
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />

                {/* Top Section: Large Image */}
                <HeroImage 
                    imagemUrl={modelo.imagemUrl} 
                    nome={nome}
                    onImageClick={handleImageClick}
                    statusColor={statusColor}
                />

                {/* Content Section */}
                <div className="px-1 space-y-4">
                    {/* Title & Ref */}
                    <div className="space-y-1">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight leading-none uppercase">
                            {parseProductName(nome, meta.referencia).nomeExibicao}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">
                                {meta.referencia}
                            </span>
                            <span className="text-xs text-slate-400">
                                {modelo.categoria || 'Calça'}
                            </span>
                        </div>
                    </div>

                    {/* Size Grade Grid */}
                    <div className="flex flex-wrap gap-2">
                        {variacoes.map((v) => (
                            <div 
                                key={v.id} 
                                className={cn(
                                    "px-3 py-1.5 rounded-lg border text-sm font-bold transition-all",
                                    v.quantidade > 0 
                                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400" 
                                        : "border-gray-200 bg-gray-50 text-gray-400 opacity-60"
                                )}
                            >
                                {v.tamanho}
                            </div>
                        ))}
                    </div>

                    {/* Stats Row 1: Quantity and Price */}
                    <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantidade</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-slate-800 dark:text-white">{totalPecas}</span>
                                <span className="text-xs font-medium text-slate-400">peças</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preço de Venda</p>
                            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                R$ {(precoUnitario ?? 0).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Stats Row 2: Vendas Semana */}
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendas na Semana</p>
                        <div className="flex items-center gap-1.5 text-blue-600 font-bold bg-blue-50/80 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl">
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="text-sm">{vendasSemana} peças</span>
                        </div>
                    </div>

                    {/* Summary Bottom Card */}
                    <div className="grid grid-cols-2 gap-0 py-4 px-1 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50">
                        <div className="flex flex-col items-center justify-center border-r border-slate-200/50 dark:border-slate-800/50">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volume Total</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-base font-black text-slate-700 dark:text-slate-200">{totalProduzido}</span>
                                <span className="text-[10px] text-slate-400">pçs</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vendas Totais</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-base font-black text-blue-600 dark:text-blue-400">{totalVendas}</span>
                                <span className="text-[10px] text-slate-400">pçs</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex gap-2 pt-2 pb-1">
                        <Button 
                            variant="outline" 
                            className="flex-1 h-12 rounded-2xl border-purple-100 bg-purple-50/30 text-purple-700 font-bold hover:bg-purple-100 transition-all gap-2"
                            onClick={() => onVerDetalhes(modelo)}
                        >
                            <Eye className="h-4 w-4" />
                            Ver Detalhes
                        </Button>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-12 w-12 rounded-2xl bg-slate-50 border-slate-200 text-slate-600 hover:text-blue-600 transition-all shrink-0"
                            onClick={() => setShowEdit(true)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-12 w-12 rounded-2xl bg-slate-50 border-slate-200 text-slate-600 hover:text-red-600 transition-all shrink-0"
                            onClick={() => setShowConfirmDelete(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Modal de Edição */}
            <EditarModeloPadronizadoModal
                modelo={modelo}
                open={showEdit}
                onClose={() => setShowEdit(false)}
            />

            {/* Modal de confirmação de exclusão */}
            <Dialog open={showConfirmDelete} onOpenChange={v => { if (!v && !deleting) setShowConfirmDelete(false); }}>
                <DialogContent className="sm:max-w-[420px] rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-xl">
                            <AlertTriangle size={24} />
                            Excluir Modelo
                        </DialogTitle>
                        <DialogDescription className="font-medium">
                            Esta ação removerá permanentemente o modelo e suas variações.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                            <p className="font-black text-lg text-foreground tracking-tight uppercase">{meta.referencia}</p>
                            <p className="text-sm font-medium text-slate-500">{nome.split('—')[0].trim()}</p>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                            <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                            <p className="text-sm text-destructive/80 font-medium">
                                Todas as variações e estoques vinculados serão removidos.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirmDelete(false)}
                            disabled={deleting}
                            className="h-12 rounded-2xl flex-1 font-bold"
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                            className="h-12 rounded-2xl flex-1 font-bold gap-2"
                        >
                            {deleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 size={16} />
                            )}
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
