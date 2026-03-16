import { Stage, StageId } from '@/types/production';

export const STAGES: Stage[] = [
  { id: 'Corte', label: 'Corte', icon: 'Scissors', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { id: 'Costura/Facção', label: 'Costura / Facção', icon: 'Shirt', color: 'text-primary', bgColor: 'bg-secondary' },
  { id: 'Travete', label: 'Travete', icon: 'Layers', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { id: 'Destroyed', label: 'Destroyed', icon: 'Zap', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { id: 'Lavanderia', label: 'Lavanderia', icon: 'Droplets', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  { id: 'Acabamento', label: 'Acabamento', icon: 'Sparkles', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  { id: 'Aprontamento', label: 'Aprontamento', icon: 'ClipboardCheck', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { id: 'Vendas', label: 'Vendas / Estoque', icon: 'CheckCircle2', color: 'text-emerald-600', bgColor: 'bg-emerald-100' }
];

// Mapeamento de responsáveis padrão por etapa
export const RESPONSAVEIS_POR_ETAPA: Record<string, string[]> = {
  'Corte': ['Ildo', 'Zeze'],
  'Costura/Facção': ['Regina', 'Patricia', 'Simone'],
  'Travete': [],
  'Destroyed': [],
  'Lavanderia': [],
  'Acabamento': [],
  'Aprontamento': [],
  'Vendas': [],
};

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
