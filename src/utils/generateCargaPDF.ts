import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getSignedUrl, compressImageForPDF } from './imageUtils';
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

  // Preparar cache de imagens
  const imageCache: Map<string, string | null> = new Map();

  // Carregar imagens em paralelo se necessário (com compressão)
  if (includeImages) {
    const imagePromises = carga.itens.map(async (item) => {
      if (item.produtoImagem) {
        try {
          const signedUrl = await getSignedUrl(item.produtoImagem);
          if (signedUrl) {
            // Comprimir imagem para 150x150px com qualidade 60%
            const base64 = await compressImageForPDF(signedUrl, 150, 150, 0.6);
            imageCache.set(item.itemId, base64);
          }
        } catch {
          imageCache.set(item.itemId, null);
        }
      }
    });
    await Promise.all(imagePromises);
  }

  // ===== CATÁLOGO DE PRODUTOS COM FOTOS =====
  if (includeImages && carga.itens.length > 0) {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CATÁLOGO DE PRODUTOS', margin, yPos);
    yPos += 8;

    // Layout: 3 produtos por linha - LAYOUT EMPILHADO (imagem acima, texto abaixo)
    const cardWidth = (pageWidth - 2 * margin - 20) / 3;
    const cardHeight = 72;
    const imageSize = 38;
    let col = 0;
    let rowY = yPos;

    for (const item of carga.itens) {
      // Verificar nova página ANTES de desenhar o card
      if (rowY + cardHeight > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        rowY = margin;
      }

      const base64Image = imageCache.get(item.itemId);
      const qtd = Number(item.quantidadeEnviada) || 0;
      const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;
      const subtotal = qtd * preco;
      
      const x = margin + col * (cardWidth + 10);
      
      // Desenhar card com borda
      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, rowY, cardWidth, cardHeight, 3, 3, 'FD');
      
      // Imagem CENTRALIZADA no topo do card
      const imageX = x + (cardWidth - imageSize) / 2;
      if (base64Image) {
        try {
          doc.addImage(base64Image, 'JPEG', imageX, rowY + 3, imageSize, imageSize);
        } catch {
          // Fallback para placeholder se imagem falhar
          doc.setFillColor(240, 240, 240);
          doc.rect(imageX, rowY + 3, imageSize, imageSize, 'F');
          doc.setFontSize(6);
          doc.setTextColor(150, 150, 150);
          doc.text('Sem foto', imageX + imageSize / 2 - 7, rowY + 22);
        }
      } else {
        // Placeholder para produtos sem imagem
        doc.setFillColor(240, 240, 240);
        doc.rect(imageX, rowY + 3, imageSize, imageSize, 'F');
        doc.setFontSize(6);
        doc.setTextColor(150, 150, 150);
        doc.text('Sem foto', imageX + imageSize / 2 - 7, rowY + 22);
      }
      
      // Texto ABAIXO da imagem - agora com mais espaço horizontal!
      const textY = rowY + imageSize + 8;
      const maxTextWidth = cardWidth - 6;
      
      // Extrair código do nome (ex: "Short cinto encapado preto - 990")
      let nome = item.produtoNome || 'Produto';
      let codigo = '';
      const matchCodigo = nome.match(/\s*-\s*(\d+)$/);
      if (matchCodigo) {
        codigo = matchCodigo[1];
        nome = nome.replace(/\s*-\s*\d+$/, '').trim();
      }
      
      // Nome do produto (truncar se necessário)
      doc.setTextColor(...textColor);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      while (doc.getTextWidth(nome) > maxTextWidth && nome.length > 10) {
        nome = nome.slice(0, -1);
      }
      if (nome.length < (item.produtoNome?.replace(/\s*-\s*\d+$/, '').trim().length || 0) - 3) {
        nome = nome.slice(0, -3) + '...';
      }
      doc.text(nome, x + 3, textY);
      
      // Código do produto (se extraído)
      let codeLineY = textY + 5;
      if (codigo) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...mutedColor);
        doc.text(`Cód: ${codigo}`, x + 3, codeLineY);
        codeLineY += 5;
      }
      
      // Qtd e Preço na mesma linha
      doc.setFontSize(7);
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'normal');
      doc.text(`Qtd: ${qtd}`, x + 3, codeLineY);
      
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      const precoText = formatCurrency(preco);
      doc.text(precoText, x + cardWidth - 3 - doc.getTextWidth(precoText), codeLineY);
      
      // Subtotal
      doc.setFontSize(6);
      doc.setTextColor(...mutedColor);
      doc.setFont('helvetica', 'normal');
      doc.text(`Sub: ${formatCurrency(subtotal)}`, x + 3, codeLineY + 5);
      
      col++;
      if (col >= 3) {
        col = 0;
        rowY += cardHeight + 8;
      }
    }

    // Ajustar posição para próxima seção
    yPos = rowY + (col > 0 ? cardHeight + 15 : 10);
    
    // Verificar se precisa de nova página para tabela
    if (yPos > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      yPos = margin;
    }
  }

  // ===== TABELA DE ITENS =====
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO DOS ITENS', margin, yPos);
  yPos += 5;

  // Preparar dados da tabela
  const tableData: (string | { content: string; styles?: object })[][] = [];

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
