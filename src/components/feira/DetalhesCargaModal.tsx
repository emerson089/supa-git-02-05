import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Truck, 
  RotateCcw, 
  Package, 
  ShoppingBag, 
  TrendingUp, 
  DollarSign,
  MapPin,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';
import { LotImage } from '@/components/production/LotImage';
import { groupItensByModel, parseProductName } from '@/utils/productNameUtils';

interface DetalhesCargaModalProps {
  carga: TransferenciaComItensHistorico | null;
  onClose: () => void;
  onExcluirCarga?: (carga: TransferenciaComItensHistorico) => void;
  onRegistrarRetorno?: (carga: TransferenciaComItensHistorico) => void;
  onEditarCarga?: (carga: TransferenciaComItensHistorico) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'concluida':
      return {
        label: 'Concluída',
        variant: 'default' as const,
        className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
        icon: CheckCircle2
      };
    case 'estornada':
      return {
        label: 'Estornada',
        variant: 'destructive' as const,
        className: 'bg-red-500 hover:bg-red-600 text-white',
        icon: XCircle
      };
    case 'cancelada':
      return {
        label: 'Cancelada',
        variant: 'secondary' as const,
        className: 'bg-muted text-muted-foreground',
        icon: XCircle
      };
    default:
      return {
        label: 'Em andamento',
        variant: 'default' as const,
        className: 'bg-primary hover:bg-primary/90 text-primary-foreground',
        icon: Clock
      };
  }
};

export function DetalhesCargaModal({ carga, onClose, onExcluirCarga, onRegistrarRetorno, onEditarCarga }: DetalhesCargaModalProps) {
  if (!carga) return null;
  
  const isEmAndamento = carga.status === 'em_andamento';

  const totais = calcularTotaisCargaPublic(carga.itens);
  const statusConfig = getStatusConfig(carga.status);
  const StatusIcon = statusConfig.icon;
  
  // Calcular percentual vendido
  const percentualVendido = totais.enviado > 0 
    ? Math.round((totais.vendido / totais.enviado) * 100) 
    : 0;

  // Verificar divergências
  const itensComDivergencia = carga.itens.filter(item => {
    const enviado = Number(item.quantidadeEnviada) || 0;
    const retornado = Number(item.quantidadeRetornada) || 0;
    return retornado > enviado; // Retornou mais do que enviou = divergência
  });
  const temDivergencia = itensComDivergencia.length > 0;

  return (
    <Dialog open={!!carga} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              {carga.observacoes ? (
                <span>
                  <span className="text-primary">"{carga.observacoes}"</span>
                  <span className="text-muted-foreground font-normal text-sm ml-2">• Carga</span>
                </span>
              ) : (
                'Detalhes da Carga'
              )}
            </DialogTitle>
            <Badge className={statusConfig.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          
          {/* Origem → Destino */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
            <MapPin className="h-4 w-4 text-primary/60" />
            <span className="font-medium">{carga.localOrigemNome || 'Origem'}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="font-medium">{carga.localDestinoNome || 'Destino'}</span>
          </div>

          {/* Data/Hora */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              <span>Saída: {format(new Date(carga.dataSaida), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
            {carga.dataRetorno && (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retorno: {format(new Date(carga.dataRetorno), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 space-y-4 md:space-y-5">
            {/* Cards de Métricas - Mobile: 2x2 grid + valor full width */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
              <Card className="p-3 text-center bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <Package className="h-4 w-4 md:h-5 md:w-5 mx-auto text-blue-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Enviado</p>
                <p className="text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400">{totais.enviado}</p>
              </Card>
              
              <Card className="p-3 text-center bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <RotateCcw className="h-4 w-4 md:h-5 md:w-5 mx-auto text-amber-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Retorno</p>
                <p className="text-lg md:text-xl font-bold text-amber-600 dark:text-amber-400">{totais.retornado}</p>
              </Card>
              
              <Card className="p-3 text-center bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 mx-auto text-emerald-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Vendido</p>
                <p className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400">{totais.vendido}</p>
              </Card>
              
              <Card className="p-3 text-center bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 mx-auto text-purple-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">% Vendido</p>
                <p className="text-lg md:text-xl font-bold text-purple-600 dark:text-purple-400">{percentualVendido}%</p>
              </Card>
              
              <Card className="p-3 text-center bg-primary/5 border-primary/20 col-span-2 md:col-span-1">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 mx-auto text-primary" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Valor Total</p>
                <p className="text-lg md:text-xl font-bold text-primary">{formatCurrency(totais.valor)}</p>
              </Card>
            </div>

            {(() => {
              const groupedItens = groupItensByModel(carga.itens, {
                getItemId: (i) => i.itemId || i.id || "",
                getItemNome: (i) => i.produtoNome || "",
                getItemPreco: (i) => Number(i.precoUnitario) || Number(i.produtoPreco) || 0,
                getItemQtd: (i) => Number(i.quantidadeEnviada) || 0,
                getItemImagem: (i) => i.produtoImagem
              }).map(g => {
                const retornado = g.itens.reduce((sum: number, item: any) => sum + (Number(item.quantidadeRetornada) || 0), 0);
                const enviado = g.quantidadeTotal;
                const vendido = Math.max(0, enviado - retornado);
                return {
                  ...g,
                  enviado,
                  retornado,
                  vendido,
                  subtotal: vendido * g.valorUnitario
                };
              });

              return (
                <>
                  {/* Lista de Itens - Mobile */}
                  <div className="md:hidden space-y-2">
                    {groupedItens.map((group, idx) => {
                      const temProblema = group.retornado > group.enviado;
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            temProblema 
                              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                              : 'bg-muted/30'
                          }`}
                        >
                          <div className="w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            <LotImage 
                              src={group.produtoImagem} 
                              alt={group.nomeBase} 
                              className="w-full h-full object-cover"
                              eager={true}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-2">
                              {group.refBase ? `${group.nomeBase} - ${group.refBase}` : group.nomeBase}
                            </p>
                            {group.tamanhos.length > 0 && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                Tam: {group.tamanhos.join(', ')}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatCurrency(group.precoUnitario)} • Total: <span className="text-emerald-600 font-semibold">{formatCurrency(group.subtotal)}</span>
                            </p>
                          </div>
                          <div className="flex gap-3 text-center text-xs shrink-0">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Env</p>
                              <p className="font-bold text-blue-600">{group.enviado}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Ret</p>
                              <p className="font-bold text-amber-600">{group.retornado}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Vend</p>
                              <p className="font-bold text-emerald-600">{group.vendido}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tabela de Itens - Desktop */}
                  <div className="hidden md:block border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right w-20">Preço</TableHead>
                            <TableHead className="text-center w-16">Env.</TableHead>
                            <TableHead className="text-center w-16">Ret.</TableHead>
                            <TableHead className="text-center w-20">Vendido</TableHead>
                            <TableHead className="text-right w-24">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedItens.map((group, idx) => {
                            const temProblema = group.retornado > group.enviado;
                            return (
                              <TableRow key={idx} className={temProblema ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                                <TableCell className="p-2">
                                  <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                    <LotImage 
                                      src={group.produtoImagem} 
                                      alt={group.nomeBase} 
                                      className="w-full h-full object-cover"
                                      eager={true}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                    <p className="font-medium text-foreground">
                                      {group.nomeExibicao}
                                    </p>
                                    {group.tamanhos.length > 0 && (
                                      <p className="text-[10px] text-muted-foreground">
                                        Tam: {group.tamanhos.join(', ')}
                                      </p>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground text-sm">
                                  {formatCurrency(group.precoUnitario)}
                                </TableCell>
                                <TableCell className="text-center font-medium text-blue-600 dark:text-blue-400">
                                  {group.enviado}
                                </TableCell>
                                <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">
                                  {group.retornado}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                                    {group.vendido}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(group.subtotal)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Alerta de Divergência */}
            {temDivergencia && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Divergência Detectada</AlertTitle>
                <AlertDescription>
                  {itensComDivergencia.length} item(ns) com quantidade retornada maior que a enviada. Verifique os dados.
                </AlertDescription>
              </Alert>
            )}

            {/* Observações */}
            {carga.observacoes && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1 font-medium">📝 Observações</p>
                <p className="text-sm">{carga.observacoes}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer com ações para cargas em andamento */}
        {isEmAndamento && (onExcluirCarga || onRegistrarRetorno || onEditarCarga) && (
          <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2 sm:gap-2">
            {onExcluirCarga && (
              <Button
                variant="destructive"
                onClick={() => onExcluirCarga(carga)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Carga
              </Button>
            )}
            {onEditarCarga && (
              <Button
                variant="outline"
                onClick={() => onEditarCarga(carga)}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Editar Carga
              </Button>
            )}
            {onRegistrarRetorno && (
              <Button
                onClick={() => onRegistrarRetorno(carga)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Registrar Retorno
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
