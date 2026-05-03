import { differenceInDays } from 'date-fns';
import { ClienteCRMBatchStats } from './useClientesCRMBatch';

export type PrioridadeNivel = 'alta' | 'media' | 'baixa';

export interface PrioridadeResult {
  score: number;
  nivel: PrioridadeNivel;
}

interface ContatoInfo {
  data: string;
  canal: 'whatsapp' | 'ligacao' | 'outro';
}

/**
 * Pure function: calculates priority score from CRM stats + optional contact info.
 * Higher score = should be contacted first.
 */
export function calcularPrioridade(
  stats: ClienteCRMBatchStats | undefined,
  contato?: ContatoInfo | null
): PrioridadeResult {
  if (!stats) return { score: 0, nivel: 'baixa' };

  const hoje = new Date();
  const diasSemComprar = stats.ultimaCompra
    ? differenceInDays(hoje, stats.ultimaCompra)
    : 365; // default high if never bought

  const ticketMedio = stats.pedidosPagos > 0
    ? stats.totalComprado / stats.pedidosPagos
    : 0;

  let score =
    (diasSemComprar * 2) +
    (stats.totalComprado / 100) +
    (ticketMedio * 0.5) -
    (stats.cancelamentos * 50);

  // Reduce priority by 80% if contacted within last 7 days
  if (contato) {
    const diasDesdeContato = differenceInDays(hoje, new Date(contato.data));
    if (diasDesdeContato < 7) {
      score *= 0.2;
    }
  }

  const nivel: PrioridadeNivel =
    score > 200 ? 'alta' :
    score > 100 ? 'media' :
    'baixa';

  return { score, nivel };
}
