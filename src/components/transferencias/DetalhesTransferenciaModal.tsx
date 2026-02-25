import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, ArrowRight, Calendar, User, Tag, FileText, Check, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { LotImage } from '@/components/production/LotImage';
import { toast } from 'sonner';
import { useTransferenciaItens, useConcluirTransferencia, useCancelarTransferencia, useAtualizarTransferencia } from '@/hooks/useTransferencias';
import { useTiposAjuste } from '@/hooks/useTiposAjuste';
import type { StatusTransferencia } from './FiltrosTransferencias';

interface TransferenciaCompleta {
  id: string;
  localOrigemId: string;
  localOrigemNome: string;
  localDestinoId: string;
  localDestinoNome: string;
  status: StatusTransferencia;
  motivo: string | null;
  observacoes: string | null;
  createdAt: string;
  dataConclusao: string | null;
  concluidoPor: string | null;
  concluidoPorNome: string | null;
  concluidoPorRole: string | null;
  criadorNome: string | null;
  criadorRole: string | null;
}

interface ItemComDetalhes {
  id: string;
  itemId: string;
  itemNome: string;
  itemImagemUrl: string | null;
  quantidadeEnviada: number;
}

interface DetalhesTransferenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferencia: TransferenciaCompleta | null;
  itensDetalhados: ItemComDetalhes[];
}
const STATUS_CONFIG: Record<StatusTransferencia, { label: string; variant: 'default' | 'secondary' | 'destructive'; className: string }> = {
  em_andamento: { label: 'Pendente', variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  concluida: { label: 'Concluída', variant: 'default', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelada: { label: 'Cancelada', variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
};

export function DetalhesTransferenciaModal({ 
  open, 
  onOpenChange, 
  transferencia,
  itensDetalhados,
}: DetalhesTransferenciaModalProps) {
  const isMobile = useIsMobile();
  const [motivo, setMotivo] = useState('');
  const { data: tiposAtivos = [] } = useTiposAjuste();
  const [observacoes, setObservacoes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const concluir = useConcluirTransferencia();
  const cancelar = useCancelarTransferencia();
  const atualizar = useAtualizarTransferencia();

  useEffect(() => {
    if (transferencia) {
      setMotivo(transferencia.motivo || '');
      setObservacoes(transferencia.observacoes || '');
      setHasChanges(false);
    }
  }, [transferencia]);

  useEffect(() => {
    if (transferencia) {
      const motivoMudou = (transferencia.motivo || '') !== motivo;
      const obsMudou = (transferencia.observacoes || '') !== observacoes;
      setHasChanges(motivoMudou || obsMudou);
    }
  }, [motivo, observacoes, transferencia]);

  if (!transferencia) return null;

  const isPendente = transferencia.status === 'em_andamento';
  const statusConfig = STATUS_CONFIG[transferencia.status];
  const totalPecas = itensDetalhados.reduce((sum, i) => sum + i.quantidadeEnviada, 0);

  const handleSalvarAlteracoes = async () => {
    try {
      await atualizar.mutateAsync({
        transferenciaId: transferencia.id,
        motivo: motivo || null,
        observacoes: observacoes || null,
      });
      toast.success('Alterações salvas');
      setHasChanges(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar alterações');
    }
  };

  const handleConcluir = async () => {
    try {
      // Salvar alterações pendentes primeiro
      if (hasChanges) {
        await atualizar.mutateAsync({
          transferenciaId: transferencia.id,
          motivo: motivo || null,
          observacoes: observacoes || null,
        });
      }
      
      await concluir.mutateAsync({ transferenciaId: transferencia.id });
      toast.success('Transferência concluída com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao concluir transferência');
    }
  };

  const handleCancelar = async () => {
    try {
      await cancelar.mutateAsync({ transferenciaId: transferencia.id });
      toast.success('Transferência cancelada');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar transferência');
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-1">
          {/* Status e ID */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">ID</p>
              <p className="font-mono text-sm">{transferencia.id.slice(0, 8)}</p>
            </div>
            <Badge className={cn("text-sm", statusConfig.className)}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Origem → Destino */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Origem</p>
                <p className="font-medium text-sm">{transferencia.localOrigemNome}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Destino</p>
                <p className="font-medium text-sm">{transferencia.localDestinoNome}</p>
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Criado em</p>
                <p className="text-sm font-medium">
                  {format(new Date(transferencia.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            {transferencia.dataConclusao && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {transferencia.status === 'concluida' ? 'Concluído em' : 'Cancelado em'}
                  </p>
                  <p className="text-sm font-medium">
                    {format(new Date(transferencia.dataConclusao), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Usuários */}
          <div className="space-y-2">
            {transferencia.criadorNome && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Criado por</p>
                  <p className="text-sm font-medium">
                    {transferencia.criadorNome}
                    {transferencia.criadorRole && (
                      <span className="text-xs text-muted-foreground ml-1">({transferencia.criadorRole})</span>
                    )}
                  </p>
                </div>
              </div>
            )}
            {transferencia.concluidoPorNome && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {transferencia.status === 'concluida' ? 'Concluído por' : 'Cancelado por'}
                  </p>
                  <p className="text-sm font-medium">
                    {transferencia.concluidoPorNome}
                    {transferencia.concluidoPorRole && (
                      <span className="text-xs text-muted-foreground ml-1">({transferencia.concluidoPorRole})</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Motivo</Label>
            </div>
            {isPendente ? (
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposAtivos.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.nome}>{tipo.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm bg-muted/50 rounded-md px-3 py-2">
                {transferencia.motivo || '—'}
              </p>
            )}
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Observação</Label>
            </div>
            {isPendente ? (
              <Textarea 
                value={observacoes} 
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações sobre a transferência..."
                className="min-h-[60px] resize-none"
              />
            ) : (
              <p className="text-sm bg-muted/50 rounded-md px-3 py-2 min-h-[40px]">
                {transferencia.observacoes || '—'}
              </p>
            )}
          </div>

          {/* Tabela de Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Itens ({itensDetalhados.length})</Label>
              <Badge variant="secondary">{totalPecas} peças</Badge>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right w-20">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensDetalhados.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="p-2">
                        <div className="w-10 h-10 rounded-md overflow-hidden border bg-muted">
                          <LotImage src={item.itemImagemUrl} alt={item.itemNome} className="w-full h-full object-cover" />
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <p className="text-sm font-medium truncate max-w-[150px]">{item.itemNome}</p>
                      </TableCell>
                      <TableCell className="text-right py-2 font-medium">
                        {item.quantidadeEnviada}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Ações */}
      {isPendente && (
        <div className="shrink-0 pt-4 border-t mt-4 space-y-2">
          {hasChanges && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleSalvarAlteracoes}
              disabled={atualizar.isPending}
            >
              {atualizar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar Transferência?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A transferência será marcada como cancelada e nenhum estoque será movimentado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleCancelar}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirmar Cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="gap-2">
                  <Check className="h-4 w-4" />
                  Concluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Concluir Transferência?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O estoque será movido da origem para o destino. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConcluir}>
                    {concluir.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirmar Conclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>Detalhes da Transferência</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden pt-4">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Detalhes da Transferência</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
