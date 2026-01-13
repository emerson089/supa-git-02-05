import { useState, useMemo } from 'react';
import { ProducaoData } from '@/entities/Producao';
import { STAGES } from '@/data/production-data';
import { StageTabBar } from './StageTabBar';
import { MobileProductionCard } from './MobileProductionCard';
import { Package } from 'lucide-react';

interface MobileKanbanProps {
  lots: ProducaoData[];
  onMoveCard: (lot: ProducaoData, direction: 'next' | 'prev') => void;
  onEditCard?: (lot: ProducaoData) => void;
  onDeleteCard?: (lot: ProducaoData) => void;
  onManageCosts?: (lot: ProducaoData) => void;
  onOpenChecklist?: (lot: ProducaoData) => void;
  onUpdateProgress?: (lotId: string, pecasConcluidas: number) => void;
}

export function MobileKanban({
  lots,
  onMoveCard,
  onEditCard,
  onDeleteCard,
  onManageCosts,
  onOpenChecklist,
  onUpdateProgress,
}: MobileKanbanProps) {
  const [activeStage, setActiveStage] = useState<string>(STAGES[0].id);

  // Calculate counts for each stage
  const stageCounts = useMemo(() => {
    return STAGES.reduce((acc, stage) => {
      acc[stage.id] = lots.filter(l => l.processo_atual === stage.id).length;
      return acc;
    }, {} as Record<string, number>);
  }, [lots]);

  // Filter lots for active stage
  const filteredLots = useMemo(() => {
    return lots.filter(lot => lot.processo_atual === activeStage);
  }, [lots, activeStage]);

  // Get stage info
  const currentStageIndex = STAGES.findIndex(s => s.id === activeStage);
  const currentStage = STAGES[currentStageIndex];
  const isFirstStage = currentStageIndex === 0;
  const isLastStage = currentStageIndex === STAGES.length - 1;

  return (
    <div className="flex flex-col h-full">
      {/* Stage Tab Bar */}
      <div className="bg-background border-b sticky top-0 z-10">
        <StageTabBar
          activeStage={activeStage}
          onStageChange={setActiveStage}
          stageCounts={stageCounts}
        />
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-auto p-4">
        {filteredLots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className={`p-4 rounded-full ${currentStage?.bgColor || 'bg-muted'} mb-4`}>
              <Package className={`h-8 w-8 ${currentStage?.color || 'text-muted-foreground'}`} />
            </div>
            <p className="text-muted-foreground font-medium">
              Nenhum lote em {currentStage?.label || 'esta etapa'}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Mova lotes de outras etapas ou crie um novo
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLots.map((lot) => (
              <MobileProductionCard
                key={lot.id}
                lot={lot}
                onMoveNext={() => onMoveCard(lot, 'next')}
                onMovePrev={() => onMoveCard(lot, 'prev')}
                onEdit={onEditCard ? () => onEditCard(lot) : undefined}
                onDelete={onDeleteCard ? () => onDeleteCard(lot) : undefined}
                onManageCosts={onManageCosts ? () => onManageCosts(lot) : undefined}
                onOpenChecklist={onOpenChecklist ? () => onOpenChecklist(lot) : undefined}
                onUpdateProgress={onUpdateProgress}
                isFirstStage={isFirstStage}
                isLastStage={isLastStage}
                currentStage={activeStage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
