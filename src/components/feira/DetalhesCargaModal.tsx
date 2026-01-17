import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';
import { LotImage } from '@/components/production/LotImage';

interface DetalhesCargaModalProps {
  carga: TransferenciaComItensHistorico | null;
  onClose: () => void;
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

export function DetalhesCargaModal({ carga, onClose }: DetalhesCargaModalProps) {
  if (!carga) return null;

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
              Detalhes da Carga
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
          <div className="p-6 space-y-5">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-3 text-center bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <Package className="h-5 w-5 mx-auto text-blue-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Enviado</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{totais.enviado}</p>
              </Card>
              
              <Card className="p-3 text-center bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <RotateCcw className="h-5 w-5 mx-auto text-amber-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Retorno</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{totais.retornado}</p>
              </Card>
              
              <Card className="p-3 text-center bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                <ShoppingBag className="h-5 w-5 mx-auto text-emerald-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Vendido</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totais.vendido}</p>
              </Card>
              
              <Card className="p-3 text-center bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                <TrendingUp className="h-5 w-5 mx-auto text-purple-500" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">% Vendido</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{percentualVendido}%</p>
              </Card>
              
              <Card className="p-3 text-center bg-primary/5 border-primary/20 col-span-2 md:col-span-1">
                <DollarSign className="h-5 w-5 mx-auto text-primary" />
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Valor Total</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(totais.valor)}</p>
              </Card>
            </div>

            {/* Tabela de Itens */}
            <div className="border rounded-lg overflow-hidden">
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
                    {carga.itens.map((item) => {
                      const enviado = Number(item.quantidadeEnviada) || 0;
                      const retornado = Number(item.quantidadeRetornada) || 0;
                      const vendido = Math.max(0, enviado - retornado);
                      const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;
                      const valorItem = vendido * preco;
                      const temProblema = retornado > enviado;

                      return (
                        <TableRow key={item.id} className={temProblema ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {/* Foto */}
                          <TableCell className="p-2">
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                              <LotImage 
                                src={item.produtoImagem} 
                                alt={item.produtoNome || 'Produto'} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </TableCell>
                          
                          {/* Produto */}
                          <TableCell className="font-medium">
                            <span className="line-clamp-2">
                              {item.produtoNome || `Item #${item.itemId.slice(0, 8)}`}
                            </span>
                          </TableCell>
                          
                          {/* Preço Unitário */}
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {formatCurrency(preco)}
                          </TableCell>
                          
                          {/* Enviado */}
                          <TableCell className="text-center font-medium text-blue-600 dark:text-blue-400">
                            {enviado}
                          </TableCell>
                          
                          {/* Retornado */}
                          <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">
                            {retornado}
                          </TableCell>
                          
                          {/* Vendido */}
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                              {vendido}
                            </Badge>
                          </TableCell>
                          
                          {/* Total Vendido */}
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(valorItem)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

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
      </DialogContent>
    </Dialog>
  );
}
