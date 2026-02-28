import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SaidaDetalhada, ResumoSaidas, FiltrosSaidas, TIPO_LABELS } from '@/hooks/useRelatorioSaidas';

function formatarMoeda(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data: Date): string {
  return format(data, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

function formatarDataCurta(data: Date): string {
  return format(data, 'dd/MM/yyyy', { locale: ptBR });
}

function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

interface GerarPDFParams {
  saidas: SaidaDetalhada[];
  resumo: ResumoSaidas;
  filtros: FiltrosSaidas;
  localNomeFiltro?: string;
}

export function generateRelatorioSaidasPDF({
  saidas,
  resumo,
  filtros,
  localNomeFiltro,
}: GerarPDFParams): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // === HEADER ===
  const headerHeight = 22;
  doc.setFillColor(99, 102, 241); // Indigo-500
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO DE MOVIMENTAÇÕES DO ESTOQUE', margin, 8);

  // Período
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const periodoTexto = `Período: ${formatarDataCurta(filtros.dataInicial)} a ${formatarDataCurta(filtros.dataFinal)}`;
  doc.text(periodoTexto, margin, 14);

  // Local e tipos filtrados
  const filtrosTexto: string[] = [];
  if (localNomeFiltro) {
    filtrosTexto.push(`Local: ${localNomeFiltro}`);
  }
  if (filtros.filtrosMovimentacao && filtros.filtrosMovimentacao.length > 0) {
    const tiposLabels = filtros.filtrosMovimentacao.map(f => f.label).join(', ');
    filtrosTexto.push(`Tipos: ${tiposLabels}`);
  }
  if (filtrosTexto.length > 0) {
    doc.text(filtrosTexto.join(' | '), margin, 19);
  }

  // Data de geração (lado direito)
  const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em ${dataGeracao}`, pageWidth - margin, 8, { align: 'right' });
  doc.text(`${saidas.length} movimentações`, pageWidth - margin, 14, { align: 'right' });

  // === CARDS DE RESUMO ===
  const cardY = headerHeight + 6;
  const cardHeight = 18;
  const cardWidth = 55;
  const cardGap = 8;

  // Card 1: Total Peças
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(59, 130, 246); // blue-500
  doc.text('Total Peças', margin + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text(resumo.totalPecas.toLocaleString('pt-BR'), margin + 4, cardY + 14);

  // Card 2: Valor Venda
  const card2X = margin + cardWidth + cardGap;
  doc.setFillColor(240, 253, 244); // green-50
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(34, 197, 94); // green-500
  doc.text('Valor Venda', card2X + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text(formatarMoeda(resumo.valorVendaTotal), card2X + 4, cardY + 14);

  // Card 3: Valor Custo (placeholder)
  const card3X = card2X + cardWidth + cardGap;
  doc.setFillColor(254, 249, 195); // yellow-100
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(202, 138, 4); // yellow-600
  doc.text('Valor Custo', card3X + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(113, 63, 18); // yellow-900
  doc.text(resumo.valorCustoTotal !== null ? formatarMoeda(resumo.valorCustoTotal) : '—', card3X + 4, cardY + 14);

  // Aviso se há itens sem preço
  if (resumo.quantidadeSemPreco > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(
      `* ${resumo.quantidadeSemPreco} movimentação(ões) sem preço registrado`,
      card3X + cardWidth + cardGap,
      cardY + 10
    );
  }

  // === TABELA ===
  const tableStartY = cardY + cardHeight + 8;

  const tableData = saidas.map(saida => [
    saida.data ? formatarData(saida.data) : '—',
    truncateText(saida.modeloNome, 35),
    (saida.quantidade ?? 0).toString(),
    formatarMoeda(saida.valorUnitario),
    formatarMoeda(saida.valorTotal),
    saida.tipoLabel || '—',
    truncateText(saida.motivo, 25),
    truncateText(saida.localNome, 20),
    truncateText(saida.localDestinoNome, 20),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Data/Hora', 'Modelo', 'Qtd', 'Unit.', 'Total', 'Tipo', 'Motivo', 'Local', 'Destino']],
    body: tableData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' }, // Data/Hora
      1: { cellWidth: 'auto', halign: 'left' }, // Modelo
      2: { cellWidth: 12, halign: 'center' }, // Qtd
      3: { cellWidth: 22, halign: 'right' }, // Unit.
      4: { cellWidth: 22, halign: 'right' }, // Total
      5: { cellWidth: 24, halign: 'center' }, // Tipo
      6: { cellWidth: 35, halign: 'left' }, // Motivo
      7: { cellWidth: 30, halign: 'center' }, // Local
      8: { cellWidth: 30, halign: 'center' }, // Destino
    },
    showHead: 'everyPage',
    didDrawPage: () => {
      // Número da página no rodapé
      const pageNumber = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`Página ${pageNumber}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    },
  });

  // === SALVAR PDF ===
  const dataInicio = format(filtros.dataInicial, 'yyyy-MM-dd');
  const dataFim = format(filtros.dataFinal, 'yyyy-MM-dd');
  const fileName = `relatorio-saidas-${dataInicio}-a-${dataFim}.pdf`;

  try {
    doc.save(fileName);
  } catch (error) {
    console.error("Erro no doc.save():", error);
  }

  // Fallback robusto para iframes (ex: Preview do Lovable ou CodeSandbox)
  // Alguns navegadores silenciosamente bloqueiam o doc.save() dentro de iframes.
  try {
    if (window.self !== window.top) {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    }
  } catch (e) {
    console.error("Falha ao abrir PDF em nova guia:", e);
  }
}
