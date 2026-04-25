import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
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
  Pencil,
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';
import { LotImage } from '@/components/production/LotImage';
import { groupItensByModel } from '@/utils/productNameUtils';

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
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800',
        icon: CheckCircle2
      };
    case 'estornada':
      return {
        label: 'Estornada',
        variant: 'destructive' as const,
        className: 'bg-red-500/10 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-800',
        icon: XCircle
      };
    case 'cancelada':
      return {
        label: 'Cancelada',
        variant: 'secondary' as const,
        className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        icon: XCircle
      };
    default:
      return {
        label: 'Em andamento',
        variant: 'default' as const,
        className: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-800',
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
  
  const percentualVendido = totais.enviado > 0 
    ? Math.round((totais.vendido / totais.enviado) * 100) 
    : 0;

  const itensComDivergencia = carga.itens.filter(item => {
    const enviado = Number(item.quantidadeEnviada) || 0;
    const retornado = Number(item.quantidadeRetornada) || 0;
    return retornado > enviado;
  });
  const temDivergencia = itensComDivergencia.length > 0;

  const groupedItens = groupItensByModel(carga.itens, {
    getItemId: (i) => i.itemId || i.id || "",
    getItemNome: (i) => i.produtoNome || "",
    getItemPreco: (i) => Number(i.precoUnitario) || Number(i.produtoPreco) || 0,
    getItemQtd: (i) => Number(i.quantidadeEnviada) || 0,
    getItemImagem: (i) => i.produtoImagem,
    getItemReferencia: (i) => i.produtoNome || "",
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
    <Dialog open={!!carga} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[32px] bg-slate-50 dark:bg-slate-950">
        {/* Header Pro Max */}
        <DialogHeader className="px-8 pt-8 pb-6 border-b bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 shrink-0 relative overflow-hidden">
          {/* Elementos decorativos de fundo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />
          
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                  <Truck className="h-7 w-7 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-white tracking-tight leading-none">
                    {carga.observacoes ? `"${carga.observacoes}"` : 'Detalhes da Carga'}
                  </DialogTitle>
                  <p className="text-indigo-100/70 text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                    Carga #ID-{carga.id.slice(0, 8).toUpperCase()} <span className="h-1 w-1 rounded-full bg-indigo-300/40" /> {carga.itens.length} SKUs Identificados
                  </p>
                </div>
              </div>
              <Badge className={cn("px-4 py-1.5 rounded-full font-bold text-xs border backdrop-blur-md", statusConfig.className)}>
                <StatusIcon className="h-3.5 w-3.5 mr-2" />
                {statusConfig.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                  <MapPin className="h-4 w-4 text-indigo-200" />
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-50">
                  <span className="font-bold">{carga.localOrigemNome || 'Estoque'}</span>
                  <ArrowRight className="h-3 w-3 text-indigo-300" />
                  <span className="font-bold">{carga.localDestinoNome || 'Feira'}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                  <Calendar className="h-4 w-4 text-indigo-200" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-300/60 uppercase tracking-tighter leading-none mb-0.5">Saída</span>
                  <span className="text-xs font-bold text-indigo-50">{format(new Date(carga.dataSaida), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>

              {carga.dataRetorno && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20">
                    <RotateCcw className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-emerald-300/60 uppercase tracking-tighter leading-none mb-0.5">Retorno</span>
                    <span className="text-xs font-bold text-emerald-50">{format(new Date(carga.dataRetorno), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-8">
            {/* Dashboard de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard 
                icon={Package} 
                label="Enviado" 
                value={totais.enviado} 
                color="blue" 
                unit="pçs"
              />
              <MetricCard 
                icon={RotateCcw} 
                label="Retorno" 
                value={totais.retornado} 
                color="amber" 
                unit="pçs"
              />
              <MetricCard 
                icon={ShoppingBag} 
                label="Vendido" 
                value={totais.vendido} 
                color="emerald" 
                unit="pçs"
              />
              <MetricCard 
                icon={TrendingUp} 
                label="% Vendido" 
                value={`${percentualVendido}%`} 
                color="purple" 
              />
              <MetricCard 
                icon={DollarSign} 
                label="Valor Total" 
                value={formatCurrency(totais.valor)} 
                color="indigo" 
                isCurrency
                className="col-span-2 md:col-span-1"
              />
            </div>

            {/* Lista de Itens */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-slate-400" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Relação de Produtos</h3>
                </div>
                <div className="h-px flex-1 mx-6 bg-slate-200 dark:bg-slate-800" />
                <Badge variant="outline" className="rounded-lg text-[10px] font-bold text-slate-500">{groupedItens.length} Modelos</Badge>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 border-b border-slate-200 dark:border-slate-800">
                      <TableHead className="w-16"></TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto / Modelo</TableHead>
                      <TableHead className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço</TableHead>
                      <TableHead className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Env.</TableHead>
                      <TableHead className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Ret.</TableHead>
                      <TableHead className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Vend.</TableHead>
                      <TableHead className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedItens.map((group, idx) => {
                      const temProblema = group.retornado > group.enviado;
                      return (
                        <TableRow key={idx} className={cn(
                          "group hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition-colors",
                          temProblema ? 'bg-red-50 dark:bg-red-950/10' : ''
                        )}>
                          <TableCell className="py-3 pl-6">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform">
                              <LotImage 
                                src={group.imagemUrl} 
                                alt={group.nomeBase} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate leading-none mb-1.5">{group.nomeExibicao}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded uppercase tracking-wider">REF {group.refBase}</span>
                                {group.tamanhos.length > 0 && (
                                  <span className="text-[10px] font-medium text-slate-400 italic">Tam: {group.tamanhos.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-slate-400 font-medium text-xs">
                            {formatCurrency(group.valorUnitario)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-black text-blue-600 dark:text-blue-400 text-sm">
                            {group.enviado}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-black text-amber-600 dark:text-amber-400 text-sm">
                            {group.retornado}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center justify-center h-7 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-black text-xs border border-emerald-100 dark:border-emerald-800/50">
                              {group.vendido}
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <span className="font-black text-slate-900 dark:text-slate-100 tabular-nums">
                              {formatCurrency(group.subtotal)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Divergências e Notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {temDivergencia && (
                <div className="p-5 rounded-3xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 flex gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-red-900 dark:text-red-200 uppercase tracking-wide mb-1">Divergência Detectada</h4>
                    <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">
                      {itensComDivergencia.length} item(ns) apresentam retorno maior que o enviado. Por favor, revise as contagens.
                    </p>
                  </div>
                </div>
              )}

              {carga.observacoes && (
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Info className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-1">Notas da Carga</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic">
                      "{carga.observacoes}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Pro Max */}
        {isEmAndamento && (onExcluirCarga || onRegistrarRetorno || onEditarCarga) && (
          <DialogFooter className="px-8 py-6 border-t bg-white dark:bg-slate-950 flex flex-row items-center justify-between shrink-0">
            <div className="flex gap-3">
              {onExcluirCarga && (
                <Button
                  variant="ghost"
                  onClick={() => onExcluirCarga(carga)}
                  className="h-12 px-6 rounded-2xl gap-2 font-bold text-red-500 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              )}
              {onEditarCarga && (
                <Button
                  variant="outline"
                  onClick={() => onEditarCarga(carga)}
                  className="h-12 px-6 rounded-2xl gap-2 font-bold border-slate-200"
                >
                  <Pencil className="h-4 w-4" />
                  Editar Dados
                </Button>
              )}
            </div>
            
            {onRegistrarRetorno && (
              <Button
                onClick={() => onRegistrarRetorno(carga)}
                className="h-12 px-8 rounded-2xl gap-3 font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <RotateCcw className="h-5 w-5" />
                Registrar Retorno
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon: Icon, label, value, color, unit, isCurrency, className }: any) {
  const colorMap: any = {
    blue: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/50",
    amber: "text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900/50",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/50",
    purple: "text-purple-600 bg-purple-50 border-purple-100 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-900/50",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-900/50",
  };

  return (
    <Card className={cn("p-5 border shadow-sm relative overflow-hidden group hover:shadow-md transition-all", colorMap[color], className)}>
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        <Icon className="h-24 w-24" />
      </div>
      <div className="flex flex-col items-center relative z-10">
        <div className="h-9 w-9 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shadow-sm mb-3">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <p className={cn(
            "font-black tracking-tighter",
            isCurrency ? "text-xl" : "text-3xl"
          )}>{value}</p>
          {unit && <span className="text-[10px] font-bold opacity-60">{unit}</span>}
        </div>
      </div>
    </Card>
  );
}
