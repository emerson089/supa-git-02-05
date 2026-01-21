import { useState } from 'react';
import { ProducaoData, ChecklistAprontamento, Producao } from '@/entities/Producao';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  DollarSign,
  AlertTriangle,
  AlertCircle,
  Clock,
  ClipboardCheck
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LotImage } from './LotImage';
import { STAGES, getStageIndex } from '@/data/production-data';
import { useTempoNaEtapa } from '@/hooks/useTempoNaEtapa';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MobileProductionCardProps {
  lot: ProducaoData;
  onMoveNext: () => void;
  onMovePrev: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onManageCosts?: () => void;
  onOpenChecklist?: () => void;
  onUpdateProgress?: (lotId: string, pecasConcluidas: number) => void;
  isFirstStage: boolean;
  isLastStage: boolean;
  currentStage: string;
}

const priorityConfig = {
  urgente: {
    label: 'Urgente',
    icon: AlertTriangle,
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  atencao: {
    label: 'Atenção',
    icon: AlertCircle,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  normal: {
    label: 'Normal',
    icon: Clock,
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

export function MobileProductionCard({
  lot,
  onMoveNext,
  onMovePrev,
  onEdit,
  onDelete,
  onManageCosts,
  onOpenChecklist,
  onUpdateProgress,
  isFirstStage,
  isLastStage,
  currentStage,
}: MobileProductionCardProps) {
  const [editingProgress, setEditingProgress] = useState(false);
  const [tempPecas, setTempPecas] = useState(lot.pecas_concluidas || 0);
  
  const priority = (lot.prioridade as keyof typeof priorityConfig) || 'normal';
  const config = priorityConfig[priority];
  const PriorityIcon = config.icon;

  const currentStageIndex = getStageIndex(lot.processo_atual);
  const progress = ((currentStageIndex + 1) / STAGES.length) * 100;

  const pecasConcluidas = lot.pecas_concluidas || 0;
  const completedPercentage = lot.quantidade > 0
    ? Math.round((pecasConcluidas / lot.quantidade) * 100)
    : 0;

  const { dias, corClasse, label: tempoLabel } = useTempoNaEtapa(lot.updated_at);

  // Handle save progress
  const handleSaveProgress = async () => {
    const newValue = Math.min(Math.max(0, tempPecas), lot.quantidade);
    setEditingProgress(false);
    
    if (newValue !== pecasConcluidas) {
      try {
        await Producao.update(lot.id, { pecas_concluidas: newValue });
        onUpdateProgress?.(lot.id, newValue);
        toast.success('Progresso atualizado!');
      } catch (error) {
        console.error('Erro ao atualizar progresso:', error);
        toast.error('Erro ao atualizar progresso');
        setTempPecas(pecasConcluidas);
      }
    }
  };

  return (
    <Card className={cn(
      "p-3 transition-all",
      priority === 'urgente' && "border-destructive/50 bg-destructive/5",
      priority === 'atencao' && "border-amber-500/50 bg-amber-500/5"
    )}>
      <div className="flex gap-3">
        {/* Image with LazyImage */}
        <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
          <LotImage
            src={lot.imagem_url}
            alt={lot.modelo_nome_cache || 'Lote'}
            className="w-full h-full object-cover"
            containerClassName="w-full h-full"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">
                  {lot.id_producao}
                </span>
                {priority !== 'normal' && (
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.className)}>
                    <PriorityIcon className="h-3 w-3 mr-0.5" />
                    {config.label}
                  </Badge>
                )}
                {/* Time indicator */}
                {dias > 0 && (
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0 rounded-full flex items-center gap-0.5",
                    corClasse
                  )}>
                    <Clock className="h-2.5 w-2.5" />
                    {tempoLabel}
                  </span>
                )}
              </div>
              <h3 className="font-medium text-sm truncate">
                {lot.modelo_nome_cache || 'Modelo não definido'}
              </h3>
            </div>

            {/* Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                {onManageCosts && (
                  <DropdownMenuItem onClick={onManageCosts}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Custos
                  </DropdownMenuItem>
                )}
                {currentStage === 'Aprontamento' && onOpenChecklist && (
                  <DropdownMenuItem onClick={onOpenChecklist}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Checklist
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Info row */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="font-medium">{lot.quantidade} pçs</span>
            {lot.responsavel && (
              <>
                <span>•</span>
                <span className="truncate">{lot.responsavel}</span>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${completedPercentage}%` }}
              />
            </div>
            {editingProgress ? (
              <div className="flex items-center gap-0.5">
                <Input
                  type="number"
                  value={tempPecas}
                  onChange={(e) => setTempPecas(Number(e.target.value))}
                  onBlur={handleSaveProgress}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveProgress()}
                  className="w-10 h-5 text-[10px] px-1 text-right"
                  min={0}
                  max={lot.quantidade}
                  autoFocus
                />
                <span className="text-[10px] text-muted-foreground">/{lot.quantidade}</span>
              </div>
            ) : (
              <span 
                onClick={() => {
                  setTempPecas(pecasConcluidas);
                  setEditingProgress(true);
                }}
                className="text-[10px] text-muted-foreground font-medium cursor-pointer hover:text-primary"
                title="Clique para editar"
              >
                {completedPercentage}%
              </span>
            )}
          </div>

          {/* Checklist indicator for Aprontamento */}
          {currentStage === 'Aprontamento' && lot.checklist_aprontamento && (
            <div className="mt-2">
              {(() => {
                const checklist = lot.checklist_aprontamento as ChecklistAprontamento;
                const items = ['botao', 'bolsa', 'cordao', 'tag'] as const;
                const completed = items.filter(item => checklist[item]).length;
                return (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onOpenChecklist}
                    className={cn(
                      "w-full h-7 text-xs",
                      completed === 4 && "border-emerald-500 text-emerald-600 bg-emerald-50"
                    )}
                  >
                    <ClipboardCheck className="h-3 w-3 mr-1.5" />
                    Checklist: {completed}/4
                  </Button>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={onMovePrev}
          disabled={isFirstStage}
          className="flex-1 h-8"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onMoveNext}
          disabled={isLastStage}
          className="flex-1 h-8"
        >
          Avançar
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
