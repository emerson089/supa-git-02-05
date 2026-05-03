import { ProducaoData } from '@/entities/Producao';
import { STAGES } from '@/data/production-data';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LotImage } from './LotImage';

interface ListViewProps {
  lots: ProducaoData[];
  onMoveCard: (lot: ProducaoData, direction: 'next' | 'prev') => void;
}

export function ListView({ lots, onMoveCard }: ListViewProps) {
  const getStageLabel = (stageId: string) => {
    return STAGES.find(s => s.id === stageId)?.label || stageId;
  };

  const getStageIndex = (stageId: string) => {
    return STAGES.findIndex(s => s.id === stageId);
  };

  return (
    <div className="neu-container p-1 h-full overflow-hidden flex flex-col">
      <div className="overflow-auto flex-1 p-2">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/30 sticky top-0">
            <tr>
              <th className="px-4 py-3.5 rounded-l-lg font-semibold">REF</th>
              <th className="px-4 py-3.5 font-semibold">Modelo</th>
              <th className="px-4 py-3.5 text-center font-semibold">Qtd</th>
              <th className="px-4 py-3.5 text-center font-semibold">Etapa Atual</th>
              <th className="px-4 py-3.5 font-semibold">Responsável</th>
              <th className="px-4 py-3.5 rounded-r-lg text-center font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {lots.map(lot => {
              const stageIndex = getStageIndex(lot.processo_atual);
              const isFirstStage = stageIndex === 0;
              const isLastStage = stageIndex === STAGES.length - 1;

              return (
                <tr 
                  key={lot.id} 
                  className="hover:bg-muted/20 transition-colors animate-fade-in"
                >
                  <td className="px-4 py-4 font-semibold text-primary">{lot.id_producao}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <LotImage 
                        src={lot.imagem_url} 
                        alt={lot.modelo_nome_cache || 'Produto'}
                        className="w-10 h-10 rounded-lg object-cover shadow-sm" 
                      />
                      <span className="text-foreground font-medium">{lot.modelo_nome_cache || 'Sem modelo'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-semibold text-foreground">{lot.quantidade}</span>
                    <span className="text-muted-foreground ml-1">pçs</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-background shadow-neu-sm text-foreground border border-border/50">
                      {getStageLabel(lot.processo_atual)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{lot.responsavel || '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onMoveCard(lot, 'prev')}
                        disabled={isFirstStage}
                        className="p-2 rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Voltar etapa"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <button
                        onClick={() => onMoveCard(lot, 'next')}
                        disabled={isLastStage}
                        className="p-2 rounded-lg transition-all duration-200 bg-secondary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Avançar etapa"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {lots.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            Nenhum lote encontrado
          </div>
        )}
      </div>
    </div>
  );
}
