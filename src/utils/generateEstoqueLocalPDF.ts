import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getSignedUrl, compressImageForPDF } from './imageUtils';
import { EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';

/**
 * Extrai a referência/código do nome do produto
 * Ex: "Short Alfa. botoes salmao - 170" → "170"
 */
function extrairReferencia(nome: string): string {
  const match = nome.match(/\s*-\s*(\d+)$/);
  return match ? match[1] : '-';
}

/**
 * Ordena itens por referência (numérica quando possível)
 */
function ordenarPorReferencia(itens: EstoqueLocalDetalhado[]): EstoqueLocalDetalhado[] {
  return [...itens].sort((a, b) => {
    const refA = extrairReferencia(a.itemNome);
    const refB = extrairReferencia(b.itemNome);
    
    const numA = parseInt(refA, 10);
    const numB = parseInt(refB, 10);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return refA.localeCompare(refB);
  });
}

/**
 * Trunca texto se for maior que o limite
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Desenha placeholder "Sem foto" em uma célula
 */
function drawPlaceholder(doc: jsPDF, x: number, y: number, size: number): void {
  doc.setFillColor(229, 231, 235); // gray-200
  doc.rect(x, y, size, size, 'F');
  doc.setFontSize(5);
  doc.setTextColor(107, 114, 128);
  doc.text('Sem', x + size / 2, y + size / 2 - 1, { align: 'center' });
  doc.text('foto', x + size / 2, y + size / 2 + 2, { align: 'center' });
}

/**
 * Gera PDF do estoque de um local para contagem manual
 */
export async function generateEstoqueLocalPDF(
  itens: EstoqueLocalDetalhado[],
  localNome: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Ordenar itens por referência
  const itensOrdenados = ordenarPorReferencia(itens);

  // === HEADER ===
  const headerHeight = 18;
  doc.setFillColor(99, 102, 241); // Indigo-500
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`ESTOQUE – ${localNome}`, margin, 8);

  // Data/hora
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const dataHora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em ${dataHora}`, margin, 14);

  // Contagem de itens (lado direito)
  doc.setFontSize(9);
  doc.text(`${itensOrdenados.length} modelos`, pageWidth - margin, 11, { align: 'right' });

  // === CARREGAR IMAGENS ===
  const imageCache = new Map<string, string | null>();
  
  // Carregar todas as imagens em paralelo
  const imagePromises = itensOrdenados.map(async (item, index) => {
    if (onProgress) {
      onProgress(index + 1, itensOrdenados.length);
    }
    
    if (!item.itemImagemUrl) {
      imageCache.set(item.id, null);
      return;
    }

    try {
      const signedUrl = await getSignedUrl(item.itemImagemUrl);
      if (signedUrl) {
        const compressed = await compressImageForPDF(signedUrl, 100, 100, 0.45);
        imageCache.set(item.id, compressed);
      } else {
        imageCache.set(item.id, null);
      }
    } catch (error) {
      console.warn(`Erro ao carregar imagem para ${item.itemNome}:`, error);
      imageCache.set(item.id, null);
    }
  });

  await Promise.all(imagePromises);

  // === PREPARAR DADOS DA TABELA ===
  // Armazenamos o item.id na primeira coluna para lookup confiável da imagem
  const tableData = itensOrdenados.map((item) => {
    const referencia = extrairReferencia(item.itemNome);
    const nomeCompleto = truncateText(item.itemNome, 45);
    
    return [
      item.id, // ID para lookup da imagem (não será exibido como texto)
      nomeCompleto,
      referencia,
      '', // Quantidade em branco para preenchimento manual
    ];
  });

  // === GERAR TABELA ===
  let yPos = headerHeight + 6;

  autoTable(doc, {
    startY: yPos,
    head: [['', 'Modelo', 'Ref.', 'Quantidade']],
    body: tableData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241], // Indigo-500
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      minCellHeight: 14,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' }, // Foto
      1: { cellWidth: 'auto', halign: 'left' }, // Modelo
      2: { cellWidth: 18, halign: 'center' }, // Referência
      3: { cellWidth: 24, halign: 'center' }, // Quantidade (em branco)
    },
    showHead: 'everyPage',
    didDrawCell: (data) => {
      // Desenhar imagem na coluna 0 (Foto)
      if (data.section === 'body' && data.column.index === 0) {
        // Obter o ID diretamente dos dados da linha (armazenado na primeira coluna)
        const rowData = data.row.raw as string[];
        const itemId = rowData[0];
        
        const cellX = data.cell.x;
        const cellY = data.cell.y;
        const cellWidth = data.cell.width;
        const cellHeight = data.cell.height;
        
        // Centralizar imagem na célula
        const imgSize = 10;
        const imgX = cellX + (cellWidth - imgSize) / 2;
        const imgY = cellY + (cellHeight - imgSize) / 2;
        
        // Buscar imagem pelo ID
        const imageData = itemId ? imageCache.get(itemId) : null;
        
        if (imageData) {
          try {
            doc.addImage(imageData, 'JPEG', imgX, imgY, imgSize, imgSize);
          } catch (error) {
            drawPlaceholder(doc, imgX, imgY, imgSize);
          }
        } else {
          drawPlaceholder(doc, imgX, imgY, imgSize);
        }
      }
    },
    didDrawPage: (data) => {
      // Número da página no rodapé
      const pageNumber = doc.getCurrentPageInfo().pageNumber;
      const totalPages = doc.getNumberOfPages();
      
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(
        `Página ${pageNumber}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    },
  });

  // === SALVAR PDF ===
  const nomeArquivoLocal = localNome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const dataFormatada = format(new Date(), 'yyyy-MM-dd');
  const fileName = `estoque-${nomeArquivoLocal}-${dataFormatada}.pdf`;
  
  doc.save(fileName);
}
