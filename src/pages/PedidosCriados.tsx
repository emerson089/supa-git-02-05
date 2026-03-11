import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePedidos, Pedido } from '@/contexts/PedidosContext';
import { usePedidoById } from '@/hooks/usePedidosData';
import { usePedidosPaginated, PedidoPaginatedDB } from '@/hooks/usePedidosPaginated';
import { usePedidosTotals } from '@/hooks/usePedidosTotals';
import { EditPedidoModal } from '@/components/pedidos/EditPedidoModal';
import { useEstoque } from '@/contexts/EstoqueContext';
import { ImportPedidosCSVModal } from '@/components/pedidos/ImportPedidosCSVModal';
import { ClearPedidosDataModal } from '@/components/pedidos/ClearPedidosDataModal';
import { ProductSummaryModal } from '@/components/pedidos/ProductSummaryModal';
import { MobileOrderCard } from '@/components/pedidos/MobileOrderCard';
import { MobileFiltersSheet } from '@/components/pedidos/MobileFiltersSheet';
import { MobileSummaryCards } from '@/components/pedidos/MobileSummaryCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InlineStatusSelect } from '@/components/pedidos/InlineStatusSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { statusPagamentoOptions, statusPedidoOptions, statusEntregaOptions } from '@/components/pedidos/StatusSelector';
import { StatusMultiSelect } from '@/components/pedidos/StatusMultiSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, Plus, Eye, EyeOff, Trash2, ShoppingBag, DollarSign, Package, MapPin, Phone, Bus, MoreHorizontal, ArrowUpDown, FileText, Pencil, Calendar as CalendarIcon, X, Download, Upload, Loader2, RefreshCw } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parse, subDays, startOfWeek, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Status colors mapping
const statusPagamentoColors: Record<string, string> = {
  'PAGO': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'PENDENTE': 'bg-amber-100 text-amber-700 border-amber-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
  'INCOMPLETO': 'bg-purple-100 text-purple-700 border-purple-300',
  'PEND. ENTREGA': 'bg-blue-100 text-blue-700 border-blue-300',
  'GOLPE CANCELADO': 'bg-zinc-900 text-white border-zinc-900'
};
const statusPedidoColors: Record<string, string> = {
  'SEPARADO': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'NÃO SEPARADO': 'bg-amber-100 text-amber-700 border-amber-300',
  'AMANHÃ': 'bg-blue-100 text-blue-700 border-blue-300',
  'INCOMPLETO': 'bg-purple-100 text-purple-700 border-purple-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
  'GOLPE CANCELADO': 'bg-zinc-900 text-white border-zinc-900'
};
const statusEntregaColors: Record<string, string> = {
  'ENTREGUE': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'RETIRADA': 'bg-blue-100 text-blue-700 border-blue-300',
  'PRÓX. SEMANA': 'bg-amber-100 text-amber-700 border-amber-300',
  'PEND. ENTREGA': 'bg-blue-100 text-blue-700 border-blue-300',
  'NÃO ENTREGOU': 'bg-red-100 text-red-700 border-red-300',
  'ENTREGOU ERRADO': 'bg-red-100 text-red-700 border-red-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300'
};
type SortField = 'created_at' | 'valor_total';
type SortDirection = 'asc' | 'desc';

// Constante para chave do localStorage
const FILTERS_STORAGE_KEY = 'pedidosCriados_filters';

// Interface para filtros persistidos
interface PersistedFilters {
  startDate?: string;
  endDate?: string;
  filterStatusPagamento: string[];
  filterStatusPedido: string[];
  filterStatusEntrega: string[];
  filterModelo: string;
  searchTerm: string;
}

// Função para carregar filtros do localStorage com tratamento de erro e migração
const loadPersistedFilters = (): PersistedFilters => {
  const defaultFilters: PersistedFilters = {
    filterStatusPagamento: [],
    filterStatusPedido: [],
    filterStatusEntrega: [],
    filterModelo: '',
    searchTerm: ''
  };
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Migration: convert old string format to array format
      if (typeof parsed.filterStatusPagamento === 'string') {
        parsed.filterStatusPagamento = parsed.filterStatusPagamento === 'all' ? [] : [parsed.filterStatusPagamento];
      }
      if (typeof parsed.filterStatusPedido === 'string') {
        parsed.filterStatusPedido = parsed.filterStatusPedido === 'all' ? [] : [parsed.filterStatusPedido];
      }
      if (typeof parsed.filterStatusEntrega === 'string') {
        parsed.filterStatusEntrega = parsed.filterStatusEntrega === 'all' ? [] : [parsed.filterStatusEntrega];
      }

      return {
        ...defaultFilters,
        ...parsed
      };
    }
  } catch (error) {
    console.error('Erro ao carregar filtros do localStorage:', error);
    // Remove dados corrompidos
    localStorage.removeItem(FILTERS_STORAGE_KEY);
  }
  return defaultFilters;
};

// Função para salvar filtros no localStorage
const savePersistedFilters = (filters: PersistedFilters): void => {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Erro ao salvar filtros no localStorage:', error);
  }
};
export default function PedidosCriados() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    removePedido,
    updatePedido,
    getPedidoById
  } = usePedidos();
  const {
    itens: estoqueItens,
    updateItem: updateEstoqueItem
  } = useEstoque();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Carregar filtros persistidos uma única vez
  const [persistedFilters] = useState(() => loadPersistedFilters());

  // Date filters - Semana atual (Segunda a Quinta) como default se não houver persistência
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    if (persistedFilters.startDate) return new Date(persistedFilters.startDate);
    // Default: Segunda-feira desta semana
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    if (persistedFilters.endDate) return new Date(persistedFilters.endDate);
    // Default: Sexta-feira desta semana (Segunda + 4 dias)
    return addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 4);
  });

  // App state
  const [searchTerm, setSearchTerm] = useState(persistedFilters.searchTerm || '');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Flag: indica se os filtros vieram de parâmetros na URL (atalhos do dashboard)
  const isFromUrl = !!searchParams.get('status');

  // Limpa o localStorage preventivamente se estivermos acessando via atalho URL
  // Isso impede que filtros temporários fiquem presos caso o usuário saia da página
  if (isFromUrl) {
    try {
      localStorage.removeItem(FILTERS_STORAGE_KEY);
    } catch (e) { }
  }

  // Advanced filters - priorizam URL, caso contrário usa localStorage
  const [filterStatusPagamento, setFilterStatusPagamento] = useState<string[]>(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      const statuses = urlStatus.split(',').filter(Boolean);
      return statuses.length > 0 ? statuses : [];
    }
    return persistedFilters.filterStatusPagamento;
  });

  // Limpa a URL imediatamente após os estados iniciais serem lidos.
  // Isso evita que a barra de endereços continue forçando filtros reativamente após o usuário tentar desmarcá-los.
  useEffect(() => {
    if (searchParams.has('status')) {
      const currentParams = new URLSearchParams(searchParams);
      currentParams.delete('status');
      setSearchParams(currentParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [filterStatusPedido, setFilterStatusPedido] = useState<string[]>(() =>
    isFromUrl ? [] : persistedFilters.filterStatusPedido
  );
  const [filterStatusEntrega, setFilterStatusEntrega] = useState<string[]>(() =>
    isFromUrl ? [] : persistedFilters.filterStatusEntrega
  );
  const [filterModelo, setFilterModelo] = useState(
    isFromUrl ? '' : persistedFilters.filterModelo
  );

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  const [exportingCSV, setExportingCSV] = useState(false);
  const [showValor, setShowValor] = useState(false);
  const maskedValue = "R$ ••••••";
  const {
    user
  } = useAuth();

  // Use paginated hook for data
  const {
    data: paginatedResult,
    isLoading
  } = usePedidosPaginated({
    page: currentPage,
    pageSize,
    search: searchTerm,
    statusPagamento: filterStatusPagamento,
    statusPedido: filterStatusPedido,
    statusEntrega: filterStatusEntrega,
    startDate,
    endDate,
    sortField,
    sortDirection,
    modeloFilter: filterModelo
  });

  // Use totals hook for summary cards
  const {
    data: totals
  } = usePedidosTotals({
    search: searchTerm,
    statusPagamento: filterStatusPagamento,
    statusPedido: filterStatusPedido,
    statusEntrega: filterStatusEntrega,
    startDate,
    endDate,
    modeloFilter: filterModelo
  });
  const pedidosList = paginatedResult?.data || [];
  const totalPages = paginatedResult?.totalPages || 0;
  const totalCount = paginatedResult?.count || 0;

  // Reset to first page when any filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm, filterStatusPagamento, filterStatusPedido, filterStatusEntrega, startDate, endDate, filterModelo]);

  // Persistir filtros no localStorage quando mudarem
  // Quando os filtros vêm da URL (atalhos do dashboard), ignora a primeira execução
  // para não 'contaminar' o localStorage com filtros temporários
  const isFirstRender = React.useRef(isFromUrl);

  useEffect(() => {
    // Se veio da URL, pula apenas a PRIMEIRA execução (montagem inicial com valores da URL)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    savePersistedFilters({
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      filterStatusPagamento,
      filterStatusPedido,
      filterStatusEntrega,
      filterModelo,
      searchTerm
    });
  }, [startDate, endDate, filterStatusPagamento, filterStatusPedido, filterStatusEntrega, filterModelo, searchTerm]);

  // Legacy handler for backwards compatibility
  const handleFilterChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
  };
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
      const produtoEstoque = estoqueItens.find(p => p.tipo === 'acabado' && (p.id === item.produtoId || p.nome.toLowerCase() === item.produtoNome.toLowerCase()));
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
  const subtrairEstoque = async (pedido: Pedido): Promise<{
    sucesso: boolean;
    mensagem: string;
  }> => {
    const itensIndisponiveis: string[] = [];

    // Verificar disponibilidade primeiro
    for (const item of pedido.itens) {
      const produtoEstoque = estoqueItens.find(p => p.tipo === 'acabado' && (p.id === item.produtoId || p.nome.toLowerCase() === item.produtoNome.toLowerCase()));
      if (!produtoEstoque || produtoEstoque.quantidade < item.quantidade) {
        const disponivel = produtoEstoque?.quantidade || 0;
        itensIndisponiveis.push(`${item.produtoNome}: necessário ${item.quantidade}, disponível ${disponivel}`);
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
      const produtoEstoque = estoqueItens.find(p => p.tipo === 'acabado' && (p.id === item.produtoId || p.nome.toLowerCase() === item.produtoNome.toLowerCase()));
      if (produtoEstoque) {
        const novaQuantidade = produtoEstoque.quantidade - item.quantidade;
        updateEstoqueItem(produtoEstoque.id, {
          quantidade: novaQuantidade
        });
      }
    }
    return {
      sucesso: true,
      mensagem: ''
    };
  };

  // Handle inline status update with cancellation automation and stock reversal
  const handleStatusUpdate = async (pedidoId: string, field: 'statusPagamento' | 'statusPedido' | 'statusEntrega', value: string) => {
    const pedido = getPedidoById(pedidoId);
    if (!pedido) return;
    const updates: Partial<Pedido> = {
      [field]: value
    };

    // CASO ESPECIAL: GOLPE CANCELADO selecionado na coluna Pedido - preenche automaticamente os outros
    if (field === 'statusPedido' && value === 'GOLPE CANCELADO') {
      updates.statusPagamento = 'GOLPE CANCELADO';
      updates.statusEntrega = 'CANCELADO'; // Entrega não tem GOLPE CANCELADO, usa CANCELADO

      // Verificar se precisa estornar estoque
      const estavaCancelado = pedido.statusPagamento === 'CANCELADO' || pedido.statusPedido === 'CANCELADO' || pedido.statusPagamento === 'GOLPE CANCELADO' || pedido.statusPedido === 'GOLPE CANCELADO';
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
    const estavaCancelado = pedido.statusPagamento === 'CANCELADO' || pedido.statusPedido === 'CANCELADO' || pedido.statusPagamento === 'GOLPE CANCELADO' || pedido.statusPedido === 'GOLPE CANCELADO';
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
      if (field === 'statusPedido' && value === 'SEPARADO') {
        const telefoneApenasNumeros = pedido.telefone?.replace(/\\D/g, '') || '';
        const mensagem = `Olá ${pedido.clienteNome}, seu pedido já foi separado e está pronto!`;
        toast.success('Pedido marcado como SEPARADO!', {
          action: telefoneApenasNumeros ? {
            label: 'Avisar no WhatsApp',
            onClick: () => window.open(`https://wa.me/55${telefoneApenasNumeros}?text=${encodeURIComponent(mensagem)}`, '_blank')
          } : undefined,
          duration: 8000,
        });
      } else {
        toast.success('Status atualizado com sucesso!');
      }
    }
    updatePedido(pedidoId, updates);
  };
  // Removed client-side filtering - now handled by server-side pagination

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      // Buscar o pedido completo com itens antes de excluir
      const pedido = getPedidoById(deleteId);

      // Se encontrou o pedido e não foi estornado ainda, devolver ao estoque
      if (pedido && !pedido.estornoRealizado) {
        const pecasDevolvidas = estornarEstoque(pedido);

        if (pecasDevolvidas > 0) {
          // Aguardar um tick para garantir que as atualizações de estoque foram processadas
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Excluir o pedido
      removePedido(deleteId);
      setDeleteId(null);

      const mensagem = pedido && !pedido.estornoRealizado && pedido.totalPecas > 0
        ? `Pedido excluído! ${pedido.totalPecas} peças retornaram ao estoque.`
        : 'Pedido excluído com sucesso!';

      toast.success(mensagem);
    } catch (error) {
      console.error('Erro ao excluir pedido:', error);
      toast.error('Erro ao excluir pedido');
      setDeleteId(null);
    }
  };
  const getModelosResumo = (pedido: PedidoPaginatedDB) => {
    const itens = pedido.pedido_itens || [];
    if (itens.length === 0) return '-';

    const cleanName = (name: string) => name
      .replace(/ — Tamanho (PEÇAS)/gi, '')
      .replace(/-(PEÇAS)/gi, '')
      .trim();

    const primeiroNome = cleanName(itens[0].produto_nome);

    if (itens.length === 1) return primeiroNome;
    return `${primeiroNome} +${itens.length - 1}`;
  };
  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };
  const clearAllFilters = () => {
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);
    setFilterStatusPagamento([]);
    setFilterStatusPedido([]);
    setFilterStatusEntrega([]);
    setFilterModelo('');
    // Limpar também do localStorage
    localStorage.removeItem(FILTERS_STORAGE_KEY);
  };

  // Atalhos rápidos de filtro
  const applyQuickFilter = (filter: 'hoje' | 'ontem' | '7dias' | 'emAberto' | 'pendPagamento' | 'naoSeparado') => {
    // Reset all filters first
    setSearchTerm('');
    setFilterStatusPagamento([]);
    setFilterStatusPedido([]);
    setFilterStatusEntrega([]);
    setFilterModelo('');
    switch (filter) {
      case 'hoje':
        setStartDate(new Date());
        setEndDate(new Date());
        break;
      case 'ontem':
        const ontem = subDays(new Date(), 1);
        setStartDate(ontem);
        setEndDate(ontem);
        break;
      case '7dias':
        setStartDate(subDays(new Date(), 6));
        setEndDate(new Date());
        break;
      case 'emAberto':
        setStartDate(undefined);
        setEndDate(undefined);
        // Filtrar por entrega diferente de ENTREGUE
        setFilterStatusEntrega(['PEND. ENTREGA']);
        break;
      case 'pendPagamento':
        setStartDate(undefined);
        setEndDate(undefined);
        setFilterStatusPagamento(['PENDENTE']);
        break;
      case 'naoSeparado':
        setStartDate(undefined);
        setEndDate(undefined);
        setFilterStatusPedido(['NÃO SEPARADO']);
        break;
    }
  };

  // Determinar qual atalho está ativo
  const getActiveQuickFilter = (): string | null => {
    const hoje = new Date();
    const ontem = subDays(hoje, 1);
    const seteDiasAtras = subDays(hoje, 6);

    const noStatusFilters = filterStatusPagamento.length === 0 && filterStatusPedido.length === 0 && filterStatusEntrega.length === 0;

    // Verificar se é "Hoje"
    if (startDate && endDate && format(startDate, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd') && format(endDate, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd') && noStatusFilters) {
      return 'hoje';
    }

    // Verificar se é "Ontem"
    if (startDate && endDate && format(startDate, 'yyyy-MM-dd') === format(ontem, 'yyyy-MM-dd') && format(endDate, 'yyyy-MM-dd') === format(ontem, 'yyyy-MM-dd') && noStatusFilters) {
      return 'ontem';
    }

    // Verificar se é "Últimos 7 dias"
    if (startDate && endDate && format(startDate, 'yyyy-MM-dd') === format(seteDiasAtras, 'yyyy-MM-dd') && format(endDate, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd') && noStatusFilters) {
      return '7dias';
    }

    // Verificar filtros de status
    if (!startDate && !endDate) {
      if (filterStatusEntrega.length === 1 && filterStatusEntrega[0] === 'PEND. ENTREGA' && filterStatusPagamento.length === 0 && filterStatusPedido.length === 0) {
        return 'emAberto';
      }
      if (filterStatusPagamento.length === 1 && filterStatusPagamento[0] === 'PENDENTE' && filterStatusPedido.length === 0 && filterStatusEntrega.length === 0) {
        return 'pendPagamento';
      }
      if (filterStatusPedido.length === 1 && filterStatusPedido[0] === 'NÃO SEPARADO' && filterStatusPagamento.length === 0 && filterStatusEntrega.length === 0) {
        return 'naoSeparado';
      }
    }
    return null;
  };
  const activeQuickFilter = getActiveQuickFilter();

  // Função de refresh manual
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: ['pedidos-paginated']
    });
    await queryClient.invalidateQueries({
      queryKey: ['pedidos-totals']
    });
    setIsRefreshing(false);
    toast.success('Dados atualizados');
  };
  const hasAnyFilter = searchTerm || startDate || endDate || filterStatusPagamento.length > 0 || filterStatusPedido.length > 0 || filterStatusEntrega.length > 0 || filterModelo;

  // Use totals from server-side hook
  const calculatedTotals = {
    totalPedidos: totals?.totalPedidos || 0,
    totalPecas: totals?.totalPecas || 0,
    totalValor: totals?.totalValor || 0
  };
  const hasActiveFilters = startDate || endDate || filterStatusPagamento.length > 0 || filterStatusPedido.length > 0 || filterStatusEntrega.length > 0 || filterModelo;

  // Count active filters for mobile badge
  const activeFilterCount = [
    startDate,
    endDate,
    filterStatusPagamento.length > 0 ? filterStatusPagamento : null,
    filterStatusPedido.length > 0 ? filterStatusPedido : null,
    filterStatusEntrega.length > 0 ? filterStatusEntrega : null,
    filterModelo
  ].filter(Boolean).length;

  // PDF Generation
  const generatePDF = (pedido: PedidoPaginatedDB) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DELOOKII - ERP JEANS | COMPROVANTE DE PEDIDO', pageWidth / 2, 20, {
      align: 'center'
    });

    // Divider
    doc.setDrawColor(200);
    doc.line(14, 25, pageWidth - 14, 25);

    // Client info section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', 14, 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const clienteData = [`Nome: ${pedido.cliente_nome}`, `Telefone: ${pedido.telefone || '-'}`, `Cidade/Estado: ${pedido.cidade || '-'}, ${pedido.estado || '-'}`, `Excursão: ${pedido.excursao || '-'}`];
    let yPos = 42;
    clienteData.forEach(line => {
      doc.text(line, 14, yPos);
      yPos += 6;
    });

    // Date and time
    doc.setFont('helvetica', 'bold');
    doc.text('Data de Emissão:', pageWidth - 70, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
      locale: ptBR
    }), pageWidth - 70, 48);
    doc.text('Data do Pedido:', pageWidth - 70, 56);
    doc.text(format(new Date(pedido.created_at), "dd/MM/yyyy", {
      locale: ptBR
    }), pageWidth - 70, 62);

    // Items grouping
    const itens = pedido.pedido_itens || [];

    const parseItem = (item: typeof itens[number]) => {
      const produtoId = item.produto_id || '';
      const produto = estoqueItens.find(p => p.id === produtoId);
      let refStr = '';
      if (produto) {
        try {
          if (produto.localizacao) {
            const loc = JSON.parse(produto.localizacao);
            if (loc.referencia) refStr = loc.referencia;
          }
        } catch (e) { }
      } else if (item.produto_nome?.includes(' | REF: ')) {
        refStr = item.produto_nome.split(' | REF: ')[1] || '';
      }

      if (refStr) {
        const m = refStr.match(/^(.+)-(P|M|G|GG|G1|G2|G3|XGG|\d{2})$/);
        if (m) {
          const refBase = m[1];
          const tamanho = m[2];
          let nomeModelo = item.produto_nome || 'Produto';
          if (produto && produto.nome) nomeModelo = produto.nome;
          if (nomeModelo.includes(' | REF: ')) nomeModelo = nomeModelo.split(' | REF: ')[0];
          nomeModelo = nomeModelo.replace(` — ${refStr}`, '').trim();
          nomeModelo = nomeModelo.replace(/-(PEÇAS)/gi, '').trim();
          return { refBase, tamanho, nomeModelo, refStr };
        }
      }
      return null;
    };

    const gradeGroups = new Map<string, { refBase: string; nomeModelo: string; itens: Array<{ item: typeof itens[number]; tamanho: string }> }>();
    const avulsosItems: typeof itens = [];

    itens.forEach(item => {
      const parsed = parseItem(item);
      if (parsed) {
        const key = `${parsed.refBase}|${item.valor_unitario}`;
        if (!gradeGroups.has(key)) {
          gradeGroups.set(key, { refBase: parsed.refBase, nomeModelo: parsed.nomeModelo, itens: [] });
        }
        gradeGroups.get(key)!.itens.push({ item, tamanho: parsed.tamanho });
      } else {
        avulsosItems.push(item);
      }
    });

    const gradeGroupsFinal: typeof gradeGroups = new Map();
    gradeGroups.forEach((v, k) => {
      if (v.itens.length >= 2) gradeGroupsFinal.set(k, v);
      else avulsosItems.push(v.itens[0].item);
    });

    const hasGrades = gradeGroupsFinal.size > 0;
    const hasAvulsos = avulsosItems.length > 0;

    const tableData: any[] = [];

    if (hasGrades) {
      if (hasGrades && hasAvulsos) {
        tableData.push([{ content: 'GRADES', colSpan: 5, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: [100, 100, 100], halign: 'left' } }]);
      }

      const ORDEM = ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54'];

      gradeGroupsFinal.forEach(grupo => {
        const totalPecas = grupo.itens.reduce((s, { item }) => s + item.quantidade, 0);
        const valorUnit = grupo.itens[0].item.valor_unitario;
        const subtotal = totalPecas * valorUnit;

        const itensSorted = [...grupo.itens].sort((a, b) => ORDEM.indexOf(a.tamanho) - ORDEM.indexOf(b.tamanho));

        // chunk the tamanhosStr to wrap every 4 sizes nicely, jspdf-autotable handles newlines
        let tamanhosStr = '';
        itensSorted.forEach((it, idx) => {
          tamanhosStr += `${it.tamanho}(${it.item.quantidade})`;
          if (idx < itensSorted.length - 1) {
            tamanhosStr += ((idx + 1) % 4 === 0) ? '\n' : ' ';
          }
        });

        tableData.push([
          `${grupo.nomeModelo}\n(Ref: ${grupo.refBase})`,
          tamanhosStr,
          totalPecas.toString(),
          formatCurrency(valorUnit),
          formatCurrency(subtotal)
        ]);
      });
    }

    if (hasAvulsos) {
      if (hasGrades && hasAvulsos) {
        tableData.push([{ content: 'AVULSOS', colSpan: 5, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: [100, 100, 100], halign: 'left' } }]);
      }

      avulsosItems.forEach(item => {
        const produtoId = item.produto_id || '';
        const produto = estoqueItens.find(p => p.id === produtoId);
        let nomeStr = item.produto_nome || 'Produto';
        let refStr = '';

        if (produto) {
          if (produto.nome) nomeStr = produto.nome;
          try {
            if (produto.localizacao) {
              const loc = JSON.parse(produto.localizacao);
              if (loc.referencia) refStr = loc.referencia;
            }
          } catch (e) { }
        } else if (nomeStr.includes(' | REF: ')) {
          refStr = nomeStr.split(' | REF: ')[1] || '';
          nomeStr = nomeStr.split(' | REF: ')[0];
        }

        if (refStr && nomeStr.includes(` — ${refStr}`)) {
          const tamanho = refStr.split('-').pop();
          if (tamanho && tamanho !== 'PEÇAS') {
            nomeStr = nomeStr.replace(` — ${refStr}`, ` — Tamanho ${tamanho}`);
          } else {
            nomeStr = nomeStr.replace(` — ${refStr}`, '');
          }
        }

        // Final sanitization for PEÇAS explicitly
        nomeStr = nomeStr.replace(/ — Tamanho (PEÇAS)/gi, '');
        refStr = refStr.replace(/-(PEÇAS)/gi, '');

        const modeloStr = refStr ? `${nomeStr}\n(Ref: ${refStr})` : nomeStr;

        tableData.push([
          modeloStr,
          '-',
          item.quantidade.toString(),
          formatCurrency(item.valor_unitario),
          formatCurrency(item.quantidade * item.valor_unitario)
        ]);
      });
    }

    autoTable(doc, {
      startY: 75,
      head: [['Modelo', 'Tamanhos', 'Qtd', 'Unit.', 'Subtotal']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 25 }
      }
    });

    // @ts-ignore - jspdf-autotable adds this property
    const finalY = doc.lastAutoTable.finalY + 10;

    // Calculate quantity of unique models
    const modelosUnicos = new Set(
      itens.filter(item => item.produto_id).map(item => item.produto_id)
    );
    const quantidadeModelos = modelosUnicos.size;
    const taxaExcursao = pedido.taxa_excursao || 0;
    const subtotalItens = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0);

    // Totals - altura dinâmica baseada na presença de taxa
    const boxHeight = taxaExcursao > 0 ? 38 : 28;
    doc.setFillColor(240, 240, 240);
    doc.rect(14, finalY, pageWidth - 28, boxHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);

    // Linha 1: Peças e Modelos
    doc.text(`Total de Peças: ${pedido.total_pecas || 0}`, 20, finalY + 10);
    doc.text(`Quantidade de Modelos: ${quantidadeModelos}`, pageWidth / 2, finalY + 10);

    // Linha 2: Subtotal e Taxa (se houver)
    if (taxaExcursao > 0) {
      doc.text(`Subtotal dos Itens: ${formatCurrency(subtotalItens)}`, 20, finalY + 18);
      doc.text(`Taxa Excursão: + ${formatCurrency(taxaExcursao)}`, pageWidth / 2, finalY + 18);

      // Linha 3: Valor Total e Status
      doc.setFontSize(12);
      doc.text(`Valor Total: ${formatCurrency(pedido.valor_total || 0)}`, 20, finalY + 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Status: ${pedido.status_pagamento} | ${pedido.status_pedido} | ${pedido.status_entrega}`, pageWidth - 20, finalY + 28, {
        align: 'right'
      });
    } else {
      // Sem taxa: Valor Total e Status na linha 2
      doc.setFontSize(12);
      doc.text(`Valor Total: ${formatCurrency(pedido.valor_total || 0)}`, 20, finalY + 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Status: ${pedido.status_pagamento} | ${pedido.status_pedido} | ${pedido.status_entrega}`, pageWidth - 20, finalY + 18, {
        align: 'right'
      });
    }

    // Footer - posição dinâmica baseada na altura do box
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('Obrigado pela preferência! Delookii Jeans', pageWidth / 2, finalY + boxHeight + 10, {
      align: 'center'
    });

    // Download
    const fileName = `Pedido_${pedido.cliente_nome.replace(/\s+/g, '_')}_${format(new Date(pedido.created_at), 'dd-MM-yyyy')}.pdf`;
    doc.save(fileName);
    toast.success('PDF gerado com sucesso!');
  };

  // CSV Export - Fetch ALL filtered pedidos from database
  const exportCSV = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }
    setExportingCSV(true);
    try {
      // Fetch all pedidos with same filters applied
      const PAGE_SIZE = 1000;
      let allPedidos: PedidoPaginatedDB[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        let query = supabase.from('pedidos').select(`
            *,
            pedido_itens (
              id,
              produto_nome,
              quantidade,
              valor_unitario
            )
          `).order('created_at', {
          ascending: sortDirection === 'asc'
        });

        // Apply filters
        if (searchTerm) {
          query = query.or(`cliente_nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,cidade.ilike.%${searchTerm}%`);
        }
        if (filterStatusPagamento.length > 0) {
          query = query.in('status_pagamento', filterStatusPagamento);
        }
        if (filterStatusPedido.length > 0) {
          query = query.in('status_pedido', filterStatusPedido);
        }
        if (filterStatusEntrega.length > 0) {
          query = query.in('status_entrega', filterStatusEntrega);
        }
        if (startDate) {
          query = query.gte('created_at', startOfDay(startDate).toISOString());
        }
        if (endDate) {
          query = query.lte('created_at', endOfDay(endDate).toISOString());
        }
        query = query.range(from, from + PAGE_SIZE - 1);
        const {
          data,
          error
        } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
          // Filter by model if needed (client-side)
          let filteredData = data as PedidoPaginatedDB[];
          if (filterModelo) {
            const modeloLower = filterModelo.toLowerCase();
            filteredData = filteredData.filter(p => p.pedido_itens?.some(i => i.produto_nome.toLowerCase().includes(modeloLower)));
          }
          allPedidos = [...allPedidos, ...filteredData];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      if (allPedidos.length === 0) {
        toast.error('Nenhum pedido encontrado para exportar');
        return;
      }
      const headers = ['Data', 'Cliente', 'Modelos', 'Qtd', 'Valor', 'Pagamento', 'Pedido', 'Entrega'];
      const rows = allPedidos.map(pedido => [
        format(new Date(pedido.created_at), "dd/MM/yyyy"),
        pedido.cliente_nome || '',
        (pedido.pedido_itens || []).map(i => `${i.produto_nome}(${i.quantidade})`).join('; '),
        pedido.total_pecas?.toString() || '',
        pedido.valor_total?.toFixed(2) || '',
        pedido.status_pagamento || '',
        pedido.status_pedido || '',
        pedido.status_entrega || ''
      ]);
      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pedidos_${format(new Date(), 'dd-MM-yyyy')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${allPedidos.length} pedidos exportados com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar pedidos');
    } finally {
      setExportingCSV(false);
    }
  };
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };
  return <div className="min-h-screen bg-background flex overflow-hidden">
    {/* Mobile Header */}
    {isMobile && <MobileHeader title="Vendas" />}

    {/* Desktop Sidebar */}
    {!isMobile && <AppSidebar />}

    <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", isMobile && "pt-14 pb-20")}>
      {/* Desktop Header */}
      {!isMobile && <header className="px-8 py-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PEDIDOS CRIADOS</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Centro operacional de gestão de pedidos
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefreshData} disabled={isRefreshing} title="Atualizar dados">
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </header>}

      {/* Content */}
      <div className={cn("flex-1 overflow-y-auto pb-8", isMobile ? "px-4" : "px-8")}>
        <div className="max-w-full space-y-4">
          {/* Summary Cards - Mobile uses compact 3-column layout */}
          {isMobile ? <MobileSummaryCards totalPedidos={calculatedTotals.totalPedidos} totalValor={calculatedTotals.totalValor} totalPecas={calculatedTotals.totalPecas} filterModelo={filterModelo} showValor={showValor} onToggleValor={() => setShowValor(v => !v)} /> : <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="neu-card p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 shadow-inner">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                <p className="text-2xl font-bold text-primary">{formatNumber(calculatedTotals.totalPedidos)}</p>
                {filterModelo && <Badge variant="outline" className="text-xs text-primary border-primary mt-1">
                  Modelo: "{filterModelo}"
                </Badge>}
              </div>
            </div>

            <div className="neu-card p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 shadow-inner">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-emerald-600">{showValor ? formatCurrency(calculatedTotals.totalValor) : maskedValue}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowValor(v => !v)} className="h-8 w-8">
                {showValor ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>

            <div className="neu-card p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 shadow-inner">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Peças</p>
                <p className="text-2xl font-bold text-primary">{formatNumber(calculatedTotals.totalPecas)}</p>
              </div>
            </div>
          </div>}

          {/* Quick Filter Shortcuts */}
          <div className={cn("flex gap-2 overflow-x-auto pb-1 scrollbar-hide", isMobile ? "-mx-4 px-4" : "")}>
            <Button variant={activeQuickFilter === 'hoje' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickFilter('hoje')} className={cn("rounded-full whitespace-nowrap text-xs h-8 px-3", activeQuickFilter === 'hoje' && "bg-primary text-primary-foreground")}>
              Hoje
            </Button>
            <Button variant={activeQuickFilter === 'ontem' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickFilter('ontem')} className={cn("rounded-full whitespace-nowrap text-xs h-8 px-3", activeQuickFilter === 'ontem' && "bg-primary text-primary-foreground")}>
              Ontem
            </Button>
            <Button variant={activeQuickFilter === '7dias' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickFilter('7dias')} className={cn("rounded-full whitespace-nowrap text-xs h-8 px-3", activeQuickFilter === '7dias' && "bg-primary text-primary-foreground")}>
              Últimos 7 dias
            </Button>
            <Button variant={activeQuickFilter === 'emAberto' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickFilter('emAberto')} className={cn("rounded-full whitespace-nowrap text-xs h-8 px-3", activeQuickFilter === 'emAberto' && "bg-primary text-primary-foreground")}>
              Em aberto
            </Button>
            <Button variant={activeQuickFilter === 'pendPagamento' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickFilter('pendPagamento')} className={cn("rounded-full whitespace-nowrap text-xs h-8 px-3", activeQuickFilter === 'pendPagamento' && "bg-primary text-primary-foreground")}>
              Pend. Pagamento
            </Button>
            <Button variant={activeQuickFilter === 'naoSeparado' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickFilter('naoSeparado')} className={cn("rounded-full whitespace-nowrap text-xs h-8 px-3", activeQuickFilter === 'naoSeparado' && "bg-primary text-primary-foreground")}>
              Não separado
            </Button>
            {hasAnyFilter && <Button variant="ghost" size="sm" onClick={clearAllFilters} className="rounded-full whitespace-nowrap text-xs h-8 px-3 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>}
          </div>

          {/* Filters and Actions Bar */}
          {isMobile ? (/* Mobile Filters */
            <div className="space-y-3">
              {/* Search */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11 rounded-xl neu-input border-0 bg-background" />
              </div>

              {/* Filters Sheet + New Order Button */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <MobileFiltersSheet filterStatusPagamento={filterStatusPagamento} filterStatusPedido={filterStatusPedido} filterStatusEntrega={filterStatusEntrega} filterModelo={filterModelo} startDate={startDate} endDate={endDate} onFilterStatusPagamentoChange={setFilterStatusPagamento} onFilterStatusPedidoChange={setFilterStatusPedido} onFilterStatusEntregaChange={setFilterStatusEntrega} onFilterModeloChange={setFilterModelo} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onClearAll={clearAllFilters} activeCount={activeFilterCount} />
                </div>
                <Button onClick={() => setSummaryModalOpen(true)} variant="outline" className="h-11 px-3 rounded-xl border-primary/20 text-primary hover:bg-primary/10">
                  <ShoppingBag className="h-5 w-5" />
                </Button>
                <Button onClick={() => navigate('/pedidos/novo')} className="h-11 px-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium gap-2">
                  <Plus className="h-4 w-4" />
                  Novo
                </Button>
              </div>
            </div>) : (/* Desktop Filters */
            <div className="neu-card p-4">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Search */}
                <div className="relative flex-1 w-full lg:max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar cliente, ID ou status..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11 rounded-xl neu-input border-0 bg-background" />
                </div>

                {/* Status Filters - Multi-Select */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatusMultiSelect
                    label="Pagamentos"
                    options={statusPagamentoOptions}
                    selected={filterStatusPagamento}
                    onSelectionChange={setFilterStatusPagamento}
                    placeholder="Todos Pagamentos"
                  />

                  <StatusMultiSelect
                    label="Pedidos"
                    options={statusPedidoOptions}
                    selected={filterStatusPedido}
                    onSelectionChange={setFilterStatusPedido}
                    placeholder="Todos Pedidos"
                  />

                  <StatusMultiSelect
                    label="Entregas"
                    options={statusEntregaOptions}
                    selected={filterStatusEntrega}
                    onSelectionChange={setFilterStatusEntrega}
                    placeholder="Todas Entregas"
                  />
                </div>

                {/* Modelo Filter */}
                <div className="relative w-full lg:w-40">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Modelo..." value={filterModelo} onChange={e => setFilterModelo(e.target.value)} className="pl-10 h-11 rounded-xl neu-input border-0 bg-background" />
                </div>

                {/* Date Range Filter */}
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-11 rounded-xl neu-button border-0 bg-background gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} defaultMonth={startDate} locale={ptBR} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>

                  <span className="text-muted-foreground">-</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-11 rounded-xl neu-button border-0 bg-background gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} defaultMonth={endDate} locale={ptBR} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>

                  {hasAnyFilter && <Button variant="ghost" onClick={clearAllFilters} className="h-11 rounded-xl hover:bg-destructive/10 hover:text-destructive gap-2">
                    <X className="h-4 w-4" />
                    Limpar
                  </Button>}
                </div>
              </div>

              {/* Second row: CSV and New Order */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50 items-center justify-between">
                {/* CSV and Clear Buttons */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setClearDataModalOpen(true)} className="h-10 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 gap-2">
                    <Trash2 className="h-4 w-4" />
                    Limpar Dados
                  </Button>

                  <Button variant="outline" onClick={() => setSummaryModalOpen(true)} className="h-10 rounded-xl border-primary/20 text-primary hover:bg-primary/10 gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Modelo/Cat.
                  </Button>

                  <Button variant="outline" onClick={exportCSV} disabled={exportingCSV || pedidosList.length === 0} className="h-10 rounded-xl neu-button border-0 bg-background gap-2">
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>

                  <Button variant="outline" onClick={() => setImportModalOpen(true)} className="h-10 rounded-xl neu-button border-0 bg-background gap-2">
                    <Upload className="h-4 w-4" />
                    Importar CSV
                  </Button>
                </div>

                {/* New Order Button */}
                <Button onClick={() => navigate('/pedidos/novo')} className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Pedido
                </Button>
              </div>

              {/* Filtered Totals Panel */}
              {hasActiveFilters && <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Total de Peças Filtrado:</span>
                  <span className="font-bold text-primary">{calculatedTotals.totalPecas}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span className="text-muted-foreground">Valor Total Filtrado:</span>
                  <span className="font-bold text-emerald-600">{showValor ? formatCurrency(calculatedTotals.totalValor) : maskedValue}</span>
                </div>
                {filterModelo && <Badge variant="outline" className="text-xs border-primary text-primary">
                  Filtrando modelo: "{filterModelo}"
                </Badge>}
              </div>}
            </div>)}

          {/* Orders - Mobile Cards or Desktop Table */}
          {isLoading ? <div className="neu-card p-4 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando pedidos...</span>
          </div> : pedidosList.length === 0 ? <div className="neu-card p-4 text-center py-12">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {hasAnyFilter ? 'Nenhum pedido com os filtros selecionados' : 'Crie seu primeiro pedido para começar'}
            </p>
          </div> : isMobile ? (/* Mobile: Card List */
            <div className="space-y-3">
              {pedidosList.map(pedido => <MobileOrderCard key={pedido.id} pedido={pedido} onView={() => setSelectedPedido(pedido)} onEdit={() => setEditingPedidoId(pedido.id)} onDelete={() => setDeleteId(pedido.id)} onGeneratePDF={() => generatePDF(pedido)} onStatusUpdate={(field, value) => handleStatusUpdate(pedido.id, field, value)} />)}
            </div>) : (/* Desktop: Table */
            <div className="neu-card p-4 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                    <TableRow className="border-b-2 border-border/50 hover:bg-transparent">
                      <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors py-3" onClick={() => handleSort('created_at')}>
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
                      <TableHead className="text-xs font-bold text-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors py-3" onClick={() => handleSort('valor_total')}>
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
                    {pedidosList.map(pedido => <TableRow key={pedido.id} className="group border-0 transition-all duration-200 hover:shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] rounded-xl">
                      <TableCell className="py-2.5 text-sm text-muted-foreground font-medium">
                        {format(new Date(pedido.created_at), "dd/MM/yyyy", {
                          locale: ptBR
                        })}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="font-semibold text-foreground text-sm">{pedido.cliente_nome}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-muted-foreground max-w-[150px] truncate">
                        {getModelosResumo(pedido)}
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <span className="font-bold text-primary text-sm">{pedido.total_pecas || 0}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="font-bold text-emerald-600 text-sm">{formatCurrency(pedido.valor_total || 0)}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <InlineStatusSelect options={statusPagamentoOptions} value={pedido.status_pagamento || 'PENDENTE'} onChange={value => handleStatusUpdate(pedido.id, 'statusPagamento', value)} />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <InlineStatusSelect options={statusPedidoOptions} value={pedido.status_pedido || 'NÃO SEPARADO'} onChange={value => handleStatusUpdate(pedido.id, 'statusPedido', value)} />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <InlineStatusSelect options={statusEntregaOptions} value={pedido.status_entrega || 'PEND. ENTREGA'} onChange={value => handleStatusUpdate(pedido.id, 'statusEntrega', value)} />
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="neu-card border-0 rounded-xl shadow-lg z-50">
                            <DropdownMenuItem onClick={() => setSelectedPedido(pedido)} className="gap-2 cursor-pointer">
                              <Eye className="h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingPedidoId(pedido.id)} className="gap-2 cursor-pointer">
                              <Pencil className="h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generatePDF(pedido)} className="gap-2 cursor-pointer">
                              <FileText className="h-4 w-4" />
                              Gerar PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteId(pedido.id)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                <div className="text-sm text-muted-foreground">
                  Mostrando {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalCount)} de {totalCount} pedidos
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(0, p - 1))} className={currentPage === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>

                    {/* Page numbers */}
                    {Array.from({
                      length: Math.min(5, totalPages)
                    }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i;
                      } else if (currentPage < 3) {
                        pageNum = i;
                      } else if (currentPage > totalPages - 4) {
                        pageNum = totalPages - 5 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return <PaginationItem key={pageNum}>
                        <PaginationLink onClick={() => setCurrentPage(pageNum)} isActive={currentPage === pageNum} className="cursor-pointer">
                          {pageNum + 1}
                        </PaginationLink>
                      </PaginationItem>;
                    })}

                    <PaginationItem>
                      <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} className={currentPage >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>}
            </div>)}
        </div>
      </div>
    </main>

    {/* Bottom Navigation for Mobile */}
    <BottomNavigation />

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
          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">
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
              <Badge className={`${statusPagamentoColors[selectedPedido?.status_pagamento || ''] || 'bg-muted'} border text-[10px]`}>
                {selectedPedido?.status_pagamento || 'Pendente'}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {selectedPedido && <div className="space-y-6 mt-4">
          {/* Cliente Info */}
          <div className="neu-card p-4 rounded-xl">
            <h3 className="font-semibold text-foreground mb-3">Informações do Cliente</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground">{selectedPedido.cliente_nome}</p>
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
                  {format(new Date(selectedPedido.created_at), "dd/MM/yyyy", {
                    locale: ptBR
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Forma de Pagamento</p>
                <p className="font-medium text-foreground">{selectedPedido.forma_pagamento || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge className={`${statusPagamentoColors[selectedPedido.status_pagamento || ''] || 'bg-muted'} border text-[9px]`}>
                    {selectedPedido.status_pagamento || 'Pendente'}
                  </Badge>
                  <Badge className={`${statusPedidoColors[selectedPedido.status_pedido || ''] || 'bg-muted'} border text-[9px]`}>
                    {selectedPedido.status_pedido || 'Nao separado'}
                  </Badge>
                  <Badge className={`${statusEntregaColors[selectedPedido.status_entrega || ''] || 'bg-muted'} border text-[9px]`}>
                    {selectedPedido.status_entrega || 'Pend. Entrega'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="neu-card p-4 rounded-xl">
            <h3 className="font-semibold text-foreground mb-3">Itens do Pedido</h3>
            {(() => {
              const allItems = selectedPedido.pedido_itens || [];

              // Helper: extract base ref from produto_nome and estoque information
              // Returns { refBase: 'SH2603-0004', tamanho: '40', nomeModelo: 'Nome' } or null if avulso
              const parseItem = (item: typeof allItems[number]) => {
                const produtoId = item.produto_id || '';
                const produto = estoqueItens.find(p => p.id === produtoId);

                let refStr = '';
                if (produto) {
                  try {
                    if (produto.localizacao) {
                      const loc = JSON.parse(produto.localizacao);
                      if (loc.referencia) refStr = loc.referencia;
                    }
                  } catch (e) { }
                } else if (item.produto_nome?.includes(' | REF: ')) {
                  refStr = item.produto_nome.split(' | REF: ')[1] || '';
                }

                if (refStr) {
                  // Assume pattern BASE-TAMANHO, e.g. SH2603-0004-40
                  // Matches word characters/hyphens for base, then specific sizes
                  const m = refStr.match(/^(.+)-(P|M|G|GG|G1|G2|G3|XGG|\d{2})$/);
                  if (m) {
                    const refBase = m[1];
                    const tamanho = m[2];

                    let nomeModelo = item.produto_nome || 'Produto';
                    if (produto && produto.nome) nomeModelo = produto.nome;
                    if (nomeModelo.includes(' | REF: ')) nomeModelo = nomeModelo.split(' | REF: ')[0];
                    nomeModelo = nomeModelo.replace(` — ${refStr}`, '').trim();
                    nomeModelo = nomeModelo.replace(/-(PEÇAS)/gi, '').trim();

                    return { refBase, tamanho, nomeModelo };
                  }
                }
                return null;
              };

              // Group items: key = refBase + '|' + valorUnitario
              const gradeGroups = new Map<string, { refBase: string; nomeModelo: string; itens: Array<{ item: typeof allItems[number]; tamanho: string }> }>();
              const avulsosItems: typeof allItems = [];

              allItems.forEach(item => {
                const parsed = parseItem(item);
                if (parsed) {
                  const key = `${parsed.refBase}|${item.valor_unitario}`;
                  if (!gradeGroups.has(key)) {
                    gradeGroups.set(key, { refBase: parsed.refBase, nomeModelo: parsed.nomeModelo, itens: [] });
                  }
                  gradeGroups.get(key)!.itens.push({ item, tamanho: parsed.tamanho });
                } else {
                  avulsosItems.push(item);
                }
              });

              // Only treat as grade if group has 2+ items (a single item with a size ref could be avulso)
              const gradeGroupsFinal: typeof gradeGroups = new Map();
              gradeGroups.forEach((v, k) => {
                if (v.itens.length >= 2) gradeGroupsFinal.set(k, v);
                else avulsosItems.push(v.itens[0].item);
              });

              const hasGrades = gradeGroupsFinal.size > 0;
              const hasAvulsos = avulsosItems.length > 0;

              return (
                <div className="space-y-4">
                  {/* ── Grades ── */}
                  {hasGrades && (
                    <div className="space-y-3">
                      {hasAvulsos && (
                        <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                          Grades
                        </p>
                      )}
                      {Array.from(gradeGroupsFinal.entries()).map(([key, grupo]) => {
                        const totalPecas = grupo.itens.reduce((s, { item }) => s + item.quantidade, 0);
                        const valorUnit = grupo.itens[0].item.valor_unitario;
                        const subtotal = totalPecas * valorUnit;

                        // Sort sizes canonically
                        const ORDEM = ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54'];
                        const itensSorted = [...grupo.itens].sort(
                          (a, b) => ORDEM.indexOf(a.tamanho) - ORDEM.indexOf(b.tamanho)
                        );

                        return (
                          <div key={key} className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/10 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-100/60 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-900/30">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 truncate">
                                  {grupo.nomeModelo}
                                </p>
                                <p className="text-[11px] text-indigo-500/80 font-mono">{grupo.refBase}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-md">
                                  GRADE
                                </span>
                                <span className="text-[11px] font-bold text-emerald-600">
                                  R$ {subtotal.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Tabela de tamanhos */}
                            <div className="px-4 py-3">
                              <div className="overflow-x-auto">
                                <table className="text-center text-xs">
                                  <thead>
                                    <tr>
                                      {itensSorted.map(({ tamanho }) => (
                                        <td key={tamanho} className="pb-1 px-2">
                                          <span className="font-mono font-bold text-muted-foreground text-[11px]">{tamanho}</span>
                                        </td>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      {itensSorted.map(({ item, tamanho }) => (
                                        <td key={tamanho} className="px-2">
                                          <span className="text-sm font-bold text-foreground">{item.quantidade}×</span>
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-2">
                                {totalPecas} peças · R$ {valorUnit.toFixed(2)} un.
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Separador */}
                  {hasGrades && hasAvulsos && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border/50" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avulso</span>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>
                  )}

                  {/* ── Avulsos ── */}
                  {hasAvulsos && (
                    <div className="space-y-0">
                      {avulsosItems.map((item, index) => {
                        const produtoId = item.produto_id || '';
                        const produto = estoqueItens.find(p => p.id === produtoId);
                        let nomeStr = item.produto_nome || 'Produto';
                        let refStr = '';
                        if (produto) {
                          if (produto.nome) nomeStr = produto.nome;
                          try {
                            if (produto.localizacao) {
                              const loc = JSON.parse(produto.localizacao);
                              if (loc.referencia) refStr = loc.referencia;
                            }
                          } catch (e) { }
                        }
                        if (nomeStr.includes(' | REF: ')) {
                          const parts = nomeStr.split(' | REF: ');
                          nomeStr = parts[0];
                          if (!refStr && parts.length > 1) refStr = parts[1];
                        }
                        if (refStr && nomeStr.includes(` — ${refStr}`)) {
                          const tamanho = refStr.split('-').pop();
                          if (tamanho && !/^(PEÇAS)$/i.test(tamanho)) {
                              nomeStr = nomeStr.replace(` — ${refStr}`, ` — ${tamanho}`);
                          } else {
                              nomeStr = nomeStr.replace(` — ${refStr}`, '');
                          }
                        }
                        
                        // Final sanitization
                        nomeStr = nomeStr.replace(/ — Tamanho (PEÇAS)/gi, '');
                        nomeStr = nomeStr.replace(/ — (PEÇAS)/gi, '');                     
                        refStr = refStr.replace(/-(PEÇAS)/gi, '');
                        
                        return (
                          <div key={item.id || index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                            <div>
                              <p className="font-medium text-foreground">{nomeStr}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {refStr && `Ref: ${refStr} · `}{item.quantidade} x {formatCurrency(item.valor_unitario)}
                              </p>
                            </div>
                            <p className="font-bold text-emerald-600">
                              {formatCurrency(item.quantidade * item.valor_unitario)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {allItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum item</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Totals */}
          <div className="neu-card p-4 rounded-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total de Peças */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Total de Peças
                </p>
                <p className="text-2xl font-semibold leading-tight text-primary">
                  {selectedPedido.total_pecas || 0} <span className="text-sm font-normal text-muted-foreground">peças</span>
                </p>
              </div>

              {/* Quantidade de Modelos */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Qtd de Modelos
                </p>
                <p className="text-2xl font-semibold leading-tight text-violet-600">
                  {(() => {
                    const modelosUnicos = new Set(
                      (selectedPedido.pedido_itens || [])
                        .filter(item => item.produto_id)
                        .map(item => item.produto_id)
                    );
                    return modelosUnicos.size;
                  })()} <span className="text-sm font-normal text-muted-foreground">
                    {(() => {
                      const modelosUnicos = new Set(
                        (selectedPedido.pedido_itens || [])
                          .filter(item => item.produto_id)
                          .map(item => item.produto_id)
                      );
                      return modelosUnicos.size === 1 ? 'modelo' : 'modelos';
                    })()}
                  </span>
                </p>
              </div>

              {/* Taxa Excursão (condicional) */}
              {(selectedPedido.taxa_excursao || 0) > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                    Taxa Excursão
                  </p>
                  <p className="text-2xl font-semibold leading-tight text-amber-600">
                    + {formatCurrency(selectedPedido.taxa_excursao || 0)}
                  </p>
                </div>
              )}

              {/* Valor Total */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Valor Total
                </p>
                <p className="text-2xl font-semibold leading-tight text-emerald-600">
                  {formatCurrency(selectedPedido.valor_total || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>}
      </DialogContent>
    </Dialog>

    {/* Edit Pedido Modal */}
    <EditPedidoModalWrapper pedidoId={editingPedidoId} onClose={() => setEditingPedidoId(null)} />

    {/* Import CSV Modal */}
    <ImportPedidosCSVModal open={importModalOpen} onOpenChange={setImportModalOpen} />

    {/* Clear Data Modal */}
    <ClearPedidosDataModal open={clearDataModalOpen} onOpenChange={setClearDataModalOpen} />

    {/* Product Summary Modal */}
    <ProductSummaryModal
      open={summaryModalOpen}
      onOpenChange={setSummaryModalOpen}
      pedidos={pedidosList}
    />
  </div>;
}

// Wrapper component to fetch pedido data for editing
function EditPedidoModalWrapper({
  pedidoId,
  onClose
}: {
  pedidoId: string | null;
  onClose: () => void;
}) {
  const {
    data: pedidoDB,
    isLoading
  } = usePedidoById(pedidoId || undefined);
  if (!pedidoId) return null;

  // Transform data to modal format
  const pedidoData = pedidoDB ? {
    id: pedidoDB.id,
    cliente_nome: pedidoDB.cliente_nome,
    total_pecas: pedidoDB.total_pecas || 0,
    valor_total: pedidoDB.valor_total || 0,
    itens: (pedidoDB.itens || []).map(item => ({
      id: item.id,
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario
    }))
  } : null;
  return <EditPedidoModal pedido={pedidoData} open={!!pedidoId && !isLoading} onClose={onClose} />;
}