import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getSignedUrl, getImageAsBase64 } from './imageUtils';
import type { TransferenciaComItensHistorico, TransferenciaItemComProduto } from '@/hooks/useFeiraHistorico';

// Formatar valor em reais
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Calcular totais de uma carga
function calcularTotais(itens: TransferenciaItemComProduto[]) {
  let totalPecas = 0;
  let valorTotal = 0;

  for (const item of itens) {
    const qtd = Number(item.quantidadeEnviada) || 0;
    const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;
    totalPecas += qtd;
    valorTotal += qtd * preco;
  }

  return { totalPecas, valorTotal, totalItens: itens.length };
}

// Gerar PDF da carga
export async function generateCargaPDF(
  carga: TransferenciaComItensHistorico,
  options?: { includeImages?: boolean }
): Promise<void> {
  const { includeImages = true } = options || {};
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  // Cores do tema
  const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // ===== CABEÇALHO =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE CARGA', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    26,
    { align: 'center' }
  );

  yPos = 45;

  // ===== INFORMAÇÕES DA CARGA =====
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMAÇÕES DA CARGA', margin, yPos);
  yPos += 8;

  // Box de informações
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 3, 3, 'FD');

  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const col1 = margin + 5;
  const col2 = pageWidth / 2 + 10;
  let infoY = yPos + 10;

  // Status
  const statusLabel = carga.status === 'em_andamento' ? 'Em andamento' : 
                     carga.status === 'concluida' ? 'Concluída' : carga.status;
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', col1, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(statusLabel, col1 + 20, infoY);

  // Data saída
  doc.setFont('helvetica', 'bold');
  doc.text('Saída:', col2, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(carga.dataSaida), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), col2 + 18, infoY);

  infoY += 10;

  // Origem
  doc.setFont('helvetica', 'bold');
  doc.text('Origem:', col1, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(carga.localOrigemNome || 'Central', col1 + 22, infoY);

  // Destino
  doc.setFont('helvetica', 'bold');
  doc.text('Destino:', col2, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(carga.localDestinoNome || 'Banca de Feira', col2 + 22, infoY);

  infoY += 10;

  // Retorno (se houver)
  if (carga.dataRetorno) {
    doc.setFont('helvetica', 'bold');
    doc.text('Retorno:', col1, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(carga.dataRetorno), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), col1 + 25, infoY);
  }

  yPos += 45;

  // ===== OBSERVAÇÕES (se houver) =====
  if (carga.observacoes) {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', margin, yPos);
    yPos += 8;

    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(254, 249, 195); // Amarelo claro
    const obsHeight = 15;
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, obsHeight, 3, 3, 'FD');

    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(carga.observacoes, margin + 5, yPos + 9);
    yPos += obsHeight + 10;
  }

  // ===== TABELA DE ITENS =====
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ITENS DA CARGA', margin, yPos);
  yPos += 5;

  // Preparar dados da tabela
  const tableData: (string | { content: string; styles?: object })[][] = [];
  const imageCache: Map<string, string | null> = new Map();

  // Carregar imagens em paralelo se necessário
  if (includeImages) {
    const imagePromises = carga.itens.map(async (item) => {
      if (item.produtoImagem) {
        try {
          const signedUrl = await getSignedUrl(item.produtoImagem);
          if (signedUrl) {
            const base64 = await getImageAsBase64(signedUrl);
            imageCache.set(item.itemId, base64);
          }
        } catch {
          imageCache.set(item.itemId, null);
        }
      }
    });
    await Promise.all(imagePromises);
  }

  // Montar linhas da tabela
  for (const item of carga.itens) {
    const qtd = Number(item.quantidadeEnviada) || 0;
    const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;
    const subtotal = qtd * preco;

    tableData.push([
      item.produtoNome || 'Produto',
      String(qtd),
      formatCurrency(preco),
      formatCurrency(subtotal),
    ]);
  }

  // Desenhar tabela
  autoTable(doc, {
    startY: yPos,
    head: [['Produto', 'Qtd', 'Preço Unit.', 'Subtotal']],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
  });

  // @ts-expect-error - autoTable adds this property
  yPos = doc.lastAutoTable.finalY + 10;

  // ===== RESUMO =====
  const totais = calcularTotais(carga.itens);

  doc.setDrawColor(...primaryColor);
  doc.setFillColor(238, 242, 255); // Indigo muito claro
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 40, 3, 3, 'FD');

  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO', margin + 5, yPos + 12);

  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  
  const resumoY = yPos + 25;
  const resumoCol1 = margin + 10;
  const resumoCol2 = pageWidth / 3 + 5;
  const resumoCol3 = (pageWidth / 3) * 2;

  // Total de itens
  doc.setFont('helvetica', 'normal');
  doc.text('Itens diferentes:', resumoCol1, resumoY);
  doc.setFont('helvetica', 'bold');
  doc.text(String(totais.totalItens), resumoCol1, resumoY + 8);

  // Total de peças
  doc.setFont('helvetica', 'normal');
  doc.text('Total de peças:', resumoCol2, resumoY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totais.totalPecas} pçs`, resumoCol2, resumoY + 8);

  // Valor total
  doc.setFont('helvetica', 'normal');
  doc.text('Valor total:', resumoCol3, resumoY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(totais.valorTotal), resumoCol3, resumoY + 8);

  // ===== RODAPÉ =====
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestão de Feira', pageWidth / 2, pageHeight - 12, { align: 'center' });

  // Salvar PDF
  const fileName = `Carga_${format(new Date(carga.dataSaida), 'dd-MM-yyyy_HH\'h\'mm')}.pdf`;
  doc.save(fileName);
}
