import { useState } from 'react';
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

interface KanbanBoardProps {
  lots: ProducaoData[];
  onMoveCard: (lot: ProducaoData, direction: 'next' | 'prev') => void;
  onDragMove?: (lot: ProducaoData, targetStage: string) => void;
  onEditCard?: (lot: ProducaoData) => void;
  onDeleteCard?: (lot: ProducaoData) => void;
  onManageCosts?: (lot: ProducaoData) => void;
}

export function KanbanBoard({ 
  lots, 
  onMoveCard, 
  onDragMove,
  onEditCard, 
  onDeleteCard, 
  onManageCosts 
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
        {STAGES.map((stage, index) => {
          const stageLots = lots.filter(l => l.processo_atual === stage.id);
          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              lots={stageLots}
              onMoveCard={onMoveCard}
              onEditCard={onEditCard}
              onDeleteCard={onDeleteCard}
              onManageCosts={onManageCosts}
              isFirstStage={index === 0}
              isLastStage={index === STAGES.length - 1}
            />
          );
        })}
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
