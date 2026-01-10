import { ProducaoData } from '@/entities/Producao';

export type StageId = 'Corte' | 'Facção/Costura' | 'Lavanderia' | 'Acabamento' | 'Concluído';

export interface Stage {
  id: StageId;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export type ViewMode = 'kanban' | 'list';

// Re-export for backward compatibility
export type ProductionLot = ProducaoData;
