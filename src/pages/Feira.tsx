import { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useDisponivelCentral, useLocais, useEnsureDefaultLocais, useSincronizarEstoqueInicial } from '@/hooks/useEstoqueLocais';
import { useCriarCargaFeira, useRegistrarRetornoFeira, TransferenciaComItens } from '@/hooks/useTransferencias';
import { 
  PeriodoFeira, 
  calcularPeriodo, 
  useResumoFeiraPeriodo, 
  useHistoricoAgrupado, 
  useTodasCargasAtivas,
  useExcluirCargaFeira,
  TransferenciaComItensHistorico
} from '@/hooks/useFeiraHistorico';
import { FiltroPeriodo, salvarFiltroPeriodo, carregarFiltroPeriodo } from '@/components/feira/FiltroPeriodo';
import { HistoricoAgrupado } from '@/components/feira/HistoricoAgrupado';
import { DetalhesCargaModal } from '@/components/feira/DetalhesCargaModal';
import { CargasAtivasAlerta } from '@/components/feira/CargasAtivasAlerta';
import { ExcluirCargaModal } from '@/components/feira/ExcluirCargaModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Plus, Truck, RotateCcw, ShoppingBag, DollarSign, Loader2, Minus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ItemCarga {
  itemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
}

export default function Feira() {
  const isMobile = useIsMobile();
  const { getProdutosAcabados } = useEstoque();
  const { getDisponivelCentral, isLoading: isLoadingLocais } = useDisponivelCentral();
  const { data: locais } = useLocais();
  const ensureLocais = useEnsureDefaultLocais();
  const sincronizarEstoque = useSincronizarEstoqueInicial();
  const criarCarga = useCriarCargaFeira();
  const registrarRetorno = useRegistrarRetornoFeira();
  const excluirCarga = useExcluirCargaFeira();

  // Estado do período - carregado do localStorage
  const [periodo, setPeriodo] = useState<PeriodoFeira>(() => carregarFiltroPeriodo());

  // Hooks de histórico baseados no período
  const { resumo, isLoading: isLoadingResumo } = useResumoFeiraPeriodo(periodo.inicio, periodo.fim);
  const { historico, isLoading: isLoadingHistorico } = useHistoricoAgrupado(periodo.inicio, periodo.fim);
  const { data: todasCargasAtivas } = useTodasCargasAtivas();

  // Modais e estados
  const [showNovaCarga, setShowNovaCarga] = useState(false);
  const [showRetorno, setShowRetorno] = useState(false);
  const [cargaSelecionada, setCargaSelecionada] = useState<TransferenciaComItens | null>(null);
  const [cargaDetalhes, setCargaDetalhes] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaExcluir, setCargaExcluir] = useState<TransferenciaComItensHistorico | null>(null);
  const [itensCarga, setItensCarga] = useState<ItemCarga[]>([]);
  const [itensRetorno, setItensRetorno] = useState<{ itemId: string; quantidadeRetornada: number }[]>([]);

  const produtosAcabados = getProdutosAcabados();
  const periodoEhHoje = periodo.tipo === 'hoje';
  
  // Cargas ativas de HOJE (para mostrar na seção principal quando filtro = hoje)
  const cargasAtivasHoje = useMemo(() => 
    (todasCargasAtivas || []).filter(c => isToday(new Date(c.dataSaida))),
    [todasCargasAtivas]
  );

  // Salvar período no localStorage quando mudar
  useEffect(() => {
    salvarFiltroPeriodo(periodo);
  }, [periodo]);

  // Garantir que locais existem
  useEffect(() => {
    if (locais && locais.length === 0) {
      ensureLocais.mutate();
    }
  }, [locais]);

  // Sincronizar estoque inicial
  useEffect(() => {
    if (locais && locais.length > 0) {
      sincronizarEstoque.mutate();
    }
  }, [locais?.length]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleAddItemCarga = (produto: { id: string; nome: string; precoUnitario: number | null }) => {
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
    }]);
  };

  const handleUpdateQuantidadeCarga = (itemId: string, delta: number) => {
    setItensCarga(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const novaQtd = Math.max(1, Math.min(item.disponivelCentral, item.quantidade + delta));
        return { ...item, quantidade: novaQtd };
      }
      return item;
    }));
  };

  const handleRemoveItemCarga = (itemId: string) => {
    setItensCarga(prev => prev.filter(i => i.itemId !== itemId));
  };

  const handleCriarCarga = async () => {
    if (itensCarga.length === 0) {
      toast.error('Adicione ao menos um item');
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
      setShowNovaCarga(false);
      setItensCarga([]);
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
    })),
  });

  const handleOpenRetorno = (carga: TransferenciaComItens) => {
    setCargaSelecionada(carga);
    setItensRetorno(carga.itens.map(i => ({
      itemId: i.itemId,
      quantidadeRetornada: 0,
    })));
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
              <Button onClick={() => setShowNovaCarga(true)} className="gap-2">
                <Plus size={18} />
                Nova Carga
              </Button>
            </div>
          </header>
        )}

        {/* Mobile Action Button */}
        {isMobile && (
          <div className="px-4 py-3">
            <Button onClick={() => setShowNovaCarga(true)} className="w-full gap-2">
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
                            <Button 
                              size="sm" 
                              onClick={() => handleOpenRetornoFromHistorico(carga)}
                              className="gap-1"
                            >
                              <RotateCcw size={14} />
                              Registrar Retorno
                            </Button>
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
              onExcluirCarga={(carga) => setCargaExcluir(carga)}
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

      {/* Modal Excluir Carga */}
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

      {/* Modal Nova Carga */}
      <Dialog open={showNovaCarga} onOpenChange={setShowNovaCarga}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nova Carga para Feira</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Produtos Disponíveis */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Adicionar Produtos</Label>
              <ScrollArea className="h-48 border rounded-lg p-2">
                <div className="space-y-2">
                  {produtosAcabados.map(produto => {
                    const disponivel = getDisponivelCentral(produto.id);
                    const jaAdicionado = itensCarga.some(i => i.itemId === produto.id);
                    
                    return (
                      <div 
                        key={produto.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border transition-colors",
                          jaAdicionado 
                            ? "bg-muted/50 opacity-50" 
                            : disponivel > 0 
                              ? "hover:bg-muted/30 cursor-pointer"
                              : "opacity-40"
                        )}
                        onClick={() => !jaAdicionado && disponivel > 0 && handleAddItemCarga(produto)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{produto.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Disponível: {disponivel} • {formatCurrency(produto.precoUnitario || 0)}
                          </p>
                        </div>
                        {!jaAdicionado && disponivel > 0 && (
                          <Plus size={16} className="text-primary shrink-0" />
                        )}
                        {jaAdicionado && (
                          <Check size={16} className="text-emerald-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Itens Selecionados */}
            {itensCarga.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Itens na Carga ({totalCarga} peças)
                </Label>
                <div className="space-y-2">
                  {itensCarga.map(item => (
                    <div 
                      key={item.itemId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.precoUnitario)} × {item.quantidade} = {formatCurrency(item.precoUnitario * item.quantidade)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantidadeCarga(item.itemId, -1)}
                          disabled={item.quantidade <= 1}
                        >
                          <Minus size={14} />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantidade}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantidadeCarga(item.itemId, 1)}
                          disabled={item.quantidade >= item.disponivelCentral}
                        >
                          <Plus size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveItemCarga(item.itemId)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold">{totalCarga} peças</span>
                <span className="mx-2">•</span>
                <span className="font-bold text-primary">{formatCurrency(valorCarga)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNovaCarga(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCriarCarga}
                  disabled={itensCarga.length === 0 || criarCarga.isPending}
                >
                  {criarCarga.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Truck className="h-4 w-4 mr-2" />
                  )}
                  Criar Carga
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Retorno */}
      <Dialog open={showRetorno} onOpenChange={setShowRetorno}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Retorno da Feira</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe a quantidade de cada item que retornou da feira:
            </p>

            <div className="space-y-3">
              {cargaSelecionada?.itens.map(item => {
                const retorno = itensRetorno.find(i => i.itemId === item.itemId);
                const vendido = item.quantidadeEnviada - (retorno?.quantidadeRetornada || 0);

                return (
                  <div key={item.id} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Item #{item.itemId.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">
                        Enviado: {item.quantidadeEnviada}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground shrink-0">Retornou:</Label>
                      <Input
                        type="number"
                        min={0}
                        max={item.quantidadeEnviada}
                        value={retorno?.quantidadeRetornada || 0}
                        onChange={(e) => handleUpdateRetorno(item.itemId, parseInt(e.target.value) || 0)}
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground">→</span>
                      <Badge variant={vendido > 0 ? "default" : "secondary"} className="text-xs">
                        {vendido} vendido{vendido !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetorno(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRegistrarRetorno}
              disabled={registrarRetorno.isPending}
            >
              {registrarRetorno.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmar Retorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
