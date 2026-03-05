import { useState, useMemo, useRef, useEffect } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useRole } from '@/contexts/RoleContext';
import { useDisponivelCentral, useLocais } from '@/hooks/useEstoqueLocais';
import { useTransferenciasFiltradas, useCriarTransferencia, useTransferenciaItens } from '@/hooks/useTransferencias';
import { useEstoqueDetalhadoPorLocal, EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { useVendasDesdeContagem } from '@/hooks/useContagensEstoque';
import { useUserLocations, useHasLocationAccess } from '@/hooks/useUserLocations';
import { useUsers } from '@/hooks/useUsers';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Plus, Loader2, Minus, X, Check, ArrowLeftRight, Package, Package2, Search, Store, Box, Info, FileDown, DollarSign, TrendingUp, ClipboardCheck, History, BarChart3, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PrintEstoqueLocal } from '@/components/estoque/PrintEstoqueLocal';
import { LotImage } from '@/components/production/LotImage';
import { ProdutoEstoqueLocalCard } from '@/components/estoque/ProdutoEstoqueLocalCard';
import { AjusteEstoqueModal } from '@/components/estoque/AjusteEstoqueModal';

import { HistoricoMovimentacoesModal } from '@/components/estoque/HistoricoMovimentacoesModal';
import { ZerarEstoqueModal } from '@/components/estoque/ZerarEstoqueModal';
import { EditarPrecoLocalModal } from '@/components/estoque/EditarPrecoLocalModal';
import { NovaContagemModal } from '@/components/estoque/NovaContagemModal';
import { HistoricoContagensModal } from '@/components/estoque/HistoricoContagensModal';
import { RelatorioSaidasModal } from '@/components/estoque/RelatorioSaidasModal';
import { FiltrosTransferencias, FiltrosTransferenciasState, StatusTransferencia } from '@/components/transferencias/FiltrosTransferencias';
import { useTiposAjuste } from '@/hooks/useTiposAjuste';
import { DetalhesTransferenciaModal } from '@/components/transferencias/DetalhesTransferenciaModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Transferencia } from '@/hooks/useTransferencias';
import { AddGradeModal } from '@/components/pedidos/AddGradeModal';
import { ItemPedido } from '@/components/pedidos/ItemPedidoRow';

interface ItemTransferencia {
  itemId: string;
  nome: string;
  imagemUrl: string | null;
  quantidade: number;
  disponivelOrigem: number;
}

const STATUS_CONFIG: Record<StatusTransferencia, { label: string; icon: typeof Clock; className: string }> = {
  em_andamento: { label: 'Pendente', icon: Clock, className: 'bg-amber-100 text-amber-800 border-amber-200' },
  concluida: { label: 'Concluída', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelada: { label: 'Cancelada', icon: XCircle, className: 'bg-red-100 text-red-800 border-red-200' },
};
export default function Transferencias() {
  const isMobile = useIsMobile();
  const {
    isAdmin,
    isGerente,
    isVendedor
  } = useRole();
  const {
    getProdutosAcabados
  } = useEstoque();
  const {
    locais,
    estoquePorLocal,
    isLoading: isLoadingLocais
  } = useDisponivelCentral();
  // Estado para filtros de transferência
  const [filtros, setFiltros] = useState<FiltrosTransferenciasState>({
    dataInicio: undefined,
    dataFim: undefined,
    origemId: '',
    destinoId: '',
    status: '',
    motivo: '',
  });

  const { users = [], fetchUsers } = useUsers();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const {
    data: transferencias,
    isLoading: isLoadingTransferencias
  } = useTransferenciasFiltradas('transferencia', {
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    origemId: filtros.origemId || undefined,
    destinoId: filtros.destinoId || undefined,
    status: filtros.status || undefined,
    motivo: filtros.motivo || undefined,
  });
  const criarTransferencia = useCriarTransferencia();

  // Hook para obter locais permitidos do usuário
  const {
    data: userLocations = [],
    isLoading: isLoadingUserLocations
  } = useUserLocations();

  // Estados para gestão de estoque local
  const [activeTab, setActiveTab] = useState(isVendedor ? 'historico' : 'estoque');
  const [searchEstoque, setSearchEstoque] = useState('');
  const debouncedSearchEstoque = useDebouncedValue(searchEstoque, 300);
  const [showAjusteModal, setShowAjusteModal] = useState(false);

  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [showZerarModal, setShowZerarModal] = useState(false);
  const [showEditarPrecoModal, setShowEditarPrecoModal] = useState(false);
  const [showNovaContagemModal, setShowNovaContagemModal] = useState(false);
  const [showHistoricoContagensModal, setShowHistoricoContagensModal] = useState(false);
  const [showRelatorioSaidasModal, setShowRelatorioSaidasModal] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<EstoqueLocalDetalhado | null>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);

  // Estados para modal de nova transferência
  const [showNovaTransferencia, setShowNovaTransferencia] = useState(false);
  const [origemId, setOrigemId] = useState<string>('');
  const [destinoId, setDestinoId] = useState<string>('');
  const [motivoNovo, setMotivoNovo] = useState('');
  const { data: tiposAtivos = [] } = useTiposAjuste();
  const [itensTransferencia, setItensTransferencia] = useState<ItemTransferencia[]>([]);
  const [searchProdutos, setSearchProdutos] = useState('');

  // Estados para modal de detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [transferenciaSelecionada, setTransferenciaSelecionada] = useState<Transferencia | null>(null);

  // Estados Nova Transferência por Grade
  const [showAddGrade, setShowAddGrade] = useState(false);

  // Buscar itens da transferência selecionada
  const { data: itensTransferenciaSelecionada = [] } = useTransferenciaItens(transferenciaSelecionada?.id);

  const produtosAcabados = getProdutosAcabados();

  // ======= NOVA TRANSFERÊNCIA (AVULSA E GRADES) =======
  const handleAddGradeItems = (novosItens: ItemPedido[]) => {
    // novosItens vem da Grade, mapeamos para ItemTransferencia
    const itensMapeados: ItemTransferencia[] = novosItens.map(item => {
      // Procuramos o produto no estoque para pegar a imagem original e disponivel
      const produtoEstoque = produtosAcabados.find(p => p.id === item.produtoId);
      const disponivelOrigem = produtoEstoque ? getDisponivelNoLocal(produtoEstoque.id, origemId) : 0;

      return {
        itemId: item.produtoId,
        nome: `${item.modeloNome} — Tamanho ${item.produtoNome.split('-').pop()}`,
        imagemUrl: produtoEstoque?.imagemUrl || null,
        quantidade: item.quantidade,
        disponivelOrigem: disponivelOrigem
      };
    });

    setItensTransferencia(prev => {
      const result = [...prev];
      for (const novo of itensMapeados) {
        const existenteIdx = result.findIndex(i => i.itemId === novo.itemId);
        if (existenteIdx >= 0) {
          result[existenteIdx].quantidade += novo.quantidade;
        } else {
          result.push(novo);
        }
      }
      return result;
    });
  };

  // Mapear itens da transferência selecionada com dados dos produtos
  const itensDetalhados = useMemo(() => {
    return itensTransferenciaSelecionada.map(item => {
      const produto = produtosAcabados.find(p => p.id === item.itemId);
      return {
        id: item.id,
        itemId: item.itemId,
        itemNome: produto?.nome || 'Produto não encontrado',
        itemImagemUrl: produto?.imagemUrl || null,
        quantidadeEnviada: item.quantidadeEnviada,
      };
    });
  }, [itensTransferenciaSelecionada, produtosAcabados]);

  // Dados completos da transferência selecionada para o modal
  const transferenciaCompleta = useMemo(() => {
    if (!transferenciaSelecionada) return null;
    const origemLocal = locais.find(l => l.id === transferenciaSelecionada.localOrigemId);
    const destinoLocal = locais.find(l => l.id === transferenciaSelecionada.localDestinoId);

    // Find creators and finishers by auth user_id instead of profile id
    const criador = users.find(u => u.user_id === transferenciaSelecionada.userId);
    const concluidoPor = users.find(u => u.user_id === transferenciaSelecionada.concluidoPor);

    const displayName = criador?.nome || 'Sistema';
    const displayRole = criador?.role ? ` - ${criador.role}` : '';

    return {
      ...transferenciaSelecionada,
      localOrigemNome: transferenciaSelecionada.localOrigemNome || origemLocal?.nome || 'Desconhecido',
      localDestinoNome: transferenciaSelecionada.localDestinoNome || destinoLocal?.nome || 'Desconhecido',
      concluidoPorNome: concluidoPor?.nome || null,
      concluidoPorRole: concluidoPor?.role || null,
      criadorNome: `${displayName}${displayRole}`,
      criadorRole: criador?.role || null,
    };
  }, [transferenciaSelecionada, locais, users]);

  // Handler para abrir modal de detalhes
  const handleOpenDetalhes = (t: Transferencia) => {
    setTransferenciaSelecionada(t);
    setShowDetalhesModal(true);
  };
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const quantidadeInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Encontrar local - para vendedor, usar o primeiro local permitido
  // Prioridade: loja > banca > central
  const selectedLocal = useMemo(() => {
    if (isVendedor) {
      // Vendedor: buscar primeiro local permitido (priorizar loja, depois banca)
      const allowedLocations = userLocations.filter(ul => ul.canView);

      // Tentar primeiro uma 'loja', depois 'banca', depois qualquer outro
      const priorityOrder: Array<'loja' | 'banca' | 'central'> = ['loja', 'banca', 'central'];
      for (const tipo of priorityOrder) {
        const found = allowedLocations.find(ul => ul.localTipo === tipo);
        if (found) {
          return locais.find(l => l.id === found.localId) || null;
        }
      }

      // Fallback: usar primeiro local permitido
      if (allowedLocations.length > 0) {
        return locais.find(l => l.id === allowedLocations[0].localId) || null;
      }
      return null;
    }

    // Admin/Gerente: usar qualquer loja ou banca
    return locais.find(l => l.tipo === 'loja' || l.tipo === 'banca') || null;
  }, [locais, isVendedor, userLocations]);
  const lojaId = selectedLocal?.id || null;
  const lojaNome = selectedLocal?.nome || 'Local';

  // Verificar permissões para o local atual
  const locationAccess = useHasLocationAccess(lojaId);
  const canAdjustStock = isAdmin || isGerente || locationAccess.canAdjustStock;
  const canEditPrice = isAdmin || isGerente || locationAccess.canEditPrice;

  // Verificar se vendedor tem acesso configurado
  const vendedorSemAcesso = isVendedor && userLocations.length === 0 && !isLoadingUserLocations;

  // Buscar estoque detalhado da loja
  const {
    data: estoqueDetalhado = [],
    isLoading: isLoadingEstoqueDetalhado
  } = useEstoqueDetalhadoPorLocal(lojaId);

  // Buscar vendas desde última contagem
  const {
    data: vendasData
  } = useVendasDesdeContagem(lojaId);

  // Filtrar produtos do estoque local
  const estoqueFiltrado = useMemo(() => {
    if (!debouncedSearchEstoque.trim()) return estoqueDetalhado;
    const termo = debouncedSearchEstoque.toLowerCase();
    return estoqueDetalhado.filter(item => item.itemNome.toLowerCase().includes(termo) || item.itemCodigo.toLowerCase().includes(termo));
  }, [estoqueDetalhado, debouncedSearchEstoque]);

  // Totais do estoque local
  const totalPecasLocal = useMemo(() => estoqueDetalhado.reduce((sum, item) => sum + item.quantidade, 0), [estoqueDetalhado]);
  const totalModelosLocal = estoqueDetalhado.length;

  // MVP: Valor do estoque (venda) - usando precoExibido (local > base)
  const {
    valorEstoqueVenda,
    itensComPreco,
    itensSemPreco,
    itensComPrecoLocal
  } = useMemo(() => {
    let total = 0;
    let comPreco = 0;
    let semPreco = 0;
    let comPrecoLocal = 0;
    estoqueDetalhado.forEach(item => {
      if (item.precoExibido && item.precoExibido > 0) {
        total += item.quantidade * item.precoExibido;
        comPreco++;
        if (item.precoLocal !== null) {
          comPrecoLocal++;
        }
      } else {
        semPreco++;
      }
    });
    return {
      valorEstoqueVenda: total,
      itensComPreco: comPreco,
      itensSemPreco: semPreco,
      itensComPrecoLocal: comPrecoLocal
    };
  }, [estoqueDetalhado]);

  // Locais disponíveis para transferência
  const locaisOrigem = useMemo(() => {
    return locais.filter(l => l.tipo === 'central' || l.tipo === 'loja');
  }, [locais]);
  const locaisDestino = useMemo(() => {
    const filtered = locais.filter(l => l.tipo === 'central' || l.tipo === 'loja');
    return filtered.filter(l => l.id !== origemId);
  }, [locais, origemId]);

  // Locais disponíveis para exibição de resumo
  const locaisDisponiveis = useMemo(() => locais.filter(l => l.tipo === 'central' || l.tipo === 'loja'), [locais]);
  const getDisponivelNoLocal = (itemId: string, localId: string): number => {
    const estoque = estoquePorLocal.find(e => e.itemId === itemId && e.localId === localId);
    if (!estoque) return 0;
    return Math.max(0, estoque.quantidade - estoque.quantidadeReservada);
  };

  // Produtos filtrados e ordenados para modal de transferência
  const produtosFiltrados = useMemo(() => {
    let filtered = produtosAcabados.filter(p => {
      if (searchProdutos.trim()) {
        const search = searchProdutos.toLowerCase();
        if (!p.nome.toLowerCase().includes(search)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const dispA = origemId ? getDisponivelNoLocal(a.id, origemId) : 0;
      const dispB = origemId ? getDisponivelNoLocal(b.id, origemId) : 0;
      return dispB - dispA;
    });
  }, [produtosAcabados, origemId, searchProdutos, estoquePorLocal]);
  useEffect(() => {
    if (lastAddedItemId) {
      setTimeout(() => {
        const input = quantidadeInputRefs.current.get(lastAddedItemId);
        if (input) {
          input.focus();
          input.select();
        }
        setLastAddedItemId(null);
      }, 50);
    }
  }, [lastAddedItemId, itensTransferencia]);

  // Handlers de estoque local
  const handleAjustar = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowAjusteModal(true);
  };
  const handleHistorico = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowHistoricoModal(true);
  };
  const handleZerar = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowZerarModal(true);
  };
  const handleEditarPreco = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowEditarPrecoModal(true);
  };

  // Handler para abrir preview do PDF
  const handleExportarPDF = () => {
    if (!lojaId || estoqueDetalhado.length === 0) {
      toast.error('Nenhum produto para exportar');
      return;
    }
    setShowPDFPreview(true);
  };

  // Handler para imprimir (chamado do preview)
  const handlePrint = () => {
    window.print();
  };

  // Handler para fechar preview
  const handleClosePreview = () => {
    setShowPDFPreview(false);
  };

  // Handlers de transferência
  const handleAddItemTransferencia = (produto: {
    id: string;
    nome: string;
    imagemUrl?: string | null;
  }) => {
    if (!origemId) {
      toast.error('Selecione o local de origem primeiro');
      return;
    }
    const disponivel = getDisponivelNoLocal(produto.id, origemId);
    if (disponivel <= 0) {
      toast.error('Produto sem estoque disponível no local de origem');
      return;
    }
    const existing = itensTransferencia.find(i => i.itemId === produto.id);
    if (existing) {
      toast.error('Produto já adicionado');
      return;
    }
    setItensTransferencia(prev => [...prev, {
      itemId: produto.id,
      nome: produto.nome,
      imagemUrl: produto.imagemUrl || null,
      quantidade: 1,
      disponivelOrigem: disponivel
    }]);
    setLastAddedItemId(produto.id);
  };
  const handleQuantidadeChange = (itemId: string, value: string) => {
    const numValue = parseInt(value, 10);
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
        if (value === '' || isNaN(numValue)) {
          return {
            ...item,
            quantidade: 0
          };
        }
        const novaQtd = Math.max(1, Math.min(item.disponivelOrigem, numValue));
        return {
          ...item,
          quantidade: novaQtd
        };
      }
      return item;
    }));
  };
  const handleQuantidadeBlur = (itemId: string) => {
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const qtd = Math.max(1, Math.min(item.disponivelOrigem, item.quantidade || 1));
        return {
          ...item,
          quantidade: qtd
        };
      }
      return item;
    }));
  };
  const handleUpdateQuantidade = (itemId: string, delta: number) => {
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const novaQtd = Math.max(1, Math.min(item.disponivelOrigem, item.quantidade + delta));
        return {
          ...item,
          quantidade: novaQtd
        };
      }
      return item;
    }));
  };
  const handleRemoveItem = (itemId: string) => {
    setItensTransferencia(prev => prev.filter(i => i.itemId !== itemId));
  };
  const handleCriarTransferencia = async () => {
    if (!origemId || !destinoId) {
      toast.error('Selecione origem e destino');
      return;
    }
    if (origemId === destinoId) {
      toast.error('Origem e destino devem ser diferentes');
      return;
    }
    if (!motivoNovo) {
      toast.error('Selecione o motivo da transferência');
      return;
    }
    if (itensTransferencia.length === 0) {
      toast.error('Adicione ao menos um item');
      return;
    }
    try {
      await criarTransferencia.mutateAsync({
        origemId,
        destinoId,
        itens: itensTransferencia.map(i => ({
          itemId: i.itemId,
          quantidade: i.quantidade
        })),
        motivo: motivoNovo,
        observacoes: undefined,
      });
      toast.success('Transferência criada! Clique nela para concluir.');
      setShowNovaTransferencia(false);
      setItensTransferencia([]);
      setOrigemId('');
      setDestinoId('');
      setMotivoNovo('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar transferência');
    }
  };
  const handleOpenModal = () => {
    setSearchProdutos('');
    setLastAddedItemId(null);
    setItensTransferencia([]);
    setOrigemId('');
    setDestinoId('');
    setShowNovaTransferencia(true);
  };
  const handleOrigemChange = (newOrigemId: string) => {
    setOrigemId(newOrigemId);
    setItensTransferencia(prev => prev.map(item => ({
      ...item,
      disponivelOrigem: getDisponivelNoLocal(item.itemId, newOrigemId),
      quantidade: Math.min(item.quantidade, getDisponivelNoLocal(item.itemId, newOrigemId))
    })).filter(item => item.disponivelOrigem > 0));
  };
  const totalPecas = itensTransferencia.reduce((sum, i) => sum + i.quantidade, 0);
  const getLocalNome = (localId: string) => {
    return locais.find(l => l.id === localId)?.nome || 'Desconhecido';
  };

  // Seção: Estoque do Local
  const renderEstoqueLocalSection = () => <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
    {/* Header do Estoque */}
    <div className={cn("shrink-0", isMobile ? "px-3 pt-2 pb-3" : "pb-4")}>
      {/* Alerta para vendedor sem acesso configurado */}
      {vendedorSemAcesso && <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Acesso não configurado</AlertTitle>
        <AlertDescription>
          Seu usuário ainda não possui acesso a nenhum local. Entre em contato com um administrador para configurar suas permissões.
        </AlertDescription>
      </Alert>}

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Store className="h-5 w-5 text-primary shrink-0" />
          <h2 className="font-semibold truncate">{lojaNome}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setShowRelatorioSaidasModal(true)} disabled={!lojaId}>
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Movimentações</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportarPDF} disabled={!lojaId || estoqueDetalhado.length === 0}>
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">PDF</span>
          </Button>
        </div>
      </div>

      {/* Cards de totais - MVP com valor do estoque */}
      <TooltipProvider>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {/* Total Peças */}
          <Card>
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Peças</p>
              </div>
              <p className="text-lg sm:text-xl font-bold">{totalPecasLocal}</p>
            </CardContent>
          </Card>

          {/* Total Modelos */}
          <Card>
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-1">
                <Box className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Modelos</p>
              </div>
              <p className="text-lg sm:text-xl font-bold">{totalModelosLocal}</p>
            </CardContent>
          </Card>

          {/* Valor Estoque (Venda) - MVP */}
          <Card>
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-emerald-600" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Valor (em estoque)</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className={cn("h-3 w-3 cursor-help", itensSemPreco > 0 ? "text-amber-500" : "text-muted-foreground")} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <div className="text-xs space-y-1">
                      {itensSemPreco > 0 && <p className="text-amber-600">{itensSemPreco} modelo(s) sem preço.</p>}
                      {itensComPrecoLocal > 0 && <p className="text-amber-600">{itensComPrecoLocal} modelo(s) com preço local diferenciado.</p>}
                      <p className="text-muted-foreground">Calculado usando preço local quando disponível, senão preço base.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-lg sm:text-xl font-bold text-emerald-600">
                {valorEstoqueVenda > 0 ? `R$ ${valorEstoqueVenda.toLocaleString('pt-BR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}` : '—'}
              </p>
            </CardContent>
          </Card>

          {/* Valor Estoque (Custo) - Placeholder */}
          <Card className="opacity-60">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Valor (Custo)</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    <p className="text-xs">Custo unitário por produto ainda não implementado. Será calculado quando campo de custo estiver disponível.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-lg sm:text-xl font-bold text-muted-foreground">—</p>
            </CardContent>
          </Card>
        </div>

        {/* Card de Contagem/Vendas - Funcional */}
        <Card className={cn("mb-3", !vendasData?.dataContagem && "opacity-70")}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  {vendasData?.dataContagem ? <>
                    <p className="text-xs font-medium">Desde última contagem</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(vendasData.dataContagem), "dd/MM 'às' HH:mm", {
                        locale: ptBR
                      })}
                    </p>
                  </> : <>
                    <p className="text-xs font-medium text-muted-foreground">Nenhuma contagem</p>
                    <p className="text-[10px] text-muted-foreground">Registre para acompanhar vendas</p>
                  </>}
                </div>
              </div>

              {vendasData?.dataContagem ? <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold">{vendasData.pecasVendidas} peças</p>
                  {vendasData.valorVendido > 0 && <p className="text-xs text-emerald-600">
                    R$ {vendasData.valorVendido.toLocaleString('pt-BR', {
                      minimumFractionDigits: 0
                    })}
                  </p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowNovaContagemModal(true)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Nova
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setShowHistoricoContagensModal(true)}>
                    <History className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                </div>
              </div> : <Button size="sm" variant="outline" onClick={() => setShowNovaContagemModal(true)} disabled={estoqueDetalhado.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Nova Contagem
              </Button>}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou código..." value={searchEstoque} onChange={e => setSearchEstoque(e.target.value)} className="pl-9" />
      </div>
    </div>

    {/* Lista de produtos */}
    <ScrollArea className="flex-1 w-full">
      <div className={cn("space-y-2 w-full", isMobile ? "px-3 pb-4" : "pb-4")}>
        {isLoadingEstoqueDetalhado ? <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div> : estoqueFiltrado.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-50" />
          <p className="font-medium">Nenhum produto no estoque</p>
          <p className="text-sm mt-1">
            {searchEstoque ? 'Tente outra busca' : 'Adicione produtos para começar'}
          </p>
        </div> : estoqueFiltrado.map(item => <ProdutoEstoqueLocalCard key={item.id} item={item} onAjustar={canAdjustStock ? handleAjustar : undefined} onHistorico={handleHistorico} onZerar={canAdjustStock ? handleZerar : undefined} onEditarPreco={canEditPrice ? handleEditarPreco : undefined} />)}
      </div>
    </ScrollArea>
  </div>;

  // Seção: Histórico de Transferências
  const renderHistoricoTransferenciasSection = () => <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
    {/* Header do Histórico */}
    <div className={cn("shrink-0", isMobile ? "px-3 pt-2 pb-3" : "pb-4")}>
      {/* Título + Barra de Filtros Horizontal */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2 shrink-0">
          <ArrowLeftRight className="h-5 w-5 text-primary shrink-0" />
          <h2 className="font-semibold text-sm sm:text-base whitespace-nowrap">Transferências</h2>
        </div>

        {/* Filtros + Nova - ocupa resto do espaço */}
        <FiltrosTransferencias
          filtros={filtros}
          onFiltrosChange={setFiltros}
          locais={locaisDisponiveis}
          onNovaClick={handleOpenModal}
        />
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-2">
        {locaisDisponiveis.map(local => {
          const total = estoquePorLocal.filter(e => e.localId === local.id).reduce((sum, e) => sum + e.quantidade, 0);
          return <Card key={local.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-md", local.tipo === 'central' ? "bg-blue-500/10" : "bg-emerald-500/10")}>
                  {local.tipo === 'central' ? <Box className="h-4 w-4 text-blue-600" /> : <Store className="h-4 w-4 text-emerald-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">{local.nome}</p>
                  <p className="text-lg font-bold">{total}</p>
                </div>
              </div>
            </CardContent>
          </Card>;
        })}
      </div>
    </div>

    {/* Lista de transferências */}
    <ScrollArea className="flex-1 w-full">
      <div className={cn("space-y-2 w-full", isMobile ? "px-3 pb-4" : "pb-4")}>
        {isLoadingTransferencias ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !transferencias || transferencias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ArrowLeftRight className="h-12 w-12 mb-3 opacity-50" />
            <p className="font-medium">Nenhuma transferência</p>
            <p className="text-sm mt-1">Transferências entre locais aparecerão aqui</p>
          </div>
        ) : (
          transferencias.map(t => {
            const statusConfig = STATUS_CONFIG[t.status as StatusTransferencia] || STATUS_CONFIG.em_andamento;
            const StatusIcon = statusConfig.icon;
            return (
              <Card
                key={t.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleOpenDetalhes(t)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={cn("text-xs gap-1", statusConfig.className)}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(t.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate">{t.localOrigemNome || getLocalNome(t.localOrigemId)}</span>
                    <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{t.localDestinoNome || getLocalNome(t.localDestinoId)}</span>
                  </div>
                  {t.motivo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Motivo: {t.motivo}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </ScrollArea>
  </div>;

  // Early return for loading state - placed after render functions are defined
  if (isLoadingLocais || isLoadingTransferencias || isLoadingUserLocations) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }
  return <div className="min-h-screen bg-background flex max-w-full overflow-x-hidden">
    {isMobile && <MobileHeader title="Movimentações" />}
    {!isMobile && <AppSidebar />}

    <main className={cn("flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden w-full max-w-full", isMobile && "pt-14 pb-20")}>
      {/* Header - Desktop */}
      {!isMobile && <header className="px-6 py-4 border-b border-border bg-card/50 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ESTOQUE POR LOCAL</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de estoque por local de armazenamento
          </p>
        </div>
      </header>}

      {/* Conteúdo - Mobile: Tabs, Desktop: Layout dividido */}
      {isMobile ? <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-2 shrink-0">
          <TabsTrigger value="historico" className="gap-1.5">
            <ArrowLeftRight className="h-4 w-4" />
            Transferências
          </TabsTrigger>
          <TabsTrigger value="estoque" className="gap-1.5">
            <Store className="h-4 w-4" />
            Estoque
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="flex-1 overflow-hidden mt-0">
          {renderEstoqueLocalSection()}
        </TabsContent>

        <TabsContent value="historico" className="flex-1 overflow-hidden mt-0">
          {renderHistoricoTransferenciasSection()}
        </TabsContent>
      </Tabs> : <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-hidden">
        <div className="border rounded-xl p-4 overflow-hidden flex flex-col bg-card">
          {renderEstoqueLocalSection()}
        </div>
        <div className="border rounded-xl p-4 overflow-hidden flex flex-col bg-card">
          {renderHistoricoTransferenciasSection()}
        </div>
      </div>}
    </main>

    {isMobile && <BottomNavigation />}

    {/* Modal de Ajuste de Estoque */}
    <AjusteEstoqueModal open={showAjusteModal} onOpenChange={setShowAjusteModal} item={itemSelecionado} />


    {/* Modal de Histórico de Movimentações */}
    <HistoricoMovimentacoesModal open={showHistoricoModal} onOpenChange={setShowHistoricoModal} item={itemSelecionado} />

    {/* Modal de Zerar Estoque */}
    <ZerarEstoqueModal open={showZerarModal} onOpenChange={setShowZerarModal} item={itemSelecionado} />

    {/* Modal de Editar Preço Local */}
    {itemSelecionado && lojaId && <EditarPrecoLocalModal open={showEditarPrecoModal} onClose={() => setShowEditarPrecoModal(false)} item={{
      itemId: itemSelecionado.itemId,
      itemNome: itemSelecionado.itemNome,
      itemImagemUrl: itemSelecionado.itemImagemUrl,
      itemPrecoUnitario: itemSelecionado.itemPrecoUnitario
    }} localId={lojaId} localNome={lojaNome} precoLocal={itemSelecionado.precoLocal} />}

    {/* Modal Nova Contagem */}
    {lojaId && <NovaContagemModal open={showNovaContagemModal} onOpenChange={setShowNovaContagemModal} localId={lojaId} localNome={lojaNome} itensEstoque={estoqueDetalhado} />}

    {/* Modal Histórico de Contagens */}
    {lojaId && <HistoricoContagensModal open={showHistoricoContagensModal} onOpenChange={setShowHistoricoContagensModal} localId={lojaId} localNome={lojaNome} />}
    <Dialog open={showNovaTransferencia} onOpenChange={setShowNovaTransferencia}>
      <DialogContent className="w-[96vw] max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Nova Transferência</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Seleção de Origem e Destino */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">De:</Label>
              <Select value={origemId} onValueChange={handleOrigemChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione origem" />
                </SelectTrigger>
                <SelectContent>
                  {locaisOrigem.map(local => <SelectItem key={local.id} value={local.id}>
                    {local.nome}
                  </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Para:</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione destino" />
                </SelectTrigger>
                <SelectContent>
                  {locaisDestino.map(local => <SelectItem key={local.id} value={local.id}>
                    {local.nome}
                  </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seleção de Motivo */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Motivo *</Label>
            <Select value={motivoNovo} onValueChange={setMotivoNovo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {tiposAtivos.map((tipo) => (
                  <SelectItem key={tipo.id} value={tipo.nome}>{tipo.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Modo de Transferência */}
          {origemId && destinoId && (
            <div className="flex bg-muted/50 p-1.5 rounded-xl mt-2 border border-border/50">
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                  "bg-background shadow-sm ring-1 ring-border/50 text-foreground"
                )}
              >
                <Plus className="h-4 w-4" />
                Modo Avulso
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                  "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={() => setShowAddGrade(true)}
              >
                <Package2 className="h-4 w-4" />
                Por Grade
              </button>
            </div>
          )}

          {/* Seção: Produtos Disponíveis */}
          {origemId && <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Produtos Disponíveis</span>
              <Badge variant="secondary" className="ml-auto">
                {produtosFiltrados.length} produtos
              </Badge>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={searchProdutos} onChange={e => setSearchProdutos(e.target.value)} className="pl-9 h-9" />
            </div>

            <ScrollArea className="h-48">
              <div className="space-y-2 pr-2">
                {produtosFiltrados.map(produto => {
                  const disponivel = getDisponivelNoLocal(produto.id, origemId);
                  const disponivelDestino = destinoId ? getDisponivelNoLocal(produto.id, destinoId) : 0;
                  const jaAdicionado = itensTransferencia.some(i => i.itemId === produto.id);
                  return <div key={produto.id} className={cn("flex items-start gap-3 p-2 rounded-lg border bg-background transition-colors", jaAdicionado ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" : disponivel > 0 ? "hover:bg-muted/50 cursor-pointer hover:border-primary/30" : "opacity-40")} onClick={() => !jaAdicionado && disponivel > 0 && handleAddItemTransferencia(produto)}>
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 border">
                      <LotImage src={produto.imagemUrl} alt={produto.nome} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{produto.nome}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs font-medium",
                            disponivel > 0
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Box className="h-3 w-3 mr-1" />
                          Origem: {disponivel} pçs
                        </Badge>
                        {destinoId && disponivelDestino > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          >
                            <Store className="h-3 w-3 mr-1" />
                            Destino: {disponivelDestino} pçs
                          </Badge>
                        )}
                      </div>
                    </div>

                    {!jaAdicionado && disponivel > 0 && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10" onClick={e => {
                      e.stopPropagation();
                      handleAddItemTransferencia(produto);
                    }}>
                      <Plus size={16} />
                    </Button>}
                    {jaAdicionado && <div className="h-8 w-8 shrink-0 flex items-center justify-center">
                      <Check size={16} className="text-emerald-600" />
                    </div>}
                  </div>;
                })}
                {produtosFiltrados.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">
                  {searchProdutos ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                </div>}
              </div>
            </ScrollArea>
          </div>}

          {/* Seção: Itens para Transferir */}
          <div className={cn("rounded-xl border p-4 transition-colors", itensTransferencia.length > 0 ? "border-primary/30 bg-primary/5" : "bg-muted/20")}>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Itens para Transferir</span>
              {itensTransferencia.length > 0 && <Badge className="ml-auto">
                {totalPecas} peças
              </Badge>}
            </div>

            {itensTransferencia.length === 0 ? <div className="py-8 text-center text-muted-foreground text-sm">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum item selecionado</p>
              <p className="text-xs mt-1">Selecione produtos da lista acima</p>
            </div> : <div className="space-y-2">
              {itensTransferencia.map(item => {
                const isShortage = item.quantidade > item.disponivelOrigem;
                return (
                  <div key={item.itemId} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    isShortage ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : "bg-background"
                  )}>
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 border">
                      <LotImage src={item.imagemUrl} alt={item.nome} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={cn("text-xs", isShortage ? "text-amber-600 font-semibold" : "text-muted-foreground")}>
                          Disp: {item.disponivelOrigem}
                        </p>
                        {isShortage && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Quantidade excede o estoque na origem.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleUpdateQuantidade(item.itemId, -1)} disabled={item.quantidade <= 1}>
                        <Minus size={14} />
                      </Button>

                      <Input ref={el => {
                        if (el) {
                          quantidadeInputRefs.current.set(item.itemId, el);
                        } else {
                          quantidadeInputRefs.current.delete(item.itemId);
                        }
                      }} type="text" inputMode="numeric" pattern="[0-9]*" value={item.quantidade || ''} onChange={e => handleQuantidadeChange(item.itemId, e.target.value.replace(/\D/g, ''))} onBlur={() => handleQuantidadeBlur(item.itemId)} onFocus={e => e.target.select()} onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }} className={cn("w-14 h-8 text-center font-medium", isShortage && "border-amber-300 focus-visible:ring-amber-400")} />

                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleUpdateQuantidade(item.itemId, 1)}>
                        <Plus size={14} />
                      </Button>

                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveItem(item.itemId)}>
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className="sticky bottom-0 px-6 py-4 border-t bg-background flex items-center justify-between shrink-0">
          <div className="text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-bold">{itensTransferencia.length} itens</span>
            <span className="text-muted-foreground"> ({totalPecas} peças)</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNovaTransferencia(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarTransferencia} disabled={!origemId || !destinoId || itensTransferencia.length === 0 || criarTransferencia.isPending}>
              {criarTransferencia.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Transferir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Componente de impressão - modo preview ou oculto */}
    <PrintEstoqueLocal itens={estoqueDetalhado} localNome={lojaNome} showPreview={showPDFPreview} onClose={handleClosePreview} onPrint={handlePrint} />
    {/* Modal de Relatório de Movimentações */}
    <RelatorioSaidasModal open={showRelatorioSaidasModal} onOpenChange={setShowRelatorioSaidasModal} localIdInicial={lojaId || undefined} />

    {/* Modal de Detalhes da Transferência */}
    <DetalhesTransferenciaModal
      open={showDetalhesModal}
      onOpenChange={setShowDetalhesModal}
      transferencia={transferenciaCompleta}
      itensDetalhados={itensDetalhados}
    />

    {/* Modal de Adicionar Itens por Grade */}
    {origemId && (
      <AddGradeModal
        open={showAddGrade}
        onClose={() => setShowAddGrade(false)}
        onAdd={handleAddGradeItems}
      />
    )}
  </div>;
}