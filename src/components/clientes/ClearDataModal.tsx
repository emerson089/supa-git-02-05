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

interface ClearDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClearDataModal({ open, onOpenChange }: ClearDataModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{
    pedidoItens: number;
    pedidos: number;
    clientes: number;
  } | null>(null);

  const isConfirmValid = confirmText === 'CONFIRMAR';

  const handleClearData = async () => {
    if (!user || !isConfirmValid) return;

    setIsDeleting(true);
    setProgress(0);
    setResult(null);

    try {
      // Step 1: Delete pedido_itens (10%)
      setStatus('Excluindo itens de pedidos...');
      const { data: deletedItens, error: itensError } = await supabase
        .from('pedido_itens')
        .delete()
        .eq('user_id', user.id)
        .select('id');

      if (itensError) throw itensError;
      setProgress(10);

      // Step 2: Delete pedidos in batches (10% - 60%)
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

        // Update progress (10% to 60%)
        const pedidoProgress = Math.min(60, 10 + (totalPedidosDeleted / 50));
        setProgress(pedidoProgress);
        setStatus(`Excluindo pedidos... (${totalPedidosDeleted} removidos)`);
      }

      setProgress(60);

      // Step 3: Delete clientes in batches (60% - 100%)
      setStatus('Excluindo clientes...');
      let totalClientesDeleted = 0;
      let hasMoreClientes = true;

      while (hasMoreClientes) {
        const { data: deletedClientes, error: clientesError } = await supabase
          .from('clientes')
          .delete()
          .eq('user_id', user.id)
          .limit(500)
          .select('id');

        if (clientesError) throw clientesError;

        totalClientesDeleted += deletedClientes?.length || 0;
        hasMoreClientes = (deletedClientes?.length || 0) === 500;

        // Update progress (60% to 100%)
        const clienteProgress = Math.min(100, 60 + (totalClientesDeleted / 10));
        setProgress(clienteProgress);
        setStatus(`Excluindo clientes... (${totalClientesDeleted} removidos)`);
      }

      setProgress(100);
      setStatus('Concluído!');

      setResult({
        pedidoItens: deletedItens?.length || 0,
        pedidos: totalPedidosDeleted,
        clientes: totalClientesDeleted,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });

      toast.success('Dados excluídos com sucesso!');
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
            Limpar Todos os Dados
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Esta ação irá excluir permanentemente todos os seus clientes e pedidos.
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
                    <li>• Todos os clientes serão excluídos</li>
                    <li>• Todos os pedidos serão excluídos</li>
                    <li>• Todos os itens de pedidos serão excluídos</li>
                    <li>• Os dados não poderão ser recuperados</li>
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
                    Excluir Tudo
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
                Dados Excluídos com Sucesso!
              </h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>✅ {result.pedidoItens} itens de pedidos excluídos</p>
                <p>✅ {result.pedidos} pedidos excluídos</p>
                <p>✅ {result.clientes} clientes excluídos</p>
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
