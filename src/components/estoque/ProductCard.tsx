import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Camera, Pencil, Check, X, Package, ShoppingBag } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/ui/lazy-image';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  item: {
    id: string;
    nome: string;
    categoria: string;
    quantidade: number;
    unidade: string;
    precoUnitario: number;
    localizacao: string;
    imagemUrl?: string;
    producaoId?: string;
    status?: string;
    tipo: string;
  };
  editingPriceId: string | null;
  editingPriceValue: number;
  onEditPrice: (item: ProductCardProps['item']) => void;
  onSavePrice: (itemId: string) => void;
  onCancelEditPrice: () => void;
  onPriceValueChange: (value: number) => void;
  onEdit: (item: ProductCardProps['item']) => void;
  onDelete: (item: ProductCardProps['item']) => void;
  onImageUpdate: (productId: string, file: File) => void;
  vendasSemana?: number;
}

function ProductImage({
  imagemUrl,
  nome,
  onImageClick
}: {
  imagemUrl?: string;
  nome: string;
  onImageClick: () => void;
}) {
  const { signedUrl, loading } = useSignedUrl(imagemUrl);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-muted/30 group cursor-pointer"
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
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20">
          <div className="text-muted-foreground/50 text-center">
            <Camera size={32} className="mx-auto mb-2 opacity-50" />
            <span className="text-xs">Sem imagem</span>
          </div>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center rounded-t-2xl">
        <Camera className="w-8 h-8 text-white mb-2" />
        <span className="text-white text-sm font-medium">Trocar Foto</span>
      </div>
    </div>
  );
}

export function ProductCard({
  item,
  editingPriceId,
  editingPriceValue,
  onEditPrice,
  onSavePrice,
  onCancelEditPrice,
  onPriceValueChange,
  onEdit,
  onDelete,
  onImageUpdate,
  vendasSemana = 0,
}: ProductCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status indicator based on quantity
  const getStockStatus = (quantidade: number) => {
    if (quantidade === 0) return { color: 'bg-red-500', label: 'Esgotado' };
    if (quantidade <= 20) return { color: 'bg-amber-500', label: 'Baixo' };
    return { color: 'bg-emerald-500', label: 'Disponível' };
  };

  const stockStatus = getStockStatus(item.quantidade);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpdate(item.id, file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-soft transition-all duration-300 hover:shadow-lg relative">
      {/* Stock status indicator */}
      <div
        className={cn(
          "absolute top-3 right-3 w-3 h-3 rounded-full z-10 shadow-sm",
          stockStatus.color
        )}
        title={stockStatus.label}
      />
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* Product Image - 4:3 aspect ratio */}
      <ProductImage
        imagemUrl={item.imagemUrl}
        nome={item.nome}
        onImageClick={handleImageClick}
      />

      {/* Content */}
      <div className="p-4">
        {/* Header: Name and Category */}
        <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-lg text-foreground line-clamp-2">{item.nome}</h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground/70 uppercase tracking-wider">
              {item.categoria}
              {item.producaoId && (
                <span className="ml-2 text-primary">• {item.producaoId}</span>
              )}
            </p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 uppercase tracking-wider border border-border/40 shrink-0">
              Manual
            </span>
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Quantidade</span>
            <span className="font-bold text-lg text-foreground">
              {item.quantidade} <span className="text-xs font-normal text-muted-foreground">{item.unidade}</span>
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Preço de Venda</span>
            {editingPriceId === item.id ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editingPriceValue}
                  onChange={(e) => onPriceValueChange(parseFloat(e.target.value) || 0)}
                  className="h-8 w-24 rounded-lg text-right text-sm font-semibold border border-gray-200 dark:border-gray-600"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSavePrice(item.id);
                    if (e.key === 'Escape') onCancelEditPrice();
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  onClick={() => onSavePrice(item.id)}
                >
                  <Check size={14} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted"
                  onClick={onCancelEditPrice}
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => onEditPrice(item)}
                className="group flex items-center gap-2 font-bold text-lg text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                R$ {(item.precoUnitario ?? 0).toFixed(2)}
                <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Vendidas Semana</span>
            <span className={cn(
              "text-sm font-semibold flex items-center gap-1.5",
              vendasSemana > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
            )}>
              <ShoppingBag size={14} />
              {vendasSemana} peças
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 h-10 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={() => onEdit(item)}
          >
            <Edit size={14} />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10 px-3 border-gray-200 dark:border-gray-600"
            onClick={() => onDelete(item)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
