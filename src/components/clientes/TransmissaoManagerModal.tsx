import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play, Pause, Loader2, CheckCircle2, AlertTriangle, Send,
  Filter, Clock, ShieldCheck,
  Smartphone, Info, Eraser, ChevronDown, ChevronUp,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useMassSending } from '@/hooks/useMassSending';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SAUDACOES = [
  'Oi, {nome}! Tô passando aqui pra te mandar uma novidade 😍',
  'Oii {nome}! Olha o que chegou pra você 👀',
  'Oie {nome}! Separei uma coisa especial pra você 🥰',
  'Ei {nome}, que bom te encontrar por aqui! Dá uma olhada nisso 😊',
  'Oi {nome}! Vim te mostrar as novidades da Delooki 🔥',
  'Oie {nome}! Você vai amar o que tenho pra te mostrar 😍',
  'Oi {nome}! Vim te mandar o catálogo novinho em folha 🥰',
  'Opa {nome}! Vim te dar uma novidade hoje 😊',
  'Ei {nome}! Vim rapidinho te mostrar nosso novo catálogo 👀',
  'Oi {nome}, tô com saudade! Olha essa coleção nova 🔥',
  'Oii {nome}! Acho que você vai gostar muito disso 🥰',
  'Ei {nome}, vim te contar uma novidade boa 😊',
  'Oi {nome}! Tava pensando em você e vim te mandar isso 🥰',
  'Oie {nome}! Chegou coisa boa aqui, dá uma olhada 👀',
  'Oi {nome}! Tem coisa nova na Delooki e precisava te mostrar 🔥',
  'Salve {nome}! Tenho uma surpresinha linda pra você 😍',
  'Oi {nome}! Sabia que ia te animar ver isso aqui 🥰',
  'Oii {nome}! Nossa coleção chegou e você precisa ver 👗',
  'Ei {nome}! Chegou o tão esperado catálogo novo 🔥',
  'Oi {nome}, passando com novidade boa por aqui! Dá uma olhadinha 😊',
];

const STORAGE_KEY = 'transmissao_progresso';

type Velocidade = 'ultra_seguro' | 'normal' | 'rapido';

const VELOCIDADES: Record<Velocidade, { min: number; max: number; label: string }> = {
  ultra_seguro: { min: 40, max: 60, label: 'Ultra Seguro (40-60s)' },
  normal: { min: 20, max: 30, label: 'Normal (20-30s)' },
  rapido: { min: 5, max: 10, label: 'Rápido (5-10s)' },
};

interface TransmissaoManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: any[];
  filtroAtual: string;
}

const normalizePhoneE164 = (raw: string): { valid: boolean; phone: string } => {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');

  // Já no formato E.164 completo: 55 + DDD(2) + 9dig(mobile=13) ou 8dig(fixo=12)
  if (digits.startsWith('55') && (digits.length === 13 || digits.length === 12)) {
    return { valid: true, phone: digits };
  }

  // Sem prefixo 55: DDD(2) + 9dig = 11 (celular) ou DDD(2) + 8dig = 10 (fixo)
  if (!digits.startsWith('55')) {
    if (digits.length === 11 || digits.length === 10) {
      return { valid: true, phone: '55' + digits };
    }
  }

  return { valid: false, phone: '' };
};

const gerarSaudacao = (nome: string): string => {
  const saudacao = SAUDACOES[Math.floor(Math.random() * SAUDACOES.length)];
  return saudacao.replace('{nome}', nome);
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
  const { isBlacklisted, saveCampanhaHistorico } = useMassSending();
  const isProcessingRef = useRef(false);

  // States fundamentais
  const [selectedCatalogoId, setSelectedCatalogoId] = useState<string>('');
  const [velocidade, setVelocidade] = useState<Velocidade>('ultra_seguro');
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'confirming'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sucessos, setSucessos] = useState(0);
  const [falhas, setFalhas] = useState(0);
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [hasPersistedData, setHasPersistedData] = useState(false);
  const [loadingEnvios, setLoadingEnvios] = useState(false);
  const [enviadosIds, setEnviadosIds] = useState<Set<string>>(new Set());
  const [jaEnviados, setJaEnviados] = useState(0);
  
  // Segmentação Avançada
  const [showFilters, setShowFilters] = useState(false);
  const [filterCidade, setFilterCidade] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('todos');
  const [filterValorMin, setFilterValorMin] = useState('');
  const [filterExcursao, setFilterExcursao] = useState('');

  // Preview e Segurança
  const [showPreview, setShowPreview] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // 1. Filtragem dinâmica baseada nos inputs do modal
  const clientesFiltradosUI = useMemo(() => {
    return (clientes || []).filter(c => {
      if (filterCidade && !c.cidade?.toLowerCase().includes(filterCidade.toLowerCase())) return false;
      if (filterExcursao && !c.excursao?.toLowerCase().includes(filterExcursao.toLowerCase())) return false;
      if (filterCategoria !== 'todos' && c.categoria !== filterCategoria) return false;
      if (filterValorMin && Number(c.total_comprado || 0) < Number(filterValorMin)) return false;
      return true;
    });
  }, [clientes, filterCidade, filterCategoria, filterValorMin, filterExcursao]);

  // 2. Filtrar clientes que já receberam o catálogo selecionado (HEAD logic)
  const clientesFinais = useMemo(() => {
    if (enviadosIds.size === 0) return clientesFiltradosUI;
    return clientesFiltradosUI.filter(c => !enviadosIds.has(c.id));
  }, [clientesFiltradosUI, enviadosIds]);

  const totalOriginal = clientesFiltradosUI.length;
  const total = clientesFinais.length;

  // Buscar envios anteriores ao trocar catálogo (HEAD logic)
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

  // Carregar progresso salvo (HEAD logic)
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

  const selectedCatalogo = catalogos.find((c) => c.id === selectedCatalogoId) || (selectedCatalogoId === 'all_active' ? catalogos.find(c => c.ativo) : null);

  const getFiltroLabel = () => {
    const map: Record<string, string> = {
      'todos': 'Todos', 'vip': 'VIPs', 'frequente': 'Frequentes',
      'risco': 'Risco', 'pendente': 'Pendentes', 'sem_compras': 'Sem Compras',
    };
    return map[filtroAtual] || filtroAtual;
  };

  const progressPercent = total === 0 ? 0 : Math.round((currentIndex / total) * 100);

  // Substituição de Variáveis
  const formatMessage = (template: string, cliente: ClientePaginatedDB) => {
    let msg = template || '';
    const primeiroNome = cliente.nome?.split(' ')[0] || 'Cliente';

    const substitutionMap: Record<string, string> = {
      '{nome}': primeiroNome,
      '{cidade}': cliente.cidade || 'sua região',
      '{estado}': cliente.estado || 'seu estado',
      '{excursao}': cliente.excursao || 'sua excursão',
      '{valor}': Number(cliente.total_comprado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    };

    Object.entries(substitutionMap).forEach(([tag, val]) => {
      msg = msg.split(tag).join(val);
    });

    // Se a mensagem do catálogo não tem {nome}, adiciona saudação com contexto no topo
    if (!template.includes('{nome}')) {
      const saudacao = SAUDACOES[Math.floor(Math.random() * SAUDACOES.length)];
      const saudacaoComNome = saudacao.replace('{nome}', primeiroNome);
      msg = `${saudacaoComNome}\n\n${msg}`;
    }

    return msg;
  };

  const handleStart = () => {
    if (total === 0) { toast.error('Nenhum cliente disponível na lista filtrada.'); return; }
    if (!selectedCatalogoId) { toast.error('Selecione um catálogo.'); return; }

    if (hasPersistedData) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setCurrentIndex(data.currentIndex);
                setSucessos(data.sucessos);
                setFalhas(data.falhas);
                if (data.selectedCatalogoId) setSelectedCatalogoId(data.selectedCatalogoId);
                setHasPersistedData(false);
                setStatus('running');
                processNext(data.currentIndex);
                return;
            } catch (e) {}
        }
    }

    setStatus('confirming');
  };

  const executeStart = async () => {
    setStatus('running');
    processNext(0);
  };

  const registrarEnvio = async (clienteId: string, catalogoId: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from('catalogo_envios').insert({
      user_id: user.id,
      cliente_id: clienteId,
      catalogo_id: catalogoId,
    });
    if (error) {
      // Não lança — só loga. Falha aqui não deve abortar a transmissão,
      // mas precisa ficar visível pra diagnóstico.
      console.error('[catalogo_envios] insert failed:', error, { clienteId, catalogoId });
    }
  };


  const processNext = async (index: number) => {
    if (isProcessingRef.current) return;
    if (status === 'paused' || status === 'idle') return;
    isProcessingRef.current = true;

    try {
      if (index >= total) {
        setStatus('completed');
        logMessage('Transmissão concluída!', 'success');
        localStorage.removeItem(STORAGE_KEY);
        await saveCampanhaHistorico({
          nome_campanha: `Campanha ${new Date().toLocaleDateString('pt-BR')}`,
          catalogo_id: selectedCatalogoId === 'all_active' ? null : selectedCatalogoId,
          total_contatos: total,
          sucessos,
          falhas,
          filtros_aplicados: { cidade: filterCidade, categoria: filterCategoria, excursao: filterExcursao, valor_min: filterValorMin },
          velocidade,
        });
        return;
      }

      const cliente = clientesFinais[index];
      const primeiroNome = cliente.nome?.split(' ')[0] ?? 'Cliente';

      // Verificar opt_out (LGPD)
      if ((cliente as any).opt_out === true) {
        logMessage(`PULADO: ${primeiroNome} optou por não receber mensagens`, 'error');
        agendarProximo(index + 1);
        return;
      }

      // Normalizar telefone
      const phoneResult = normalizePhoneE164(cliente.telefone || '');

      // Verificar Blacklist com telefone normalizado
      const blocked = phoneResult.valid ? await isBlacklisted(phoneResult.phone) : false;
      if (blocked) {
        logMessage(`PULADO: ${primeiroNome} está na Blacklist`, 'error');
        agendarProximo(index + 1);
        return;
      }

      if (!phoneResult.valid) {
        logMessage(`Telefone inválido: ${primeiroNome}`, 'error');
        setFalhas(prev => prev + 1);
        agendarProximo(index + 1);
        return;
      }

      if (!user?.id) throw new Error('Usuário não autenticado');
      const catalogsToSend = selectedCatalogoId === 'all_active'
        ? catalogos.filter(c => c.ativo)
        : catalogos.filter(c => c.id === selectedCatalogoId);

      for (const cat of catalogsToSend) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('lotes')
          .createSignedUrl(cat.file_path, 604800);
        if (signedError || !signedData?.signedUrl) continue;

        const caption = formatMessage(cat.mensagem, cliente);
        // Sem .pdf no final — a Z-API adiciona a extensão via o campo extension
        const fileName = cat.nome.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Catalogo';

        const { error } = await supabase.functions.invoke('send-whatsapp', {
          body: { type: 'document', phone: phoneResult.phone, documentUrl: signedData.signedUrl, fileName, caption },
        });
        if (error) throw error;

        await registrarEnvio(cliente.id, cat.id);

        if (catalogsToSend.length > 1 && catalogsToSend.indexOf(cat) < catalogsToSend.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      marcarContato(cliente.id, 'whatsapp');
      logMessage(`Enviado para ${primeiroNome}`, 'success');
      setSucessos(prev => {
        const next = prev + 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentIndex: index + 1, sucessos: next, falhas, selectedCatalogoId }));
        return next;
      });
    } catch (err) {
      const primeiroNome = clientesFinais[index]?.nome?.split(' ')[0] ?? 'Cliente';
      logMessage(`Falha ao enviar para ${primeiroNome}`, 'error');
      setFalhas(prev => {
        const next = prev + 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentIndex: index + 1, sucessos, falhas: next, selectedCatalogoId }));
        return next;
      });
    } finally {
      isProcessingRef.current = false;
    }

    agendarProximo(index + 1);
  };

  const agendarProximo = (next: number) => {
    setCurrentIndex(next);
    if (next >= total) {
      setStatus('completed');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const config = VELOCIDADES[velocidade];
    const randomWait = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
    setCountdown(randomWait);
  };

  useEffect(() => {
    if (status !== 'running' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, status]);

  useEffect(() => {
    if (status === 'running' && countdown === 0) processNext(currentIndex);
  }, [countdown, status]);

  const logMessage = (msg: string, type: 'success' | 'error') => {
    setLogs(prev => [{ id: Math.random().toString(), msg, type }, ...prev].slice(0, 50));
  };

  const handleTestSend = async () => {
    const num = window.prompt('Digite o número de teste (com DDD):');
    if (!num) return;
    const phone = normalizePhoneE164(num);
    if (!phone.valid) { toast.error('Número inválido'); return; }
    
    toast.info('Enviando teste...');
    try {
        const cat = catalogos.find(c => c.id === selectedCatalogoId) || catalogos.find(c => c.ativo);
        if (!cat) throw new Error('Selecione um catálogo');
        
        const { data: signed } = await supabase.storage.from('lotes').createSignedUrl(cat.file_path, 3600);
        
        await supabase.functions.invoke('send-whatsapp', {
            body: {
                type: 'document',
                phone: phone.phone,
                documentUrl: signed?.signedUrl,
                fileName: 'teste.pdf',
                caption: formatMessage(cat.mensagem, clientes[0] || { 
                    id: 'teste', 
                    nome: 'Teste', 
                    telefone: '', 
                    cidade: '', 
                    estado: '', 
                    excursao: '',
                    user_id: user?.id || '',
                    created_at: new Date().toISOString()
                } as ClientePaginatedDB)
            }
        });
        toast.success('Teste enviado com sucesso!');
    } catch (e) {
        toast.error('Falha no teste.');
    }
  };

  const handleReset = () => {
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
        if (status === 'running') return;
        onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden rounded-3xl bg-background border-none shadow-2xl">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md shadow-inner">
            <Send size={28} className="text-white drop-shadow-sm" />
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight text-white mb-1">Transmissão Segura</DialogTitle>
          <DialogDescription className="text-primary-foreground/80 font-medium">
            Personalização avançada e controle anti-spam
          </DialogDescription>
        </div>

        <div className="p-6 h-[70vh] overflow-y-auto space-y-6 custom-scrollbar">
          {status === 'idle' && (
            <>
              {/* Seção 1: Configuração Base */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Catálogo Principal</Label>
                  <Select value={selectedCatalogoId} onValueChange={setSelectedCatalogoId}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-none">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_active" className="font-bold text-primary">🚀 Todos os Ativos</SelectItem>
                      {catalogos.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.nome} {cat.ativo ? '(Ativo)' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Velocidade de Envio</Label>
                  <Select value={velocidade} onValueChange={v => setVelocidade(v as Velocidade)}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(VELOCIDADES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seção 2: Segmentação Avançada */}
              <Card className="p-4 border-none bg-secondary/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-primary" />
                    <h4 className="font-bold text-sm">Segmentação do Público</h4>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setShowFilters(!showFilters)}>
                    {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </Button>
                </div>

                {showFilters && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Categoria</Label>
                      <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                        <SelectTrigger className="h-9 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="VIP">💎 VIP</SelectItem>
                          <SelectItem value="Novo">✨ Novos</SelectItem>
                          <SelectItem value="Frequente">🔥 Frequentes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Cidade/Estado</Label>
                      <Input value={filterCidade} onChange={e => setFilterCidade(e.target.value)} placeholder="Ex: Goiânia" className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px]">Excursão</Label>
                        <Input value={filterExcursao} onChange={e => setFilterExcursao(e.target.value)} placeholder="Nome do ônibus" className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px]">Valor Mínimo (R$)</Label>
                        <Input type="number" value={filterValorMin} onChange={e => setFilterValorMin(e.target.value)} placeholder="0,00" className="h-9 text-xs" />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {total}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Contatos Filtrados</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-destructive rounded-lg" onClick={() => {
                        setFilterCidade(''); setFilterCategoria('todos'); setFilterValorMin(''); setFilterExcursao('');
                    }}>
                        <Eraser size={12} className="mr-1" /> Limpar Filtros
                    </Button>
                  </div>

                  {loadingEnvios ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                        <Loader2 size={12} className="animate-spin" /> Verificando envios anteriores...
                    </div>
                  ) : jaEnviados > 0 && (
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit">
                        <ShieldCheck size={12} /> {jaEnviados} CONTATOS JÁ RECEBERAM ESTE CATÁLOGO
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest bg-background/50 px-2 py-1 rounded-md w-fit">
                    Filtro: {getFiltroLabel()}
                  </p>
                </div>
              </Card>

              {/* Seção 3: Preview Mockup */}
              <div className="flex justify-center py-2">
                <Button variant="outline" size="sm" className="rounded-xl border-primary/20 bg-primary/5 text-primary font-bold gap-2 h-10 px-6" onClick={() => setShowPreview(true)}>
                    <Smartphone size={16} /> Ver Prévia no Celular
                </Button>
              </div>

              {hasPersistedData && (
                 <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-3 text-blue-800">
                        <Info size={20} />
                        <div>
                            <p className="text-xs font-bold leading-none">Progresso Salvo!</p>
                            <p className="text-[10px] opacity-70">Existe uma transmissão em andamento.</p>
                        </div>
                    </div>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 rounded-lg" onClick={handleStart}>Retomar</Button>
                 </div>
              )}
            </>
          )}

          {status !== 'idle' && status !== 'confirming' && (
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <div className="text-5xl font-black text-primary tracking-tighter">
                        {progressPercent}%
                    </div>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        Processando: {currentIndex} de {total}
                    </p>
                </div>

                <Progress value={progressPercent} className="h-3 bg-secondary rounded-full overflow-hidden" />

                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3">
                        <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-400">Entregues</p>
                            <p className="text-xl font-black text-emerald-600">{sucessos}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-center gap-3">
                        <AlertTriangle size={24} className="text-rose-500 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold uppercase text-rose-800 dark:text-rose-400">Falhas</p>
                            <p className="text-xl font-black text-rose-600">{falhas}</p>
                        </div>
                    </div>
                </div>

                {status === 'running' && countdown > 0 && (
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-primary">
                            <Clock size={20} className="animate-spin" />
                            <span className="font-bold text-sm tracking-tight uppercase">Aguardando {countdown}s para o próximo...</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg" onClick={() => setCountdown(0)}>Pular</Button>
                    </div>
                )}

                <div className="bg-secondary/40 p-4 rounded-2xl h-40 overflow-y-auto space-y-2 font-mono text-[11px] border border-border/50">
                    {logs.map(log => (
                        <div key={log.id} className={cn("flex gap-2", log.type === 'error' ? "text-rose-600" : "text-emerald-600")}>
                            <span>{log.type === 'success' ? '✓' : '⚠️'}</span>
                            <span className="flex-1 opacity-80">{log.msg}</span>
                        </div>
                    ))}
                    {logs.length === 0 && <p className="text-center text-muted-foreground opacity-30 mt-14 italic">Iniciando motor de envio...</p>}
                </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-secondary/20 border-t border-border flex flex-col sm:flex-row gap-3">
          {status === 'idle' && (
            <>
              <Button variant="outline" className="h-12 rounded-2xl flex-1 border-border font-bold text-muted-foreground" onClick={handleTestSend}>
                <Smartphone size={18} className="mr-2" /> Teste Piloto
              </Button>
              <Button onClick={handleStart} className="h-12 rounded-2xl flex-[2] bg-primary hover:bg-primary/90 text-white font-black shadow-xl shadow-primary/20">
                <Play size={18} className="mr-2 fill-current" />
                Iniciar Agora
              </Button>
            </>
          )}

          {status === 'running' && (
            <Button onClick={() => setStatus('paused')} variant="outline" className="w-full h-12 rounded-2xl font-black border-orange-200 text-orange-600 hover:bg-orange-50">
                <Pause size={18} className="mr-2 fill-current" /> Pausar Transmissão
            </Button>
          )}

          {status === 'paused' && (
            <div className="flex gap-3 w-full">
                <Button onClick={() => setStatus('running')} className="flex-[2] h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">
                    <Play size={18} className="mr-2 fill-current" /> Retomar Envios
                </Button>
                <Button onClick={handleReset} variant="ghost" className="flex-1 h-12 rounded-2xl font-bold bg-secondary">
                    Resetar
                </Button>
            </div>
          )}

          {status === 'completed' && (
            <Button onClick={() => onOpenChange(false)} className="w-full h-12 rounded-2xl bg-primary text-white font-black">
                Concluído • Fechar Janela
            </Button>
          )}
        </DialogFooter>

        {/* Modal de Preview (Mockup Celular) */}
        {showPreview && selectedCatalogo && (
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="sm:max-w-[400px] p-0 bg-transparent border-none shadow-none">
                    <div className="w-[320px] h-[640px] bg-[#1a1a1a] rounded-[3rem] p-4 mx-auto border-[8px] border-[#2a2a2a] relative shadow-2xl overflow-hidden">
                        {/* Status bar */}
                        <div className="absolute top-0 inset-x-0 h-6 bg-transparent flex justify-between items-center px-10 pt-2 z-20">
                            <span className="text-[10px] text-white">10:07</span>
                            <div className="flex gap-1">
                                <span className="text-[10px] text-white">WiFi</span>
                                <span className="text-[10px] text-white">88%</span>
                            </div>
                        </div>
                        
                        {/* WhatsApp Header */}
                        <div className="bg-[#075e54] h-16 pt-6 px-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-400" />
                            <div className="text-white">
                                <p className="text-xs font-bold leading-none">{clientesFinais[0]?.nome || 'Cliente Exemplo'}</p>
                                <p className="text-[8px] opacity-70">online agora</p>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div className="bg-[#e5ddd5] dark:bg-stone-900 h-full p-3 space-y-4 pt-4 overflow-y-auto">
                            <div className="max-w-[85%] bg-white dark:bg-slate-800 rounded-lg p-2 rounded-tl-none shadow-sm relative">
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-md mb-2 flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/30">
                                    <FileText size={16} className="text-primary" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold truncate">{selectedCatalogo.nome}.pdf</p>
                                        <p className="text-[8px] text-muted-foreground">Catálogo • PDF</p>
                                    </div>
                                </div>
                                <p className="text-[11px] whitespace-pre-wrap leading-relaxed">
                                    {formatMessage(selectedCatalogo.mensagem, clientesFinais[0] || { 
                                        id: 'preview',
                                        nome: 'Cliente Exemplo', 
                                        telefone: '', 
                                        cidade: 'Sua Cidade',
                                        estado: 'Seu Estado',
                                        excursao: 'Sua Excursão',
                                        user_id: user?.id || '',
                                        created_at: new Date().toISOString(),
                                        total_comprado: 1000 
                                    } as ClientePaginatedDB)}
                                </p>
                                <span className="text-[8px] text-muted-foreground absolute bottom-1 right-2">10:07 ✔✔</span>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )}

        {/* Modal de Confirmação de Segurança */}
        {status === 'confirming' && (
            <Dialog open={true} onOpenChange={() => setStatus('idle')}>
                <DialogContent className="sm:max-w-[400px] p-6 rounded-3xl animate-in zoom-in-95 duration-200">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-center">🔐 Segurança do Disparo</DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            Confirme os dados da campanha abaixo
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-secondary/50 p-4 rounded-2xl space-y-2">
                             <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Público Alvo</span>
                                <span className="font-bold">{total} contatos</span>
                             </div>
                             <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Catálogo</span>
                                <span className="font-bold truncate max-w-[150px]">{selectedCatalogo?.nome || 'Múltiplos'}</span>
                             </div>
                             <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Velocidade</span>
                                <span className="font-bold capitalize">{velocidade.replace('_', ' ')}</span>
                             </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Digite CONFIRMAR para liberar:</Label>
                            <Input 
                                value={confirmText} 
                                onChange={e => setConfirmText(e.target.value)} 
                                placeholder="DIGITE AQUI"
                                className="h-12 rounded-xl text-center font-black tracking-widest uppercase border-primary/20 bg-primary/5 focus:bg-background transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="ghost" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setStatus('idle')}>Cancelar</Button>
                        <Button
                            className="flex-2 rounded-xl h-12 bg-primary font-black shadow-lg shadow-primary/20"
                            disabled={confirmText.toUpperCase() !== 'CONFIRMAR'}
                            onClick={executeStart}
                        >
                            INICIAR DISPARO
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};
