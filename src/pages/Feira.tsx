import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useDisponivelCentral, useLocais, useEnsureDefaultLocais, useSincronizarEstoqueInicial } from '@/hooks/useEstoqueLocais';
import { useCriarCargaFeira, useRegistrarRetornoFeira, TransferenciaComItens } from '@/hooks/useTransferencias';
import { useRecalcularEstoque } from '@/hooks/useRecalcularEstoque';
import { useEstornarCarga } from '@/hooks/useEstornarCarga';
import { 
  PeriodoFeira, 
  calcularPeriodo, 
  useResumoFeiraPeriodo, 
  useHistoricoAgrupado, 
  useTodasCargasAtivas,
  useExcluirCargaFeira,
  useExcluirHistoricoCarga,
  TransferenciaComItensHistorico
} from '@/hooks/useFeiraHistorico';
import { FiltroPeriodo, salvarFiltroPeriodo, carregarFiltroPeriodo } from '@/components/feira/FiltroPeriodo';
import { HistoricoAgrupado } from '@/components/feira/HistoricoAgrupado';
import { DetalhesCargaModal } from '@/components/feira/DetalhesCargaModal';
import { CargasAtivasAlerta } from '@/components/feira/CargasAtivasAlerta';
import { ExcluirCargaModal } from '@/components/feira/ExcluirCargaModal';
import { ExcluirHistoricoModal } from '@/components/feira/ExcluirHistoricoModal';
import { EstornarCargaModal } from '@/components/feira/EstornarCargaModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Plus, Truck, RotateCcw, ShoppingBag, DollarSign, Loader2, Minus, X, Check, Search, Trash2, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateCargaPDF } from '@/utils/generateCargaPDF';

interface ItemCarga {
  itemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
}

export default function Feira() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { getProdutosAcabados } = useEstoque();
  const { getDisponivelCentral, isLoading: isLoadingLocais } = useDisponivelCentral();
  const { data: locais } = useLocais();
  const ensureLocais = useEnsureDefaultLocais();
  const sincronizarEstoque = useSincronizarEstoqueInicial();
  const criarCarga = useCriarCargaFeira();
  const registrarRetorno = useRegistrarRetornoFeira();
  const excluirCarga = useExcluirCargaFeira();
  const excluirHistorico = useExcluirHistoricoCarga();
  const recalcularEstoque = useRecalcularEstoque();
  const estornarCarga = useEstornarCarga();

  // Estado do período - carregado do localStorage
  const [periodo, setPeriodo] = useState<PeriodoFeira>(() => carregarFiltroPeriodo());

  // Hooks de histórico baseados no período
  const { resumo, isLoading: isLoadingResumo } = useResumoFeiraPeriodo(periodo.inicio, periodo.fim);
  const { historico, isLoading: isLoadingHistorico } = useHistoricoAgrupado(periodo.inicio, periodo.fim);
  const { data: todasCargasAtivas } = useTodasCargasAtivas();

  // Modais e estados
  const [showNovaCarga, setShowNovaCarga] = useState(false);
  const [showRetorno, setShowRetorno] = useState(false);
  const [showRecalcularConfirm, setShowRecalcularConfirm] = useState(false);
  const [cargaSelecionada, setCargaSelecionada] = useState<TransferenciaComItens | null>(null);
  const [cargaDetalhes, setCargaDetalhes] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaExcluir, setCargaExcluir] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaExcluirHistorico, setCargaExcluirHistorico] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaEstornar, setCargaEstornar] = useState<TransferenciaComItensHistorico | null>(null);
  const [itensCarga, setItensCarga] = useState<ItemCarga[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [itensRetorno, setItensRetorno] = useState<{ itemId: string; quantidadeRetornada: number }[]>([]);
  const [isRefetchingEstoque, setIsRefetchingEstoque] = useState(false);
  const [inputRetornoValues, setInputRetornoValues] = useState<Record<string, string>>({});

  const produtosAcabados = getProdutosAcabados();
  const periodoEhHoje = periodo.tipo === 'hoje';

  // Filtrar produtos em tempo real
  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto.trim()) return produtosAcabados;
    const termo = buscaProduto.toLowerCase().trim();
    return produtosAcabados.filter(p => 
      p.nome.toLowerCase().includes(termo)
    );
  }, [produtosAcabados, buscaProduto]);
  
  // Cargas ativas de HOJE (para mostrar na seção principal quando filtro = hoje)
  const cargasAtivasHoje = useMemo(() => 
    (todasCargasAtivas || []).filter(c => isToday(new Date(c.dataSaida))),
    [todasCargasAtivas]
  );

  // Limpar estado ao fechar modal
  const handleCloseNovaCarga = () => {
    setShowNovaCarga(false);
    setItensCarga([]);
    setBuscaProduto('');
  };

  // Abrir modal com estado limpo e refetch de estoque
  const handleOpenNovaCarga = async () => {
    setItensCarga([]);
    setBuscaProduto('');
    setShowNovaCarga(true);
    setIsRefetchingEstoque(true);
    
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['estoque-por-local'] }),
        queryClient.refetchQueries({ queryKey: ['estoque-locais'] }),
      ]);
    } finally {
      setIsRefetchingEstoque(false);
    }
  };

  // Salvar período no localStorage quando mudar
  useEffect(() => {
    salvarFiltroPeriodo(periodo);
  }, [periodo]);

  // Garantir que locais existem - esperar dados estarem prontos
  useEffect(() => {
    // Só tenta criar se temos certeza que não há locais (data loaded, array vazio)
    if (locais !== undefined && locais.length === 0 && !ensureLocais.isPending) {
      console.log('[Feira] Criando locais padrão...');
      ensureLocais.mutate();
    }
  }, [locais, ensureLocais.isPending]);

  // Sincronizar estoque inicial - aguardar locais existirem
  useEffect(() => {
    const hasRequiredLocais = locais && locais.length > 0 && 
      locais.some(l => l.tipo === 'central') && 
      locais.some(l => l.tipo === 'banca');
    
    if (hasRequiredLocais && !sincronizarEstoque.isPending) {
      sincronizarEstoque.mutate();
    }
  }, [locais]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleAddItemCarga = (produto: { id: string; nome: string; precoUnitario: number | null; imagemUrl?: string | null }) => {
    const disponivel = getDisponivelCentral(produto.id);
    if (disponivel <= 0) {
      toast.error('Produto sem estoque disponível no Central');
      return;
    }

    const existing = itensCarga.find(i => i.itemId === produto.id);
    if (existing) {
      toast.error('Produto já adicionado');
      return;
    }

    setItensCarga(prev => [...prev, {
      itemId: produto.id,
      nome: produto.nome,
      quantidade: 1,
      precoUnitario: produto.precoUnitario || 0,
      disponivelCentral: disponivel,
      imagemUrl: produto.imagemUrl ?? null,
    }]);
  };

  const handleUpdateQuantidadeCarga = (itemId: string, delta: number) => {
    setItensCarga(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const novaQtd = item.quantidade + delta;
        // Validar limite máximo
        if (novaQtd > item.disponivelCentral) {
          toast.warning('Quantidade máxima disponível atingida');
          return item;
        }
        return { ...item, quantidade: Math.max(1, novaQtd) };
      }
      return item;
    }));
  };

  const handleSetQuantidadeCarga = (itemId: string, novaQuantidade: number) => {
    setItensCarga(prev => prev.map(item => {
      if (item.itemId === itemId) {
        // Validar limites
        if (novaQuantidade > item.disponivelCentral) {
          toast.warning('Quantidade máxima disponível atingida');
          return { ...item, quantidade: item.disponivelCentral };
        }
        if (novaQuantidade < 1 || isNaN(novaQuantidade)) {
          return { ...item, quantidade: 1 };
        }
        return { ...item, quantidade: novaQuantidade };
      }
      return item;
    }));
  };

  const handleRemoveItemCarga = (itemId: string) => {
    setItensCarga(prev => prev.filter(i => i.itemId !== itemId));
  };

  const handleCriarCarga = async () => {
    // Proteção contra clique duplo e lista vazia
    if (itensCarga.length === 0 || criarCarga.isPending) {
      return;
    }

    try {
      await criarCarga.mutateAsync({
        itens: itensCarga.map(i => ({
          itemId: i.itemId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
        })),
      });
      toast.success('Carga criada com sucesso!');
      handleCloseNovaCarga();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar carga');
    }
  };

  // Converter TransferenciaComItensHistorico para TransferenciaComItens para o modal de retorno
  const convertToTransferenciaComItens = (carga: TransferenciaComItensHistorico): TransferenciaComItens => ({
    id: carga.id,
    localOrigemId: carga.localOrigemId,
    localDestinoId: carga.localDestinoId,
    tipo: carga.tipo as 'transferencia' | 'carga_feira',
    status: carga.status as 'em_andamento' | 'concluida' | 'cancelada',
    dataSaida: carga.dataSaida,
    dataRetorno: carga.dataRetorno,
    observacoes: carga.observacoes,
    createdAt: carga.createdAt,
      itens: carga.itens.map(item => ({
        id: item.id,
        transferenciaId: carga.id,
        itemId: item.itemId,
        quantidadeEnviada: item.quantidadeEnviada,
        quantidadeRetornada: item.quantidadeRetornada,
        precoUnitario: item.precoUnitario ?? item.produtoPreco,
        createdAt: carga.createdAt,
        produtoNome: item.produtoNome,
        produtoImagem: item.produtoImagem,
      })),
  });

  const handleOpenRetorno = (carga: TransferenciaComItens) => {
    setCargaSelecionada(carga);
    setItensRetorno(carga.itens.map(i => ({
      itemId: i.itemId,
      quantidadeRetornada: 0,
    })));
    // Inicializar inputValues com "0" para cada item
    setInputRetornoValues(
      carga.itens.reduce((acc, i) => ({ ...acc, [i.itemId]: '0' }), {})
    );
    setShowRetorno(true);
  };

  const handleOpenRetornoFromHistorico = (carga: TransferenciaComItensHistorico) => {
    handleOpenRetorno(convertToTransferenciaComItens(carga));
  };

  const handleUpdateRetorno = (itemId: string, quantidade: number) => {
    const item = cargaSelecionada?.itens.find(i => i.itemId === itemId);
    if (!item) return;

    setItensRetorno(prev => prev.map(i => {
      if (i.itemId === itemId) {
        return { ...i, quantidadeRetornada: Math.max(0, Math.min(item.quantidadeEnviada, quantidade)) };
      }
      return i;
    }));
  };

  const handleRegistrarRetorno = async () => {
    if (!cargaSelecionada) return;

    try {
      await registrarRetorno.mutateAsync({
        transferenciaId: cargaSelecionada.id,
        itensRetornados: itensRetorno,
      });
      toast.success('Retorno registrado com sucesso!');
      setShowRetorno(false);
      setCargaSelecionada(null);
      setItensRetorno([]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar retorno');
    }
  };

  const totalCarga = itensCarga.reduce((sum, i) => sum + i.quantidade, 0);
  const valorCarga = itensCarga.reduce((sum, i) => sum + (i.quantidade * i.precoUnitario), 0);

  // Handler para excluir carga (apenas em_andamento)
  const handleExcluirCarga = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'em_andamento') {
      toast.error('Apenas cargas em andamento podem ser excluídas');
      return;
    }
    setCargaExcluir(carga);
  };

  // Handler para estornar carga (apenas concluida)
  const handleEstornarCarga = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'concluida') {
      toast.error('Apenas cargas concluídas podem ser estornadas');
      return;
    }
    setCargaEstornar(carga);
  };

  // Handler para excluir carga do histórico (apenas estornada/cancelada)
  const handleExcluirHistorico = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'estornada' && carga.status !== 'cancelada') {
      toast.error('Apenas cargas estornadas ou canceladas podem ser removidas do histórico');
      return;
    }
    setCargaExcluirHistorico(carga);
  };

  const handleRecalcularEstoque = async () => {
    try {
      const result = await recalcularEstoque.mutateAsync();
      toast.success(
        `Estoque recalculado! ${result.itensProcessados} itens, ${result.transferenciasProcessadas} transferências, ${result.movimentacoesCriadas} movimentações criadas.`
      );
      setShowRecalcularConfirm(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao recalcular estoque');
    }
  };

  // Handler para gerar PDF da carga
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const handleGerarPDF = async (carga: TransferenciaComItensHistorico) => {
    if (isGeneratingPDF) return;
    
    setIsGeneratingPDF(true);
    toast.info('Gerando PDF...');
    
    try {
      await generateCargaPDF(carga);
      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const isLoading = isLoadingLocais || isLoadingResumo;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {isMobile && <MobileHeader title="Feira" />}
      {!isMobile && <AppSidebar />}

      <main className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden",
        isMobile && "pt-14 pb-20"
      )}>
        {/* Header - Desktop */}
        {!isMobile && (
          <header className="px-6 py-4 border-b border-border bg-card/50">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Feira</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowRecalcularConfirm(true)}
                  disabled={recalcularEstoque.isPending}
                  className="gap-2"
                >
                  <RefreshCw size={16} className={recalcularEstoque.isPending ? 'animate-spin' : ''} />
                  Recalcular Estoque
                </Button>
                <Button onClick={handleOpenNovaCarga} className="gap-2">
                  <Plus size={18} />
                  Nova Carga
                </Button>
              </div>
            </div>
          </header>
        )}

        {/* Mobile Action Button */}
        {isMobile && (
          <div className="px-4 py-3">
            <Button onClick={handleOpenNovaCarga} className="w-full gap-2">
              <Plus size={18} />
              Nova Carga
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className={cn("p-4 space-y-4", !isMobile && "p-6 space-y-6")}>
            {/* Filtro de Período */}
            <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />

            {/* Resumo do Período */}
            <div className={cn(
              "grid gap-3",
              isMobile ? "grid-cols-2" : "grid-cols-4"
            )}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Carga</p>
                      <p className="text-xl font-bold">{resumo.totalCarga}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <RotateCcw className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Retorno</p>
                      <p className="text-xl font-bold">{resumo.totalRetorno}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <ShoppingBag className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vendido</p>
                      <p className="text-xl font-bold text-emerald-600">{resumo.totalVendido}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="text-xl font-bold text-primary">
                        {isMobile 
                          ? `${(resumo.valorVendido / 1000).toFixed(1)}k`
                          : formatCurrency(resumo.valorVendido)
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerta de Cargas Ativas (quando período não é Hoje) */}
            <CargasAtivasAlerta
              cargasAtivas={todasCargasAtivas || []}
              onVerCarga={(carga) => setCargaDetalhes(carga)}
              periodoEhHoje={periodoEhHoje}
            />

            {/* Cargas Ativas de Hoje (apenas quando período = Hoje) */}
            {periodoEhHoje && cargasAtivasHoje.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Cargas Ativas</h2>
                <div className="grid gap-3">
                  {cargasAtivasHoje.map(carga => {
                    const totalPecas = carga.itens.reduce((s, i) => s + i.quantidadeEnviada, 0);
                    const valorTotal = carga.itens.reduce((s, i) => s + (i.quantidadeEnviada * (i.precoUnitario || i.produtoPreco || 0)), 0);

                    return (
                      <Card key={carga.id} className="border-primary/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                Em andamento
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(carga.dataSaida), "HH:mm")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => handleGerarPDF(carga)}
                                disabled={isGeneratingPDF}
                                className="gap-1"
                              >
                                <FileText size={14} />
                                PDF
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => handleOpenRetornoFromHistorico(carga)}
                                className="gap-1"
                              >
                                <RotateCcw size={14} />
                                Registrar Retorno
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>{totalPecas} peças</span>
                            <span className="font-semibold">{formatCurrency(valorTotal)}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {carga.itens.slice(0, 3).map(item => (
                              <Badge key={item.id} variant="secondary" className="text-xs">
                                {item.quantidadeEnviada}x {item.produtoNome?.slice(0, 15) || ''}
                              </Badge>
                            ))}
                            {carga.itens.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{carga.itens.length - 3}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Histórico Agrupado */}
            <HistoricoAgrupado
              historico={historico}
              onVerDetalhes={(carga) => setCargaDetalhes(carga)}
              onExcluirCarga={handleExcluirCarga}
              onEstornarCarga={handleEstornarCarga}
              onExcluirHistorico={handleExcluirHistorico}
              isLoading={isLoadingHistorico}
            />
          </div>
        </ScrollArea>
      </main>

      {isMobile && <BottomNavigation />}

      {/* Modal Detalhes da Carga */}
      <DetalhesCargaModal
        carga={cargaDetalhes}
        onClose={() => setCargaDetalhes(null)}
      />

      {/* Modal Excluir Carga (apenas para em_andamento) */}
      <ExcluirCargaModal
        carga={cargaExcluir}
        onClose={() => setCargaExcluir(null)}
        onConfirm={async (motivo) => {
          if (!cargaExcluir) return;
          try {
            await excluirCarga.mutateAsync({
              transferenciaId: cargaExcluir.id,
              motivo,
            });
            toast.success('Carga excluída e estoque revertido');
            setCargaExcluir(null);
          } catch (error: any) {
            toast.error(error.message || 'Erro ao excluir carga');
          }
        }}
        isLoading={excluirCarga.isPending}
      />

      {/* Modal Estornar Carga (apenas para concluídas) */}
      <EstornarCargaModal
        carga={cargaEstornar}
        onClose={() => setCargaEstornar(null)}
        onConfirm={async (motivo) => {
          if (!cargaEstornar) return;
          try {
            await estornarCarga.mutateAsync({
              transferenciaId: cargaEstornar.id,
              motivo,
            });
            toast.success('Carga estornada! Produtos devolvidos ao estoque Central.');
            setCargaEstornar(null);
          } catch (error: any) {
            toast.error(error.message || 'Erro ao estornar carga');
          }
        }}
        isLoading={estornarCarga.isPending}
      />

      {/* Modal Excluir do Histórico (apenas para estornadas/canceladas) */}
      <ExcluirHistoricoModal
        carga={cargaExcluirHistorico}
        onClose={() => setCargaExcluirHistorico(null)}
        onConfirm={async () => {
          if (!cargaExcluirHistorico) return;
          try {
            await excluirHistorico.mutateAsync({
              transferenciaId: cargaExcluirHistorico.id,
            });
            toast.success('Carga removida do histórico');
            setCargaExcluirHistorico(null);
          } catch (error: any) {
            toast.error(error.message || 'Erro ao excluir do histórico');
          }
        }}
        isLoading={excluirHistorico.isPending}
      />

      {/* Modal Confirmar Recálculo de Estoque */}
      <Dialog open={showRecalcularConfirm} onOpenChange={setShowRecalcularConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Recalcular Estoque
            </DialogTitle>
            <DialogDescription>
              Esta ação irá reconstruir todo o histórico de movimentações e recalcular os saldos de estoque do zero.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              O sistema irá:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Limpar movimentações existentes</li>
              <li>Recalcular estoque Central e Banca</li>
              <li>Recriar histórico de auditoria</li>
            </ul>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRecalcularConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRecalcularEstoque}
              disabled={recalcularEstoque.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {recalcularEstoque.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Confirmar Recálculo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nova Carga - Mobile uses Drawer, Desktop uses Dialog */}
      {isMobile ? (
        <Drawer open={showNovaCarga} onOpenChange={(open) => !open && handleCloseNovaCarga()}>
          <DrawerContent className="max-h-[95vh] flex flex-col">
            <DrawerHeader className="px-4 pt-2 pb-3 border-b shrink-0">
              <DrawerTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5 text-primary" />
                Nova Carga para Feira
              </DrawerTitle>
            </DrawerHeader>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Campo de Busca */}
              <div className="px-4 py-2 border-b bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    className="pl-9 pr-9 bg-background h-10"
                  />
                  {buscaProduto && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setBuscaProduto('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Produtos Disponíveis */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/20">
                  Produtos ({produtosFiltrados.length})
                </div>
                <ScrollArea className="flex-1 min-h-[120px] max-h-[30vh]">
                  {isRefetchingEstoque ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : produtosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <Package className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">Nenhum produto</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {produtosFiltrados.map(produto => {
                        const disponivel = getDisponivelCentral(produto.id);
                        const jaAdicionado = itensCarga.some(i => i.itemId === produto.id);
                        const semEstoque = disponivel <= 0;
                        
                        return (
                          <div 
                            key={produto.id}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 transition-all min-h-[56px]",
                              jaAdicionado && "bg-emerald-50 dark:bg-emerald-900/20",
                              semEstoque && "opacity-50",
                              !jaAdicionado && !semEstoque && "active:bg-muted/50"
                            )}
                            onClick={() => !jaAdicionado && !semEstoque && handleAddItemCarga(produto)}
                          >
                            <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                              <LotImage src={produto.imagemUrl} alt={produto.nome} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{produto.nome}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-xs font-medium", disponivel > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                                  Disp: {disponivel}
                                </span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{formatCurrency(produto.precoUnitario || 0)}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {jaAdicionado ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs px-2">
                                  <Check size={10} className="mr-1" /> OK
                                </Badge>
                              ) : semEstoque ? (
                                <Badge variant="outline" className="text-muted-foreground text-xs">Sem</Badge>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-primary">
                                  <Plus size={20} />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Itens Selecionados - Mobile Layout */}
              {itensCarga.length > 0 && (
                <div className="border-t flex-shrink-0">
                  <div className="px-4 py-1.5 flex items-center justify-between border-b bg-primary/5">
                    <span className="text-xs font-medium text-primary uppercase tracking-wide">
                      Selecionados ({itensCarga.length})
                    </span>
                  </div>
                  <ScrollArea className="max-h-[25vh]">
                    <div className="divide-y">
                      {itensCarga.map(item => (
                        <div key={item.itemId} className="px-4 py-2 bg-card space-y-2">
                          {/* Linha 1: Imagem, Nome, Lixeira */}
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded overflow-hidden bg-muted flex-shrink-0 border">
                              <LotImage src={item.imagemUrl} alt={item.nome} className="w-full h-full object-cover" />
                            </div>
                            <p className="text-sm font-medium truncate flex-1">{item.nome}</p>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveItemCarga(item.itemId)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                          {/* Linha 2: Preço, Controles, Subtotal */}
                          <div className="flex items-center justify-between pl-11">
                            <span className="text-xs text-muted-foreground">{formatCurrency(item.precoUnitario)}</span>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleUpdateQuantidadeCarga(item.itemId, -1)} disabled={item.quantidade <= 1}>
                                <Minus size={14} />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={item.disponivelCentral}
                                value={item.quantidade}
                                onChange={(e) => handleSetQuantidadeCarga(item.itemId, parseInt(e.target.value) || 1)}
                                className="w-12 h-8 text-center text-sm font-medium px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleUpdateQuantidadeCarga(item.itemId, 1)} disabled={item.quantidade >= item.disponivelCentral}>
                                <Plus size={14} />
                              </Button>
                            </div>
                            <span className="text-sm font-semibold text-primary min-w-[70px] text-right">
                              {formatCurrency(item.precoUnitario * item.quantidade)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <DrawerFooter className="border-t px-4 py-3 bg-muted/30 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              {/* Resumo em Grid */}
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="flex flex-col items-center">
                  <Package className="h-4 w-4 text-muted-foreground mb-0.5" />
                  <span className="text-[10px] text-muted-foreground">Itens</span>
                  <strong className="text-sm">{itensCarga.length}</strong>
                </div>
                <div className="flex flex-col items-center">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground mb-0.5" />
                  <span className="text-[10px] text-muted-foreground">Peças</span>
                  <strong className="text-sm">{totalCarga}</strong>
                </div>
                <div className="flex flex-col items-center">
                  <DollarSign className="h-4 w-4 text-primary mb-0.5" />
                  <span className="text-[10px] text-muted-foreground">Total</span>
                  <strong className="text-sm text-primary">{formatCurrency(valorCarga)}</strong>
                </div>
              </div>
              {/* Botões full width */}
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={handleCloseNovaCarga} className="flex-1 h-11">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCriarCarga}
                  disabled={itensCarga.length === 0 || criarCarga.isPending}
                  className="flex-1 h-11"
                >
                  {criarCarga.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</>
                  ) : itensCarga.length === 0 ? (
                    'Selecione'
                  ) : (
                    <><Truck className="h-4 w-4 mr-2" /> Criar Carga</>
                  )}
                </Button>
              </div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showNovaCarga} onOpenChange={(open) => !open && handleCloseNovaCarga()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
            <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Nova Carga para Feira
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Campo de Busca */}
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto (nome, código...)"
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    className="pl-9 pr-9 bg-background"
                  />
                  {buscaProduto && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setBuscaProduto('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Produtos Disponíveis */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/20">
                  Produtos Disponíveis ({produtosFiltrados.length})
                </div>
                <ScrollArea className="h-[200px]">
                  {isRefetchingEstoque ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : produtosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Package className="h-10 w-10 mb-2 opacity-40" />
                      <p className="text-sm">Nenhum produto encontrado</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {produtosFiltrados.map(produto => {
                        const disponivel = getDisponivelCentral(produto.id);
                        const jaAdicionado = itensCarga.some(i => i.itemId === produto.id);
                        const semEstoque = disponivel <= 0;
                        
                        return (
                          <div 
                            key={produto.id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 transition-all",
                              jaAdicionado && "bg-emerald-50 dark:bg-emerald-900/20",
                              semEstoque && "opacity-50 cursor-not-allowed",
                              !jaAdicionado && !semEstoque && "hover:bg-muted/30 cursor-pointer"
                            )}
                            onClick={() => !jaAdicionado && !semEstoque && handleAddItemCarga(produto)}
                          >
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                              <LotImage src={produto.imagemUrl} alt={produto.nome} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{produto.nome}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-xs font-medium", disponivel > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                                  Disp: {disponivel}
                                </span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{formatCurrency(produto.precoUnitario || 0)}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {jaAdicionado && (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                  <Check size={12} className="mr-1" /> Na carga
                                </Badge>
                              )}
                              {!jaAdicionado && semEstoque && (
                                <Badge variant="outline" className="text-muted-foreground">Sem estoque</Badge>
                              )}
                              {!jaAdicionado && !semEstoque && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary"><Plus size={18} /></Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Itens Selecionados */}
              {itensCarga.length > 0 && (
                <div className="border-t flex-shrink-0">
                  <div className="px-4 py-2 flex items-center justify-between border-b bg-primary/5">
                    <span className="text-xs font-medium text-primary uppercase tracking-wide">
                      Itens Selecionados ({itensCarga.length})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {totalCarga} pç • {formatCurrency(valorCarga)}
                    </span>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="divide-y">
                      {itensCarga.map(item => (
                        <div key={item.itemId} className="flex items-center gap-3 px-4 py-2.5 bg-card">
                          <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0 border">
                            <LotImage src={item.imagemUrl} alt={item.nome} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.nome}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.precoUnitario)} × {item.quantidade}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleUpdateQuantidadeCarga(item.itemId, -1); }} disabled={item.quantidade <= 1}>
                              <Minus size={14} />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={item.disponivelCentral}
                              value={item.quantidade}
                              onChange={(e) => handleSetQuantidadeCarga(item.itemId, parseInt(e.target.value) || 1)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 h-7 text-center text-sm font-medium px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleUpdateQuantidadeCarga(item.itemId, 1); }} disabled={item.quantidade >= item.disponivelCentral}>
                              <Plus size={14} />
                            </Button>
                          </div>
                          <span className="text-sm font-semibold text-primary w-20 text-right">{formatCurrency(item.precoUnitario * item.quantidade)}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleRemoveItemCarga(item.itemId); }}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <DialogFooter className="border-t px-4 py-3 bg-muted/30">
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Itens:</span>
                    <strong>{itensCarga.length}</strong>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Peças:</span>
                    <strong>{totalCarga}</strong>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Total:</span>
                    <strong className="text-primary text-base">{formatCurrency(valorCarga)}</strong>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCloseNovaCarga}>Cancelar</Button>
                  <Button onClick={handleCriarCarga} disabled={itensCarga.length === 0 || criarCarga.isPending} className="min-w-[140px]">
                    {criarCarga.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</>
                    ) : itensCarga.length === 0 ? (
                      'Selecione produtos'
                    ) : (
                      <><Truck className="h-4 w-4 mr-2" /> Criar Carga</>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Retorno */}
      <Dialog open={showRetorno} onOpenChange={setShowRetorno}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <DialogTitle className="text-lg">Registrar Retorno</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Informe quantos itens retornaram da feira
            </DialogDescription>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              Vendido é calculado automaticamente: Enviado − Retorno
            </p>
          </DialogHeader>

          {/* Header de colunas fixo */}
          <div className="grid grid-cols-[40px_1fr_50px_80px_70px] gap-2 px-4 py-2 border-b bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span></span>
            <span>Produto</span>
            <span className="text-center">Enviado</span>
            <span className="text-center">Retorno</span>
            <span className="text-center">Vendido</span>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="divide-y">
              {cargaSelecionada?.itens.map(item => {
                const retorno = itensRetorno.find(i => i.itemId === item.itemId);
                const retornado = retorno?.quantidadeRetornada || 0;
                const vendido = item.quantidadeEnviada - retornado;
                const itemWithExtras = item as typeof item & { produtoNome?: string | null; produtoImagem?: string | null };

                return (
                  <div key={item.id} className="grid grid-cols-[40px_1fr_50px_80px_70px] gap-2 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    {/* Coluna 1: Imagem */}
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <LotImage 
                        src={itemWithExtras.produtoImagem} 
                        alt={itemWithExtras.produtoNome || 'Produto'} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Coluna 2: Nome do Produto */}
                    <p className="text-sm font-medium truncate leading-tight">
                      {itemWithExtras.produtoNome || `Item #${item.itemId.slice(0, 8)}`}
                    </p>
                    
                    {/* Coluna 3: Enviado */}
                    <span className="text-center text-sm font-medium text-blue-600 dark:text-blue-400">
                      {item.quantidadeEnviada}
                    </span>
                    
                    {/* Coluna 4: Input Retorno */}
                    <div className="flex items-center justify-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          const newVal = Math.max(0, retornado - 1);
                          handleUpdateRetorno(item.itemId, newVal);
                          setInputRetornoValues(prev => ({ ...prev, [item.itemId]: String(newVal) }));
                        }}
                        disabled={retornado <= 0}
                      >
                        <Minus size={12} />
                      </Button>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={inputRetornoValues[item.itemId] ?? String(retornado)}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            setInputRetornoValues(prev => ({ ...prev, [item.itemId]: val }));
                            if (val !== '') {
                              handleUpdateRetorno(item.itemId, parseInt(val, 10));
                            }
                          }
                        }}
                        onBlur={() => {
                          const val = inputRetornoValues[item.itemId];
                          if (val === '' || isNaN(parseInt(val, 10))) {
                            setInputRetornoValues(prev => ({ ...prev, [item.itemId]: '0' }));
                            handleUpdateRetorno(item.itemId, 0);
                          } else {
                            const numVal = parseInt(val, 10);
                            const clampedVal = Math.max(0, Math.min(item.quantidadeEnviada, numVal));
                            setInputRetornoValues(prev => ({ ...prev, [item.itemId]: String(clampedVal) }));
                            handleUpdateRetorno(item.itemId, clampedVal);
                          }
                        }}
                        className="w-10 h-6 text-center text-xs font-medium px-0"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          const newVal = Math.min(item.quantidadeEnviada, retornado + 1);
                          handleUpdateRetorno(item.itemId, newVal);
                          setInputRetornoValues(prev => ({ ...prev, [item.itemId]: String(newVal) }));
                        }}
                        disabled={retornado >= item.quantidadeEnviada}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                    
                    {/* Coluna 5: Vendido - sempre com estilo suave */}
                    <span className="inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                      {vendido} vendido
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer fixo com resumo */}
          <div className="border-t px-4 py-3 shrink-0 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-3 text-xs">
                <span className="text-muted-foreground">
                  Total enviado: <strong className="text-foreground">{cargaSelecionada?.itens.reduce((sum, i) => sum + i.quantidadeEnviada, 0) || 0}</strong>
                </span>
                <span className="text-muted-foreground">
                  Retorno: <strong className="text-amber-600">{itensRetorno.reduce((sum, i) => sum + i.quantidadeRetornada, 0)}</strong>
                </span>
                <span className="text-muted-foreground">
                  Vendido: <strong className="text-emerald-600">{(cargaSelecionada?.itens.reduce((sum, i) => sum + i.quantidadeEnviada, 0) || 0) - itensRetorno.reduce((sum, i) => sum + i.quantidadeRetornada, 0)}</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRetorno(false)} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleRegistrarRetorno}
                disabled={registrarRetorno.isPending}
                className="flex-1"
              >
                {registrarRetorno.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
