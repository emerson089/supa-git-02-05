import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { ClienteInfoCard } from '@/components/pedidos/ClienteInfoCard';
import { ClienteInsightsCard } from '@/components/pedidos/ClienteInsightsCard';
import { 
  statusPagamentoOptions, 
  statusPedidoOptions, 
  statusEntregaOptions
} from '@/components/pedidos/StatusSelector';
import { ItensPedidoCard } from '@/components/pedidos/ItensPedidoCard';
import { ItemPedido } from '@/components/pedidos/ItemPedidoRow';
import { ResumoCard } from '@/components/pedidos/ResumoCard';
import { toast } from 'sonner';
import { useClientesContext } from '@/contexts/ClientesContext';
import { usePedidos } from '@/contexts/PedidosContext';
import { useEstoque } from '@/contexts/EstoqueContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ClienteSchema, PedidoItemSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'novo-pedido-draft';

const NovoPedido = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { clientes, addCliente, getClienteById } = useClientesContext();
  const { addPedido } = usePedidos();
  const { getProdutosAcabados, deduzirEstoque, getItemById, updateItem } = useEstoque();

  // Cliente info
  const [clienteId, setClienteId] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [telefone, setTelefone] = useState('');
  const [excursao, setExcursao] = useState('');

  // Status - valores fixos, não editáveis na UI
  const statusPagamento = 'PENDENTE';
  const statusPedido = 'NÃO SEPARADO';
  const statusEntrega = 'NÃO ENTREGUE';

  // Items
  const [items, setItems] = useState<ItemPedido[]>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);

  // Flag para indicar se já carregou do localStorage
  const [isInitialized, setIsInitialized] = useState(false);

  // Carregar dados do localStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.clienteId) setClienteId(data.clienteId);
        if (data.cidade) setCidade(data.cidade);
        if (data.estado) setEstado(data.estado);
        if (data.telefone) setTelefone(data.telefone);
        if (data.excursao) setExcursao(data.excursao);
        if (data.items && Array.isArray(data.items)) setItems(data.items);
      } catch (e) {
        // Ignorar erro de parse
      }
    }
    setIsInitialized(true);
  }, []);

  // Salvar automaticamente quando dados mudam (após inicialização)
  useEffect(() => {
    if (!isInitialized) return;
    const data = { clienteId, cidade, estado, telefone, excursao, items };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [clienteId, cidade, estado, telefone, excursao, items, isInitialized]);

  // Função para limpar o rascunho
  const clearDraft = () => localStorage.removeItem(STORAGE_KEY);

  // Loading
  const [isLoading, setIsLoading] = useState(false);

  // Add Cliente Modal
  const [showAddCliente, setShowAddCliente] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', cidade: '', estado: '', excursao: '' });

  // Calculate totals
  const totalPecas = items.reduce((sum, item) => sum + item.quantidade, 0);
  const valorTotal = items.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0);

  // Verificar se há estoque insuficiente em algum item
  const hasEstoqueInsuficiente = useMemo(() => {
    const produtosAcabados = getProdutosAcabados();
    return items.some(item => {
      if (!item.produtoId) return false;
      const produto = produtosAcabados.find(p => p.id === item.produtoId);
      if (!produto) return false;
      return item.quantidade > produto.quantidade;
    });
  }, [items, getProdutosAcabados]);

  // Item handlers
  const handleAddItem = useCallback(() => {
    const newId = crypto.randomUUID();
    const newItem: ItemPedido = {
      id: newId,
      produtoId: '',
      quantidade: 1,
      valorUnitario: 0,
    };
    setItems(prev => [newItem, ...prev]); // Inserir no topo
    setNewItemId(newId); // Marcar para auto-focus
  }, []);

  const handleUpdateItem = useCallback((updatedItem: ItemPedido) => {
    setItems(prev => prev.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Form actions
  const handleLimpar = () => {
    setClienteId('');
    setCidade('');
    setEstado('');
    setTelefone('');
    setExcursao('');
    setItems([]);
    clearDraft();
    toast.success('Formulário limpo');
  };

  const handleCriarPedido = async () => {
    // Validações
    if (!clienteId) {
      toast.error('Selecione um cliente');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }
    // Validate each item with Zod schema
    for (const item of items) {
      const result = PedidoItemSchema.safeParse({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario
      });
      if (!result.success) {
        const firstError = result.error.errors[0]?.message || 'Dados inválidos';
        toast.error(`Item inválido: ${firstError}`);
        return;
      }
    }
    
    // Validar estoque
    if (hasEstoqueInsuficiente) {
      toast.error('Estoque insuficiente para um ou mais itens');
      return;
    }

    setIsLoading(true);
    try {
      const cliente = getClienteById(clienteId);
      
      // Mapear itens para incluir nome do produto
      const itensFormatados = items.map(item => ({
        id: item.id,
        produtoId: item.produtoId,
        produtoNome: item.produtoNome || 'Produto',
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
      }));

      // Subtrair do estoque
      for (const item of items) {
        const produto = getItemById(item.produtoId);
        if (produto) {
          const novaQuantidade = produto.quantidade - item.quantidade;
          updateItem(item.produtoId, { 
            quantidade: novaQuantidade
          });
        }
      }

      // Criar pedido no contexto - usando labels em maiúsculo para matching de cores
      const getLabel = (value: string, options: { value: string; label: string }[]) => 
        options.find(opt => opt.value === value)?.label || value;

      await addPedido({
        clienteId,
        clienteNome: cliente?.nome || 'Cliente',
        cidade: cidade || cliente?.cidade || '',
        estado: estado || cliente?.estado || '',
        telefone: telefone || cliente?.telefone || '',
        excursao: excursao || cliente?.excursao || '',
        status: getLabel(statusPedido, statusPedidoOptions),
        statusPagamento: getLabel(statusPagamento, statusPagamentoOptions),
        statusPedido: getLabel(statusPedido, statusPedidoOptions),
        statusEntrega: getLabel(statusEntrega, statusEntregaOptions),
        formaPagamento: getLabel(statusPagamento, statusPagamentoOptions),
        observacoes: '',
        itens: itensFormatados,
        totalPecas,
        valorTotal,
      });

      toast.success('Pedido cadastrado com sucesso! Estoque atualizado.');
      clearDraft();
      handleLimpar();
      
      // Redirecionar para página de pedidos criados
      navigate('/pedidos/criados');
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toast.error('Erro ao criar pedido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCliente = () => {
    setShowAddCliente(true);
  };

  const handleSaveNovoCliente = async () => {
    // Validate with Zod schema
    const result = ClienteSchema.safeParse(novoCliente);
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
      const cliente = await addCliente(validData);
      toast.success(`Cliente "${validData.nome}" cadastrado com sucesso!`);
      
      // Auto-select the new client
      setClienteId(cliente.id);
      setCidade(cliente.cidade);
      setEstado(cliente.estado);
      setTelefone(cliente.telefone);
      setExcursao(cliente.excursao);
      
      setShowAddCliente(false);
      setNovoCliente({ nome: '', telefone: '', cidade: '', estado: '', excursao: '' });
    } catch (error) {
      toast.error('Erro ao cadastrar cliente');
    }
  };

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Mobile Header */}
      {isMobile && <MobileHeader title="Novo Pedido" />}
      
      {/* Sidebar */}
      {!isMobile && <AppSidebar />}

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden",
        isMobile && "pt-14 pb-20"
      )}>
        {/* Header - Desktop only */}
        {!isMobile && (
          <header className="px-8 py-6 flex-shrink-0">
            <h1 className="text-2xl font-bold text-foreground">Novo Pedido</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre pedidos vinculados a clientes e estoque
            </p>
          </header>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="max-w-5xl space-y-8">
            {/* Cliente Info Card */}
            <ClienteInfoCard
              clienteId={clienteId}
              cidade={cidade}
              estado={estado}
              telefone={telefone}
              excursao={excursao}
              onClienteChange={setClienteId}
              onCidadeChange={setCidade}
              onEstadoChange={setEstado}
              onTelefoneChange={setTelefone}
              onExcursaoChange={setExcursao}
              onAddCliente={handleAddCliente}
            />

            {/* Insights do Cliente - Apenas para consulta interna */}
            <ClienteInsightsCard clienteId={clienteId} />

            {/* Status padrão: PENDENTE, NÃO SEPARADO, NÃO ENTREGUE - configurável apenas ao editar pedido */}

            {/* Items Card */}
            <ItensPedidoCard
              items={items}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveItem}
              newItemId={newItemId}
              onNewItemFocused={() => setNewItemId(null)}
            />

            {/* Resumo Card */}
            <ResumoCard
              totalPecas={totalPecas}
              valorTotal={valorTotal}
              onLimpar={handleLimpar}
              onCriarPedido={handleCriarPedido}
              isLoading={isLoading}
              disabled={hasEstoqueInsuficiente}
            />
          </div>
        </div>
      </main>

      {/* Add Cliente Modal */}
      <Dialog open={showAddCliente} onOpenChange={setShowAddCliente}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Novo Cliente</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Cadastre um novo cliente rapidamente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="novo-nome">Nome</Label>
              <Input
                id="novo-nome"
                value={novoCliente.nome}
                onChange={(e) => setNovoCliente(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do cliente"
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-telefone">Telefone</Label>
              <Input
                id="novo-telefone"
                value={novoCliente.telefone}
                onChange={(e) => setNovoCliente(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="novo-cidade">Cidade</Label>
                <Input
                  id="novo-cidade"
                  value={novoCliente.cidade}
                  onChange={(e) => setNovoCliente(prev => ({ ...prev, cidade: e.target.value }))}
                  placeholder="Cidade"
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-estado">Estado</Label>
                <Input
                  id="novo-estado"
                  value={novoCliente.estado}
                  onChange={(e) => setNovoCliente(prev => ({ ...prev, estado: e.target.value }))}
                  placeholder="UF"
                  maxLength={2}
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-excursao">Excursão</Label>
              <Input
                id="novo-excursao"
                value={novoCliente.excursao}
                onChange={(e) => setNovoCliente(prev => ({ ...prev, excursao: e.target.value }))}
                placeholder="Nome da excursão"
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowAddCliente(false)} 
              className="flex-1 h-11 rounded-xl border-0 text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveNovoCliente} 
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
            >
              Salvar Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default NovoPedido;
