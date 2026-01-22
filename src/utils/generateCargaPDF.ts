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

// Extrair código do nome do produto
function extrairCodigo(nome: string): { nome: string; codigo: string } {
  const match = nome.match(/\s*-\s*(\d+)$/);
  if (match) {
    return {
      nome: nome.replace(/\s*-\s*\d+$/, '').trim(),
      codigo: match[1],
    };
  }
  return { nome, codigo: '-' };
}

// Gerar PDF da carga
export async function generateCargaPDF(
  carga: TransferenciaComItensHistorico,
  options?: { 
    includeImages?: boolean;
    hideFinancials?: boolean;
  }
): Promise<void> {
  const { includeImages = true, hideFinancials = false } = options || {};
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let yPos = margin;

  // Cores do tema - tons mais suaves e profissionais
  const primaryColor: [number, number, number] = [99, 102, 241]; // Indigo-500
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];
  const altRowColor: [number, number, number] = [250, 250, 252]; // Cinza muito sutil

  // ===== CABEÇALHO COMPACTO =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE CARGA', pageWidth / 2, 10, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    17,
    { align: 'center' }
  );

  yPos = 27;

  // ===== INFORMAÇÕES DA CARGA (COMPACTO) =====
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMAÇÕES', margin, yPos);
  yPos += 5;

  // Box compacto com bordas mais suaves
  doc.setDrawColor(220, 220, 225);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 22, 2, 2, 'FD');

  doc.setTextColor(...textColor);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const col1 = margin + 3;
  const col2 = pageWidth / 2 + 5;
  let infoY = yPos + 6;

  // Status e Data saída (linha 1)
  const statusLabel = carga.status === 'em_andamento' ? 'Em andamento' : 
                     carga.status === 'concluida' ? 'Concluída' : carga.status;
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', col1, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(statusLabel, col1 + 14, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('Saída:', col2, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(carga.dataSaida), "dd/MM/yyyy HH:mm", { locale: ptBR }), col2 + 13, infoY);

  infoY += 7;

  // Origem e Destino (linha 2)
  doc.setFont('helvetica', 'bold');
  doc.text('Origem:', col1, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(carga.localOrigemNome || 'Central', col1 + 16, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('Destino:', col2, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(carga.localDestinoNome || 'Banca de Feira', col2 + 17, infoY);

  // Retorno (se houver, na mesma linha)
  if (carga.dataRetorno) {
    infoY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Retorno:', col1, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(carga.dataRetorno), "dd/MM/yyyy HH:mm", { locale: ptBR }), col1 + 18, infoY);
  }

  yPos += 27;

  // ===== OBSERVAÇÕES (se houver e não vazio) - COMPACTO =====
  if (carga.observacoes && carga.observacoes.trim()) {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('OBS', margin, yPos);
    yPos += 4;

    doc.setDrawColor(220, 220, 225);
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'FD');

    doc.setTextColor(...textColor);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    
    // Truncar observações se muito longas
    let obs = carga.observacoes;
    const maxWidth = pageWidth - 2 * margin - 6;
    while (doc.getTextWidth(obs) > maxWidth && obs.length > 20) {
      obs = obs.slice(0, -1);
    }
    if (obs.length < carga.observacoes.length) {
      obs = obs.slice(0, -3) + '...';
    }
    doc.text(obs, margin + 3, yPos + 6);
    yPos += 14;
  }

  // ===== RESUMO PRIMEIRO (COMPACTO - HORIZONTAL) =====
  const totais = calcularTotais(carga.itens);

  doc.setDrawColor(...primaryColor);
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 16, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('RESUMO:', margin + 3, yPos + 10);

  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Layout horizontal compacto - condicional para hideFinancials
  if (hideFinancials) {
    const resumoText = `${totais.totalItens} modelos  |  ${totais.totalPecas} peças`;
    doc.text(resumoText, margin + 25, yPos + 10);
  } else {
    const resumoText = `${totais.totalItens} modelos  |  ${totais.totalPecas} peças  |  `;
    doc.text(resumoText, margin + 25, yPos + 10);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(totais.valorTotal), margin + 25 + doc.getTextWidth(resumoText), yPos + 10);
  }

  yPos += 20;

  // Preparar cache de imagens (miniaturas maiores - 100x100 @ 45% quality)
  const imageCache: Map<string, string | null> = new Map();
  const itemIdMap: Map<number, string> = new Map();

  if (includeImages) {
    const imagePromises = carga.itens.map(async (item, index) => {
      itemIdMap.set(index, item.itemId);
      if (item.produtoImagem) {
        try {
          const signedUrl = await getSignedUrl(item.produtoImagem);
          if (signedUrl) {
            // Comprimir para miniatura 100x100 com qualidade 45%
            const base64 = await compressImageForPDF(signedUrl, 100, 100, 0.45);
            imageCache.set(item.itemId, base64);
          }
        } catch {
          imageCache.set(item.itemId, null);
        }
      }
    });
    await Promise.all(imagePromises);
  }

  // ===== TABELA DE ITENS COM MINIATURAS =====
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ITENS DA CARGA', margin, yPos);
  yPos += 4;

  // Preparar dados da tabela - condicional para hideFinancials
  const tableData: { content: string; styles?: object }[][] = [];
  const imagePositions: { rowIndex: number; itemId: string }[] = [];

  carga.itens.forEach((item, index) => {
    const qtd = Number(item.quantidadeEnviada) || 0;
    const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;
    const subtotal = qtd * preco;
    const { nome, codigo } = extrairCodigo(item.produtoNome || 'Produto');

    imagePositions.push({ rowIndex: index, itemId: item.itemId });

    if (hideFinancials) {
      // Sem colunas de preço e subtotal
      tableData.push([
        { content: '', styles: { cellWidth: 16 } }, // Coluna para foto (maior)
        { content: nome.length > 35 ? nome.substring(0, 32) + '...' : nome },
        { content: codigo, styles: { halign: 'center' } },
        { content: String(qtd), styles: { halign: 'center', fontStyle: 'bold' } },
      ]);
    } else {
      // Tabela completa com preços
      tableData.push([
        { content: '', styles: { cellWidth: 16 } }, // Coluna para foto (maior)
        { content: nome.length > 30 ? nome.substring(0, 27) + '...' : nome },
        { content: codigo, styles: { halign: 'center' } },
        { content: String(qtd), styles: { halign: 'center' } },
        { content: formatCurrency(preco), styles: { halign: 'right' } },
        { content: formatCurrency(subtotal), styles: { halign: 'right', fontStyle: 'bold' } },
      ]);
    }
  });

  // Configuração de colunas condicional
  const columnStyles = hideFinancials 
    ? {
        0: { cellWidth: 16, halign: 'center' as const }, // Foto (maior)
        1: { cellWidth: 'auto' as const }, // Produto - expande
        2: { cellWidth: 16, halign: 'center' as const }, // Código
        3: { cellWidth: 18, halign: 'center' as const }, // Qtd
      }
    : {
        0: { cellWidth: 16, halign: 'center' as const }, // Foto (maior)
        1: { cellWidth: 'auto' as const }, // Produto
        2: { cellWidth: 16, halign: 'center' as const }, // Código
        3: { cellWidth: 14, halign: 'center' as const }, // Qtd
        4: { cellWidth: 22, halign: 'right' as const }, // Preço
        5: { cellWidth: 24, halign: 'right' as const }, // Subtotal
      };

  const tableHeaders = hideFinancials 
    ? [['', 'Produto', 'Cód', 'Qtd']]
    : [['', 'Produto', 'Cód', 'Qtd', 'Preço', 'Subtotal']];

  autoTable(doc, {
    startY: yPos,
    head: tableHeaders,
    body: tableData.map(row => row.map(cell => cell.content)),
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 7,
      cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
      minCellHeight: 12, // Maior para acomodar thumbnails 10x10mm
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: altRowColor,
    },
    columnStyles: columnStyles,
    didDrawCell: (data) => {
      // Desenhar imagem diretamente dentro do callback para garantir coordenadas corretas
      if (data.column.index === 0 && data.cell.section === 'body' && includeImages) {
        const rowIndex = data.row.index;
        const itemId = imagePositions[rowIndex]?.itemId;
        if (itemId) {
          const base64Image = imageCache.get(itemId);
          if (base64Image) {
            try {
              // Thumbnail 10x10mm (25% maior que 8x8mm)
              doc.addImage(base64Image, 'JPEG', data.cell.x + 3, data.cell.y + 1, 10, 10);
            } catch {
              // Silently fail if image can't be added
            }
          }
        }
      }
    },
  });

  // @ts-expect-error - autoTable adds this property
  yPos = doc.lastAutoTable.finalY + 5;

  // ===== RODAPÉ COMPACTO =====
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Se ainda há espaço, adicionar rodapé na mesma página
  if (yPos < pageHeight - 15) {
    doc.setDrawColor(220, 220, 225);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    
    doc.setTextColor(...mutedColor);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Gestão de Feira', pageWidth / 2, pageHeight - 7, { align: 'center' });
  }

  // Salvar PDF
  const fileName = `Carga_${format(new Date(carga.dataSaida), 'dd-MM-yyyy_HH\'h\'mm')}.pdf`;
  doc.save(fileName);
}
