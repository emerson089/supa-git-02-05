import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Loader2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClientePaginatedDB } from '@/hooks/useClientesPaginated';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TransmissaoManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClientePaginatedDB[];
  filtroAtual: string;
}

const normalizePhoneE164 = (raw: string): { valid: boolean; phone: string } => {
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  if (digits.length < 12 || digits.length > 13) {
    return { valid: false, phone: '' };
  }
  return { valid: true, phone: digits };
};

export const TransmissaoManagerModal: React.FC<TransmissaoManagerModalProps> = ({
  open,
  onOpenChange,
  clientes,
  filtroAtual,
}) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sucessos, setSucessos] = useState(0);
  const [falhas, setFalhas] = useState(0);
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);
  const [countdown, setCountdown] = useState(0);
  
  // Ref para controlar timeout no React StrictMode / rerenders
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getFiltroLabel = () => {
    const map: Record<string, string> = {
      'todos': 'Todos',
      'vip': 'VIPs',
      'frequente': 'Frequentes',
      'risco': 'Risco',
      'pendente': 'Pendentes',
      'sem_compras': 'Sem Compras'
    };
    return map[filtroAtual] || filtroAtual;
  };

  const total = clientes.length;
  const progressPercent = total === 0 ? 0 : Math.round((currentIndex / total) * 100);

  // Limpa o processo quando a aba for fechada via "pause"
  const handlePause = () => {
    setStatus('paused');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const logMessage = (msg: string, type: 'success' | 'error') => {
    setLogs((prev) => [{ id: Math.random().toString(), msg, type }, ...prev].slice(0, 50));
  };

  const processNext = async (index: number) => {
    if (status === 'paused' || status === 'idle') return;

    if (index >= total) {
      setStatus('completed');
      logMessage('Transmissão concluída com sucesso!', 'success');
      toast.success('Envio em massa finalizado!');
      return;
    }

    const cliente = clientes[index];
    const phoneResult = normalizePhoneE164(cliente.telefone);

    if (!phoneResult.valid) {
      logMessage(`Telefone inválido: ${cliente.nome.split(' ')[0]}`, 'error');
      setFalhas((prev) => prev + 1);
      agendarProximo(index + 1);
      return;
    }

    try {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // 1. Obter URL assinada do catálogo (7 dias)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('lotes')
        .createSignedUrl(`${user.id}/catalogos/oficial.pdf`, 604800);

      if (signedError || !signedData?.signedUrl) {
        throw new Error("Catálogo não encontrado. Faça upload nas Configurações.");
      }

      // 2. Chamar função de envio
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { 
          type: 'document',
          phone: phoneResult.phone, 
          documentUrl: signedData.signedUrl,
          fileName: 'Catalogo_Delookii.pdf',
          caption: `Olá ${cliente.nome.split(' ')[0]}! Tudo bem? Segue nosso catálogo atualizado com todas as novidades! Qualquer dúvida, pode me chamar. 👇`
        },
      });

      if (error) throw error;

      logMessage(`Enviado para ${cliente.nome.split(' ')[0]}`, 'success');
      setSucessos((prev) => prev + 1);

    } catch (err: any) {
      console.error(err);
      const errorMsg = err.details?.error || err.message || "Erro desconhecido";
      logMessage(`Falha (${cliente.nome.split(' ')[0]}): ${errorMsg}`, 'error');
      setFalhas((prev) => prev + 1);
    }

    agendarProximo(index + 1);
  };

  const agendarProximo = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    
    if (nextIndex >= total) {
      setStatus('completed');
      toast.success('Transmissão finalizada!');
      return;
    }

    // Intervalo aleatório entre 15 e 40 segundos para evitar bloqueio
    const randomSeconds = Math.floor(Math.random() * (40 - 15 + 1)) + 15;
    setCountdown(randomSeconds);
  };

  // Efeito para tratar o countdown e disparo do próximo
  useEffect(() => {
    if (status !== 'running') return;
    if (currentIndex >= total) return;

    if (countdown > 0) {
      timeoutRef.current = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      // Dispara o envio
      processNext(currentIndex);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [countdown, status, currentIndex]);

  const handleStart = () => {
    if (total === 0) {
      toast.error('Nenhum cliente na lista selecionada.');
      return;
    }
    
    // Confirmação de catálogo
    if (status === 'idle') {
      const confirm = window.confirm(`Você está prester a iniciar o envio automátio para ${total} clientes. Lembre-se de manter esta janela aberta. Deseja continuar?`);
      if (!confirm) return;
    }

    setStatus('running');
    // Se estava idle, aciona o disparo imediato do índice zero definindo countdown para 0
    if (status === 'idle') {
        processNext(0);
    }
  };

  const resetQueue = () => {
    setStatus('idle');
    setCurrentIndex(0);
    setSucessos(0);
    setFalhas(0);
    setLogs([]);
    setCountdown(0);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && status === 'running') {
        toast.error('Pause a transmissão antes de fechar a janela.');
        return;
      }
      onOpenChange(val);
      if (!val && (status === 'completed' || status === 'paused')) {
          resetQueue(); // Clean up if they re-open
      }
    }}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden bg-background">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white text-center rounded-t-xl">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <Send size={24} className="text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-white mb-1">Transmissão Segura</DialogTitle>
          <DialogDescription className="text-orange-100 flex items-center justify-center gap-2">
            Disparo anti-spam do Catálogo PDF
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center justify-center bg-secondary/40 p-4 rounded-xl border border-border">
            <p className="text-sm font-medium text-foreground mb-1">Público Alvo Selecionado</p>
            <p className="text-2xl font-bold text-primary">{total}</p>
            <p className="text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-md mt-2 border border-border">
              Filtro: {getFiltroLabel()}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="font-semibold text-lg">{progressPercent}% Concluído</p>
                <p className="text-sm text-muted-foreground">{currentIndex} de {total} enviados</p>
              </div>
              
              {status === 'running' && countdown > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-100 dark:bg-orange-950/40 px-2 py-1 rounded-md animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  Próximo em {countdown}s
                </div>
              )}
            </div>
            
            <Progress value={progressPercent} className="h-3" />
            
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">{sucessos} Entregues</span>
              </div>
              <div className="flex items-center gap-2 text-sm bg-destructive/5 px-3 py-2 rounded-lg border border-destructive/10">
                <AlertTriangle size={16} className="text-destructive" />
                <span className="font-medium text-destructive">{falhas} Falhas</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3 pt-2">
            {(status === 'idle' || status === 'paused') && (
              <Button onClick={handleStart} className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                <Play className="mr-2 h-5 w-5 fill-current" />
                {status === 'paused' ? 'Retomar Envio' : 'Iniciar Transmissão'}
              </Button>
            )}
            
            {status === 'running' && (
              <Button onClick={handlePause} variant="outline" className="w-full h-12 rounded-xl font-semibold border-orange-200 hover:bg-orange-50 text-orange-700">
                <Pause className="mr-2 h-5 w-5 fill-current" />
                Pausar Envio
              </Button>
            )}
          </div>

          <div className="bg-secondary/50 p-4 rounded-xl text-xs space-y-1 h-32 overflow-y-auto font-mono">
            {logs.length === 0 ? (
              <p className="text-muted-foreground opacity-50 text-center mt-6">Os registros de envio aparecerão aqui.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-destructive' : 'text-foreground'}`}>
                  <span>{log.type === 'success' ? '✓' : '⚠️'}</span>
                  <span>{log.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
