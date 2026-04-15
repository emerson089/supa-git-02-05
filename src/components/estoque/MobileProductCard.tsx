import { useRef } from 'react';
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
import { MoreVertical, Pencil, Trash2, DollarSign, Camera, ShoppingBag, Package, Calendar } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import { parseProductName } from '@/utils/productNameUtils';

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
    quantidadeInicial: number;
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
  vendasSemana?: number;
}

function HeroImage({ 
  imagemUrl, 
  nome, 
  onImageClick,
  statusColor
}: { 
  imagemUrl: string | null; 
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
  vendasSemana = 0,
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

  const getStockStatus = (quantidade: number) => {
    if (quantidade === 0) return { color: 'bg-red-500', label: 'Esgotado' };
    if (quantidade <= 20) return { color: 'bg-amber-500', label: 'Baixo' };
    return { color: 'bg-emerald-500', label: 'Disponível' };
  };

  const stockStatus = getStockStatus(item.quantidade);

  return (
    <Card className="p-3 bg-white dark:bg-card border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none rounded-[2rem] flex flex-col gap-4 overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {/* Top Section: Large Image */}
      <HeroImage 
        imagemUrl={item.imagemUrl} 
        nome={item.nome}
        onImageClick={handleImageClick}
        statusColor={stockStatus.color}
      />

      {/* Content Section */}
      <div className="px-1 space-y-4">
        {/* Title & Category */}
        <div className="space-y-1">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight leading-none uppercase">
            {parseProductName(item.nome, item.id).nomeExibicao}
          </h3>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {item.categoria}
          </span>
        </div>

        {/* Stats Row 1: Quantity and Price */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantidade</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-800 dark:text-white">{item.quantidade}</span>
              <span className="text-xs font-medium text-slate-400">peças</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preço de Venda</p>
            {isEditingPrice ? (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  type="number"
                  value={editingPrice}
                  onChange={(e) => onPriceChange(e.target.value)}
                  className="h-8 w-20 text-sm font-bold"
                  autoFocus
                />
                <Button size="sm" className="h-8 px-2 bg-emerald-600" onClick={() => onSavePrice(item.id)}>
                  OK
                </Button>
              </div>
            ) : (
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                R$ {item.precoUnitario.toFixed(2)}
              </p>
            )}
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
              <span className="text-base font-black text-slate-700 dark:text-slate-200">
                {item.quantidadeInicial || item.quantidade}
              </span>
              <span className="text-[10px] text-slate-400">pçs</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vendas Totais</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-blue-600 dark:text-blue-400">
                {Math.max(0, (item.quantidadeInicial || item.quantidade) - item.quantidade)}
              </span>
              <span className="text-[10px] text-slate-400">pçs</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-2 pt-2 pb-1">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl border-slate-200 bg-slate-50/30 text-slate-700 font-bold hover:bg-slate-100 transition-all gap-2"
              onClick={() => onEdit(item)}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className={cn(
                "h-12 w-12 rounded-2xl bg-slate-50 border-slate-200 text-slate-600 hover:text-emerald-600 transition-all shrink-0",
                isEditingPrice && "bg-emerald-50 text-emerald-600 border-emerald-200"
              )}
              onClick={() => isEditingPrice ? onCancelEditPrice() : onEditPrice(item.id, item.precoUnitario)}
            >
              <DollarSign className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-2xl bg-slate-50 border-slate-200 text-slate-600 hover:text-red-600 transition-all shrink-0"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </div>
    </Card>
  );
}
