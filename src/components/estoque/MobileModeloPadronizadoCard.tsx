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
import { MoreVertical, Pencil, Trash2, Camera, ShoppingBag, Package, Eye, AlertTriangle, Layers } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ModeloPadronizado, TAMANHOS_LETRAS, TAMANHOS_NUMERICOS, useModelosPadronizados } from '@/hooks/useModelosPadronizados';
import { EditarModeloPadronizadoModal } from './EditarModeloPadronizadoModal';

interface MobileModeloPadronizadoCardProps {
    modelo: ModeloPadronizado;
    onVerDetalhes: (modelo: ModeloPadronizado) => void;
    onImageUpdate?: (productId: string, file: File) => void;
    vendasSemana?: number;
}

function ProductImage({ 
  imagemUrl, 
  nome, 
  onImageClick 
}: { 
  imagemUrl?: string; 
  nome: string;
  onImageClick?: () => void;
}) {
  const { signedUrl, loading } = useSignedUrl(imagemUrl);

  if (loading) {
    return (
      <div className="w-14 h-14 rounded-lg bg-muted animate-pulse flex items-center justify-center shrink-0">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  if (!imagemUrl || !signedUrl) {
    return (
      <div 
        className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors shrink-0"
        onClick={onImageClick}
      >
        <Camera className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div 
      className="w-14 h-14 rounded-lg overflow-hidden bg-muted cursor-pointer relative group shrink-0"
      onClick={onImageClick}
    >
      <LazyImage
        src={signedUrl}
        alt={nome}
        className="w-full h-full object-cover object-center block"
        containerClassName="w-full h-full"
        showPlaceholderIcon={false}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="h-4 w-4 text-white" />
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
            <Card className="p-3 relative overflow-hidden border-purple-100 dark:border-purple-900/30">
                {/* Status indicator */}
                <div 
                    className={cn(
                        "absolute top-2 left-2 w-2.5 h-2.5 rounded-full z-20 shadow-sm border border-white dark:border-gray-900",
                        statusColor
                    )}
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

                <div className="flex gap-3">
                    {/* Imagem compacta */}
                    <ProductImage 
                        imagemUrl={modelo.imagemUrl} 
                        nome={nome}
                        onImageClick={handleImageClick}
                    />

                    {/* Conteúdo principal */}
                    <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-0.5">
                                <h3 className="font-semibold text-sm line-clamp-2 leading-tight">
                                    {nome.split('—')[0].trim()}
                                </h3>
                                <span className="text-[11px] text-muted-foreground font-medium block">
                                    {meta.referencia}
                                </span>
                            </div>
                        </div>

                        {/* Menu de ações */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 absolute right-1.5 top-1.5">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onVerDetalhes(modelo)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShowEdit(true)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    onClick={() => setShowConfirmDelete(true)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Informações de quantidade e preço */}
                        <div className="flex items-center gap-3 mt-2 pb-1">
                            <div className="flex items-center gap-1">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-semibold text-sm">{totalPecas}</span>
                                <span className="text-xs text-muted-foreground">pçs</span>
                            </div>

                            <span className="font-bold text-base text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
                                R$ {(precoUnitario ?? 0).toFixed(2)}
                            </span>
                        </div>

                        {/* Vendidas na semana */}
                        <div className="flex items-center gap-1 mt-1">
                            <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                            <span className={cn(
                                "text-xs",
                                vendasSemana > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-muted-foreground"
                            )}>
                                {vendasSemana} vendidas na semana
                            </span>
                        </div>
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
