import { useState, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileDown, FileSpreadsheet, Loader2, Calendar, Filter, TrendingDown, DollarSign, Package, Search, X, CheckSquare, Trash2, Shirt } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import {
  useRelatorioSaidas,
  useLocaisParaFiltro,
  useModelosParaFiltro,
  FiltrosSaidas,
  FiltroMovimentacao,
  TIPO_LABELS,
} from '@/hooks/useRelatorioSaidas';
import { useTiposAjusteParaFiltro } from '@/hooks/useTiposAjuste';
import { useExcluirMovimentacoes } from '@/hooks/useExcluirMovimentacoes';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { generateRelatorioSaidasPDF } from '@/utils/generateRelatorioSaidasPDF';
import { generateRelatorioSaidasExcel } from '@/utils/generateRelatorioSaidasExcel';

// Tipos de sistema removidos - filtro agora mostra apenas tipos de ajuste do usuário

interface RelatorioSaidasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localIdInicial?: string;
}

export function RelatorioSaidasModal({
  open,
  onOpenChange,
  localIdInicial,
}: RelatorioSaidasModalProps) {
  // Estado dos filtros
  const [dataInicial, setDataInicial] = useState<Date>(startOfMonth(new Date()));
  const [dataFinal, setDataFinal] = useState<Date>(new Date());
  const [localId, setLocalId] = useState<string>(localIdInicial || 'todos');
  const [filtrosMovimentacao, setFiltrosMovimentacao] = useState<FiltroMovimentacao[]>([]);
  const [modelosSelecionados, setModelosSelecionados] = useState<{ id: string; nome: string; categoria: string }[]>([]);
  const [modeloBusca, setModeloBusca] = useState('');
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosSaidas | null>(null);

  // Estado de seleção para exclusão e exportação
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Debounce para busca de modelos
  const modeloBuscaDebounced = useDebouncedValue(modeloBusca, 300);

  // Queries
  const { data: locais } = useLocaisParaFiltro();
  const { data: modelosDisponiveis, isLoading: isLoadingModelos } = useModelosParaFiltro(modeloBuscaDebounced);
  const { data: tiposAjusteDisponiveis = [], isLoading: isLoadingTiposAjuste } = useTiposAjusteParaFiltro(localId !== 'todos' ? localId : undefined);
  const { data, isLoading, isFetching } = useRelatorioSaidas(filtrosAplicados);
  const excluirMutation = useExcluirMovimentacoes();

  const saidas = data?.saidas || [];
  const resumo = data?.resumo || { totalPecas: 0, valorVendaTotal: 0, valorCustoTotal: null, quantidadeSemPreco: 0 };

  // Construir lista de tipos de ajuste do usuário (todos, incluindo contaComoVenda), deduplicados por nome
  const opcoesUnificadas = useMemo(() => {
    const tiposAjusteFiltro: FiltroMovimentacao[] = (tiposAjusteDisponiveis || [])
      .reduce((acc, t) => {
        if (!acc.some(x => x.label.toLowerCase() === t.nome.toLowerCase())) {
          acc.push({ kind: 'ajuste' as const, value: t.id, label: t.nome });
        }
        return acc;
      }, [] as FiltroMovimentacao[]);

    return tiposAjusteFiltro;
  }, [tiposAjusteDisponiveis]);

  // Nome do local selecionado para exibição
  const localNomeFiltro = useMemo(() => {
    if (!localId || localId === 'todos') return undefined;
    return locais?.find(l => l.id === localId)?.nome;
  }, [localId, locais]);

  // Seleção de movimentações
  const allSelected = saidas.length > 0 && selectedIds.size === saidas.length;
  const someSelected = selectedIds.size > 0;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(saidas.map(s => s.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    const movParaExcluir = saidas
      .filter(s => selectedIds.has(s.id))
      .map(s => ({
        id: s.id,
        itemId: s.itemId,
        localId: s.localId,
        quantidade: s.quantidade,
        tipo: s.tipo,
      }));

    await excluirMutation.mutateAsync(movParaExcluir);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  // Aplicar filtros
  const handleAplicarFiltros = () => {
    setSelectedIds(new Set());
    setFiltrosAplicados({
      dataInicial,
      dataFinal,
      localId: localId !== 'todos' ? localId : undefined,
      filtrosMovimentacao: filtrosMovimentacao.length > 0 ? filtrosMovimentacao : undefined,
      modeloIds: modelosSelecionados.length > 0 ? modelosSelecionados.map(m => m.id) : undefined,
    });
  };

  // Toggle filtro de movimentação unificado
  const handleToggleFiltroMov = (filtro: FiltroMovimentacao) => {
    setFiltrosMovimentacao(prev => {
      const key = `${filtro.kind}:${filtro.value}`;
      const exists = prev.some(f => `${f.kind}:${f.value}` === key);
      if (exists) {
        return prev.filter(f => `${f.kind}:${f.value}` !== key);
      }
      return [...prev, filtro];
    });
  };

  const isFiltroSelecionado = (filtro: FiltroMovimentacao) => {
    return filtrosMovimentacao.some(f => f.kind === filtro.kind && f.value === filtro.value);
  };

  // Exportar PDF
  const handleExportPDF = async () => {
    try {
      if (!filtrosAplicados || saidas.length === 0) return;
      setIsExportingPDF(true);
      // Pequeno delay para permitir que o React renderize o estado de loading antes da thread ser bloqueada
      await new Promise(resolve => setTimeout(resolve, 100));

      const dadosValidos = saidas.filter(s => s && typeof s.quantidade === 'number');
      generateRelatorioSaidasPDF({
        saidas: dadosValidos,
        resumo,
        filtros: filtrosAplicados,
        localNomeFiltro,
      });
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      alert(`Erro ao exportar PDF: ${error.message}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Toggle modelo selecionado
  const handleToggleModelo = (modelo: { id: string; nome: string; categoria: string }) => {
    setModelosSelecionados(prev => {
      const isSelected = prev.some(m => m.id === modelo.id);
      if (isSelected) {
        return prev.filter(m => m.id !== modelo.id);
      }
      return [...prev, modelo];
    });
  };

  // Selecionar todos os modelos filtrados
  const handleSelecionarTodosModelos = () => {
    if (!modelosDisponiveis) return;
    const modelosParaAdicionar = modelosDisponiveis.filter(
      m => !modelosSelecionados.some(s => s.id === m.id)
    );
    setModelosSelecionados(prev => [...prev, ...modelosParaAdicionar]);
  };

  // Limpar modelos selecionados
  const handleLimparModelos = () => {
    setModelosSelecionados([]);
  };

  // Exportar Excel/CSV
  const handleExportExcel = async () => {
    try {
      if (!filtrosAplicados || saidas.length === 0) return;
      setIsExportingExcel(true);
      // Pequeno delay para renderizar o spinner
      await new Promise(resolve => setTimeout(resolve, 100));

      const dadosValidos = saidas.filter(s => s && typeof s.quantidade === 'number');
      generateRelatorioSaidasExcel({
        saidas: dadosValidos,
        resumo,
        filtros: filtrosAplicados,
        localNomeFiltro,
      });
    } catch (error: any) {
      console.error("Erro ao gerar Excel:", error);
      alert(`Erro ao exportar Excel: ${error.message}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Formatar moeda
  const formatarMoeda = (valor: number | null) => {
    if (valor === null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Formatar data
  const formatarData = (data: Date) => {
    return format(data, 'dd/MM HH:mm', { locale: ptBR });
  };

  // Truncar texto
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  // --- Cálculos de novas métricas (safe-add) ---
  const ticketMedio = resumo.totalPecas > 0
    ? resumo.valorVendaTotal / resumo.totalPecas
    : 0;

  const produtoDestaque = useMemo(() => {
    if (!saidas.length) return null;
    const counts = new Map<string, { nome: string; qty: number; imagemUrl: string | null }>();
    for (const s of saidas) {
      const prev = counts.get(s.itemId) ?? { nome: s.modeloNome, qty: 0, imagemUrl: s.imagemUrl };
      counts.set(s.itemId, { ...prev, qty: prev.qty + s.quantidade });
    }
    let best: { nome: string; qty: number; imagemUrl: string | null } | null = null;
    for (const v of counts.values()) {
      if (!best || v.qty > best.qty) best = v;
    }
    return best;
  }, [saidas]);

  // Helpers para atalhos de período
  const setHoje = () => {
    const hoje = new Date();
    setDataInicial(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    setDataFinal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59));
  };
  const set7Dias = () => {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 6);
    setDataInicial(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()));
    setDataFinal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59));
  };
  const setEsteMes = () => {
    setDataInicial(startOfMonth(new Date()));
    setDataFinal(new Date());
  };

  // Error state from react-query
  const { error: queryError } = useRelatorioSaidas(filtrosAplicados);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Relatório de Movimentações do Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── Filtros compactos ── */}
          <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
            {/* Atalhos de período */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Atalhos:
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={setHoje}>Hoje</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={set7Dias}>7 dias</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={setEsteMes}>Este Mês</Button>
            </div>

            {/* Filtros em linha única */}
            <div className="flex flex-wrap items-end gap-2">
              {/* Data Inicial */}
              <div className="space-y-1 min-w-[130px]">
                <Label className="text-xs">Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-9">
                      <Calendar className="mr-2 h-3.5 w-3.5" />
                      {format(dataInicial, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dataInicial}
                      onSelect={(date) => date && setDataInicial(date)}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Final */}
              <div className="space-y-1 min-w-[130px]">
                <Label className="text-xs">Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-9">
                      <Calendar className="mr-2 h-3.5 w-3.5" />
                      {format(dataFinal, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dataFinal}
                      onSelect={(date) => date && setDataFinal(date)}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Local */}
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">Local</Label>
                <Select value={localId} onValueChange={setLocalId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos os locais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os locais</SelectItem>
                    {locais?.map(local => (
                      <SelectItem key={local.id} value={local.id}>
                        {local.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Movimentação */}
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">Tipo de Movimentação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-9">
                      {filtrosMovimentacao.length === 0
                        ? 'Todos os tipos'
                        : `${filtrosMovimentacao.length} selecionado(s)`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-1">
                      {isLoadingTiposAjuste ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : opcoesUnificadas.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-2">
                          Nenhum tipo configurado
                        </div>
                      ) : (
                        opcoesUnificadas.map(filtro => (
                          <div
                            key={`ajuste:${filtro.value}`}
                            className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleToggleFiltroMov(filtro)}
                          >
                            <Checkbox
                              checked={isFiltroSelecionado(filtro)}
                              onCheckedChange={() => handleToggleFiltroMov(filtro)}
                            />
                            <span className="text-sm">{filtro.label}</span>
                          </div>
                        ))
                      )}
                      {filtrosMovimentacao.length > 0 && (
                        <div className="border-t pt-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={() => setFiltrosMovimentacao([])}
                          >
                            Limpar seleção
                          </Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Modelos */}
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">Modelos</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-9">
                      {modelosSelecionados.length === 0
                        ? 'Todos os modelos'
                        : `${modelosSelecionados.length} modelo(s)`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar modelo..."
                          value={modeloBusca}
                          onChange={(e) => setModeloBusca(e.target.value)}
                          className="pl-8 h-9"
                        />
                      </div>
                      {modeloBusca.length >= 2 && modelosDisponiveis && modelosDisponiveis.length > 1 && (
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleSelecionarTodosModelos}>
                          <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                          Selecionar todos ({modelosDisponiveis.length})
                        </Button>
                      )}
                      <div className="max-h-[280px] overflow-y-auto border rounded-md overscroll-contain" onWheel={(e) => e.stopPropagation()}>
                        {isLoadingModelos ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : modelosDisponiveis && modelosDisponiveis.length > 0 ? (
                          <div className="p-1 space-y-0.5">
                            {modelosDisponiveis.map(modelo => {
                              const isSelected = modelosSelecionados.some(m => m.id === modelo.id);
                              return (
                                <div
                                  key={modelo.id}
                                  className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                  onClick={() => handleToggleModelo(modelo)}
                                >
                                  <Checkbox checked={isSelected} onCheckedChange={() => handleToggleModelo(modelo)} />
                                  <span className="text-sm truncate flex-1">
                                    {modelo.nome}
                                    {modelo.categoria && <span className="text-muted-foreground ml-1">- {modelo.categoria}</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            {modeloBusca.length > 0 && modeloBusca.length < 2 ? 'Digite ao menos 2 caracteres' : 'Nenhum modelo encontrado'}
                          </div>
                        )}
                      </div>
                      {modelosSelecionados.length > 0 && (
                        <div className="border-t pt-2 space-y-2">
                          <div className="text-xs text-muted-foreground">{modelosSelecionados.length} modelo(s) selecionado(s)</div>
                          <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
                            {modelosSelecionados.slice(0, 5).map(modelo => (
                              <Badge key={modelo.id} variant="secondary" className="text-xs">
                                {truncateText(modelo.nome, 12)}
                                <button className="ml-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleToggleModelo(modelo); }}>
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                            {modelosSelecionados.length > 5 && <Badge variant="outline" className="text-xs">+{modelosSelecionados.length - 5}</Badge>}
                          </div>
                          <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={handleLimparModelos}>Limpar seleção</Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Botão Aplicar */}
              <Button onClick={handleAplicarFiltros} disabled={isLoading} size="sm" className="h-9 self-end">
                {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aplicar Filtros
              </Button>
            </div>
          </div>

          {/* ── Cards de métricas ── */}
          {filtrosAplicados && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Total Peças */}
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs mb-1">
                    <Package className="h-3.5 w-3.5" />
                    Total Peças
                  </div>
                  <div className="text-xl font-bold text-blue-800 dark:text-blue-200">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : resumo.totalPecas.toLocaleString('pt-BR')}
                  </div>
                </CardContent>
              </Card>

              {/* Valor Venda */}
              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs mb-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Valor Venda
                  </div>
                  <div className="text-xl font-bold text-green-800 dark:text-green-200">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : formatarMoeda(resumo.valorVendaTotal)}
                  </div>
                </CardContent>
              </Card>

              {/* Ticket Médio (nova métrica) */}
              <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs mb-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Ticket Médio
                  </div>
                  <div className="text-xl font-bold text-purple-800 dark:text-purple-200">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : formatarMoeda(ticketMedio)}
                  </div>
                </CardContent>
              </Card>

              {/* Produto Destaque (nova métrica) */}
              <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-xs mb-1">
                    <Package className="h-3.5 w-3.5" />
                    Produto Destaque
                  </div>
                  <div className="text-sm font-bold text-orange-800 dark:text-orange-200 leading-snug">
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : produtoDestaque ? (
                      <span>
                        {produtoDestaque.nome}
                        <span className="text-xs font-normal text-orange-600 ml-1">({produtoDestaque.qty} pç)</span>
                      </span>
                    ) : '—'}
                  </div>
                </CardContent>
              </Card>

              {/* Valor Custo — mantido no código, removido da view */}
              {/* resumo.valorCustoTotal está disponível para cálculos hidden */}
            </div>
          )}

          {/* ── Tabela de Detalhamento ── */}
          {filtrosAplicados && (
            <div className="flex-1 min-h-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {saidas.length} movimentação(ões)
                </span>
                <div className="flex gap-2">
                  {someSelected && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={excluirMutation.isPending}
                    >
                      {excluirMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Excluir selecionadas ({selectedIds.size})
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={saidas.length === 0 || isExportingPDF || isExportingExcel}>
                    {isExportingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    {isExportingPDF ? 'Gerando...' : 'PDF'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={saidas.length === 0 || isExportingExcel || isExportingPDF}>
                    {isExportingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                    {isExportingExcel ? 'Gerando...' : 'Excel'}
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[340px] border rounded-lg">
                {queryError ? (
                  <div className="flex flex-col items-center justify-center h-full text-destructive gap-2 py-8">
                    <TrendingDown className="h-10 w-10 opacity-40" />
                    <p className="font-medium">Erro ao carregar movimentações</p>
                    <p className="text-sm text-muted-foreground">Tente aplicar os filtros novamente</p>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center h-full py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : saidas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                    <TrendingDown className="h-12 w-12 mb-2 opacity-50" />
                    <p>Nenhuma movimentação encontrada no período</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox checked={allSelected} onCheckedChange={handleToggleSelectAll} />
                        </TableHead>
                        <TableHead className="w-[36px]"></TableHead>
                        <TableHead className="w-[90px]">Data/Hora</TableHead>
                        <TableHead className="min-w-[170px]">Modelo</TableHead>
                        <TableHead className="text-center w-[50px]">Qtd</TableHead>
                        <TableHead className="text-right w-[80px]">Unit.</TableHead>
                        <TableHead className="text-right w-[90px]">Total</TableHead>
                        <TableHead className="w-[130px]">Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="w-[100px]">Usuário</TableHead>
                        <TableHead className="w-[110px]">Local</TableHead>
                        <TableHead className="w-[110px]">Destino</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saidas.map(saida => {
                        const isEntrada = saida.tipo === 'AJUSTE_ENTRADA';
                        const isSaidaRow = saida.tipo === 'AJUSTE_SAIDA';
                        return (
                          <TableRow
                            key={saida.id}
                            className={cn(
                              selectedIds.has(saida.id) && 'bg-muted/50',
                              isEntrada && 'hover:bg-green-50/60 dark:hover:bg-green-950/20',
                              isSaidaRow && 'hover:bg-red-50/60 dark:hover:bg-red-950/20',
                            )}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(saida.id)}
                                onCheckedChange={() => handleToggleSelect(saida.id)}
                              />
                            </TableCell>
                            {/* Thumbnail */}
                            <TableCell className="p-1">
                              {saida.imagemUrl ? (
                                <img
                                  src={saida.imagemUrl}
                                  alt={saida.modeloNome}
                                  className="w-8 h-8 rounded object-cover border"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                                  }}
                                />
                              ) : null}
                              <div
                                className={cn(
                                  "w-8 h-8 rounded border bg-muted items-center justify-center",
                                  saida.imagemUrl ? "hidden" : "flex"
                                )}
                              >
                                <Shirt className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatarData(saida.data)}
                            </TableCell>
                            <TableCell className={cn("font-medium text-sm", isEntrada && "text-green-700 dark:text-green-400", isSaidaRow && "text-red-700 dark:text-red-400")}>
                              {saida.modeloNome}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {isEntrada && <span className="text-green-600">+</span>}
                              {isSaidaRow && <span className="text-red-600">-</span>}
                              {saida.quantidade}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatarMoeda(saida.valorUnitario)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatarMoeda(saida.valorTotal)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs font-medium",
                                  isEntrada && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                  isSaidaRow && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}
                              >
                                {saida.tipoLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {saida.motivo || '—'}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {saida.usuarioNome || '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {saida.localNome}
                            </TableCell>
                            <TableCell className="text-xs">
                              {saida.localDestinoNome || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Estado inicial */}
          {!filtrosAplicados && (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-16">
              <Filter className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Configure os filtros acima</p>
              <p className="text-sm">Selecione o período e clique em "Aplicar Filtros"</p>
            </div>
          )}

        </div>
      </DialogContent>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentações</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> movimentação(ões)?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={excluirMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

