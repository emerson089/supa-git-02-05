import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface ClearPedidosDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClearPedidosDataModal({ open, onOpenChange }: ClearPedidosDataModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{
    pedidoItens: number;
    pedidos: number;
  } | null>(null);

  const isConfirmValid = confirmText === 'CONFIRMAR';

  const handleClearData = async () => {
    if (!user || !isConfirmValid) return;

    setIsDeleting(true);
    setProgress(0);
    setResult(null);

    try {
      // Step 1: Delete pedido_itens (0% - 30%)
      setStatus('Excluindo itens de pedidos...');
      let totalItensDeleted = 0;
      let hasMoreItens = true;

      while (hasMoreItens) {
        const { data: deletedItens, error: itensError } = await supabase
          .from('pedido_itens')
          .delete()
          .eq('user_id', user.id)
          .limit(500)
          .select('id');

        if (itensError) throw itensError;

        totalItensDeleted += deletedItens?.length || 0;
        hasMoreItens = (deletedItens?.length || 0) === 500;

        const itensProgress = Math.min(30, (totalItensDeleted / 100) * 3);
        setProgress(itensProgress);
        setStatus(`Excluindo itens de pedidos... (${totalItensDeleted} removidos)`);
      }

      setProgress(30);

      // Step 2: Delete pedidos in batches (30% - 100%)
      setStatus('Excluindo pedidos...');
      let totalPedidosDeleted = 0;
      let hasMorePedidos = true;

      while (hasMorePedidos) {
        const { data: deletedPedidos, error: pedidosError } = await supabase
          .from('pedidos')
          .delete()
          .eq('user_id', user.id)
          .limit(500)
          .select('id');

        if (pedidosError) throw pedidosError;

        totalPedidosDeleted += deletedPedidos?.length || 0;
        hasMorePedidos = (deletedPedidos?.length || 0) === 500;

        // Update progress (30% to 100%)
        const pedidoProgress = Math.min(100, 30 + (totalPedidosDeleted / 50));
        setProgress(pedidoProgress);
        setStatus(`Excluindo pedidos... (${totalPedidosDeleted} removidos)`);
      }

      setProgress(100);
      setStatus('Concluído!');

      setResult({
        pedidoItens: totalItensDeleted,
        pedidos: totalPedidosDeleted,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });

      toast.success('Pedidos excluídos com sucesso!');
      setIsDeleting(false);
    } catch (error) {
      console.error('Erro ao excluir dados:', error);
      toast.error('Erro ao excluir dados. Tente novamente.');
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      setProgress(0);
      setStatus('');
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={24} />
            Limpar Todos os Pedidos
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Esta ação irá excluir permanentemente todos os seus pedidos e itens.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6 mt-4">
            {!isDeleting ? (
              <>
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <p className="text-sm text-destructive font-medium mb-2">
                    ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Todos os pedidos serão excluídos</li>
                    <li>• Todos os itens de pedidos serão excluídos</li>
                    <li>• Os dados não poderão ser recuperados</li>
                    <li>• Os clientes NÃO serão afetados</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Digite <span className="font-bold text-destructive">CONFIRMAR</span> para prosseguir:
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Digite CONFIRMAR"
                    className="font-mono"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1 h-11 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleClearData}
                    disabled={!isConfirmValid}
                    className="flex-1 h-11 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    <Trash2 size={18} className="mr-2" />
                    Excluir Pedidos
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">{status}</span>
                </div>
                <Progress value={progress} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {progress.toFixed(0)}% concluído
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Pedidos Excluídos com Sucesso!
              </h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>✅ {result.pedidoItens} itens de pedidos excluídos</p>
                <p>✅ {result.pedidos} pedidos excluídos</p>
              </div>
            </div>

            <Button
              onClick={handleClose}
              className="w-full h-11 rounded-xl"
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
