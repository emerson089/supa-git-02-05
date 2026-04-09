import { ProducaoData } from '@/entities/Producao';

export type StageId = 
  | 'Corte' 
  | 'Costura/Facção' 
  | 'Travete' 
  | 'Destroyed' 
  | 'Lavanderia' 
  | 'Acabamento'
  | 'Aprontamento'
  | 'Vendas';

export type StatusDefeitos = 'pendente_conserto' | 'em_conserto' | 'conserto_concluido';

export interface Stage {
  id: StageId;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export type ViewMode = 'kanban' | 'list';

export interface ChecklistAprontamento {
  botao: boolean;
  bolsa: boolean;
  cordao: boolean;
  tag: boolean;
  placa_marca: boolean;
}

// Re-export for backward compatibility
export type ProductionLot = ProducaoData;
