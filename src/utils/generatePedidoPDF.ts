import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { groupItensByModel } from '@/utils/productNameUtils';

export interface PedidoPDFInput {
  cliente_nome: string;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  excursao?: string | null;
  created_at: string;
  total_pecas?: number | null;
  valor_total?: number | null;
  taxa_excursao?: number | null;
  status_pagamento?: string | null;
  status_pedido?: string | null;
  status_entrega?: string | null;
  pedido_itens?: Array<{
    id: string;
    produto_id: string | null;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
  }>;
  observacoes?: string | null;
}


export interface EstoqueItemForPDF {
  id: string;
  nome?: string;
  localizacao?: string | null;
}

export interface GeneratedPedidoPDF {
  blob: Blob;
  fileName: string;
  save: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export function generatePedidoPDF(
  pedido: PedidoPDFInput,
  estoqueItens: EstoqueItemForPDF[] = []
): GeneratedPedidoPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DELOOKII - ERP JEANS | COMPROVANTE DE PEDIDO', pageWidth / 2, 20, { align: 'center' });

  // Divider
  doc.setDrawColor(200);
  doc.line(14, 25, pageWidth - 14, 25);

  // Client info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', 14, 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const clienteData = [
    `Nome: ${pedido.cliente_nome}`,
    `Telefone: ${pedido.telefone || '-'}`,
    `Cidade/Estado: ${pedido.cidade || '-'}, ${pedido.estado || '-'}`,
    `Excursão: ${pedido.excursao || '-'}`,
  ];
  let yPos = 42;
  clienteData.forEach((line) => {
    doc.text(line, 14, yPos);
    yPos += 6;
  });

  // Date and time
  doc.setFont('helvetica', 'bold');
  doc.text('Data de Emissão:', pageWidth - 70, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), pageWidth - 70, 48);
  doc.text('Data do Pedido:', pageWidth - 70, 56);
  doc.text(format(new Date(pedido.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }), pageWidth - 70, 62);

  // Items
  const itens = pedido.pedido_itens || [];
  const allItemsForPDF = itens.map((item) => ({
    itemId: item.id,
    produtoId: item.produto_id,
    produtoNome: item.produto_nome,
    quantidade: item.quantidade,
    precoUnitario: item.valor_unitario,
  }));

  const groupedItens = groupItensByModel(allItemsForPDF, {
    getItemId: (i) => i.itemId || '',
    getItemNome: (i) => {
      const produto = estoqueItens.find((p) => p.id === i.produtoId);
      return produto?.nome || i.produtoNome || '';
    },
    getItemPreco: (i) => i.precoUnitario ?? 0,
    getItemQtd: (i) => i.quantidade ?? 0,
    getItemReferencia: (i) => {
      const produto = estoqueItens.find((p) => p.id === i.produtoId);
      if (produto?.localizacao) {
        try {
          const loc = JSON.parse(produto.localizacao);
          if (loc.referencia) {
            if (
              loc.tamanho &&
              !loc.referencia.toUpperCase().endsWith(`-${String(loc.tamanho).toUpperCase()}`)
            ) {
              return `${loc.referencia}-${loc.tamanho}`;
            }
            return loc.referencia;
          }
        } catch (e) {
          /* noop */
        }
      }
      if (i.produtoNome?.includes(' | REF: ')) {
        return i.produtoNome.split(' | REF: ')[1] || '';
      }
      return i.produtoNome || '';
    },
  });

  const tableData = groupedItens.map((item) => [
    item.nomeExibicao,
    Object.keys(item.tamanhosComQtd ?? {}).length > 0
      ? Object.entries(item.tamanhosComQtd).map(([t, q]) => `${q}× ${t}`).join(', ')
      : item.tamanhos.join(', ') || '-',
    item.quantidadeTotal.toString(),
    formatCurrency(item.valorUnitario),
    formatCurrency(item.subtotal),
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['Modelo', 'Tamanhos', 'Qtd', 'Unit.', 'Subtotal']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 25 },
    },
  });

  // @ts-ignore - jspdf-autotable adds this property
  const finalY = doc.lastAutoTable.finalY + 10;

  const quantidadeModelos = groupedItens.length;
  const taxaExcursao = pedido.taxa_excursao || 0;

  const boxHeight = taxaExcursao > 0 ? 38 : 28;
  doc.setFillColor(240, 240, 240);
  doc.rect(14, finalY, pageWidth - 28, boxHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);

  doc.text(`Total de Peças: ${pedido.total_pecas || 0}`, 20, finalY + 10);
  doc.text(`Quantidade de Modelos: ${quantidadeModelos}`, pageWidth / 2, finalY + 10);

  if (taxaExcursao > 0) {
    doc.text(`Taxa Excursão: + ${formatCurrency(taxaExcursao)}`, 20, finalY + 18);

    doc.setFontSize(12);
    doc.text(`Valor Total: ${formatCurrency(pedido.valor_total || 0)}`, 20, finalY + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      `Status: ${pedido.status_pagamento || '-'} | ${pedido.status_pedido || '-'} | ${pedido.status_entrega || '-'}`,
      pageWidth - 20,
      finalY + 28,
      { align: 'right' }
    );
  } else {
    doc.setFontSize(12);
    doc.text(`Valor Total: ${formatCurrency(pedido.valor_total || 0)}`, 20, finalY + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      `Status: ${pedido.status_pagamento || '-'} | ${pedido.status_pedido || '-'} | ${pedido.status_entrega || '-'}`,
      pageWidth - 20,
      finalY + 18,
      { align: 'right' }
    );
  }

// Footer & Observações
  let currentY = finalY + boxHeight + 10;

  if (pedido.observacoes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Observações:', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitObs = doc.splitTextToSize(pedido.observacoes, pageWidth - 28);
    doc.text(splitObs, 14, currentY + 5);
    currentY += (splitObs.length * 5) + 10;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.text('Obrigado pela preferência! Delookii Jeans', pageWidth / 2, currentY, {
    align: 'center',
  });


  const fileName = `Pedido_${pedido.cliente_nome.replace(/\s+/g, '_')}_${format(
    new Date(pedido.created_at),
    'dd-MM-yyyy'
  )}.pdf`;

  const blob = doc.output('blob');

  return {
    blob,
    fileName,
    save: () => doc.save(fileName),
  };
}
