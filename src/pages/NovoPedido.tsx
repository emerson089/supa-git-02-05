import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { ClienteInfoCard } from '@/components/pedidos/ClienteInfoCard';
import { ClienteInsightsCard } from '@/components/pedidos/ClienteInsightsCard';
import { statusPagamentoOptions, statusPedidoOptions, statusEntregaOptions } from '@/components/pedidos/StatusSelector';
import { ItensPedidoCard } from '@/components/pedidos/ItensPedidoCard';
import { ItemPedido } from '@/components/pedidos/ItemPedidoRow';
import { ResumoCard } from '@/components/pedidos/ResumoCard';
import { toast } from 'sonner';
import { useClientesContext } from '@/contexts/ClientesContext';
import { usePedidos } from '@/contexts/PedidosContext';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useExcursoesAtivas } from '@/hooks/useExcursoes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ClienteSchema, PedidoItemSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { ChevronsUpDown, Check } from 'lucide-react';
import { parseProductName } from '@/utils/productNameUtils';
import { supabase } from '@/integrations/supabase/client';

function formatPhone(phone: string): string {
  if (!phone) return '';
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}
const STORAGE_KEY = 'novo-pedido-draft';
const NovoPedido = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const {
    clientes,
    addCliente,
    getClienteById
  } = useClientesContext();
  const {
    addPedido
  } = usePedidos();
  const {
    getProdutosAcabados,
    deduzirEstoque,
    getItemById,
    updateItem
  } = useEstoque();

  const { data: excursoesAtivas } = useExcursoesAtivas();

  // Cliente info
  const [clienteId, setClienteId] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [telefone, setTelefone] = useState('');
  const [excursao, setExcursao] = useState('');
  const [excursaoId, setExcursaoId] = useState<string | null>(null);
  const [taxaExcursao, setTaxaExcursao] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(true);

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
        if (data.excursaoId) setExcursaoId(data.excursaoId);
        if (data.taxaExcursao) setTaxaExcursao(data.taxaExcursao);
        if (data.desconto) setDesconto(data.desconto);
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
    const data = {
      clienteId,
      cidade,
      estado,
      telefone,
      excursao,
      excursaoId,
      taxaExcursao,
      desconto,
      items
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [clienteId, cidade, estado, telefone, excursao, excursaoId, taxaExcursao, items, isInitialized]);

  // Função para limpar o rascunho
  const clearDraft = () => localStorage.removeItem(STORAGE_KEY);

  // Loading
  const [isLoading, setIsLoading] = useState(false);

  // Add Cliente Modal
  const [showAddCliente, setShowAddCliente] = useState(false);
  const [novoClienteExcursaoOpen, setNovoClienteExcursaoOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    estado: '',
    excursao: ''
  });

  // Calculate totals
  const valorItens = items.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);
  const totalPecas = items.reduce((sum, item) => sum + item.quantidade, 0);
  const valorTotal = valorItens + taxaExcursao - desconto;

  // Verificar se há estoque insuficiente em algum item
  // Agrega por produtoId para detectar quando múltiplas linhas do mesmo produto somam mais do que o disponível
  const hasEstoqueInsuficiente = useMemo(() => {
    const qtdPorProduto: Record<string, number> = {};
    for (const item of items) {
      if (!item.produtoId) continue;
      qtdPorProduto[item.produtoId] = (qtdPorProduto[item.produtoId] || 0) + item.quantidade;
    }
    return Object.entries(qtdPorProduto).some(([produtoId, total]) => {
      const produto = getItemById(produtoId);
      return !!produto && total > produto.quantidade;
    });
  }, [items, getItemById]);

  // Calcular quantidade de modelos únicos
  // Calcular quantidade de modelos únicos baseada no agrupamento inteligente
  const quantidadeModelos = useMemo(() => {
    const groups = new Set();
    
    items.forEach(item => {
      if (!item.produtoId) return;
      
      const produto = getItemById(item.produtoId);
      let refTecnica = '';
      if (produto?.localizacao) {
        try {
          const loc = JSON.parse(produto.localizacao);
          refTecnica = loc.referencia || '';
        } catch (e) {}
      }

      const info = parseProductName(item.produtoNome || "", refTecnica);
      
      // Chave de agrupamento: RefBase + Valor + NomeBase (vinda do parseProductName)
      const key = `${info.refBase}|${item.valorUnitario}|${info.nomeBase}`;
      groups.add(key);
    });
    
    return groups.size;
  }, [items, getItemById]);

  // Item handlers
  const handleAddItem = useCallback(() => {
    const newId = crypto.randomUUID();
    const newItem: ItemPedido = {
      id: newId,
      produtoId: '',
      quantidade: 1,
      valorUnitario: 0
    };
    setItems(prev => [newItem, ...prev]); // Inserir no topo
    setNewItemId(newId); // Marcar para auto-focus
  }, []);
  const handleUpdateItem = useCallback((updatedItem: ItemPedido) => {
    setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  }, []);
  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);
  const handleAddGradeItems = useCallback((novosItens: ItemPedido[]) => {
    setItems(prev => [...novosItens, ...prev]);
  }, []);

  // Form actions
  const handleLimpar = () => {
    setClienteId('');
    setCidade('');
    setEstado('');
    setTelefone('');
    setExcursao('');
    setExcursaoId(null);
    setTaxaExcursao(0);
    setDesconto(0);
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
        valorUnitario: item.valorUnitario
      }));

      // Subtrair do estoque — agrega por produtoId para evitar deduzir parcialmente quando
      // o mesmo produto aparece em múltiplas linhas (ex.: grades adicionadas em momentos distintos)
      const qtdPorProduto: Record<string, number> = {};
      for (const item of items) {
        if (!item.produtoId) continue;
        qtdPorProduto[item.produtoId] = (qtdPorProduto[item.produtoId] || 0) + item.quantidade;
      }
      await Promise.all(
        Object.entries(qtdPorProduto).map(([produtoId, qtdTotal]) => {
          const produto = getItemById(produtoId);
          if (!produto) return Promise.resolve();
          return updateItem(produtoId, { quantidade: produto.quantidade - qtdTotal });
        })
      );

      // Criar pedido no contexto - usando labels em maiúsculo para matching de cores
      const getLabel = (value: string, options: {
        value: string;
        label: string;
      }[]) => options.find(opt => opt.value === value)?.label || value;
      const pedidoCriado = await addPedido({
        clienteId,
        clienteNome: cliente?.nome || 'Cliente',
        cidade: cidade || cliente?.cidade || '',
        estado: estado || cliente?.estado || '',
        telefone: telefone || cliente?.telefone || '',
        excursao: excursao || cliente?.excursao || '',
        excursaoId: excursaoId,
        taxaExcursao: taxaExcursao,
        status: getLabel(statusPedido, statusPedidoOptions),
        statusPagamento: getLabel(statusPagamento, statusPagamentoOptions),
        statusPedido: getLabel(statusPedido, statusPedidoOptions),
        statusEntrega: getLabel(statusEntrega, statusEntregaOptions),
        formaPagamento: getLabel(statusPagamento, statusPagamentoOptions),
        observacoes: '',
        itens: itensFormatados,
        totalPecas,
        valorTotal,
        desconto
      });
      toast.success('Pedido cadastrado com sucesso! Estoque atualizado.');

      // Gerar link de pagamento InfinitePay
      let linkInfinitePay = '';
      try {
        const infinitePayItems = items.map(item => ({
          description: item.produtoNome || 'Produto',
          quantity: item.quantidade,
          price: Math.round(item.valorUnitario * 100), // centavos
        }));

        let phoneFormatted = '';
        if (telefone) {
          let digits = telefone.replace(/\D/g, '').replace(/^0+/, '');
          if (!digits.startsWith('55')) digits = '55' + digits;
          phoneFormatted = `+${digits}`;
        }

        const { data: linkData } = await supabase.functions.invoke('create-infinitepay-link', {
          body: {
            pedido_id: pedidoCriado.id,
            items: infinitePayItems,
            customer: {
              name: cliente?.nome || 'Cliente',
              phone_number: phoneFormatted || undefined,
            },
          },
        });
        linkInfinitePay = linkData?.link || '';
        if (linkInfinitePay) {
          toast.success('Link de pagamento InfinitePay gerado!');
        }
      } catch (infiniteErr) {
        console.error('Erro ao gerar link InfinitePay:', infiniteErr);
        toast.error('Pedido criado, mas não foi possível gerar o link de pagamento.');
      }

      // Enviar WhatsApp automaticamente se ativado
      if (enviarWhatsApp && telefone) {
        try {
          const clienteNome = cliente?.nome?.split(' ')[0] || 'Cliente';
          const valorFormatado = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          let mensagemPagamento = '';
          if (linkInfinitePay) {
            mensagemPagamento = `Para dar andamento, realize o pagamento pelo link:

🔗 *Link de Pagamento:* ${linkInfinitePay}

Ou via PIX manual:

🔑 *Chave PIX:*

\`40548049000106\`

*CNPJ:* 40.548.049/0001-06

*Favorecido:* Delookii Confecções Ltda`;
          } else {
            mensagemPagamento = `Para dar andamento, realize o pagamento via PIX:

🔑 *Chave PIX:*

\`40548049000106\`

*CNPJ:* 40.548.049/0001-06

*Favorecido:* Delookii Confecções Ltda`;
          }

          const mensagem = `Olá, ${clienteNome}! 👋

Seu pedido foi confirmado aqui na *Delookii Jeans*! 🎉

💰 *Total: ${valorFormatado}*

${mensagemPagamento}

Após o pagamento, envie o comprovante aqui e já priorizamos o seu pedido. ✅

Qualquer dúvida é só chamar. Estamos sempre por aqui! 😊

*Delookii Jeans — Toritama/PE*`;

          // Normalizar telefone
          let digits = telefone.replace(/\D/g, '').replace(/^0+/, '');
          if (!digits.startsWith('55')) digits = '55' + digits;

          if (digits.length >= 12 && digits.length <= 13) {
            await supabase.functions.invoke('send-whatsapp', {
              body: { phone: digits, message: mensagem },
            });
            toast.success('Resumo enviado via WhatsApp!');
          }
        } catch (whatsErr) {
          console.error('Erro ao enviar WhatsApp:', whatsErr);
          toast.error('Pedido criado, mas não foi possível enviar o WhatsApp.');
        }
      }

      clearDraft();
      handleLimpar();

      // Redirecionar para página de pedidos criados
      navigate('/pedidos/criados');
    } catch (error: any) {
      console.error('Erro detalhado ao criar pedido:', error);
      const errorMsg = error?.message || (typeof error === 'string' ? error : 'Erro desconhecido');
      toast.error(`Erro ao criar pedido: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };
  const handleAddCliente = () => {
    setShowAddCliente(true);
  };
  const handleSaveNovoCliente = async () => {
    // Custom pre-flight validations for UI alerts
    if (!novoCliente.telefone) {
      toast.error('O telefone é obrigatório.');
      return;
    }
    if (!novoCliente.excursao) {
      toast.error('Por favor, selecione a excursão.');
      return;
    }

    // Pass the raw string to Zod for strict constraints (only digits)
    const rawData = {
      ...novoCliente,
      telefone: novoCliente.telefone.replace(/\D/g, '')
    };

    // Validate with Zod schema
    const result = ClienteSchema.safeParse(rawData);
    if (!result.success) {
      const firstError = result.error.errors[0]?.message || 'Dados inválidos';
      toast.error(firstError);
      return;
    }
    try {
      const validData = {
        nome: result.data.nome,
        telefone: result.data.telefone, // Already stripped of non-digits
        cidade: result.data.cidade,
        estado: result.data.estado,
        excursao: result.data.excursao
      };
      const cliente = await addCliente(validData);
      toast.success(`Cliente "${validData.nome}" cadastrado com sucesso!`);

      // Auto-select the new client
      setClienteId(cliente.id);
      setCidade(cliente.cidade);
      setEstado(cliente.estado);
      setTelefone(cliente.telefone);
      setExcursao(cliente.excursao);

      // Buscar taxa da excursão se existir
      const excursaoMatch = excursoesAtivas?.find(e =>
        e.nome.toLowerCase() === cliente.excursao.toLowerCase()
      );
      if (excursaoMatch) {
        setExcursaoId(excursaoMatch.id);
        setTaxaExcursao(excursaoMatch.taxa);
      } else {
        setExcursaoId(null);
        setTaxaExcursao(0);
      }
      setShowAddCliente(false);
      setNovoCliente({
        nome: '',
        telefone: '',
        cidade: '',
        estado: '',
        excursao: ''
      });
    } catch (error) {
      toast.error('Erro ao cadastrar cliente');
    }
  };
  return <div className="min-h-screen bg-background flex overflow-hidden">
    {/* Mobile Header */}
    {isMobile && <MobileHeader title="Novo Pedido" />}

    {/* Sidebar */}
    {!isMobile && <AppSidebar />}

    {/* Main Content */}
    <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", isMobile && "pt-14 pb-20")}>
      {/* Header - Desktop only */}
      {!isMobile && <header className="px-8 py-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">NOVO PEDIDO</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre pedidos vinculados a clientes e estoque
        </p>
      </header>}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="max-w-5xl space-y-8">
          {/* Cliente Info Card */}
          <ClienteInfoCard clienteId={clienteId} cidade={cidade} estado={estado} telefone={telefone} excursao={excursao} excursaoId={excursaoId} taxaExcursao={taxaExcursao} onClienteChange={setClienteId} onCidadeChange={setCidade} onEstadoChange={setEstado} onTelefoneChange={setTelefone} onExcursaoChange={setExcursao} onExcursaoIdChange={setExcursaoId} onTaxaExcursaoChange={setTaxaExcursao} onAddCliente={handleAddCliente} />

          {/* Insights do Cliente - Apenas para consulta interna */}
          <ClienteInsightsCard clienteId={clienteId} />

          {/* Status padrão: PENDENTE, NÃO SEPARADO, NÃO ENTREGUE - configurável apenas ao editar pedido */}

          {/* Resumo Card - agora acima dos itens */}
          <ResumoCard 
            totalPecas={totalPecas} 
            valorItens={valorItens} 
            taxaExcursao={taxaExcursao} 
            nomeExcursao={excursao} 
            valorTotal={valorTotal} 
            desconto={desconto}
            onDescontoChange={setDesconto}
            quantidadeModelos={quantidadeModelos} 
            onLimpar={handleLimpar} 
            onCriarPedido={handleCriarPedido} 
            isLoading={isLoading} 
            disabled={hasEstoqueInsuficiente}
            enviarWhatsApp={enviarWhatsApp}
            onEnviarWhatsAppChange={setEnviarWhatsApp}
          />

          {/* Items Card - agora abaixo do resumo */}
          <ItensPedidoCard items={items} onAddItem={handleAddItem} onUpdateItem={handleUpdateItem} onRemoveItem={handleRemoveItem} onAddGradeItems={handleAddGradeItems} newItemId={newItemId} onNewItemFocused={() => setNewItemId(null)} />
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
            <Input id="novo-nome" value={novoCliente.nome} onChange={e => setNovoCliente(prev => ({
              ...prev,
              nome: e.target.value
            }))} placeholder="Nome do cliente" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="novo-telefone">Telefone</Label>
            <Input id="novo-telefone" value={novoCliente.telefone} onChange={e => setNovoCliente(prev => ({
              ...prev,
              telefone: formatPhone(e.target.value)
            }))} placeholder="(00) 00000-0000" maxLength={15} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="novo-cidade">Cidade</Label>
              <Input id="novo-cidade" value={novoCliente.cidade} onChange={e => setNovoCliente(prev => ({
                ...prev,
                cidade: e.target.value
              }))} placeholder="Cidade" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-estado">Estado</Label>
              <Input id="novo-estado" value={novoCliente.estado} onChange={e => setNovoCliente(prev => ({
                ...prev,
                estado: e.target.value
              }))} placeholder="UF" maxLength={2} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="novo-excursao">Excursão</Label>
            <Popover open={novoClienteExcursaoOpen} onOpenChange={setNovoClienteExcursaoOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={novoClienteExcursaoOpen} className="w-full justify-between font-normal shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0 h-10 overflow-hidden text-muted-foreground">
                  <span className="truncate block max-w-[calc(100%-2rem)] text-foreground">
                    {novoCliente.excursao || <span className="text-muted-foreground">Selecione a excursão</span>}
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
                        setNovoCliente(prev => ({ ...prev, excursao: exc.nome }));
                        setNovoClienteExcursaoOpen(false);
                      }} className="flex items-center">
                        <Check className={cn("mr-2 h-4 w-4 shrink-0", novoCliente.excursao === exc.nome ? "opacity-100" : "opacity-0")} />
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
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={() => setShowAddCliente(false)} className="flex-1 h-11 rounded-xl border-0 text-muted-foreground hover:text-foreground">
            Cancelar
          </Button>
          <Button onClick={handleSaveNovoCliente} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground">
            Salvar Cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Bottom Navigation */}
    <BottomNavigation />
  </div>;
};
export default NovoPedido;