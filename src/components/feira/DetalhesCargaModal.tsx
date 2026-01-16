import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, RotateCcw, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';

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

export function DetalhesCargaModal({ carga, onClose }: DetalhesCargaModalProps) {
  if (!carga) return null;

  const totais = calcularTotaisCargaPublic(carga.itens);

  return (
    <Dialog open={!!carga} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Detalhes da Carga
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Info da Carga */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Saída</p>
                <p className="font-medium">
                  {format(new Date(carga.dataSaida), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {carga.status === 'concluida' ? (
                <>
                  <RotateCcw className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Retorno</p>
                    <p className="font-medium text-emerald-600">
                      {carga.dataRetorno
                        ? format(new Date(carga.dataRetorno), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : 'Não registrado'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-primary animate-pulse" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className="bg-primary text-primary-foreground">Em andamento</Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center w-24">Enviado</TableHead>
                  <TableHead className="text-center w-24">Retorno</TableHead>
                  <TableHead className="text-center w-24">Vendido</TableHead>
                  <TableHead className="text-right w-32">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carga.itens.map((item) => {
                  const enviado = Number(item.quantidadeEnviada) || 0;
                  const retornado = Number(item.quantidadeRetornada) || 0;
                  const vendido = Math.max(0, enviado - retornado);
                  const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;
                  const valorItem = vendido * preco;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.produtoNome || `Item #${item.itemId.slice(0, 8)}`}
                      </TableCell>
                      <TableCell className="text-center">{enviado}</TableCell>
                      <TableCell className="text-center">{retornado}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={vendido > 0 ? 'default' : 'secondary'} className="bg-emerald-500/10 text-emerald-600 border-0">
                          {vendido}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(valorItem)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totais */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Enviado</p>
                <p className="text-lg font-bold">{totais.enviado}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Retorno</p>
                <p className="text-lg font-bold">{totais.retornado}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Vendido</p>
                <p className="text-lg font-bold text-emerald-600">{totais.vendido}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totais.valor)}</p>
            </div>
          </div>

          {/* Observações */}
          {carga.observacoes && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{carga.observacoes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
