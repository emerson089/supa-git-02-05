import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SaidaDetalhada, ResumoSaidas, FiltrosSaidas, TIPO_LABELS } from '@/hooks/useRelatorioSaidas';

function formatarMoeda(valor: number | null): string {
  if (valor === null) return '';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data: Date): string {
  return format(data, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

function formatarDataCurta(data: Date): string {
  return format(data, 'dd/MM/yyyy', { locale: ptBR });
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Se contém vírgula, aspas ou quebra de linha, envolver em aspas e escapar aspas internas
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface GerarExcelParams {
  saidas: SaidaDetalhada[];
  resumo: ResumoSaidas;
  filtros: FiltrosSaidas;
  localNomeFiltro?: string;
}

export function generateRelatorioSaidasExcel({
  saidas,
  resumo,
  filtros,
  localNomeFiltro,
}: GerarExcelParams): void {
  // Construir CSV com BOM para UTF-8
  const BOM = '\uFEFF';
  const lines: string[] = [];

  // Cabeçalho do relatório
  lines.push('RELATÓRIO DE SAÍDAS DO ESTOQUE');
  lines.push(`Período: ${formatarDataCurta(filtros.dataInicial)} a ${formatarDataCurta(filtros.dataFinal)}`);
  
  if (localNomeFiltro) {
    lines.push(`Local: ${localNomeFiltro}`);
  }
  
  if (filtros.tiposMovimento && filtros.tiposMovimento.length > 0) {
    const tiposLabels = filtros.tiposMovimento.map(t => TIPO_LABELS[t] || t).join(', ');
    lines.push(`Tipos: ${tiposLabels}`);
  }
  
  lines.push(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`);
  lines.push('');

  // Resumo
  lines.push('RESUMO');
  lines.push(`Total de Peças,${resumo.totalPecas}`);
  lines.push(`Valor Total Venda,${formatarMoeda(resumo.valorVendaTotal)}`);
  lines.push(`Valor Total Custo,${resumo.valorCustoTotal !== null ? formatarMoeda(resumo.valorCustoTotal) : 'Não disponível'}`);
  if (resumo.quantidadeSemPreco > 0) {
    lines.push(`Movimentações sem preço,${resumo.quantidadeSemPreco}`);
  }
  lines.push('');

  // Cabeçalho da tabela
  lines.push('DETALHAMENTO');
  const headers = [
    'Data/Hora',
    'Modelo',
    'Quantidade',
    'Valor Unitário',
    'Valor Total',
    'Tipo',
    'Motivo',
    'Local Origem',
    'Local Destino',
  ];
  lines.push(headers.map(escapeCSV).join(','));

  // Dados
  for (const saida of saidas) {
    const row = [
      formatarData(saida.data),
      saida.modeloNome,
      saida.quantidade,
      saida.valorUnitario !== null ? saida.valorUnitario.toFixed(2) : '',
      saida.valorTotal !== null ? saida.valorTotal.toFixed(2) : '',
      saida.tipoLabel,
      saida.motivo || '',
      saida.localNome,
      saida.localDestinoNome || '',
    ];
    lines.push(row.map(escapeCSV).join(','));
  }

  // Linha de totais
  lines.push('');
  lines.push(`TOTAL,,${resumo.totalPecas},,${resumo.valorVendaTotal.toFixed(2)}`);

  // Criar blob e download
  const csvContent = BOM + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dataInicio = format(filtros.dataInicial, 'yyyy-MM-dd');
  const dataFim = format(filtros.dataFinal, 'yyyy-MM-dd');
  const fileName = `relatorio-saidas-${dataInicio}-a-${dataFim}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
