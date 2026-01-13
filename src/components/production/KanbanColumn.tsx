import { useDroppable } from '@dnd-kit/core';
import { 
  Scissors, 
  Shirt, 
  Droplets, 
  Tag, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Zap,
  Sparkles,
  ClipboardCheck
} from 'lucide-react';
import { ProducaoData } from '@/entities/Producao';
import { Stage } from '@/types/production';
import { ProductionCard } from './ProductionCard';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Scissors,
  Shirt,
  Droplets,
  Tag,
  CheckCircle2,
  Layers,
  Zap,
  Sparkles,
  ClipboardCheck,
};

interface KanbanColumnProps {
  stage: Stage;
  lots: ProducaoData[];
  onMoveCard: (lot: ProducaoData, direction: 'next' | 'prev') => void;
  onEditCard?: (lot: ProducaoData) => void;
  onDeleteCard?: (lot: ProducaoData) => void;
  onManageCosts?: (lot: ProducaoData) => void;
  onOpenChecklist?: (lot: ProducaoData) => void;
  onUpdateProgress?: (lotId: string, pecasConcluidas: number) => void;
  isFirstStage: boolean;
  isLastStage: boolean;
}

const BOTTLENECK_THRESHOLD = 5;

export function KanbanColumn({ 
  stage, 
  lots, 
  onMoveCard,
  onEditCard,
  onDeleteCard,
  onManageCosts,
  onOpenChecklist,
  onUpdateProgress,
  isFirstStage, 
  isLastStage 
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const Icon = iconMap[stage.icon] || Scissors;
  
  // Calculate total pieces in column
  const totalPecas = lots.reduce((sum, lot) => sum + lot.quantidade, 0);
  
  // Bottleneck detection
  const isBottleneck = lots.length > BOTTLENECK_THRESHOLD;

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "w-[320px] flex flex-col h-full flex-shrink-0 transition-all duration-300 rounded-2xl p-3",
        isOver && "scale-[1.02] bg-primary/5",
        isBottleneck && "ring-2 ring-amber-400/40 bg-amber-50/20 dark:bg-amber-900/10"
      )}
    >
      {/* Column Header */}
      <div className={cn(
        "flex items-center gap-3 mb-4 px-3 py-3 rounded-xl transition-all",
        "neu-card border-0"
      )}>
        <div className={`p-2.5 rounded-xl ${stage.bgColor} ${stage.color} shadow-sm`}>
          <Icon size={18} />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-foreground text-sm">
            {stage.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {totalPecas} peças
          </span>
        </div>
        
        {/* Lot count badge */}
        <span className={cn(
          "ml-auto text-xs font-bold px-2.5 py-1.5 rounded-full transition-colors",
          isBottleneck 
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" 
            : "bg-muted text-muted-foreground"
        )}>
          {lots.length}
          {isBottleneck && <AlertTriangle size={10} className="inline ml-1" />}
        </span>
      </div>

      {/* Cards Container */}
      <div className={cn(
        "flex-1 overflow-y-auto space-y-4 px-1 pb-10 scrollbar-hide transition-all",
        isOver && "bg-primary/5 rounded-xl"
      )}>
        {lots.map((lot) => (
          <ProductionCard
            key={lot.id}
            lot={lot}
            onMoveNext={() => onMoveCard(lot, 'next')}
            onMovePrev={() => onMoveCard(lot, 'prev')}
            onEdit={() => onEditCard?.(lot)}
            onDelete={() => onDeleteCard?.(lot)}
            onManageCosts={() => onManageCosts?.(lot)}
            onOpenChecklist={() => onOpenChecklist?.(lot)}
            onUpdateProgress={onUpdateProgress}
            isFirstStage={isFirstStage}
            isLastStage={isLastStage}
            currentStage={stage.id}
          />
        ))}
        
        {lots.length === 0 && (
          <div className={cn(
            "h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
            isOver 
              ? "border-primary/50 bg-primary/5 text-primary" 
              : "border-border text-muted-foreground"
          )}>
            <Icon size={24} className="opacity-30" />
            <span className="text-xs italic">
              {isOver ? "Solte aqui" : "Sem lotes nesta etapa"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
