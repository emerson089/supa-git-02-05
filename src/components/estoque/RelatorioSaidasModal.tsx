import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileDown, FileSpreadsheet, Loader2, Calendar, Filter, TrendingDown, DollarSign, Package, Search, X, CheckSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  useRelatorioSaidas,
  useLocaisParaFiltro,
  useModelosParaFiltro,
  FiltrosSaidas,
  TIPOS_SAIDA,
  TIPO_LABELS,
} from '@/hooks/useRelatorioSaidas';
import { useTiposAjusteParaFiltro } from '@/hooks/useTiposAjuste';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { generateRelatorioSaidasPDF } from '@/utils/generateRelatorioSaidasPDF';
import { generateRelatorioSaidasExcel } from '@/utils/generateRelatorioSaidasExcel';

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
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([]);
  const [modelosSelecionados, setModelosSelecionados] = useState<{ id: string; nome: string; categoria: string }[]>([]);
  const [modeloBusca, setModeloBusca] = useState('');
  const [tiposAjusteSelecionados, setTiposAjusteSelecionados] = useState<{ id: string; nome: string }[]>([]);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosSaidas | null>(null);

  // Debounce para busca de modelos
  const modeloBuscaDebounced = useDebouncedValue(modeloBusca, 300);

  // Queries
  const { data: locais } = useLocaisParaFiltro();
  const { data: modelosDisponiveis, isLoading: isLoadingModelos } = useModelosParaFiltro(modeloBuscaDebounced);
  const { data: tiposAjusteDisponiveis = [], isLoading: isLoadingTiposAjuste } = useTiposAjusteParaFiltro();
  const { data, isLoading, isFetching } = useRelatorioSaidas(filtrosAplicados);

  const saidas = data?.saidas || [];
  const resumo = data?.resumo || { totalPecas: 0, valorVendaTotal: 0, valorCustoTotal: null, quantidadeSemPreco: 0 };

  // Verificar se AJUSTE_SAIDA está selecionado para exibir filtro de tipos de ajuste
  const mostrarFiltroTiposAjuste = tiposSelecionados.includes('AJUSTE_SAIDA') || tiposSelecionados.length === 0;

  // Nome do local selecionado para exibição
  const localNomeFiltro = useMemo(() => {
    if (!localId || localId === 'todos') return undefined;
    return locais?.find(l => l.id === localId)?.nome;
  }, [localId, locais]);

  // Aplicar filtros
  const handleAplicarFiltros = () => {
    setFiltrosAplicados({
      dataInicial,
      dataFinal,
      localId: localId !== 'todos' ? localId : undefined,
      tiposMovimento: tiposSelecionados.length > 0 ? tiposSelecionados : undefined,
      modeloIds: modelosSelecionados.length > 0 ? modelosSelecionados.map(m => m.id) : undefined,
      tipoAjusteIds: tiposAjusteSelecionados.length > 0 ? tiposAjusteSelecionados.map(t => t.id) : undefined,
    });
  };

  // Toggle tipo de movimento
  const handleToggleTipo = (tipo: string) => {
    setTiposSelecionados(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  // Exportar PDF
  const handleExportPDF = () => {
    if (!filtrosAplicados || saidas.length === 0) return;
    generateRelatorioSaidasPDF({
      saidas,
      resumo,
      filtros: filtrosAplicados,
      localNomeFiltro,
    });
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
    
    // Adicionar apenas os modelos que ainda não estão selecionados
    const modelosParaAdicionar = modelosDisponiveis.filter(
      m => !modelosSelecionados.some(s => s.id === m.id)
    );
    
    setModelosSelecionados(prev => [...prev, ...modelosParaAdicionar]);
  };

  // Limpar modelos selecionados
  const handleLimparModelos = () => {
    setModelosSelecionados([]);
  };

  // Toggle tipo de ajuste
  const handleToggleTipoAjuste = (tipo: { id: string; nome: string }) => {
    setTiposAjusteSelecionados(prev => {
      const isSelected = prev.some(t => t.id === tipo.id);
      if (isSelected) {
        return prev.filter(t => t.id !== tipo.id);
      }
      return [...prev, tipo];
    });
  };

  // Limpar tipos de ajuste selecionados
  const handleLimparTiposAjuste = () => {
    setTiposAjusteSelecionados([]);
  };

  // Exportar Excel/CSV
  const handleExportExcel = () => {
    if (!filtrosAplicados || saidas.length === 0) return;
    generateRelatorioSaidasExcel({
      saidas,
      resumo,
      filtros: filtrosAplicados,
      localNomeFiltro,
    });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Relatório de Saídas do Estoque
          </DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Data Inicial */}
            <div className="space-y-1.5">
              <Label className="text-xs">Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
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
            <div className="space-y-1.5">
              <Label className="text-xs">Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
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
            <div className="space-y-1.5">
              <Label className="text-xs">Local</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger>
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

            {/* Tipos de Saída */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Saída</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {tiposSelecionados.length === 0
                      ? 'Todos os tipos'
                      : `${tiposSelecionados.length} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="start">
                  <div className="space-y-2">
                    {TIPOS_SAIDA.map(tipo => (
                      <div key={tipo} className="flex items-center space-x-2">
                        <Checkbox
                          id={tipo}
                          checked={tiposSelecionados.includes(tipo)}
                          onCheckedChange={() => handleToggleTipo(tipo)}
                        />
                        <label
                          htmlFor={tipo}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {TIPO_LABELS[tipo]}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Modelos */}
            <div className="space-y-1.5">
              <Label className="text-xs">Modelos</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {modelosSelecionados.length === 0
                      ? 'Todos os modelos'
                      : `${modelosSelecionados.length} modelo(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <div className="space-y-3">
                    {/* Campo de busca */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar modelo..."
                        value={modeloBusca}
                        onChange={(e) => setModeloBusca(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>

                    {/* Botão Selecionar Todos (quando há busca com 2+ resultados) */}
                    {modeloBusca.length >= 2 && modelosDisponiveis && modelosDisponiveis.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={handleSelecionarTodosModelos}
                      >
                        <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                        Selecionar todos ({modelosDisponiveis.length})
                      </Button>
                    )}

                    {/* Lista de modelos com scroll */}
                    <div className="max-h-[200px] overflow-y-auto border rounded-md">
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
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleModelo(modelo)}
                                />
                                <span className="text-sm truncate flex-1">
                                  {modelo.nome}
                                  {modelo.categoria && (
                                    <span className="text-muted-foreground ml-1">- {modelo.categoria}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          {modeloBusca.length > 0 && modeloBusca.length < 2
                            ? 'Digite ao menos 2 caracteres'
                            : 'Nenhum modelo encontrado'}
                        </div>
                      )}
                    </div>

                    {/* Modelos selecionados e botão limpar */}
                    {modelosSelecionados.length > 0 && (
                      <div className="border-t pt-2 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          {modelosSelecionados.length} modelo(s) selecionado(s)
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
                          {modelosSelecionados.slice(0, 5).map(modelo => (
                            <Badge key={modelo.id} variant="secondary" className="text-xs">
                              {truncateText(modelo.nome, 12)}
                              <button
                                className="ml-1 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleModelo(modelo);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          {modelosSelecionados.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{modelosSelecionados.length - 5}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={handleLimparModelos}
                        >
                          Limpar seleção
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Linha adicional para Tipo de Ajuste (condicional) */}
          {mostrarFiltroTiposAjuste && tiposAjusteDisponiveis.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Tipo de Ajuste</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {tiposAjusteSelecionados.length === 0
                        ? 'Todos os tipos de ajuste'
                        : `${tiposAjusteSelecionados.length} tipo(s) selecionado(s)`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <div className="space-y-3">
                      {isLoadingTiposAjuste ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                          {tiposAjusteDisponiveis.map(tipo => {
                            const isSelected = tiposAjusteSelecionados.some(t => t.id === tipo.id);
                            return (
                              <div
                                key={tipo.id}
                                className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                onClick={() => handleToggleTipoAjuste(tipo)}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleTipoAjuste(tipo)}
                                />
                                <span className="text-sm">{tipo.nome}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {tiposAjusteSelecionados.length > 0 && (
                        <div className="border-t pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={handleLimparTiposAjuste}
                          >
                            Limpar seleção
                          </Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleAplicarFiltros} disabled={isLoading}>
              {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar Filtros
            </Button>
          </div>
        </div>

        {/* Resumo */}
        {filtrosAplicados && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs mb-1">
                  <Package className="h-4 w-4" />
                  Total Peças
                </div>
                <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  {resumo.totalPecas.toLocaleString('pt-BR')}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs mb-1">
                  <DollarSign className="h-4 w-4" />
                  Valor Venda
                </div>
                <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {formatarMoeda(resumo.valorVendaTotal)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-xs mb-1">
                  <DollarSign className="h-4 w-4" />
                  Valor Custo
                </div>
                <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                  {formatarMoeda(resumo.valorCustoTotal)}
                </div>
                {resumo.quantidadeSemPreco > 0 && (
                  <div className="text-xs text-destructive mt-1">
                    * {resumo.quantidadeSemPreco} sem preço
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela de Detalhamento */}
        {filtrosAplicados && (
          <div className="flex-1 min-h-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {saidas.length} movimentação(ões)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={saidas.length === 0}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={saidas.length === 0}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : saidas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mb-2 opacity-50" />
                  <p>Nenhuma saída encontrada no período</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Data/Hora</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-center w-[60px]">Qtd</TableHead>
                      <TableHead className="text-right w-[80px]">Unit.</TableHead>
                      <TableHead className="text-right w-[90px]">Total</TableHead>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-[120px]">Local</TableHead>
                      <TableHead className="w-[120px]">Destino</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saidas.map(saida => (
                      <TableRow key={saida.id}>
                        <TableCell className="text-xs">
                          {formatarData(saida.data)}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {truncateText(saida.modeloNome, 30)}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {saida.quantidade}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {formatarMoeda(saida.valorUnitario)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatarMoeda(saida.valorTotal)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {saida.tipoLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {truncateText(saida.motivo || '—', 25)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {truncateText(saida.localNome, 15)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {saida.localDestinoNome ? truncateText(saida.localDestinoNome, 15) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Estado inicial - antes de aplicar filtros */}
        {!filtrosAplicados && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
            <Filter className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Configure os filtros acima</p>
            <p className="text-sm">Selecione o período e clique em "Aplicar Filtros"</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
