import { useState, useMemo } from 'react';
import { Search, Phone, MapPin, Tag, User, Plus, Pencil, FileSpreadsheet, Download, Trash2, AlertTriangle, Users, Receipt, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
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
import { useClientesCRM, getClienteStatus, hasRiskAlert, ClienteCRMStats } from '@/hooks/useClientesCRM';
import { useClientes as useClientesRaw } from '@/hooks/useClientesData';
import { ImportCSVModal } from '@/components/clientes/ImportCSVModal';
import { ClearDataModal } from '@/components/clientes/ClearDataModal';
import { WhatsAppButton } from '@/components/clientes/WhatsAppButton';
import { ClienteSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const emptyCliente = {
  nome: '',
  telefone: '',
  cidade: '',
  estado: '',
  excursao: '',
};

type Ordenacao = 'nome' | 'comprador' | 'ultima' | 'recente';
type FiltroStatus = 'todos' | 'vip' | 'frequente' | 'inativo' | 'risco';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Clientes() {
  const isMobile = useIsMobile();
  const { clientes, isLoading, addCliente, updateCliente, removeCliente } = useClientesContext();
  const { data: clientesDB } = useClientesRaw();
  const { data: crmData, isLoading: crmLoading } = useClientesCRM();
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('nome');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState(emptyCliente);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);

  // Calculate CRM metrics
  const crmMetrics = useMemo(() => {
    return {
      totalClientes: clientes.length,
      ticketMedio: crmData?.metrics.ticketMedio || 0,
      ltvMedio: crmData?.metrics.ltvMedio || 0,
      taxaRetencao: crmData?.metrics.taxaRetencao || 0,
    };
  }, [clientes.length, crmData?.metrics]);

  // Get stats for a specific client
  const getClienteStats = (clienteId: string): ClienteCRMStats | undefined => {
    return crmData?.statsMap.get(clienteId);
  };

  // Filter and sort clients
  const clientesFiltrados = useMemo(() => {
    let filtered = clientes.filter(cliente =>
      cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.telefone.includes(busca) ||
      cliente.cidade.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.excursao.toLowerCase().includes(busca.toLowerCase())
    );

    // Apply status filter
    if (filtroStatus !== 'todos') {
      filtered = filtered.filter(cliente => {
        const stats = getClienteStats(cliente.id);
        const status = getClienteStatus(stats);
        const isRisk = hasRiskAlert(stats);

        switch (filtroStatus) {
          case 'vip':
            return status?.label === 'VIP';
          case 'frequente':
            return status?.label === 'Frequente';
          case 'inativo':
            return status?.label === 'Inativo';
          case 'risco':
            return isRisk;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      const statsA = getClienteStats(a.id);
      const statsB = getClienteStats(b.id);

      switch (ordenacao) {
        case 'comprador':
          return (statsB?.totalComprado || 0) - (statsA?.totalComprado || 0);
        case 'ultima':
          const dateA = statsA?.ultimaCompra?.getTime() || 0;
          const dateB = statsB?.ultimaCompra?.getTime() || 0;
          return dateB - dateA;
        case 'recente':
          // Get created_at from raw DB data
          const clienteDbA = clientesDB?.find(c => c.id === a.id);
          const clienteDbB = clientesDB?.find(c => c.id === b.id);
          const createdA = clienteDbA ? new Date(clienteDbA.created_at).getTime() : 0;
          const createdB = clienteDbB ? new Date(clienteDbB.created_at).getTime() : 0;
          return createdB - createdA; // Most recent first
        case 'nome':
        default:
          return a.nome.localeCompare(b.nome);
      }
    });
  }, [clientes, busca, filtroStatus, ordenacao, crmData, clientesDB]);

  const handleOpenNew = () => {
    setEditingCliente(null);
    setFormData(emptyCliente);
    setModalOpen(true);
  };

  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
      cidade: cliente.cidade,
      estado: cliente.estado,
      excursao: cliente.excursao,
    });
    setModalOpen(true);
  };

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
        telefone: result.data.telefone,
        cidade: result.data.cidade,
        estado: result.data.estado,
        excursao: result.data.excursao,
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

  const handleDeleteClick = (cliente: Cliente) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };

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

  const handleExportCSV = () => {
    if (clientes.length === 0) {
      toast.error('Não há clientes para exportar.');
      return;
    }

    const headers = ['Nome', 'Telefone', 'Cidade', 'Estado', 'Excursão', 'Data Cadastro', 'Hora Cadastro'];
    const csvRows = [
      headers.join(','),
      ...clientes.map(c => {
        // Get the raw created_at from DB data
        const clienteDb = clientesDB?.find(db => db.id === c.id);
        const createdAt = clienteDb ? new Date(clienteDb.created_at) : new Date();
        
        return [
          c.nome, 
          c.telefone, 
          c.cidade, 
          c.estado, 
          c.excursao,
          format(createdAt, 'dd/MM/yyyy'),
          format(createdAt, 'HH:mm:ss')
        ]
          .map(field => `"${(field || '').replace(/"/g, '""')}"`)
          .join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Lista de clientes exportada com sucesso!');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && <MobileHeader title="Clientes" />}
      
      {/* Sidebar - Desktop only */}
      {!isMobile && <AppSidebar />}
      
      <main className={cn(
        "flex-1 p-6 lg:p-8 overflow-auto",
        isMobile && "pt-20 pb-24"
      )}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">Painel CRM - Gerencie sua base de clientes</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button 
              onClick={() => setClearDataModalOpen(true)}
              variant="outline"
              className="h-11 px-5 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <AlertTriangle size={18} className="mr-2" />
              <span className="hidden sm:inline">Limpar Dados</span>
            </Button>
            <Button 
              onClick={handleExportCSV}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-lg"
            >
              <Download size={18} className="mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button 
              onClick={() => setImportModalOpen(true)}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-lg"
            >
              <FileSpreadsheet size={18} className="mr-2" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button 
              onClick={handleOpenNew}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-lg"
            >
              <Plus size={18} className="mr-2" />
              <span className="hidden sm:inline">Novo Cliente</span>
            </Button>
          </div>
        </div>

        {/* Dashboard de Métricas CRM */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 neu-card rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Clientes</p>
                <p className="text-2xl font-bold text-foreground">{crmMetrics.totalClientes.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 neu-card rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(crmMetrics.ticketMedio)}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 neu-card rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LTV Médio</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(crmMetrics.ltvMedio)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Valor médio gerado por cliente ao longo do tempo
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 neu-card rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 text-teal-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Retenção</p>
                <p className="text-2xl font-bold text-foreground">{crmMetrics.taxaRetencao.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clientes que compraram mais de uma vez
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="neu-card p-4 mb-4 rounded-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Buscar por nome, telefone, cidade ou excursão..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-12 pl-12 rounded-xl neu-input border-0 bg-background text-base"
            />
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as Ordenacao)}>
            <SelectTrigger className="w-full sm:w-[200px] h-10 rounded-xl">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
              <SelectItem value="recente">Cadastro (Mais Recente)</SelectItem>
              <SelectItem value="comprador">Maior Comprador</SelectItem>
              <SelectItem value="ultima">Última Compra</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2 flex-wrap">
            {(['todos', 'vip', 'frequente', 'inativo', 'risco'] as FiltroStatus[]).map((filtro) => (
              <Button
                key={filtro}
                size="sm"
                variant={filtroStatus === filtro ? 'default' : 'outline'}
                onClick={() => setFiltroStatus(filtro)}
                className={cn(
                  "rounded-xl h-10 px-4",
                  filtroStatus === filtro && "bg-primary text-primary-foreground"
                )}
              >
                {filtro === 'todos' && 'Todos'}
                {filtro === 'vip' && '⭐ VIP'}
                {filtro === 'frequente' && '🔵 Frequentes'}
                {filtro === 'inativo' && '⚪ Inativos'}
                {filtro === 'risco' && '⚠️ Risco'}
              </Button>
            ))}
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {clientesFiltrados.map((cliente) => {
            const stats = getClienteStats(cliente.id);
            const status = getClienteStatus(stats);
            const isRisk = hasRiskAlert(stats);
            
            return (
              <div
                key={cliente.id}
                className="neu-card p-5 rounded-2xl hover:shadow-neu transition-all duration-200 group relative"
              >
                {/* Status Badge and Risk Alert */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {isRisk && (
                    <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center" title="Histórico de cancelamentos">
                      <AlertTriangle size={14} className="text-destructive" />
                    </div>
                  )}
                  {status && (
                    <Badge className={cn("text-xs px-2 py-0.5", status.color)}>
                      {status.label}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons - Desktop: hover, Mobile: always visible */}
                <div className={cn(
                  "absolute top-12 right-4 flex gap-2 transition-opacity z-50",
                  isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <WhatsAppButton cliente={cliente} stats={stats} />
                  <button
                    onClick={() => handleOpenEdit(cliente)}
                    className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors"
                  >
                    <Pencil size={14} className="text-muted-foreground hover:text-primary" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(cliente)}
                    className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                  </button>
                </div>

                {/* Header do Card */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <User size={24} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 pr-20">
                    <h3 className="font-semibold text-foreground text-lg truncate group-hover:text-primary transition-colors">
                      {cliente.nome}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Cadastrado em {cliente.dataCadastro}
                    </p>
                  </div>
                </div>

                {/* Info do Card */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Phone size={14} className="text-muted-foreground" />
                    </div>
                    <span className="text-foreground">{cliente.telefone}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <MapPin size={14} className="text-muted-foreground" />
                    </div>
                    <span className="text-foreground">
                      {cliente.cidade}, {cliente.estado}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Tag size={14} className="text-muted-foreground" />
                    </div>
                    <span className="text-foreground">
                      Excursão: <span className="font-medium text-primary">{cliente.excursao}</span>
                    </span>
                  </div>
                </div>

                {/* CRM Stats Section */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Comprado:</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                      {formatCurrency(stats?.totalComprado || 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <Calendar size={14} />
                    {stats?.ultimaCompra ? (
                      <>
                        <span>Última Compra ({format(stats.ultimaCompra, "dd/MM/yy")}):</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(stats.ultimoPedidoValor || 0)}
                        </span>
                        {stats.ultimoPedidoStatus && (
                          <Badge 
                            className={cn(
                              "text-xs border-0",
                              stats.ultimoPedidoStatus.toUpperCase() === 'PAGO' 
                                ? "bg-green-100 text-green-700" 
                                : stats.ultimoPedidoStatus.toUpperCase() === 'PENDENTE'
                                ? "bg-yellow-100 text-yellow-700"
                                : stats.ultimoPedidoStatus.toUpperCase() === 'CANCELADO'
                                ? "bg-red-100 text-red-700"
                                : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            {stats.ultimoPedidoStatus}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span>Nenhuma compra registrada</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {clientesFiltrados.length === 0 && (
          <div className="neu-card p-12 rounded-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum cliente encontrado
            </h3>
            <p className="text-muted-foreground">
              Tente ajustar os termos da busca ou os filtros.
            </p>
          </div>
        )}
      </main>

      {/* Modal de Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                placeholder="Nome do cliente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excursao">Excursão</Label>
              <Input
                id="excursao"
                value={formData.excursao}
                onChange={(e) => setFormData(prev => ({ ...prev, excursao: e.target.value }))}
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                placeholder="Nome da excursão"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="flex-1 h-11 rounded-xl border-0 text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
              >
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
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
