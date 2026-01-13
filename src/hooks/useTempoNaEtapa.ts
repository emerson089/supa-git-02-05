import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';

interface TempoNaEtapaResult {
  dias: number;
  dataInicio: string;
  corClasse: string;
  label: string;
}

/**
 * Hook para calcular quantos dias o lote está na etapa atual.
 * Usa o updated_at como referência da última movimentação.
 */
export function useTempoNaEtapa(updatedAt: string): TempoNaEtapaResult {
  return useMemo(() => {
    const dataInicio = updatedAt;
    const dias = differenceInDays(new Date(), new Date(dataInicio));
    
    // Define cor baseada nos dias
    let corClasse = 'bg-muted text-muted-foreground'; // 0-2 dias (normal)
    if (dias >= 5) {
      corClasse = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    } else if (dias >= 3) {
      corClasse = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
    
    const label = dias === 0 
      ? 'Hoje' 
      : dias === 1 
        ? '1 dia' 
        : `${dias} dias`;
    
    return { dias, dataInicio, corClasse, label };
  }, [updatedAt]);
}
