import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Search, Phone, MapPin, Tag, User, Plus, Pencil, FileSpreadsheet, Download, Trash2, AlertTriangle, Users, Receipt, TrendingUp, Calendar, RefreshCw, ChevronLeft, ChevronRight, ChevronsUpDown, Check, CheckCircle2, PhoneCall, MessageCircle, MessageSquarePlus, Send, Loader2 } from 'lucide-react';
import { useExcursoesAtivas } from '@/hooks/useExcursoes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useClientesContext, Cliente } from '@/contexts/ClientesContext';
import { useClientesCRM } from '@/hooks/useClientesCRM';
import { useClientesPaginated, ClientePaginatedDB } from '@/hooks/useClientesPaginated';
import { useClientesCRMBatch, useClientesCRMFilter, getClienteStatusFromStats, hasRiskAlertFromStats, ClienteCRMBatchStats } from '@/hooks/useClientesCRMBatch';
import { ImportCSVModal } from '@/components/clientes/ImportCSVModal';
import { ClearDataModal } from '@/components/clientes/ClearDataModal';
import { WhatsAppButton } from '@/components/clientes/WhatsAppButton';
import { ClienteGridSkeleton } from '@/components/clientes/ClienteCardSkeleton';
import { ClienteSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useClienteContatos, CanalContato } from '@/hooks/useClienteContatos';
import { calcularPrioridade, PrioridadeNivel } from '@/hooks/useClientePrioridade';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeedbackModal } from '@/components/clientes/FeedbackModal';

const emptyCliente = {
  nome: '',
  telefone: '',
  cidade: '',
  estado: '',
  excursao: ''
};
type Ordenacao = 'nome' | 'recente' | 'maior_historico';
type FiltroStatus = 'todos' | 'vip' | 'frequente' | 'risco' | 'pendente' | 'sem_compras' | 'novos';
const PAGE_SIZE = 24;
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatPhone(phone: string): string {
  if (!phone) return '';
  // Remover tudo que não for número
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

// localStorage state persistence
const CLIENTES_STATE_KEY = 'clientes_state';

function loadClientesState() {
  try {
    const raw = localStorage.getItem(CLIENTES_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      filtroStatus: FiltroStatus;
      ordenacao: Ordenacao;
      currentPage: number;
      busca: string;
      subFiltroInativo?: 'critico' | 'alerta' | null;
    };
  } catch {
    return null;
  }
}

// Memoized client card component for performance
const ClienteCard = memo(function ClienteCard({
  cliente,
  stats,
  isMobile,
  onEdit,
  onDelete,
  prioridadeNivel,
  showPrioridade,
  contatoInfo,
  onMarcarContato,
  onWhatsAppEnviado,
  isPendenteFilter,
}: {
  cliente: ClientePaginatedDB;
  stats: ClienteCRMBatchStats | undefined;
  isMobile: boolean;
  onEdit: (cliente: ClientePaginatedDB) => void;
  onDelete: (cliente: ClientePaginatedDB) => void;
  prioridadeNivel?: PrioridadeNivel;
  showPrioridade?: boolean;
  contatoInfo?: { data: string; canal: string } | null;
  onMarcarContato?: (clienteId: string, canal: CanalContato) => void;
  onWhatsAppEnviado?: () => void;
  isPendenteFilter?: boolean;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const status = getClienteStatusFromStats(stats);
  const isRisk = hasRiskAlertFromStats(stats);
  const dataCadastro = format(new Date(cliente.created_at), "dd/MM/yyyy");

  // Contact days ago
  const diasDesdeContato = contatoInfo
    ? differenceInDays(new Date(), new Date(contatoInfo.data))
    : null;

  // Priority border color (only when showPrioridade)
  const borderClass = showPrioridade && prioridadeNivel === 'alta'
    ? 'border-l-4 border-l-destructive'
    : showPrioridade && prioridadeNivel === 'media'
      ? 'border-l-4 border-l-yellow-500'
      : '';

  // Inativo rules & Ex-VIP
  const diasSemComprar = stats?.ultimaCompra
    ? differenceInDays(new Date(), new Date(stats.ultimaCompra))
    : Infinity;

  const isInativo = status?.label === 'Inativo';
  const isExVip = isInativo && (stats?.totalComprado || 0) >= 5000;

  let inativoColorClass = status?.color;
  if (isInativo) {
    if (diasSemComprar >= 40 && diasSemComprar !== Infinity) {
      inativoColorClass = 'bg-red-800 text-white border-red-800'; // Vermelho Escuro
    } else if (diasSemComprar >= 25 && diasSemComprar < 40) {
      inativoColorClass = 'bg-orange-500 text-white border-orange-500'; // Laranja
    }
  }

  // Convert to Cliente format for WhatsAppButton
  const clienteForWhatsApp: Cliente = {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    cidade: cliente.cidade,
    estado: cliente.estado,
    excursao: cliente.excursao,
    dataCadastro,
    isNovo: differenceInDays(new Date(), new Date(cliente.created_at)) < 7
  };

  const statsForWhatsApp = stats ? { ...stats, clienteId: stats.clienteId } : undefined;

  return (
    <div className={cn("neu-card p-4 sm:p-5 rounded-2xl hover:shadow-neu transition-all duration-200 group flex flex-col h-full", borderClass)}>
      {/* Topo: Avatar, Nome, Data e Badges */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <User size={24} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-foreground text-lg truncate group-hover:text-primary transition-colors">
              {cliente.nome}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              Cadastrado em {dataCadastro}
            </p>
          </div>
        </div>

        {/* Status Badges - Reposicionado da absolute para o fluxo natural */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {diasDesdeContato !== null && diasDesdeContato < 30 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={10} className="mr-1" />
                {diasDesdeContato === 0 ? 'Hoje' : `Há ${diasDesdeContato}d`}
              </Badge>
            )}
            {showPrioridade && prioridadeNivel === 'alta' && (
              <Badge className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-0">
                Alta
              </Badge>
            )}
            {showPrioridade && prioridadeNivel === 'media' && (
              <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-0">
                Média
              </Badge>
            )}
            {isRisk && (
              <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center" title="Histórico de cancelamentos">
                <AlertTriangle size={12} className="text-destructive" />
              </div>
            )}
            {isExVip && (
              <Badge className="text-[10px] px-1.5 py-0.5 whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white border-0" title="Foi VIP no passado (> R$ 5.000)">
                Ex-VIP
              </Badge>
            )}
            {status && (
              <Badge className={cn("text-[10px] px-1.5 py-0.5 whitespace-nowrap", isInativo ? inativoColorClass : status.color)}>
                {status.label}
              </Badge>
            )}
            {clienteForWhatsApp.isNovo && (
              <Badge className="text-[10px] px-1.5 py-0.5 whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm animate-pulse">
                NOVO
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Ações: Div dedicada abaixo do nome com gap-4 */}
      <div className="flex items-center gap-2 sm:gap-4 mb-5 border-b border-border/40 pb-4">
        <div className="flex items-center">
          <WhatsAppButton cliente={clienteForWhatsApp} stats={statsForWhatsApp} onContatoRegistrado={onWhatsAppEnviado} />
        </div>
        {cliente.telefone && (
          <a
            href={`tel:${cliente.telefone.replace(/\D/g, '')}`}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-colors flex-shrink-0"
            title="Ligar"
          >
            <PhoneCall size={14} className="text-blue-500" />
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center transition-colors flex-shrink-0"
              title="Marcar como contatado"
            >
              <CheckCircle2 size={14} className="text-emerald-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => onMarcarContato?.(cliente.id, 'whatsapp')} className="cursor-pointer">
              <MessageCircle size={14} className="mr-2 text-[#25D366]" /> WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMarcarContato?.(cliente.id, 'ligacao')} className="cursor-pointer">
              <PhoneCall size={14} className="mr-2 text-blue-500" /> Ligação
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMarcarContato?.(cliente.id, 'outro')} className="cursor-pointer">
              <CheckCircle2 size={14} className="mr-2 text-muted-foreground" /> Outro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" /> {/* Empurra os próximos pra direita */}

        <button onClick={() => onEdit(cliente)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors flex-shrink-0">
          <Pencil size={14} className="text-muted-foreground hover:text-primary" />
        </button>
        <button onClick={() => onDelete(cliente)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors flex-shrink-0">
          <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* Botão de Feedback para Inativos */}
      {isInativo && (
        <div className="mb-4">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="w-full h-8 sm:h-9 rounded-xl border border-dashed border-orange-300 dark:border-orange-800/30 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquarePlus size={14} />
            Registrar Feedback
          </button>
        </div>
      )}

      {/* Corpo (Info): Lista limpa com truncate garantido */}
      <div className="space-y-3 flex-1 mb-4">
        <div className="flex items-center gap-3 text-sm">
          <div className="w-7 h-7 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0">
            <Phone size={13} className="text-muted-foreground" />
          </div>
          <span className="text-foreground truncate">{formatPhone(cliente.telefone) || 'Não informado'}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="w-7 h-7 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0">
            <MapPin size={13} className="text-muted-foreground" />
          </div>
          <span className="text-foreground truncate">
            {cliente.cidade || cliente.estado ? `${cliente.cidade || ''}${cliente.cidade && cliente.estado ? ', ' : ''}${cliente.estado || ''}` : 'Não informado'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="w-7 h-7 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0">
            <Tag size={13} className="text-muted-foreground" />
          </div>
          <span className="text-foreground truncate">
            Excursão: <span className="font-medium text-primary ml-1">{cliente.excursao || 'Não informada'}</span>
          </span>
        </div>
      </div>

      {/* Rodapé (Finanças): Dois blocos lado a lado com cores suaves */}
      <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-border">
        {/* Bloco 1: Total Comprado */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-center">
          <span className="text-[11px] font-medium text-emerald-800/70 dark:text-emerald-300/70 mb-0.5 uppercase tracking-wider">Total Comprado</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm truncate">
            {formatCurrency(stats?.totalComprado || 0)}
          </span>
        </div>

        {/* Bloco 2: Última Compra ou Pendência */}
        {isPendenteFilter && stats?.ultimoPedidoPendenteData ? (
          <div className="bg-orange-50/60 dark:bg-orange-950/20 p-3 rounded-xl border border-orange-100 dark:border-orange-900/30 flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <AlertTriangle size={11} className="text-orange-600 dark:text-orange-400" />
              <span className="text-[11px] font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wider truncate">Pedido Pendente</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-orange-700 dark:text-orange-400 text-sm truncate leading-none">
                {formatCurrency(stats.ultimoPedidoPendenteValor || 0)}
              </span>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <span className="text-[10px] text-muted-foreground truncate">{format(stats.ultimoPedidoPendenteData, "dd/MM/yy")}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-sm font-semibold truncate bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
                  PENDENTE
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50/60 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Calendar size={11} className="text-blue-800/70 dark:text-blue-300/70" />
              <span className="text-[11px] font-medium text-blue-800/70 dark:text-blue-300/70 uppercase tracking-wider truncate">Última Compra</span>
            </div>
            {stats?.ultimaCompra ? (
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-blue-700 dark:text-blue-400 text-sm truncate leading-none">
                  {formatCurrency(stats.ultimoPedidoValor || 0)}
                </span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground truncate">{format(stats.ultimaCompra, "dd/MM/yy")}</span>
                  {stats.ultimoPedidoStatus && (
                    <span className={cn("text-[8px] px-1.5 py-0.5 rounded-sm font-semibold truncate",
                      stats.ultimoPedidoStatus.toUpperCase() === 'PAGO' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" :
                        stats.ultimoPedidoStatus.toUpperCase() === 'PENDENTE' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400" :
                          stats.ultimoPedidoStatus.toUpperCase() === 'CANCELADO' ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400" :
                            "bg-secondary text-secondary-foreground"
                    )}>
                      {stats.ultimoPedidoStatus}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground italic truncate mt-1">Nenhuma compra</span>
            )}
          </div>
        )}
      </div>

      <FeedbackModal
        clienteId={cliente.id}
        clienteNome={cliente.nome}
        isOpen={feedbackOpen}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
});
export default function Clientes() {
  const isMobile = useIsMobile();
  const {
    user
  } = useAuth();
  const {
    addCliente,
    updateCliente,
    removeCliente
  } = useClientesContext();
  const {
    data: crmData
  } = useClientesCRM();

  // localStorage state persistence
  const savedState = useMemo(() => loadClientesState(), []);
  const [currentPage, setCurrentPage] = useState(savedState?.currentPage || 0);
  const [busca, setBusca] = useState(savedState?.busca || '');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(savedState?.ordenacao || 'nome');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>(savedState?.filtroStatus || 'todos');

  // Contact markers
  const { contatosMap, marcarContato, getContato } = useClienteContatos();

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(CLIENTES_STATE_KEY, JSON.stringify({
      filtroStatus,
      ordenacao,
      currentPage,
      busca,
    }));
  }, [filtroStatus, ordenacao, currentPage, busca]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ClientePaginatedDB | null>(null);
  const [formData, setFormData] = useState(emptyCliente);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<ClientePaginatedDB | null>(null);
  const [excursaoPopoverOpen, setExcursaoPopoverOpen] = useState(false);

  const { data: excursoesAtivas } = useExcursoesAtivas();

  const crmFilterStatus = filtroStatus !== 'todos' ? filtroStatus : null;
  const {
    data: crmFilterIds,
    isLoading: crmFilterLoading
  } = useClientesCRMFilter(crmFilterStatus, ordenacao === 'maior_historico' ? 'maior_historico' : undefined);

  // Paginated query - now with filterByIds for CRM filters (filter BEFORE pagination)
  const {
    data: paginatedData,
    isLoading: paginatedLoading,
    isFetching
  } = useClientesPaginated({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: busca,
    ordenacao,
    filterByIds: filtroStatus !== 'todos' ? crmFilterIds : null
  });

  const rawClientes = paginatedData?.data || [];

  // Get IDs of visible clients for batch CRM stats
  const visibleClienteIds = useMemo(() => {
    return rawClientes.map(c => c.id);
  }, [rawClientes]);

  // Fetch CRM stats only for visible clients
  const {
    data: crmBatchStats,
    isLoading: crmBatchLoading
  } = useClientesCRMBatch(visibleClienteIds);

  // Calculate CRM metrics from global data
  const crmMetrics = useMemo(() => {
    return {
      totalClientes: paginatedData?.count || 0,
      ticketMedio: crmData?.metrics.ticketMedio || 0,
      ltvMedio: crmData?.metrics.ltvMedio || 0,
      taxaRetencao: crmData?.metrics.taxaRetencao || 0
    };
  }, [paginatedData?.count, crmData?.metrics]);

  // Get stats for a specific client
  const getClienteStats = useCallback((clienteId: string): ClienteCRMBatchStats | undefined => {
    return crmBatchStats?.get(clienteId);
  }, [crmBatchStats]);

  // Reset to page 0 when filters change
  const handleSearchChange = useCallback((value: string) => {
    setBusca(value);
    setCurrentPage(0);
  }, []);
  const handleFiltroChange = useCallback((filtro: FiltroStatus) => {
    setFiltroStatus(filtro);
    setCurrentPage(0);
  }, []);
  const handleOrdenacaoChange = useCallback((ord: Ordenacao) => {
    setOrdenacao(ord);
    setCurrentPage(0);
  }, []);
  const handleOpenNew = useCallback(() => {
    setEditingCliente(null);
    setFormData(emptyCliente);
    setModalOpen(true);
  }, []);
  const handleOpenEdit = useCallback((cliente: ClientePaginatedDB) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: formatPhone(cliente.telefone),
      cidade: cliente.cidade,
      estado: cliente.estado,
      excursao: cliente.excursao
    });
    setModalOpen(true);
  }, []);
  const handleSave = async () => {
    const result = ClienteSchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.errors[0]?.message || 'Dados inválidos';
      toast.error(firstError);
      return;
    }
    try {
      const validData = {
        nome: result.data.nome,
        telefone: result.data.telefone.replace(/\D/g, ''),
        cidade: result.data.cidade,
        estado: result.data.estado,
        excursao: result.data.excursao
      };
      if (editingCliente) {
        await updateCliente(editingCliente.id, validData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await addCliente(validData);
        toast.success('Cliente cadastrado com sucesso!');
      }
      setModalOpen(false);
      setFormData(emptyCliente);
      setEditingCliente(null);
    } catch (error) {
      toast.error('Erro ao salvar cliente');
    }
  };
  const handleDeleteClick = useCallback((cliente: ClientePaginatedDB) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  }, []);
  const handleConfirmDelete = async () => {
    if (clienteToDelete) {
      try {
        await removeCliente(clienteToDelete.id);
        toast.success('Cliente removido com sucesso!');
        setDeleteDialogOpen(false);
        setClienteToDelete(null);
      } catch (error) {
        toast.error('Erro ao remover cliente');
      }
    }
  };
  const handleExportCSV = async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado.');
      return;
    }
    try {
      // Fetch all clients for export (paginated internally)
      let allClientes: ClientePaginatedDB[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const {
          data,
          error
        } = await supabase.from('clientes').select('id, nome, telefone, cidade, estado, excursao, created_at, user_id').eq('user_id', user.id).order('nome').range(from, from + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allClientes = [...allClientes, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      if (allClientes.length === 0) {
        toast.error('Não há clientes para exportar.');
        return;
      }
      const headers = ['Nome', 'Telefone', 'Cidade', 'Estado', 'Excursão', 'Data Cadastro', 'Hora Cadastro'];
      const csvRows = [headers.join(','), ...allClientes.map(c => {
        const createdAt = new Date(c.created_at);
        return [c.nome, c.telefone, c.cidade, c.estado, c.excursao, format(createdAt, 'dd/MM/yyyy'), format(createdAt, 'HH:mm:ss')].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',');
      })];
      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Lista de clientes exportada com sucesso!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar clientes.');
    }
  };


  // Pagination info
  const totalCount = paginatedData?.count || 0;
  const totalPages = paginatedData?.totalPages || 1;
  const fromItem = totalCount === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const toItem = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);
  const isLoading = paginatedLoading || filtroStatus !== 'todos' && crmFilterLoading;
  return <div className="flex min-h-screen bg-background">
    {/* Mobile Header */}
    {isMobile && <MobileHeader title="Clientes" />}

    {/* Sidebar - Desktop only */}
    {!isMobile && <AppSidebar />}

    <main className={cn("flex-1 p-4 sm:p-6 lg:p-8 overflow-auto", isMobile && "pt-20 pb-28")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">CLIENTES</h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">Painel CRM - Gerencie sua base de clientes</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <Button onClick={() => setClearDataModalOpen(true)} variant="outline" size="icon" className="h-10 w-10 sm:h-11 sm:w-auto sm:px-4 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors" title="Limpar Dados">
              <AlertTriangle size={18} />
              <span className="hidden sm:inline ml-2">Limpar</span>
            </Button>
            <Button onClick={handleExportCSV} variant="outline" size="icon" className="h-10 w-10 sm:h-11 sm:w-auto sm:px-4 rounded-xl border-border bg-background hover:bg-muted/50 text-foreground transition-colors" title="Exportar">
              <Download size={18} />
              <span className="hidden sm:inline ml-2">Exportar</span>
            </Button>
            <Button onClick={() => setImportModalOpen(true)} className="h-10 px-4 sm:h-11 sm:px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-lg">
              <FileSpreadsheet size={18} className="sm:mr-2" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button onClick={handleOpenNew} className="h-10 px-4 sm:h-11 sm:px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-lg">
              <Plus size={18} className="sm:mr-2" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard de Métricas CRM */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-3 sm:p-4 neu-card rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Clientes</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{crmMetrics.totalClientes.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 neu-card rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Ticket Médio</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{formatCurrency(crmMetrics.ticketMedio)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 neu-card rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">LTV Médio</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{formatCurrency(crmMetrics.ltvMedio)}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 leading-tight hidden xs:block">
                Valor médio acumulado
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 neu-card rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 text-teal-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Taxa Retenção</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{crmMetrics.taxaRetencao.toFixed(1)}%</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 leading-tight hidden xs:block">
                Recompras
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="neu-card p-4 mb-4 rounded-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input placeholder="Buscar por nome, telefone, cidade ou excursão..." value={busca} onChange={e => handleSearchChange(e.target.value)} className="h-12 pl-12 rounded-xl neu-input border-0 bg-background text-base" />
          {isFetching && <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>}
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={ordenacao} onValueChange={v => handleOrdenacaoChange(v as Ordenacao)}>
          <SelectTrigger className="w-full sm:w-[200px] h-10 rounded-xl">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Nome (A-Z)</SelectItem>
            <SelectItem value="recente">Cadastro (Mais Recente)</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar scroll-smooth">
          {(['todos', 'novos', 'vip', 'frequente', 'risco', 'pendente', 'sem_compras'] as FiltroStatus[]).map(filtro => <Button key={filtro} size="sm" variant={filtroStatus === filtro ? 'default' : 'outline'} onClick={() => handleFiltroChange(filtro)} className={cn("rounded-xl h-9 px-3 whitespace-nowrap text-xs sm:text-sm flex-shrink-0 transition-all", filtroStatus === filtro ? "bg-primary text-primary-foreground shadow-md" : "border-border hover:bg-muted/50", (filtro === 'pendente' || filtro === 'novos') && filtroStatus !== filtro && "border-yellow-400/50 text-yellow-700 bg-yellow-50/30")}>
            {filtro === 'todos' && 'Todos'}
            {filtro === 'novos' && '🎈 Novos'}
            {filtro === 'vip' && '⭐ VIP'}
            {filtro === 'frequente' && '🔵 Frequentes'}
            {filtro === 'risco' && '⚠️ Risco'}
            {filtro === 'pendente' && '🟡 Pendentes'}
            {filtro === 'sem_compras' && '👤 Sem Compras'}
          </Button>)}
        </div>
      </div>

      {/* Pagination Info */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {totalCount > 0 ? <>Mostrando <span className="font-medium text-foreground">{fromItem}-{toItem}</span> de <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> clientes</> : 'Nenhum cliente encontrado'}
        </span>

        {totalPages > 1 && <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0 || isLoading} className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl border-border bg-background">
            <ChevronLeft size={16} />
            <span className="hidden xs:inline ml-1">Anterior</span>
          </Button>
          <div className="flex items-center justify-center px-1 min-w-[60px] sm:min-w-[80px]">
            <span className="text-[11px] sm:text-sm font-medium text-foreground">
              {currentPage + 1} <span className="text-muted-foreground font-normal mx-0.5">/</span> {totalPages}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1 || isLoading} className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl border-border bg-background">
            <span className="hidden xs:inline mr-1">Próxima</span>
            <ChevronRight size={16} />
          </Button>
        </div>}
      </div>

      {/* Clients Grid */}
      {isLoading ? <ClienteGridSkeleton count={PAGE_SIZE} /> : rawClientes.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {rawClientes.map(cliente => {
          const stats = getClienteStats(cliente.id);
          const contato = getContato(cliente.id);
          const prio = calcularPrioridade(stats, contato);
          return (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              stats={stats}
              isMobile={isMobile}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteClick}
              prioridadeNivel={prio.nivel}
              showPrioridade={false}
              contatoInfo={contato}
              onMarcarContato={marcarContato}
              onWhatsAppEnviado={() => marcarContato(cliente.id, 'whatsapp')}
              isPendenteFilter={filtroStatus === 'pendente'}
            />
          );
        })}
      </div> : <div className="neu-card p-12 rounded-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
          <User size={32} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Nenhum cliente encontrado
        </h3>
        <p className="text-muted-foreground">
          Tente ajustar os termos da busca ou os filtros.
        </p>
      </div>}

      {/* Bottom Pagination */}
      {totalPages > 1 && !isLoading && <div className="flex items-center justify-center gap-2 mt-6">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="h-9 px-3 rounded-xl">
          <ChevronLeft size={16} className="mr-1" />
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground px-4">
          Página {currentPage + 1} de {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} className="h-9 px-3 rounded-xl">
          Próxima
          <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>}
    </main>

    {/* Modal de Criar/Editar */}
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="sm:max-w-[450px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={formData.nome} onChange={e => setFormData(prev => ({
              ...prev,
              nome: e.target.value
            }))} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" placeholder="Nome do cliente" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={formData.telefone} onChange={e => setFormData(prev => ({
              ...prev,
              telefone: formatPhone(e.target.value)
            }))} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" placeholder="(00) 00000-0000" maxLength={15} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={formData.cidade} onChange={e => setFormData(prev => ({
                ...prev,
                cidade: e.target.value
              }))} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" placeholder="Cidade" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" value={formData.estado} onChange={e => setFormData(prev => ({
                ...prev,
                estado: e.target.value
              }))} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" placeholder="UF" maxLength={2} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Excursão</Label>
            <Popover open={excursaoPopoverOpen} onOpenChange={setExcursaoPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={excursaoPopoverOpen} className="w-full justify-between font-normal shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0 h-10 overflow-hidden">
                  <span className="truncate block max-w-[calc(100%-2rem)]">
                    {formData.excursao || <span className="text-muted-foreground">Selecione a excursão</span>}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 overflow-hidden" align="start">
                <Command>
                  <CommandInput placeholder="Buscar excursão..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma excursão encontrada</CommandEmpty>
                    {(excursoesAtivas || []).map(exc => (
                      <CommandItem key={exc.id} value={exc.nome} onSelect={() => {
                        setFormData(prev => ({ ...prev, excursao: exc.nome }));
                        setExcursaoPopoverOpen(false);
                      }} className="flex items-center">
                        <Check className={cn("mr-2 h-4 w-4 shrink-0", formData.excursao === exc.nome ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1 truncate">{exc.nome}</span>
                        <span className="text-xs text-emerald-600 font-semibold ml-2 shrink-0">
                          {exc.taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.excursao && (() => {
              const taxa = excursoesAtivas?.find(e => e.nome === formData.excursao)?.taxa;
              return taxa != null ? (
                <p className="text-sm text-emerald-600 font-medium mt-1">
                  Taxa: {taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              ) : null;
            })()}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 h-11 rounded-xl border-0 text-muted-foreground hover:text-foreground">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground">
              {editingCliente ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal de Importação CSV */}
    <ImportCSVModal open={importModalOpen} onOpenChange={setImportModalOpen} />

    {/* Modal de Limpar Dados */}
    <ClearDataModal open={clearDataModalOpen} onOpenChange={setClearDataModalOpen} />

    {/* Modal de Confirmação de Exclusão */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent className="sm:max-w-[400px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Confirmar Exclusão</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Tem certeza que deseja excluir o cliente <span className="font-semibold text-foreground">{clienteToDelete?.nome}</span>? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 rounded-xl border-0 text-muted-foreground hover:text-foreground">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDelete} className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>


    {/* Bottom Navigation */}
    <BottomNavigation />
  </div>;
}