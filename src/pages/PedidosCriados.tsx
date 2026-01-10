import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { usePedidos, Pedido } from '@/contexts/PedidosContext';
import { usePedidoById } from '@/hooks/usePedidosData';
import { EditPedidoModal } from '@/components/pedidos/EditPedidoModal';
import { useEstoque } from '@/contexts/EstoqueContext';
import { ImportPedidosCSVModal } from '@/components/pedidos/ImportPedidosCSVModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InlineStatusSelect } from '@/components/pedidos/InlineStatusSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  statusPagamentoOptions,
  statusPedidoOptions,
  statusEntregaOptions,
} from '@/components/pedidos/StatusSelector';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  Plus, 
  Eye, 
  Trash2, 
  ShoppingBag,
  DollarSign,
  Package,
  MapPin,
  Phone,
  Bus,
  MoreHorizontal,
  ArrowUpDown,
  FileText,
  Pencil,
  Calendar as CalendarIcon,
  X,
  Download,
  Upload
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Status colors mapping
const statusPagamentoColors: Record<string, string> = {
  'PAGO': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'PENDENTE': 'bg-amber-100 text-amber-700 border-amber-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
  'INCOMPLETO': 'bg-purple-100 text-purple-700 border-purple-300',
  'PEND. ENTREGA': 'bg-blue-100 text-blue-700 border-blue-300',
  'GOLPE CANCELADO': 'bg-zinc-900 text-white border-zinc-900',
};

const statusPedidoColors: Record<string, string> = {
  'SEPARADO': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'NÃO SEPARADO': 'bg-amber-100 text-amber-700 border-amber-300',
  'AMANHÃ': 'bg-blue-100 text-blue-700 border-blue-300',
  'INCOMPLETO': 'bg-purple-100 text-purple-700 border-purple-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
  'GOLPE CANCELADO': 'bg-zinc-900 text-white border-zinc-900',
};

const statusEntregaColors: Record<string, string> = {
  'ENTREGUE': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'RETIRADA': 'bg-blue-100 text-blue-700 border-blue-300',
  'PRÓX. SEMANA': 'bg-amber-100 text-amber-700 border-amber-300',
  'PEND. ENTREGA': 'bg-blue-100 text-blue-700 border-blue-300',
  'NÃO ENTREGOU': 'bg-red-100 text-red-700 border-red-300',
  'ENTREGOU ERRADO': 'bg-red-100 text-red-700 border-red-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
};

type SortField = 'dataCriacao' | 'valorTotal' | null;
type SortDirection = 'asc' | 'desc';

export default function PedidosCriados() {
  const navigate = useNavigate();
  const { pedidos, removePedido, updatePedido, getPedidoById } = usePedidos();
  const { itens: estoqueItens, updateItem: updateEstoqueItem } = useEstoque();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('dataCriacao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Date filters
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Advanced filters
  const [filterStatusPagamento, setFilterStatusPagamento] = useState<string>('all');
  const [filterStatusPedido, setFilterStatusPedido] = useState<string>('all');
  const [filterStatusEntrega, setFilterStatusEntrega] = useState<string>('all');
  const [filterModelo, setFilterModelo] = useState<string>('');
  
  // CSV import modal
  const [importModalOpen, setImportModalOpen] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Função para estornar estoque (devolver peças ao estoque)
  const estornarEstoque = (pedido: Pedido): number => {
    let totalEstornado = 0;
    
    for (const item of pedido.itens) {
      // Encontrar o produto no estoque pelo nome
      const produtoEstoque = estoqueItens.find(
        p => p.tipo === 'acabado' && 
        (p.id === item.produtoId || p.nome.toLowerCase() === item.produtoNome.toLowerCase())
      );
      
      if (produtoEstoque) {
        const novaQuantidade = produtoEstoque.quantidade + item.quantidade;
        updateEstoqueItem(produtoEstoque.id, { 
          quantidade: novaQuantidade
        });
        totalEstornado += item.quantidade;
      }
    }
    
    return totalEstornado;
  };

  // Função para subtrair estoque ao descancelar pedido
  const subtrairEstoque = async (pedido: Pedido): Promise<{ sucesso: boolean; mensagem: string }> => {
    const itensIndisponiveis: string[] = [];
    
    // Verificar disponibilidade primeiro
    for (const item of pedido.itens) {
      const produtoEstoque = estoqueItens.find(
        p => p.tipo === 'acabado' && 
        (p.id === item.produtoId || p.nome.toLowerCase() === item.produtoNome.toLowerCase())
      );
      
      if (!produtoEstoque || produtoEstoque.quantidade < item.quantidade) {
        const disponivel = produtoEstoque?.quantidade || 0;
        itensIndisponiveis.push(
          `${item.produtoNome}: necessário ${item.quantidade}, disponível ${disponivel}`
        );
      }
    }
    
    if (itensIndisponiveis.length > 0) {
      return {
        sucesso: false,
        mensagem: `Estoque insuficiente:\n${itensIndisponiveis.join('\n')}`
      };
    }
    
    // Subtrair do estoque
    for (const item of pedido.itens) {
      const produtoEstoque = estoqueItens.find(
        p => p.tipo === 'acabado' && 
        (p.id === item.produtoId || p.nome.toLowerCase() === item.produtoNome.toLowerCase())
      );
      
      if (produtoEstoque) {
        const novaQuantidade = produtoEstoque.quantidade - item.quantidade;
        updateEstoqueItem(produtoEstoque.id, { quantidade: novaQuantidade });
      }
    }
    
    return { sucesso: true, mensagem: '' };
  };

  // Handle inline status update with cancellation automation and stock reversal
  const handleStatusUpdate = async (pedidoId: string, field: 'statusPagamento' | 'statusPedido' | 'statusEntrega', value: string) => {
    const pedido = getPedidoById(pedidoId);
    if (!pedido) return;
    
    const updates: Partial<Pedido> = { [field]: value };
    
    // CASO ESPECIAL: GOLPE CANCELADO selecionado na coluna Pedido - preenche automaticamente os outros
    if (field === 'statusPedido' && value === 'GOLPE CANCELADO') {
      updates.statusPagamento = 'GOLPE CANCELADO';
      updates.statusEntrega = 'CANCELADO'; // Entrega não tem GOLPE CANCELADO, usa CANCELADO
      
      // Verificar se precisa estornar estoque
      const estavaCancelado = pedido.statusPagamento === 'CANCELADO' || pedido.statusPedido === 'CANCELADO' || 
                              pedido.statusPagamento === 'GOLPE CANCELADO' || pedido.statusPedido === 'GOLPE CANCELADO';
      const jaEstornou = pedido.estornoRealizado === true;
      
      if (!estavaCancelado && !jaEstornou) {
        const pecasEstornadas = estornarEstoque(pedido);
        updates.estornoRealizado = true;
        if (pecasEstornadas > 0) {
          toast.success(`GOLPE CANCELADO aplicado! ${pecasEstornadas} peças retornaram ao estoque.`);
        } else {
          toast.success('Status GOLPE CANCELADO aplicado a todos os campos!');
        }
      } else {
        toast.success('Status GOLPE CANCELADO aplicado a todos os campos!');
      }
      
      updatePedido(pedidoId, updates);
      return;
    }
    
    // Verificar estados
    const estavaCancelado = pedido.statusPagamento === 'CANCELADO' || pedido.statusPedido === 'CANCELADO' ||
                            pedido.statusPagamento === 'GOLPE CANCELADO' || pedido.statusPedido === 'GOLPE CANCELADO';
    const estaCancelando = value === 'CANCELADO' || value === 'GOLPE CANCELADO';
    const jaEstornou = pedido.estornoRealizado === true;
    
    // CASO 1: Descancelando (saindo de cancelado para outro status)
    if (estavaCancelado && !estaCancelando && jaEstornou) {
      const resultado = await subtrairEstoque(pedido);
      
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem, {
          description: 'Não é possível reativar este pedido sem estoque suficiente.',
          duration: 6000
        });
        return; // Impede a mudança de status
      }
      
      updates.estornoRealizado = false;
      toast.success(`Pedido reativado! ${pedido.totalPecas} peças subtraídas do estoque.`);
    }
    // CASO 2: Cancelando (indo para cancelado)
    else if (estaCancelando && !estavaCancelado && !jaEstornou) {
      const pecasEstornadas = estornarEstoque(pedido);
      updates.estornoRealizado = true;
      
      // Automation: if payment status is set to CANCELADO or GOLPE CANCELADO, auto-cancel others
      if (field === 'statusPagamento') {
        updates.statusPedido = value === 'GOLPE CANCELADO' ? 'GOLPE CANCELADO' : 'CANCELADO';
        updates.statusEntrega = 'CANCELADO';
      }
      
      if (pecasEstornadas > 0) {
        toast.success(`Pedido cancelado e ${pecasEstornadas} peças retornaram ao estoque com sucesso`);
      } else {
        toast.success('Status atualizado com sucesso!');
      }
    } else {
      toast.success('Status atualizado com sucesso!');
    }
    
    updatePedido(pedidoId, updates);
  };

  const filteredAndSortedPedidos = useMemo(() => {
    let filtered = pedidos;
    
    // Busca inteligente por cliente, ID ou status
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      
      // Mapear termos de busca para valores de status
      const matchesStatus = (status: string | undefined) => {
        if (!status) return false;
        const label = statusPagamentoOptions.find(o => o.value === status)?.label ||
                     statusPedidoOptions.find(o => o.value === status)?.label ||
                     statusEntregaOptions.find(o => o.value === status)?.label || status;
        return label.toLowerCase().includes(searchLower) || status.toLowerCase().includes(searchLower);
      };
      
      filtered = filtered.filter(pedido =>
        pedido.clienteNome.toLowerCase().includes(searchLower) ||
        pedido.id.toLowerCase().includes(searchLower) ||
        matchesStatus(pedido.statusPagamento) ||
        matchesStatus(pedido.statusPedido) ||
        matchesStatus(pedido.statusEntrega)
      );
    }
    
    // Função para normalizar status para comparação case-insensitive
    const normalizeStatus = (status: string | undefined): string => {
      if (!status) return '';
      return status.toLowerCase().replace(/\s+/g, '_').replace(/[áàã]/g, 'a').replace(/[éê]/g, 'e').replace(/ó/g, 'o');
    };

    // Filtro por status específicos (selects) - comparação case-insensitive
    if (filterStatusPagamento !== 'all') {
      filtered = filtered.filter(p => normalizeStatus(p.statusPagamento) === normalizeStatus(filterStatusPagamento));
    }
    if (filterStatusPedido !== 'all') {
      filtered = filtered.filter(p => normalizeStatus(p.statusPedido) === normalizeStatus(filterStatusPedido));
    }
    if (filterStatusEntrega !== 'all') {
      filtered = filtered.filter(p => normalizeStatus(p.statusEntrega) === normalizeStatus(filterStatusEntrega));
    }
    
    // Filtro por modelo específico
    if (filterModelo) {
      const modeloLower = filterModelo.toLowerCase();
      filtered = filtered.filter(pedido =>
        pedido.itens.some(item => 
          item.produtoNome.toLowerCase().includes(modeloLower)
        )
      );
    }

    // Apply date filter
    if (startDate || endDate) {
      filtered = filtered.filter(pedido => {
        const pedidoDate = new Date(pedido.dataCriacao);
        
        if (startDate && endDate) {
          return isWithinInterval(pedidoDate, {
            start: startOfDay(startDate),
            end: endOfDay(endDate)
          });
        } else if (startDate) {
          return pedidoDate >= startOfDay(startDate);
        } else if (endDate) {
          return pedidoDate <= endOfDay(endDate);
        }
        return true;
      });
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;
        if (sortField === 'dataCriacao') {
          comparison = new Date(a.dataCriacao).getTime() - new Date(b.dataCriacao).getTime();
        } else if (sortField === 'valorTotal') {
          comparison = a.valorTotal - b.valorTotal;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [pedidos, searchTerm, sortField, sortDirection, startDate, endDate, filterStatusPagamento, filterStatusPedido, filterStatusEntrega, filterModelo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleDelete = () => {
    if (deleteId) {
      removePedido(deleteId);
      setDeleteId(null);
      toast.success('Pedido excluído com sucesso!');
    }
  };

  const getModelosResumo = (pedido: Pedido) => {
    if (pedido.itens.length === 0) return '-';
    if (pedido.itens.length === 1) return pedido.itens[0].produtoNome;
    return `${pedido.itens[0].produtoNome} +${pedido.itens.length - 1}`;
  };

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };
  
  const clearAllFilters = () => {
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);
    setFilterStatusPagamento('all');
    setFilterStatusPedido('all');
    setFilterStatusEntrega('all');
    setFilterModelo('');
  };

  const hasAnyFilter = searchTerm || startDate || endDate || 
    filterStatusPagamento !== 'all' || filterStatusPedido !== 'all' || 
    filterStatusEntrega !== 'all' || filterModelo;

  // Calculate totals - now based on filtered data and modelo filter
  const calculatedTotals = useMemo(() => {
    // Se há filtro de modelo, calcular apenas valores desse modelo
    if (filterModelo) {
      const modeloLower = filterModelo.toLowerCase();
      let pecasModelo = 0;
      let valorModelo = 0;
      
      filteredAndSortedPedidos.forEach(pedido => {
        pedido.itens.forEach(item => {
          if (item.produtoNome.toLowerCase().includes(modeloLower)) {
            pecasModelo += item.quantidade;
            valorModelo += item.quantidade * item.valorUnitario;
          }
        });
      });
      
      return {
        totalPedidos: filteredAndSortedPedidos.length,
        totalPecas: pecasModelo,
        totalValor: valorModelo
      };
    }
    
    // Caso contrário, usar totais normais dos pedidos filtrados
    return {
      totalPedidos: filteredAndSortedPedidos.length,
      totalPecas: filteredAndSortedPedidos.reduce((sum, p) => sum + p.totalPecas, 0),
      totalValor: filteredAndSortedPedidos.reduce((sum, p) => sum + p.valorTotal, 0)
    };
  }, [filteredAndSortedPedidos, filterModelo]);

  const hasActiveFilters = startDate || endDate || filterStatusPagamento !== 'all' || 
    filterStatusPedido !== 'all' || filterStatusEntrega !== 'all' || filterModelo;

  // PDF Generation
  const generatePDF = (pedido: Pedido) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DELOOKII - ERP JEANS | COMPROVANTE DE PEDIDO', pageWidth / 2, 20, { align: 'center' });
    
    // Divider
    doc.setDrawColor(200);
    doc.line(14, 25, pageWidth - 14, 25);
    
    // Client info section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', 14, 35);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const clienteData = [
      `Nome: ${pedido.clienteNome}`,
      `Telefone: ${pedido.telefone || '-'}`,
      `Cidade/Estado: ${pedido.cidade || '-'}, ${pedido.estado || '-'}`,
      `Excursão: ${pedido.excursao || '-'}`
    ];
    
    let yPos = 42;
    clienteData.forEach(line => {
      doc.text(line, 14, yPos);
      yPos += 6;
    });
    
    // Date and time
    doc.setFont('helvetica', 'bold');
    doc.text('Data de Emissão:', pageWidth - 70, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), pageWidth - 70, 48);
    
    doc.text('Data do Pedido:', pageWidth - 70, 56);
    doc.text(format(new Date(pedido.dataCriacao), "dd/MM/yyyy", { locale: ptBR }), pageWidth - 70, 62);
    
    // Items table
    const tableData = pedido.itens.map(item => [
      item.produtoNome,
      formatCurrency(item.valorUnitario),
      item.quantidade.toString(),
      formatCurrency(item.quantidade * item.valorUnitario)
    ]);
    
    autoTable(doc, {
      startY: 75,
      head: [['Modelo', 'Valor Unitário', 'Qtd', 'Subtotal']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 10,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'right' },
        2: { halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' }
      }
    });
    
    // @ts-ignore - jspdf-autotable adds this property
    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Totals
    doc.setFillColor(240, 240, 240);
    doc.rect(14, finalY, pageWidth - 28, 25, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Total de Peças: ${pedido.totalPecas}`, 20, finalY + 10);
    doc.text(`Valor Total: ${formatCurrency(pedido.valorTotal)}`, 20, finalY + 18);
    
    // Status
    doc.setFontSize(10);
    doc.text(`Status: ${pedido.statusPagamento} | ${pedido.statusPedido} | ${pedido.statusEntrega}`, pageWidth - 20, finalY + 14, { align: 'right' });
    
    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('Obrigado pela preferência! Delookii Jeans', pageWidth / 2, finalY + 35, { align: 'center' });
    
    // Download
    const fileName = `Pedido_${pedido.clienteNome.replace(/\s+/g, '_')}_${format(new Date(pedido.dataCriacao), 'dd-MM-yyyy')}.pdf`;
    doc.save(fileName);
    toast.success('PDF gerado com sucesso!');
  };

  // CSV Export
  const exportCSV = () => {
    const headers = ['Data', 'Cliente', 'Itens', 'Qtd Total', 'Valor Total', 'Status Pagamento', 'Status Pedido', 'Status Entrega'];
    
    const rows = filteredAndSortedPedidos.map(pedido => [
      format(new Date(pedido.dataCriacao), "dd/MM/yyyy"),
      pedido.clienteNome,
      pedido.itens.map(i => `${i.produtoNome}(${i.quantidade})`).join('; '),
      pedido.totalPecas.toString(),
      pedido.valorTotal.toFixed(2),
      pedido.statusPagamento || 'Pendente',
      pedido.statusPedido || 'Nao separado',
      pedido.statusEntrega || 'Pend. Entrega'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedidos_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredAndSortedPedidos.length} pedidos exportados com sucesso!`);
  };


  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Pedidos Criados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centro operacional de gestão de pedidos
          </p>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="max-w-full space-y-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="neu-card p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 shadow-inner">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  <p className="text-2xl font-bold text-primary">{calculatedTotals.totalPedidos}</p>
                  {filterModelo && (
                    <Badge variant="outline" className="text-xs text-primary border-primary mt-1">
                      Modelo: "{filterModelo}"
                    </Badge>
                  )}
                </div>
              </div>

              <div className="neu-card p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 shadow-inner">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(calculatedTotals.totalValor)}</p>
                </div>
              </div>

              <div className="neu-card p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 shadow-inner">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Peças</p>
                  <p className="text-2xl font-bold text-primary">{calculatedTotals.totalPecas}</p>
                </div>
              </div>
            </div>

            {/* Filters and Actions Bar */}
            <div className="neu-card p-4">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Search */}
                <div className="relative flex-1 w-full lg:max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, ID ou status..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 rounded-xl neu-input border-0 bg-background"
                  />
                </div>

                {/* Status Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={filterStatusPagamento} onValueChange={setFilterStatusPagamento}>
                    <SelectTrigger className="h-11 w-[140px] rounded-xl neu-input border-0 bg-background">
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Pagamentos</SelectItem>
                      {statusPagamentoOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterStatusPedido} onValueChange={setFilterStatusPedido}>
                    <SelectTrigger className="h-11 w-[140px] rounded-xl neu-input border-0 bg-background">
                      <SelectValue placeholder="Separação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Pedidos</SelectItem>
                      {statusPedidoOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterStatusEntrega} onValueChange={setFilterStatusEntrega}>
                    <SelectTrigger className="h-11 w-[140px] rounded-xl neu-input border-0 bg-background">
                      <SelectValue placeholder="Entrega" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Entregas</SelectItem>
                      {statusEntregaOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Modelo Filter */}
                <div className="relative w-full lg:w-40">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Modelo..."
                    value={filterModelo}
                    onChange={(e) => setFilterModelo(e.target.value)}
                    className="pl-10 h-11 rounded-xl neu-input border-0 bg-background"
                  />
                </div>

                {/* Date Range Filter */}
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl neu-button border-0 bg-background gap-2"
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-muted-foreground">-</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl neu-button border-0 bg-background gap-2"
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  {hasAnyFilter && (
                    <Button
                      variant="ghost"
                      onClick={clearAllFilters}
                      className="h-11 rounded-xl hover:bg-destructive/10 hover:text-destructive gap-2"
                    >
                      <X className="h-4 w-4" />
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Second row: CSV and New Order */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50 items-center justify-between">
                {/* CSV Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={exportCSV}
                    className="h-10 rounded-xl neu-button border-0 bg-background gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setImportModalOpen(true)}
                    className="h-10 rounded-xl neu-button border-0 bg-background gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Importar CSV
                  </Button>
                </div>

                {/* New Order Button */}
                <Button
                  onClick={() => navigate('/pedidos/novo')}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Novo Pedido
                </Button>
              </div>

              {/* Filtered Totals Panel */}
              {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Total de Peças Filtrado:</span>
                    <span className="font-bold text-primary">{calculatedTotals.totalPecas}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span className="text-muted-foreground">Valor Total Filtrado:</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(calculatedTotals.totalValor)}</span>
                  </div>
                  {filterModelo && (
                    <Badge variant="outline" className="text-xs border-primary text-primary">
                      Filtrando modelo: "{filterModelo}"
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Orders Table */}
            <div className="neu-card p-4 overflow-hidden">
              {filteredAndSortedPedidos.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground">Nenhum pedido encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    {hasAnyFilter ? 'Nenhum pedido com os filtros selecionados' : 'Crie seu primeiro pedido para começar'}
                  </p>
                  {!hasAnyFilter && (
                    <Button
                      onClick={() => navigate('/pedidos/novo')}
                      className="h-11 px-5 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Novo Pedido
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                      <TableRow className="border-b-2 border-border/50 hover:bg-transparent">
                        <TableHead 
                          className="text-xs font-bold text-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors py-3"
                          onClick={() => handleSort('dataCriacao')}
                        >
                          <div className="flex items-center gap-1">
                            Data
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider py-3">
                          Cliente
                        </TableHead>
                        <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider py-3">
                          Modelos
                        </TableHead>
                        <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider py-3 text-center">
                          Qtd
                        </TableHead>
                        <TableHead 
                          className="text-xs font-bold text-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors py-3"
                          onClick={() => handleSort('valorTotal')}
                        >
                          <div className="flex items-center gap-1">
                            Valor
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider py-3 text-center">
                          Pagamento
                        </TableHead>
                        <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider py-3 text-center">
                          Pedido
                        </TableHead>
                        <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider py-3 text-center">
                          Entrega
                        </TableHead>
                        <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider py-3 text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedPedidos.map((pedido) => (
                        <TableRow 
                          key={pedido.id} 
                          className="group border-0 transition-all duration-200 hover:shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] rounded-xl"
                        >
                          <TableCell className="py-2.5 text-sm text-muted-foreground font-medium">
                            {format(new Date(pedido.dataCriacao), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="font-semibold text-foreground text-sm">{pedido.clienteNome}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-muted-foreground max-w-[150px] truncate">
                            {getModelosResumo(pedido)}
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <span className="font-bold text-primary text-sm">{pedido.totalPecas}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="font-bold text-emerald-600 text-sm">{formatCurrency(pedido.valorTotal)}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <InlineStatusSelect
                              options={statusPagamentoOptions}
                              value={pedido.statusPagamento || 'PENDENTE'}
                              onChange={(value) => handleStatusUpdate(pedido.id, 'statusPagamento', value)}
                            />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <InlineStatusSelect
                              options={statusPedidoOptions}
                              value={pedido.statusPedido || 'NÃO SEPARADO'}
                              onChange={(value) => handleStatusUpdate(pedido.id, 'statusPedido', value)}
                            />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <InlineStatusSelect
                              options={statusEntregaOptions}
                              value={pedido.statusEntrega || 'PEND. ENTREGA'}
                              onChange={(value) => handleStatusUpdate(pedido.id, 'statusEntrega', value)}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="neu-card border-0 rounded-xl shadow-lg z-50">
                                <DropdownMenuItem 
                                  onClick={() => setSelectedPedido(pedido)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Eye className="h-4 w-4" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setEditingPedidoId(pedido.id)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => generatePDF(pedido)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <FileText className="h-4 w-4" />
                                  Gerar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeleteId(pedido.id)}
                                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 rounded-xl"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Details Modal */}
      <Dialog open={!!selectedPedido} onOpenChange={() => setSelectedPedido(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-3">
              Detalhes do Pedido
              <div className="flex gap-2">
                <Badge className={`${statusPagamentoColors[selectedPedido?.statusPagamento || ''] || 'bg-muted'} border text-[10px]`}>
                  {selectedPedido?.statusPagamento || 'Pendente'}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedPedido && (
            <div className="space-y-6 mt-4">
              {/* Cliente Info */}
              <div className="neu-card p-4 rounded-xl">
                <h3 className="font-semibold text-foreground mb-3">Informações do Cliente</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome</p>
                    <p className="font-medium text-foreground">{selectedPedido.clienteNome}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">{selectedPedido.telefone || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">{selectedPedido.cidade}, {selectedPedido.estado}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bus className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">{selectedPedido.excursao || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="neu-card p-4 rounded-xl">
                <h3 className="font-semibold text-foreground mb-3">Informações do Pedido</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Data de Criação</p>
                    <p className="font-medium text-foreground">
                      {format(new Date(selectedPedido.dataCriacao), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Forma de Pagamento</p>
                    <p className="font-medium text-foreground">{selectedPedido.formaPagamento || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge className={`${statusPagamentoColors[selectedPedido.statusPagamento] || 'bg-muted'} border text-[9px]`}>
                        {selectedPedido.statusPagamento || 'Pendente'}
                      </Badge>
                      <Badge className={`${statusPedidoColors[selectedPedido.statusPedido] || 'bg-muted'} border text-[9px]`}>
                        {selectedPedido.statusPedido || 'Nao separado'}
                      </Badge>
                      <Badge className={`${statusEntregaColors[selectedPedido.statusEntrega] || 'bg-muted'} border text-[9px]`}>
                        {selectedPedido.statusEntrega || 'Pend. Entrega'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="neu-card p-4 rounded-xl">
                <h3 className="font-semibold text-foreground mb-3">Itens do Pedido</h3>
                <div className="space-y-2">
                  {selectedPedido.itens.map((item, index) => (
                    <div key={item.id || index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <div>
                        <p className="font-medium text-foreground">{item.produtoNome || 'Produto'}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade} x {formatCurrency(item.valorUnitario)}
                        </p>
                      </div>
                      <p className="font-bold text-emerald-600">
                        {formatCurrency(item.quantidade * item.valorUnitario)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-between items-center p-4 neu-card rounded-xl">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Peças</p>
                  <p className="text-xl font-bold text-primary">{selectedPedido.totalPecas} peças</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedPedido.valorTotal)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Pedido Modal */}
      <EditPedidoModalWrapper 
        pedidoId={editingPedidoId} 
        onClose={() => setEditingPedidoId(null)} 
      />

      {/* Import CSV Modal */}
      <ImportPedidosCSVModal 
        open={importModalOpen} 
        onOpenChange={setImportModalOpen} 
      />
    </div>
  );
}

// Wrapper component to fetch pedido data for editing
function EditPedidoModalWrapper({ pedidoId, onClose }: { pedidoId: string | null; onClose: () => void }) {
  const { data: pedidoDB, isLoading } = usePedidoById(pedidoId || undefined);

  if (!pedidoId) return null;

  // Transform data to modal format
  const pedidoData = pedidoDB ? {
    id: pedidoDB.id,
    cliente_nome: pedidoDB.cliente_nome,
    total_pecas: pedidoDB.total_pecas || 0,
    valor_total: pedidoDB.valor_total || 0,
    itens: (pedidoDB.itens || []).map(item => ({
      id: item.id,
      produto_nome: item.produto_nome,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
    })),
  } : null;

  return (
    <EditPedidoModal
      pedido={pedidoData}
      open={!!pedidoId && !isLoading}
      onClose={onClose}
    />
  );
}
