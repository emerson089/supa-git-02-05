import { useState, useEffect, useRef, memo } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  closestCorners, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { ProducaoData } from '@/entities/Producao';
import { STAGES } from '@/data/production-data';
import { KanbanColumn } from './KanbanColumn';
import { ProductionCard } from './ProductionCard';
import { FiltrosProducao } from '@/hooks/useProducaoPorEtapa';

interface KanbanBoardProps {
  lots: ProducaoData[];
  onMoveCard: (lot: ProducaoData, direction: 'next' | 'prev') => void;
  onDragMove?: (lot: ProducaoData, targetStage: string) => void;
  onEditCard?: (lot: ProducaoData) => void;
  onDeleteCard?: (lot: ProducaoData) => void;
  onManageCosts?: (lot: ProducaoData) => void;
  onOpenChecklist?: (lot: ProducaoData) => void;
  onUpdateProgress?: (lotId: string, pecasConcluidas: number) => void;
  filtros?: FiltrosProducao;
}

// Memoized column wrapper para lazy loading
const LazyColumn = memo(function LazyColumn({
  stageId,
  stageIndex,
  allLots,
  filtros,
  onMoveCard,
  onEditCard,
  onDeleteCard,
  onManageCosts,
  onOpenChecklist,
  onUpdateProgress,
}: {
  stageId: string;
  stageIndex: number;
  allLots: ProducaoData[];
  filtros?: FiltrosProducao;
  onMoveCard: (lot: ProducaoData, direction: 'next' | 'prev') => void;
  onEditCard?: (lot: ProducaoData) => void;
  onDeleteCard?: (lot: ProducaoData) => void;
  onManageCosts?: (lot: ProducaoData) => void;
  onOpenChecklist?: (lot: ProducaoData) => void;
  onUpdateProgress?: (lotId: string, pecasConcluidas: number) => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(stageIndex < 3); // Primeiras 3 visíveis imediatamente
  
  const stage = STAGES[stageIndex];
  
  // IntersectionObserver para lazy loading de colunas
  useEffect(() => {
    if (isVisible) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );
    
    if (columnRef.current) {
      observer.observe(columnRef.current);
    }
    
    return () => observer.disconnect();
  }, [isVisible]);

  // Filtrar lotes para esta etapa
  const stageLots = allLots.filter(l => {
    if (l.processo_atual !== stageId) return false;
    
    // Aplicar filtros locais
    if (filtros?.prioridade && filtros.prioridade !== 'todos' && l.prioridade !== filtros.prioridade) {
      return false;
    }
    if (filtros?.responsavel && l.responsavel !== filtros.responsavel) {
      return false;
    }
    
    return true;
  });

  return (
    <div ref={columnRef} className="min-w-[320px]">
      {isVisible ? (
        <KanbanColumn
          stage={stage}
          lots={stageLots}
          onMoveCard={onMoveCard}
          onEditCard={onEditCard}
          onDeleteCard={onDeleteCard}
          onManageCosts={onManageCosts}
          onOpenChecklist={onOpenChecklist}
          onUpdateProgress={onUpdateProgress}
          isFirstStage={stageIndex === 0}
          isLastStage={stageIndex === STAGES.length - 1}
        />
      ) : (
        // Placeholder enquanto não está visível
        <div className="w-[320px] h-full flex flex-col">
          <div className="h-16 bg-muted/30 rounded-xl animate-pulse mb-4" />
          <div className="flex-1 bg-muted/20 rounded-xl" />
        </div>
      )}
    </div>
  );
});

export function KanbanBoard({ 
  lots, 
  onMoveCard, 
  onDragMove,
  onEditCard, 
  onDeleteCard, 
  onManageCosts,
  onOpenChecklist,
  onUpdateProgress,
  filtros,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeLot = activeId ? lots.find(l => l.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const lotId = active.id as string;
    const targetStage = over.id as string;

    const lot = lots.find(l => l.id === lotId);
    if (lot && lot.processo_atual !== targetStage && onDragMove) {
      onDragMove(lot, targetStage);
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full min-w-max pb-4">
        {STAGES.map((stage, index) => (
          <LazyColumn
            key={stage.id}
            stageId={stage.id}
            stageIndex={index}
            allLots={lots}
            filtros={filtros}
            onMoveCard={onMoveCard}
            onEditCard={onEditCard}
            onDeleteCard={onDeleteCard}
            onManageCosts={onManageCosts}
            onOpenChecklist={onOpenChecklist}
            onUpdateProgress={onUpdateProgress}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLot && (
          <div className="rotate-3 scale-105 opacity-90">
            <ProductionCard
              lot={activeLot}
              onMoveNext={() => {}}
              onMovePrev={() => {}}
              isFirstStage={false}
              isLastStage={false}
              isDragging
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
