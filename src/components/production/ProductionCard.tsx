import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, ArrowRight, ArrowLeft, Trash2, Pencil, DollarSign, PackageCheck, Package, Flame, AlertTriangle, Circle, Clock, History } from 'lucide-react';
import { ProducaoData } from '@/entities/Producao';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useLoteCustos } from '@/hooks/useLoteCustos';
import { useTempoNaEtapa } from '@/hooks/useTempoNaEtapa';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LazyImage } from '@/components/ui/lazy-image';
import { STAGES, getStageIndex } from '@/data/production-data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProductionCardProps {
  lot: ProducaoData;
  onMoveNext: () => void;
  onMovePrev: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onManageCosts?: () => void;
  onOpenChecklist?: () => void;
  onOpenHistory?: () => void;
  onUpdateProgress?: (lotId: string, pecasConcluidas: number) => void;
  isFirstStage: boolean;
  isLastStage: boolean;
  isDragging?: boolean;
  currentStage?: string;
}

const priorityConfig = {
  urgente: {
    label: 'URGENTE',
    icon: Flame,
    className: 'bg-red-500 text-white',
    ringClass: 'ring-red-400/30',
  },
  atencao: {
    label: 'ATENÇÃO',
    icon: AlertTriangle,
    className: 'bg-amber-500 text-white',
    ringClass: 'ring-amber-400/30',
  },
  normal: {
    label: 'NORMAL',
    icon: Circle,
    className: 'bg-blue-500 text-white',
    ringClass: '',
  },
};

export function ProductionCard({ 
  lot, 
  onMoveNext, 
  onMovePrev,
  onEdit,
  onDelete,
  onManageCosts,
  onOpenChecklist,
  onOpenHistory,
  onUpdateProgress,
  isFirstStage, 
  isLastStage,
  isDragging: isDraggingProp,
  currentStage
}: ProductionCardProps) {
  
  const { attributes, listeners, setNodeRef, transform, isDragging: isDraggingDnd } = useDraggable({
    id: lot.id,
  });

  const isDragging = isDraggingProp || isDraggingDnd;
  
  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const { signedUrl } = useSignedUrl(lot.imagem_url);
  const { config } = useLoteCustos(lot.id);
  const { dias, corClasse, label: tempoLabel } = useTempoNaEtapa(lot.updated_at);
  
  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir o lote ${lot.id_producao}?`)) {
      onDelete?.();
    }
  };

  const precoVenda = config?.preco_venda || 0;
  const priority = lot.prioridade || 'normal';
  const priorityInfo = priorityConfig[priority];
  const PriorityIcon = priorityInfo.icon;
  
  // Stage progress calculation
  const currentStageIndex = getStageIndex(lot.processo_atual);
  const stageProgress = ((currentStageIndex + 1) / STAGES.length) * 100;
  const currentStageLabel = STAGES[currentStageIndex]?.label || lot.processo_atual;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "neu-card p-4 transition-all duration-300 cursor-grab active:cursor-grabbing group",
        isDragging && "opacity-50 scale-105 shadow-lg rotate-2",
        priority !== 'normal' && `ring-2 ${priorityInfo.ringClass}`,
        "hover:shadow-neu-sm hover:-translate-y-0.5"
      )}
    >
      {/* Header with Priority & ID */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority Tag */}
          <span className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
            priorityInfo.className
          )}>
            <PriorityIcon size={10} />
            {priorityInfo.label}
          </span>
          
          {/* Badge de status de integração com estoque */}
          {lot.posted_to_stock_at ? (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
              <PackageCheck size={10} className="mr-1" />
              Estoque ✓
            </Badge>
          ) : lot.integrado_estoque ? (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
              <Package size={10} className="mr-1" />
              Sem custo
            </Badge>
          ) : null}
        </div>
        
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-primary bg-secondary px-2 py-1 rounded-md">
            {lot.id_producao}
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50 opacity-0 group-hover:opacity-100">
                <MoreVertical size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-card z-50">
              <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                <Pencil size={14} className="mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageCosts} className="cursor-pointer">
                <DollarSign size={14} className="mr-2" />
                Custos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenHistory} className="cursor-pointer">
                <History size={14} className="mr-2" />
                Histórico
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleDelete} 
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Excluir Lote
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Large Image with LazyImage */}
      <div className="aspect-[4/3] rounded-xl overflow-hidden mb-3 neu-input">
        <LazyImage 
          src={signedUrl} 
          alt={lot.modelo_nome_cache || 'Produto'} 
          className="w-full h-full object-cover"
          containerClassName="w-full h-full"
        />
      </div>

      {/* Model Name & Quantity */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-bold text-foreground text-base truncate leading-tight flex-1 mr-2">
            {lot.modelo_nome_cache || 'Sem modelo'}
          </h4>
          {/* Time indicator */}
          {dias > 0 && (
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0",
              corClasse
            )}>
              <Clock size={10} />
              {tempoLabel}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {lot.quantidade} <span className="text-xs font-normal text-muted-foreground">peças</span>
          </span>
          {precoVenda > 0 && (
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
              R$ {precoVenda.toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Etapa {currentStageIndex + 1} de {STAGES.length}</span>
          <span className="font-medium">{currentStageLabel}</span>
        </div>
        <Progress value={stageProgress} className="h-2" />
      </div>

      {/* Footer with Avatar & Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border/30">
        {/* Responsible Avatar */}
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 shadow-sm">
            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
              {lot.responsavel?.slice(0, 2).toUpperCase() || '??'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground font-medium truncate max-w-[80px]">
            {lot.responsavel || '-'}
          </span>
        </div>

        {/* Action Buttons - Extruded Neumorphic */}
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onMovePrev(); }}
            disabled={isFirstStage}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              "neu-button-extruded",
              "text-muted-foreground hover:text-foreground",
              "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            )}
            title="Voltar etapa"
          >
            <ArrowLeft size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveNext(); }}
            disabled={isLastStage}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              "neu-button-extruded",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            )}
            title="Avançar etapa"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
