import { Stage, StageId } from '@/types/production';

export const STAGES: Stage[] = [
  { id: 'Corte', label: 'Corte / Talhação', icon: 'Scissors', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { id: 'Facção/Costura', label: 'Costura / Facção', icon: 'Shirt', color: 'text-primary', bgColor: 'bg-secondary' },
  { id: 'Lavanderia', label: 'Lavanderia', icon: 'Droplets', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  { id: 'Acabamento', label: 'Acabamento', icon: 'Tag', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { id: 'Concluído', label: 'Estoque / Pronto', icon: 'CheckCircle2', color: 'text-emerald-600', bgColor: 'bg-emerald-100' }
];

export const getStageIndex = (stageId: string): number => {
  return STAGES.findIndex(s => s.id === stageId);
};

export const getNextStage = (currentStage: string): StageId | null => {
  const currentIndex = getStageIndex(currentStage);
  if (currentIndex >= 0 && currentIndex < STAGES.length - 1) {
    return STAGES[currentIndex + 1].id;
  }
  return null;
};

export const getPrevStage = (currentStage: string): StageId | null => {
  const currentIndex = getStageIndex(currentStage);
  if (currentIndex > 0) {
    return STAGES[currentIndex - 1].id;
  }
  return null;
};
