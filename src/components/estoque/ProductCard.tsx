import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Camera, Pencil, Check, X, Package, ArrowUp, ArrowDown } from 'lucide-react';
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
    quantidadeInicial: number;
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
  vendasSemanaAnterior?: number;
}

function ProductImage({ imagemUrl, nome, onImageClick }: { imagemUrl?: string; nome: string; onImageClick: () => void }) {
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

export function ProductCard({ item, editingPriceId, editingPriceValue, onEditPrice, onSavePrice, onCancelEditPrice, onPriceValueChange, onEdit, onDelete, onImageUpdate, vendasSemana = 0, vendasSemanaAnterior = 0 }: ProductCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalProduzidoRaw = item.quantidadeInicial || item.quantidade;
  const totalProduzido = Math.max(totalProduzidoRaw, item.quantidade);
  const taxaGiro = totalProduzido > 0 ? Math.max(0, Math.min(100, ((totalProduzido - item.quantidade) / totalProduzido) * 100)) : 0;
  const cobertura = vendasSemana > 0 ? Math.ceil(item.quantidade / vendasSemana) : null;
  const tendencia = vendasSemanaAnterior > 0
    ? ((vendasSemana - vendasSemanaAnterior) / vendasSemanaAnterior) * 100
    : vendasSemana > 0 ? 100 : null;

  const giroColor = taxaGiro >= 70 ? 'bg-emerald-500' : taxaGiro >= 30 ? 'bg-amber-500' : 'bg-red-500';
  const giroTextColor = taxaGiro >= 70 ? 'text-emerald-600' : taxaGiro >= 30 ? 'text-amber-600' : 'text-red-500';
  const coberturaColor = cobertura === null ? 'text-muted-foreground' : cobertura <= 2 ? 'text-red-500' : cobertura <= 4 ? 'text-amber-600' : 'text-emerald-600';

  const stockStatus = item.quantidade <= 0 ? { color: 'bg-red-500', label: 'Esgotado' } : item.quantidade <= 20 ? { color: 'bg-amber-500', label: 'Baixo' } : { color: 'bg-emerald-500', label: 'Disponível' };

  const handleImageClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageUpdate(item.id, file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-soft transition-all duration-300 hover:shadow-lg relative flex flex-col h-full">
      <div className={cn("absolute top-3 right-3 w-3 h-3 rounded-full z-10 shadow-sm", stockStatus.color)} title={stockStatus.label} />
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
      <ProductImage imagemUrl={item.imagemUrl} nome={item.nome} onImageClick={handleImageClick} />

      <div className="p-4 flex flex-col flex-1">
        {/* Identificação */}
        <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-lg text-foreground line-clamp-2">{item.nome}</h3>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mt-1">
            {item.categoria}
            {item.producaoId && <span className="ml-2 text-primary">• {item.producaoId}</span>}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 uppercase tracking-wide">Legado</span>
            {!item.imagemUrl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase tracking-wide">Sem imagem</span>}
            {(!item.precoUnitario || item.precoUnitario === 0) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-red-50 text-red-500 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 uppercase tracking-wide">Sem preço</span>}
          </div>
        </div>

        {/* Qtd + Preço */}
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Quantidade</span>
            <span className="font-bold text-lg text-foreground">{item.quantidade} <span className="text-xs font-normal text-muted-foreground">{item.unidade}</span></span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Preço de Venda</span>
            {editingPriceId === item.id ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input type="number" step="0.01" min={0} value={editingPriceValue} onChange={e => onPriceValueChange(parseFloat(e.target.value) || 0)} className="h-8 w-24 rounded-lg text-right text-sm font-semibold border border-gray-200 dark:border-gray-600" autoFocus onKeyDown={e => { if (e.key === 'Enter') onSavePrice(item.id); if (e.key === 'Escape') onCancelEditPrice(); }} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-100" onClick={() => onSavePrice(item.id)}><Check size={14} /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={onCancelEditPrice}><X size={14} /></Button>
              </div>
            ) : (
              <button onClick={() => onEditPrice(item)} className="group flex items-center gap-2 font-bold text-lg text-emerald-600 hover:text-emerald-700 transition-colors">
                R$ {(item.precoUnitario ?? 0).toFixed(2)}
                <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>

        {/* Métricas de performance */}
        <div className="mt-3 space-y-2.5 pt-3 border-t border-border/20">
          {/* Vendas Semana + Tendência */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Vendas Semana</span>
            <div className="flex items-center gap-1.5">
              <span className={cn('text-sm font-bold', vendasSemana > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
                {vendasSemana} pçs
              </span>
              {tendencia !== null && (
                <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', tendencia > 0 ? 'text-emerald-600' : tendencia < 0 ? 'text-red-500' : 'text-muted-foreground')}>
                  {tendencia > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                  {tendencia > 0 ? '+' : ''}{tendencia.toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* Giro do Lote */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Giro do Lote</span>
              <span className={cn('text-[11px] font-black', giroTextColor)}>{taxaGiro.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', giroColor)} style={{ width: `${taxaGiro}%` }} />
            </div>
          </div>

          {/* Cobertura */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Cobertura</span>
            <span className={cn('text-[11px] font-black', coberturaColor)}>
              {cobertura === null ? '—' : cobertura === 1 ? '1 semana' : `${cobertura} semanas`}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-10 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => onEdit(item)}>
            <Edit size={14} />
            Editar
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10 px-3 border-gray-200 dark:border-gray-600" onClick={() => onDelete(item)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
