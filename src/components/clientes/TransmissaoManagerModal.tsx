import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Loader2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientePaginatedDB } from '@/hooks/useClientesPaginated';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalogos } from '@/hooks/useCatalogos';
import { useClienteContatos } from '@/hooks/useClienteContatos';

const SAUDACOES = [
  'Olá', 'Oii', 'Oie', 'Opa', 'Olaa', 'Oiii', 'E aí', 'Fala', 'Oi',
  'Bom dia', 'Boa tarde', 'Boa noite', 'Oiie', 'Opaa', 'Hey', 'Salve',
  'Oi, passando para te mandar...',
];

const SUFIXOS = [
  ', tudo bem?', ', tudo certo?', ', como vai?',
  ', tudo bom?', '! Tudo tranquilo?', '! Como está?',
  ', beleza?', '! Tudo certo por aí?',
];

type Velocidade = 'ultra_seguro' | 'normal' | 'rapido';

const VELOCIDADES: Record<Velocidade, { min: number; max: number; label: string }> = {
  ultra_seguro: { min: 15, max: 40, label: 'Ultra Seguro (15-40s)' },
  normal: { min: 5, max: 10, label: 'Normal (5-10s)' },
  rapido: { min: 1, max: 3, label: 'Rápido (1-3s)' },
};

interface TransmissaoManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClientePaginatedDB[];
  filtroAtual: string;
}

const normalizePhoneE164 = (raw: string): { valid: boolean; phone: string } => {
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (!digits.startsWith('55')) digits = '55' + digits;
  if (digits.length < 12 || digits.length > 13) return { valid: false, phone: '' };
  return { valid: true, phone: digits };
};

const gerarSaudacao = (nome: string): string => {
  const saudacao = SAUDACOES[Math.floor(Math.random() * SAUDACOES.length)];
  const sufixo = SUFIXOS[Math.floor(Math.random() * SUFIXOS.length)];
  return `${saudacao} ${nome}${sufixo}`;
};

export const TransmissaoManagerModal: React.FC<TransmissaoManagerModalProps> = ({
  open,
  onOpenChange,
  clientes,
  filtroAtual,
}) => {
  const { user } = useAuth();
  const { catalogos, loading: loadingCatalogos } = useCatalogos();
  const { marcarContato } = useClienteContatos();
  const [selectedCatalogoId, setSelectedCatalogoId] = useState<string>('');
  const [velocidade, setVelocidade] = useState<Velocidade>('ultra_seguro');
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sucessos, setSucessos] = useState(0);
  const [falhas, setFalhas] = useState(0);
  const [jaEnviados, setJaEnviados] = useState(0);
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [hasPersistedData, setHasPersistedData] = useState(false);
  const [loadingEnvios, setLoadingEnvios] = useState(false);
  const [enviadosIds, setEnviadosIds] = useState<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STORAGE_KEY = `transmissao_progresso_${filtroAtual}`;

  // Filtrar clientes que já receberam o catálogo selecionado
  const clientesFiltrados = useMemo(() => {
    if (enviadosIds.size === 0) return clientes;
    return clientes.filter(c => !enviadosIds.has(c.id));
  }, [clientes, enviadosIds]);

  const totalOriginal = clientes.length;
  const total = clientesFiltrados.length;

  // Buscar envios anteriores ao trocar catálogo
  useEffect(() => {
    if (!open || !user?.id || !selectedCatalogoId) {
      setEnviadosIds(new Set());
      setJaEnviados(0);
      return;
    }

    const fetchEnvios = async () => {
      setLoadingEnvios(true);
      try {
        let catalogoIds: string[] = [];
        if (selectedCatalogoId === 'all_active') {
          catalogoIds = catalogos.filter(c => c.ativo).map(c => c.id);
        } else {
          catalogoIds = [selectedCatalogoId];
        }

        if (catalogoIds.length === 0) {
          setEnviadosIds(new Set());
          setJaEnviados(0);
          return;
        }

        const { data, error } = await supabase
          .from('catalogo_envios')
          .select('cliente_id, catalogo_id')
          .eq('user_id', user.id)
          .in('catalogo_id', catalogoIds);

        if (error) throw error;

        if (selectedCatalogoId === 'all_active' && catalogoIds.length > 1) {
          // Para "todos ativos", filtrar clientes que já receberam TODOS
          const countMap = new Map<string, number>();
          (data || []).forEach(row => {
            countMap.set(row.cliente_id, (countMap.get(row.cliente_id) || 0) + 1);
          });
          const ids = new Set<string>();
          countMap.forEach((count, clienteId) => {
            if (count >= catalogoIds.length) ids.add(clienteId);
          });
          setEnviadosIds(ids);
          setJaEnviados(ids.size);
        } else {
          const ids = new Set((data || []).map(r => r.cliente_id));
          setEnviadosIds(ids);
          setJaEnviados(ids.size);
        }
      } catch (err) {
        console.error('Erro ao buscar envios anteriores:', err);
      } finally {
        setLoadingEnvios(false);
      }
    };

    fetchEnvios();
  }, [open, user?.id, selectedCatalogoId, catalogos]);

  // Carregar progresso salvo
  useEffect(() => {
    if (open && status === 'idle') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.currentIndex > 0 && data.currentIndex < total) {
            setHasPersistedData(true);
          }
        } catch (e) {
          console.error('Erro ao carregar progresso:', e);
        }
      }
    }
  }, [open, status, total]);

  // Bloqueio de fechamento de aba
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'running') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  // Auto-select active catalog
  useEffect(() => {
    if (catalogos.length > 0 && !selectedCatalogoId) {
      if (catalogos.filter(c => c.ativo).length > 1) {
        setSelectedCatalogoId('all_active');
      } else {
        const ativo = catalogos.find((c) => c.ativo);
        setSelectedCatalogoId(ativo?.id || catalogos[0].id);
      }
    }
  }, [catalogos, selectedCatalogoId]);

  const selectedCatalogo = catalogos.find((c) => c.id === selectedCatalogoId) || null;

  const getFiltroLabel = () => {
    const map: Record<string, string> = {
      'todos': 'Todos', 'vip': 'VIPs', 'frequente': 'Frequentes',
      'risco': 'Risco', 'pendente': 'Pendentes', 'sem_compras': 'Sem Compras',
    };
    return map[filtroAtual] || filtroAtual;
  };

  const progressPercent = total === 0 ? 0 : Math.round((currentIndex / total) * 100);

  const handlePause = () => {
    setStatus('paused');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const logMessage = (msg: string, type: 'success' | 'error') => {
    setLogs((prev) => [{ id: Math.random().toString(), msg, type }, ...prev].slice(0, 50));
  };

  const registrarEnvio = async (clienteId: string, catalogoId: string) => {
    if (!user?.id) return;
    try {
      await supabase.from('catalogo_envios').insert({
        user_id: user.id,
        cliente_id: clienteId,
        catalogo_id: catalogoId,
      });
    } catch (err) {
      console.error('Erro ao registrar envio:', err);
    }
  };

  const processNext = async (index: number) => {
    if (status === 'paused' || status === 'idle') return;
    if (index >= total) {
      setStatus('completed');
      logMessage('Transmissão concluída com sucesso!', 'success');
      toast.success('Envio em massa finalizado!');
      return;
    }

    const cliente = clientesFiltrados[index];
    const phoneResult = normalizePhoneE164(cliente.telefone);

    if (!phoneResult.valid) {
      logMessage(`Telefone inválido: ${cliente.nome.split(' ')[0]}`, 'error');
      setFalhas((prev) => prev + 1);
      agendarProximo(index + 1);
      return;
    }

    try {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const catalogsToSend = selectedCatalogoId === 'all_active'
        ? catalogos.filter(c => c.ativo)
        : catalogos.filter(c => c.id === selectedCatalogoId);

      if (catalogsToSend.length === 0) throw new Error("Nenhum catálogo disponível para envio.");

      const primeiroNome = cliente.nome.split(' ')[0];

      for (const cat of catalogsToSend) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('lotes')
          .createSignedUrl(cat.file_path, 604800);

        if (signedError || !signedData?.signedUrl) {
          console.error(`Catálogo ${cat.nome} não encontrado.`);
          continue;
        }

        const isFirst = catalogsToSend.indexOf(cat) === 0;
        const hasNameTag = cat.mensagem?.includes('{nome}');

        let caption = '';
        if (isFirst) {
          const saudacaoPersonalizada = gerarSaudacao(primeiroNome);
          const baseCaption = cat.mensagem
            ? cat.mensagem.replace(/\{nome\}/g, primeiroNome)
            : `Segue nosso catálogo atualizado!`;

          caption = hasNameTag
            ? baseCaption
            : `${saudacaoPersonalizada} ${baseCaption}`;
        } else {
          caption = cat.mensagem
            ? cat.mensagem.replace(/\{nome\}/g, primeiroNome)
            : '';
        }

        const fileName = `${cat.nome.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`;

        const { error } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            type: 'document',
            phone: phoneResult.phone,
            documentUrl: signedData.signedUrl,
            fileName,
            caption,
          },
        });

        if (error) throw error;

        // Registrar envio no banco
        await registrarEnvio(cliente.id, cat.id);

        if (catalogsToSend.length > 1 && catalogsToSend.indexOf(cat) < catalogsToSend.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      marcarContato(cliente.id, 'whatsapp');
      logMessage(`Enviado para ${cliente.nome.split(' ')[0]}`, 'success');
      setSucessos((prev) => prev + 1);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentIndex: index + 1,
        sucessos: sucessos + 1,
        falhas,
        selectedCatalogoId
      }));

    } catch (err: any) {
      console.error(err);
      const errorMsg = err.details?.error || err.message || "Erro desconhecido";
      logMessage(`Falha (${cliente.nome.split(' ')[0]}): ${errorMsg}`, 'error');
      setFalhas((prev) => {
        const next = prev + 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          currentIndex: index + 1,
          sucessos,
          falhas: next,
          selectedCatalogoId
        }));
        return next;
      });
    }

    agendarProximo(index + 1);
  };

  const agendarProximo = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    if (nextIndex >= total) {
      setStatus('completed');
      localStorage.removeItem(STORAGE_KEY);
      toast.success('Transmissão finalizada!');
      return;
    }
    const config = VELOCIDADES[velocidade];
    const randomSeconds = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
    setCountdown(randomSeconds);
  };

  useEffect(() => {
    if (status !== 'running') return;
    if (currentIndex >= total) return;

    if (countdown > 0) {
      timeoutRef.current = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0) {
      processNext(currentIndex);
    }

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [countdown, status, currentIndex]);

  const handleStart = () => {
    if (total === 0) { toast.error('Nenhum cliente pendente na lista.'); return; }
    if (!selectedCatalogo && selectedCatalogoId !== 'all_active') {
      toast.error('Selecione um catálogo antes de iniciar.');
      return;
    }

    if (status === 'idle') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.currentIndex > 0 && data.currentIndex < total) {
          setCurrentIndex(data.currentIndex);
          setSucessos(data.sucessos);
          setFalhas(data.falhas);
          if (data.selectedCatalogoId) setSelectedCatalogoId(data.selectedCatalogoId);
          setHasPersistedData(false);
          setStatus('running');
          processNext(data.currentIndex);
          return;
        }
      }

      const confirm = window.confirm(`Iniciar envio automático para ${total} clientes? Mantenha esta janela aberta.`);
      if (!confirm) return;
    }

    setStatus('running');
    if (status === 'idle') processNext(0);
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    resetQueue();
    setHasPersistedData(false);
    toast.info('Progresso resetado.');
  };

  const resetQueue = () => {
    setStatus('idle');
    setCurrentIndex(0);
    setSucessos(0);
    setFalhas(0);
    setLogs([]);
    setCountdown(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && status === 'running') {
        toast.error('Pause a transmissão antes de fechar.');
        return;
      }
      onOpenChange(val);
      if (!val && (status === 'completed' || status === 'paused')) resetQueue();
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

        <div className="p-6 space-y-5">
          {/* Catalog + Speed Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Catálogo</label>
              {loadingCatalogos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                  <Loader2 size={14} className="animate-spin" /> Carregando...
                </div>
              ) : catalogos.length === 0 ? (
                <p className="text-xs text-destructive">Nenhum catálogo cadastrado.</p>
              ) : (
                <Select value={selectedCatalogoId} onValueChange={setSelectedCatalogoId} disabled={status === 'running'}>
                  <SelectTrigger className="w-full h-10 shadow-sm border-border bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogos.filter(c => c.ativo).length > 1 && (
                      <SelectItem value="all_active" className="font-semibold text-primary">
                        🚀 Todos os Catálogos Ativos
                      </SelectItem>
                    )}
                    {catalogos.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nome} {cat.ativo ? '(Ativo)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Velocidade</label>
              <Select
                value={velocidade}
                onValueChange={(v) => setVelocidade(v as Velocidade)}
                disabled={status === 'running'}
              >
                <SelectTrigger className="w-full h-10 shadow-sm border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VELOCIDADES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Público Alvo com filtro de duplicatas */}
          <div className="flex flex-col items-center justify-center bg-secondary/40 p-4 rounded-xl border border-border">
            <p className="text-sm font-medium text-foreground mb-1">Público Alvo</p>
            {loadingEnvios ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Verificando envios anteriores...
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-primary">{total}</p>
                {jaEnviados > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">de {totalOriginal} total</span>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">
                      {jaEnviados} já receberam
                    </span>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-md mt-2 border border-border">
              Filtro: {getFiltroLabel()}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="font-semibold text-lg">{progressPercent}% Concluído</p>
                <p className="text-sm text-muted-foreground">{currentIndex} de {total}</p>
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
              <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/20 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <CheckCircle2 size={16} className="text-blue-500" />
                <span className="font-medium text-blue-700 dark:text-blue-400">{jaEnviados} Já Enviados</span>
              </div>
              <div className="flex items-center gap-2 text-sm bg-destructive/5 px-3 py-2 rounded-lg border border-destructive/10 col-span-2">
                <AlertTriangle size={16} className="text-destructive" />
                <span className="font-medium text-destructive">{falhas} Falhas</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {hasPersistedData && status === 'idle' && (
              <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30 mb-2">
                <p className="text-xs text-orange-800 dark:text-orange-300 font-medium mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Existe um envio anterior não finalizado.
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleStart} className="flex-1 h-9 bg-orange-600 hover:bg-orange-700 text-white text-xs">
                    Retomar de onde parei
                  </Button>
                  <Button onClick={handleReset} variant="outline" className="h-9 text-xs border-orange-200">
                    Recomeçar do zero
                  </Button>
                </div>
              </div>
            )}

            {(status === 'idle' || status === 'paused') && !hasPersistedData && (
              <div className="flex gap-3">
                <Button onClick={handleStart} className="flex-1 h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold" disabled={catalogos.length === 0 || loadingEnvios || total === 0}>
                  <Play className="mr-2 h-5 w-5 fill-current" />
                  {status === 'paused' ? 'Retomar Envio' : `Iniciar Transmissão (${total})`}
                </Button>
                {status === 'paused' && (
                  <Button onClick={handleReset} variant="outline" className="h-12 px-4 rounded-xl border-border text-muted-foreground" title="Resetar tudo">
                    Limpar
                  </Button>
                )}
              </div>
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
              <p className="text-muted-foreground opacity-50 text-center mt-6">Os registros aparecerão aqui.</p>
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
