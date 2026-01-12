import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, DollarSign, Camera, MapPin, Package } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface MobileProductCardProps {
  item: {
    id: string;
    nome: string;
    categoria: string;
    quantidade: number;
    precoUnitario: number;
    imagemUrl: string | null;
    localizacao?: string | null;
    tipo?: string;
  };
  editingPriceId: string | null;
  editingPrice: string;
  onEditPrice: (id: string, currentPrice: number) => void;
  onSavePrice: (id: string) => void;
  onCancelEditPrice: () => void;
  onPriceChange: (value: string) => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onImageUpdate?: (id: string, file: File) => void;
}

function ProductImage({ 
  imagemUrl, 
  nome, 
  onImageClick 
}: { 
  imagemUrl: string | null; 
  nome: string;
  onImageClick?: () => void;
}) {
  const { signedUrl, loading } = useSignedUrl(imagemUrl);

  if (loading) {
    return (
      <div className="w-14 h-14 rounded-lg bg-muted animate-pulse flex items-center justify-center">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div 
        className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
        onClick={onImageClick}
      >
        <Camera className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div 
      className="w-14 h-14 rounded-lg overflow-hidden bg-muted cursor-pointer relative group"
      onClick={onImageClick}
    >
      <img
        src={signedUrl}
        alt={nome}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="h-4 w-4 text-white" />
      </div>
    </div>
  );
}

export function MobileProductCard({
  item,
  editingPriceId,
  editingPrice,
  onEditPrice,
  onSavePrice,
  onCancelEditPrice,
  onPriceChange,
  onEdit,
  onDelete,
  onImageUpdate,
}: MobileProductCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditingPrice = editingPriceId === item.id;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpdate) {
      onImageUpdate(item.id, file);
    }
    e.target.value = '';
  };

  // Status indicator based on quantity
  const getStockStatus = (quantidade: number) => {
    if (quantidade === 0) return { color: 'bg-red-500', label: 'Esgotado' };
    if (quantidade <= 20) return { color: 'bg-amber-500', label: 'Baixo' };
    return { color: 'bg-emerald-500', label: 'Disponível' };
  };

  const stockStatus = getStockStatus(item.quantidade);

  return (
    <Card className="p-3 relative">
      {/* Stock status indicator */}
      <div 
        className={cn(
          "absolute top-2 right-2 w-3 h-3 rounded-full z-10",
          stockStatus.color
        )}
        title={stockStatus.label}
      />
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      <div className="flex gap-3">
        {/* Imagem compacta */}
        <div className="shrink-0">
          <ProductImage 
            imagemUrl={item.imagemUrl} 
            nome={item.nome}
            onImageClick={handleImageClick}
          />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                {item.nome}
              </h3>
              <Badge variant="secondary" className="mt-1 text-xs">
                {item.categoria}
              </Badge>
            </div>

            {/* Menu de ações */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(item)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditPrice(item.id, item.precoUnitario)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Alterar Preço
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(item)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Informações de quantidade e preço */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold text-sm">{item.quantidade}</span>
              <span className="text-xs text-muted-foreground">pçs</span>
            </div>

            {isEditingPrice ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={editingPrice}
                  onChange={(e) => onPriceChange(e.target.value)}
                  className="h-7 w-20 text-sm"
                  autoFocus
                />
                <Button size="sm" className="h-7 px-2" onClick={() => onSavePrice(item.id)}>
                  OK
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancelEditPrice}>
                  ✕
                </Button>
              </div>
            ) : (
              <span className="font-bold text-base text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
                R$ {item.precoUnitario.toFixed(2)}
              </span>
            )}
          </div>

          {/* Localização */}
          {item.localizacao && (
            <div className="flex items-center gap-1 mt-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">
                {item.localizacao}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
