import { useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, DollarSign, Camera, Package, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
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
  vendasSemanaAnterior?: number;
}

function HeroImage({ imagemUrl, nome, onImageClick, statusColor }: { imagemUrl: string | null; nome: string; onImageClick?: () => void; statusColor: string }) {
  const { signedUrl, loading } = useSignedUrl(imagemUrl);
  return (
    <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-muted cursor-pointer group shadow-sm" onClick={onImageClick}>
      {loading ? (
        <div className="w-full h-full flex items-center justify-center animate-pulse">
          <Package className="h-8 w-8 text-muted-foreground/30" />
        </div>
      ) : signedUrl ? (
        <LazyImage src={signedUrl} alt={nome} className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105" containerClassName="w-full h-full" showPlaceholderIcon={false} />
      ) : (
        <div className="w-full h-full flex items-center justify-center hover:bg-muted/80 transition-colors">
          <Camera className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className={cn("absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-white shadow-md z-10", statusColor)} />
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="h-6 w-6 text-white drop-shadow-md" />
      </div>
    </div>
  );
}

export function MobileProductCard({ item, editingPriceId, editingPrice, onEditPrice, onSavePrice, onCancelEditPrice, onPriceChange, onEdit, onDelete, onImageUpdate, vendasSemana = 0, vendasSemanaAnterior = 0 }: MobileProductCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditingPrice = editingPriceId === item.id;

  const totalProduzido = item.quantidadeInicial || item.quantidade;
  const taxaGiro = totalProduzido > 0 ? Math.min(100, ((totalProduzido - item.quantidade) / totalProduzido) * 100) : 0;
  const cobertura = vendasSemana > 0 ? Math.ceil(item.quantidade / vendasSemana) : null;
  const tendencia = vendasSemanaAnterior > 0
    ? ((vendasSemana - vendasSemanaAnterior) / vendasSemanaAnterior) * 100
    : vendasSemana > 0 ? 100 : null;

  const giroColor = taxaGiro >= 70 ? 'bg-emerald-500' : taxaGiro >= 30 ? 'bg-amber-500' : 'bg-red-500';
  const giroTextColor = taxaGiro >= 70 ? 'text-emerald-600' : taxaGiro >= 30 ? 'text-amber-600' : 'text-red-500';
  const coberturaColor = cobertura === null ? 'text-slate-400' : cobertura <= 2 ? 'text-red-500' : cobertura <= 4 ? 'text-amber-600' : 'text-emerald-600';

  const stockStatus = item.quantidade === 0 ? { color: 'bg-red-500' } : item.quantidade <= 20 ? { color: 'bg-amber-500' } : { color: 'bg-emerald-500' };

  const handleImageClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpdate) onImageUpdate(item.id, file);
    e.target.value = '';
  };

  return (
    <Card className="p-3 bg-white dark:bg-card border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none rounded-[2rem] flex flex-col gap-4 overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      <HeroImage imagemUrl={item.imagemUrl} nome={item.nome} onImageClick={handleImageClick} statusColor={stockStatus.color} />

      <div className="px-1 space-y-4">
        {/* Identificação */}
        <div className="space-y-1">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight leading-none uppercase">
            {parseProductName(item.nome, item.id).nomeExibicao}
          </h3>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.categoria}</span>
          <div className="flex flex-wrap gap-1 pt-0.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 uppercase tracking-wide">Legado</span>
            {!item.imagemUrl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase tracking-wide">Sem imagem</span>}
            {(!item.precoUnitario || item.precoUnitario === 0) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-red-50 text-red-500 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 uppercase tracking-wide">Sem preço</span>}
          </div>
        </div>

        {/* Qtd + Preço */}
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
                <Input type="number" value={editingPrice} onChange={e => onPriceChange(e.target.value)} className="h-8 w-20 text-sm font-bold" autoFocus />
                <Button size="sm" className="h-8 px-2 bg-emerald-600" onClick={() => onSavePrice(item.id)}>OK</Button>
              </div>
            ) : (
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">R$ {item.precoUnitario.toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Métricas de performance */}
        <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
          {/* Vendas Semana + Tendência */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendas Semana</p>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50/80 dark:bg-blue-900/20 px-2.5 py-1 rounded-xl">
                <Calendar className="h-3 w-3" />
                <span className="text-sm">{vendasSemana} pçs</span>
              </div>
              {tendencia !== null && (
                <span className={cn("flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg", tendencia > 0 ? "text-emerald-600 bg-emerald-50" : tendencia < 0 ? "text-red-500 bg-red-50" : "text-slate-400 bg-slate-50")}>
                  {tendencia > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                  {tendencia > 0 ? '+' : ''}{tendencia.toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* Giro do Lote */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giro do Lote</p>
              <span className={cn("text-[11px] font-black", giroTextColor)}>{taxaGiro.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", giroColor)} style={{ width: `${taxaGiro}%` }} />
            </div>
          </div>

          {/* Cobertura */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cobertura</p>
            <span className={cn("text-[11px] font-black", coberturaColor)}>
              {cobertura === null ? '—' : cobertura === 1 ? '1 semana' : `${cobertura} semanas`}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2 pb-1">
          <Button variant="outline" className="flex-1 h-12 rounded-2xl border-slate-200 bg-slate-50/30 text-slate-700 font-bold hover:bg-slate-100 transition-all gap-2" onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button variant="outline" size="icon" className={cn("h-12 w-12 rounded-2xl bg-slate-50 border-slate-200 text-slate-600 hover:text-emerald-600 transition-all shrink-0", isEditingPrice && "bg-emerald-50 text-emerald-600 border-emerald-200")} onClick={() => isEditingPrice ? onCancelEditPrice() : onEditPrice(item.id, item.precoUnitario)}>
            <DollarSign className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-slate-50 border-slate-200 text-slate-600 hover:text-red-600 transition-all shrink-0" onClick={() => onDelete(item)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
