import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  UploadCloud, FileText, CheckCircle2, Loader2, Trash2, Star, Eye,
  Info, History, UserX, Settings2,
  Plus, BarChart3, Edit2, FileSpreadsheet, Send, Phone,
  RefreshCw, XCircle, Save, Users,
  Zap, TrendingUp, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useCatalogos, Catalogo } from '@/hooks/useCatalogos';
import { useMassSending } from '@/hooks/useMassSending';
import { TransmissaoManagerModal } from '@/components/clientes/TransmissaoManagerModal';
import { useAuth } from '@/contexts/AuthContext';

const ConfigCatalogo = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { catalogos, loading, uploadCatalogo, ativarCatalogo, excluirCatalogo, updateCatalogo } = useCatalogos();
  const {
    getEnviosHojeCount, getBlacklist, addToBlacklist, removeFromBlacklist,
    getCampanhasHistorico, getPerfilConfig, savePerfilConfig,
  } = useMassSending();

  const STORAGE_KEY = 'envios-massa-estado';

  const lerEstadoSalvo = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const estadoSalvo = lerEstadoSalvo();

  const [activeTab, setActiveTabRaw] = useState<string>(estadoSalvo?.activeTab || 'gestao');
  const setActiveTab = (tab: string) => {
    setActiveTabRaw(tab);
    try {
      const atual = lerEstadoSalvo() || {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...atual, activeTab: tab }));
    } catch {}
  };

  // Formulário — colapsável
  const [formAberto, setFormAberto] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  // Métricas do topo
  const [enviosHoje, setEnviosHoje] = useState(0);
  const [ultimaCampanha, setUltimaCampanha] = useState<any>(null);
  const [totalClientes, setTotalClientes] = useState(0);
  const [limiteDiarioConfig, setLimiteDiarioConfig] = useState(500);

  // Contadores por catálogo (quantos já receberam)
  const [enviosPorCatalogo, setEnviosPorCatalogo] = useState<Record<string, number>>({});

  // Segmentação na página — persistida no localStorage
  const [clientes, setClientes] = useState<any[]>([]);
  const [filtroExcursao, setFiltroExcursaoRaw] = useState<string>(estadoSalvo?.filtroExcursao || '');
  const setFiltroExcursao = (v: string) => {
    setFiltroExcursaoRaw(v);
    try {
      const atual = lerEstadoSalvo() || {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...atual, filtroExcursao: v }));
    } catch {}
  };
  const [filtroCategoria, setFiltroCategoriaRaw] = useState<string>(estadoSalvo?.filtroCategoria || 'todos');
  const setFiltroCategoria = (v: string) => {
    setFiltroCategoriaRaw(v);
    try {
      const atual = lerEstadoSalvo() || {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...atual, filtroCategoria: v }));
    } catch {}
  };
  const [excursoesDisponiveis, setExcursoesDisponiveis] = useState<string[]>([]);

  // Modal de transmissão
  const [modalAberto, setModalAberto] = useState(false);
  const [clientesFiltradosParaEnvio, setClientesFiltradosParaEnvio] = useState<any[]>([]);

  // CSV
  const [importedContacts, setImportedContacts] = useState<any[]>([]);
  const [isTransmissaoCSVOpen, setIsTransmissaoCSVOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState('');
  const [savingCSV, setSavingCSV] = useState(false);

  // Histórico
  const [historico, setHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'semana' | 'mes' | 'tudo'>('semana');

  // Blacklist
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [loadingBlacklist, setLoadingBlacklist] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [addingBlacklist, setAddingBlacklist] = useState(false);

  // Config
  const [limiteDiario, setLimiteDiario] = useState(500);
  const [pausaInteligente, setPausaInteligente] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Carregar métricas iniciais
  useEffect(() => {
    carregarMetricas();
    carregarClientes();
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') carregarHistorico();
    if (activeTab === 'blacklist') carregarBlacklist();
    if (activeTab === 'config') carregarConfig();
  }, [activeTab, filtroPeriodo]);

  // Atualizar contadores de envio por catálogo quando catálogos carregam
  useEffect(() => {
    if (catalogos.length > 0 && user?.id) carregarEnviosPorCatalogo();
  }, [catalogos, user?.id]);

  const carregarMetricas = async () => {
    const [hoje, campanhas, config, { count }] = await Promise.all([
      getEnviosHojeCount(),
      getCampanhasHistorico(undefined),
      getPerfilConfig(),
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    ]);
    setEnviosHoje(hoje);
    setUltimaCampanha(campanhas[0] ?? null);
    setLimiteDiarioConfig(config?.limite_diario_mensagens ?? 500);
    setTotalClientes(count ?? 0);
  };

  const carregarClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, telefone, cidade, estado, excursao, categoria, total_comprado, opt_out')
      .eq('user_id', user!.id)
      .order('nome');
    const lista = data ?? [];
    setClientes(lista);
    const excursoes = [...new Set(lista.map((c: any) => c.excursao).filter(Boolean))];
    setExcursoesDisponiveis(excursoes as string[]);
  };

  const carregarEnviosPorCatalogo = async () => {
    const ids = catalogos.map(c => c.id);
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('catalogo_envios')
      .select('catalogo_id')
      .eq('user_id', user!.id)
      .in('catalogo_id', ids);
    const contagem: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
      contagem[r.catalogo_id] = (contagem[r.catalogo_id] ?? 0) + 1;
    });
    setEnviosPorCatalogo(contagem);
  };

  const clientesFiltrados = clientes.filter(c => {
    if (filtroCategoria !== 'todos' && c.categoria !== filtroCategoria) return false;
    if (filtroExcursao && c.excursao !== filtroExcursao) return false;
    return true;
  });

  const abrirModal = (_catalogoId: string) => {
    setClientesFiltradosParaEnvio(clientesFiltrados);
    setModalAberto(true);
  };

  // Histórico
  const carregarHistorico = useCallback(async () => {
    setLoadingHistorico(true);
    try {
      let desde: Date | undefined;
      const agora = new Date();
      if (filtroPeriodo === 'semana') {
        desde = new Date(agora);
        const dia = agora.getDay();
        desde.setDate(agora.getDate() - (dia === 0 ? 6 : dia - 1));
        desde.setHours(0, 0, 0, 0);
      } else if (filtroPeriodo === 'mes') {
        desde = new Date(agora.getFullYear(), agora.getMonth(), 1);
      }
      setHistorico(await getCampanhasHistorico(desde));
    } finally {
      setLoadingHistorico(false);
    }
  }, [filtroPeriodo]);

  const carregarBlacklist = useCallback(async () => {
    setLoadingBlacklist(true);
    try { setBlacklist(await getBlacklist()); }
    finally { setLoadingBlacklist(false); }
  }, []);

  const carregarConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const data = await getPerfilConfig();
      if (data) { setLimiteDiario(data.limite_diario_mensagens ?? 500); setPausaInteligente(data.pausa_inteligente ?? true); }
    } finally { setLoadingConfig(false); }
  }, []);

  const handleSalvarConfig = async () => {
    setSavingConfig(true);
    try { await savePerfilConfig({ limite_diario_mensagens: limiteDiario, pausa_inteligente: pausaInteligente }); toast.success('Configurações salvas!'); }
    catch { toast.error('Erro ao salvar configurações.'); }
    finally { setSavingConfig(false); }
  };

  const handleAdicionarBlacklist = async () => {
    const digits = novoTelefone.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('Número inválido. Digite com DDD.'); return; }
    const tel = digits.length <= 11 ? '55' + digits : digits;
    setAddingBlacklist(true);
    try {
      await addToBlacklist(tel, novoMotivo || 'Adicionado manualmente', 'manual');
      setNovoTelefone(''); setNovoMotivo('');
      await carregarBlacklist();
      toast.success('Número adicionado à blacklist.');
    } finally { setAddingBlacklist(false); }
  };

  const handleRemoverBlacklist = async (id: string) => {
    await removeFromBlacklist(id);
    setBlacklist(prev => prev.filter(b => b.id !== id));
    toast.success('Número removido da blacklist.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      if (!['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'].includes(f.type)) { toast.error('Use PDF, JPG, PNG ou MP4.'); return; }
      if (f.size > 25 * 1024 * 1024) { toast.error('Máximo 25MB.'); return; }
      setFile(f);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Dê um nome ao catálogo.'); return; }
    setUploading(true);
    try {
      if (editingId) {
        await updateCatalogo(editingId, { nome: nome.trim(), mensagem }, file || undefined);
        toast.success('Catálogo atualizado!'); setEditingId(null);
      } else {
        if (!file) { toast.error('Selecione um arquivo.'); return; }
        await uploadCatalogo(file, nome.trim(), mensagem);
        toast.success('Catálogo criado!');
      }
      setFile(null); setNome(''); setMensagem(''); setFormAberto(false);
      await carregarEnviosPorCatalogo();
    } catch (err: any) { toast.error(`Erro: ${err.message}`); }
    finally { setUploading(false); }
  };

  const handleEdit = (cat: Catalogo) => {
    setEditingId(cat.id); setNome(cat.nome); setMensagem(cat.mensagem || ''); setFile(null);
    setFormAberto(true); setActiveTab('gestao');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreview = async (cat: Catalogo) => {
    const { data } = await supabase.storage.from('lotes').createSignedUrl(cat.file_path, 3600);
    if (data?.signedUrl) { setPreviewUrl(data.signedUrl); setPreviewName(cat.nome); }
    else toast.error('Não foi possível gerar o preview.');
  };

  const handleDelete = async (cat: Catalogo) => {
    if (!window.confirm(`Excluir "${cat.nome}"?`)) return;
    await excluirCatalogo(cat);
    await carregarEnviosPorCatalogo();
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) { toast.error('Selecione um arquivo CSV.'); return; }
    setCsvFileName(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) { toast.error('CSV vazio.'); return; }
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('nome'));
      const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('cel'));
      const cityIdx = headers.findIndex(h => h.includes('cid'));
      const stateIdx = headers.findIndex(h => h.includes('est'));
      const excIdx = headers.findIndex(h => h.includes('exc'));
      if (nameIdx === -1 || phoneIdx === -1) { toast.error('CSV inválido. Precisa ter colunas Nome e Telefone.'); return; }
      const contacts = lines.slice(1).filter(l => l.trim()).map((line, idx) => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        return { id: `csv-${idx}`, nome: cols[nameIdx] || 'Cliente', telefone: cols[phoneIdx]?.replace(/\D/g, '') || '', cidade: cityIdx !== -1 ? cols[cityIdx] : '', estado: stateIdx !== -1 ? cols[stateIdx] : '', excursao: excIdx !== -1 ? cols[excIdx] : '', created_at: new Date().toISOString() };
      }).filter(c => c.telefone.length >= 8);
      setImportedContacts(contacts);
      toast.success(`${contacts.length} contatos prontos.`);
    };
    reader.readAsText(f);
  };

  const handleTransmitirCSV = async () => {
    if (importedContacts.length === 0) return;
    setSavingCSV(true);
    let criados = 0; let existentes = 0;
    try {
      for (const c of importedContacts) {
        if (!c.telefone) continue;
        const tel = c.telefone.length <= 11 ? '55' + c.telefone : c.telefone;
        const { data: existing } = await supabase.from('clientes').select('id').eq('user_id', user!.id).eq('telefone', tel).maybeSingle();
        if (existing) { existentes++; c.id = existing.id; }
        else {
          const { data: novo } = await supabase.from('clientes').insert({ user_id: user!.id, nome: c.nome, telefone: tel, cidade: c.cidade, estado: c.estado, excursao: c.excursao, categoria: 'Importado' }).select('id').single();
          if (novo) { c.id = novo.id; criados++; }
        }
      }
      toast.success(`${criados} criados, ${existentes} já existiam.`);
      setIsTransmissaoCSVOpen(true);
    } catch (err: any) { toast.error('Erro: ' + err.message); }
    finally { setSavingCSV(false); }
  };

  const formatFiltros = (filtros: any) => {
    if (!filtros) return '';
    const parts = [];
    if (filtros.cidade) parts.push(filtros.cidade);
    if (filtros.categoria && filtros.categoria !== 'todos') parts.push(filtros.categoria);
    if (filtros.excursao) parts.push(filtros.excursao);
    return parts.join(' · ') || 'Todos';
  };

  const percentualUso = Math.min((enviosHoje / limiteDiarioConfig) * 100, 100);
  const catalogoAtivo = catalogos.find(c => c.ativo);

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      {isMobile && <MobileHeader title="Envios em Massa" />}
      {!isMobile && <AppSidebar />}

      <main className={cn('flex-1 p-6 lg:p-8 overflow-auto', isMobile && 'pt-20')}>
        <div className="max-w-5xl mx-auto space-y-6">

          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Envios em Massa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">WhatsApp CRM · Z-API</p>
          </div>

          {/* 3 CARDS DE MÉTRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Mensagens hoje */}
            <Card className="neu-card border-none rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center">
                    <Zap size={18} className="text-indigo-600" />
                  </div>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', percentualUso < 60 ? 'bg-emerald-100 text-emerald-700' : percentualUso < 85 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>
                    {Math.round(percentualUso)}%
                  </span>
                </div>
                <p className="text-3xl font-black text-foreground">{enviosHoje}</p>
                <p className="text-xs text-muted-foreground mt-0.5">de {limiteDiarioConfig} mensagens hoje</p>
                <Progress value={percentualUso} className="h-1 mt-3" />
              </CardContent>
            </Card>

            {/* Catálogo ativo */}
            <Card className="neu-card border-none rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                    <FileText size={18} className="text-emerald-600" />
                  </div>
                  {catalogoAtivo
                    ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Pronto</span>
                    : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Nenhum</span>
                  }
                </div>
                <p className="text-lg font-black text-foreground truncate">{catalogoAtivo?.nome ?? '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {catalogoAtivo ? `${enviosPorCatalogo[catalogoAtivo.id] ?? 0} pessoas já receberam` : 'Ative um catálogo para disparar'}
                </p>
              </CardContent>
            </Card>

            {/* Último disparo */}
            <Card className="neu-card border-none rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                    <TrendingUp size={18} className="text-violet-600" />
                  </div>
                </div>
                {ultimaCampanha ? (
                  <>
                    <p className="text-xl font-black text-foreground">
                      {ultimaCampanha.sucessos} <span className="text-emerald-500">✓</span>
                      <span className="text-rose-400 ml-2">{ultimaCampanha.falhas} ✗</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(ultimaCampanha.data_disparo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-black text-foreground">—</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Nenhum disparo ainda</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
            <TabsList className="bg-secondary/50 p-1 rounded-2xl h-12 w-full md:w-fit inline-flex">
              <TabsTrigger value="gestao" className="rounded-xl px-5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Plus size={14} className="mr-1.5" /> Gestão
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-xl px-5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <History size={14} className="mr-1.5" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="blacklist" className="rounded-xl px-5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <UserX size={14} className="mr-1.5" /> Blacklist
                {blacklist.length > 0 && <Badge className="ml-1.5 h-4 px-1 text-[9px]">{blacklist.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="config" className="rounded-xl px-5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Settings2 size={14} className="mr-1.5" /> Ajustes
              </TabsTrigger>
            </TabsList>

            {/* ─── ABA GESTÃO ─── */}
            <TabsContent value="gestao" className="space-y-5 mt-0">

              {/* PAINEL DE SEGMENTAÇÃO */}
              <Card className="neu-card border-none rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Users size={15} className="text-primary" /> Público para o próximo disparo
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-primary">{clientesFiltrados.length}</span>
                      <span className="text-xs text-muted-foreground">de {totalClientes}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {/* Filtro categoria */}
                    {(['todos', 'VIP', 'Frequente', 'Novo', 'Importado'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFiltroCategoria(cat)}
                        className={cn(
                          'text-xs px-3 py-1 rounded-full font-medium border transition-all',
                          filtroCategoria === cat
                            ? 'bg-primary text-white border-primary'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        {cat === 'todos' ? 'Todos' : cat}
                      </button>
                    ))}
                  </div>

                  {excursoesDisponiveis.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setFiltroExcursao('')}
                        className={cn('text-xs px-3 py-1 rounded-full font-medium border transition-all', !filtroExcursao ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-background border-border text-muted-foreground hover:border-indigo-300')}
                      >
                        Todas as excursões
                      </button>
                      {excursoesDisponiveis.map(exc => (
                        <button
                          key={exc}
                          onClick={() => setFiltroExcursao(exc === filtroExcursao ? '' : exc)}
                          className={cn('text-xs px-3 py-1 rounded-full font-medium border transition-all', filtroExcursao === exc ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-background border-border text-muted-foreground hover:border-indigo-300')}
                        >
                          {exc}
                        </button>
                      ))}
                    </div>
                  )}

                  <Button
                    className="w-full h-10 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 gap-2"
                    onClick={() => abrirModal(catalogoAtivo?.id ?? 'all_active')}
                    disabled={clientesFiltrados.length === 0 || !catalogoAtivo}
                  >
                    <Send size={15} />
                    Disparar para {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'cliente' : 'clientes'}
                    {!catalogoAtivo && <span className="opacity-60 text-xs ml-1">(ative um catálogo)</span>}
                  </Button>
                </CardContent>
              </Card>

              {/* LISTA DE CATÁLOGOS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">
                    Catálogos <span className="text-primary ml-1">{catalogos.length}</span>
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1.5"
                    onClick={() => { setFormAberto(v => !v); if (editingId) { setEditingId(null); setNome(''); setMensagem(''); setFile(null); } }}
                  >
                    <Plus size={13} /> Novo catálogo
                  </Button>
                </div>

                {/* Formulário colapsável */}
                {formAberto && (
                  <Card className="neu-card border-none rounded-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{editingId ? 'Editando catálogo' : 'Novo catálogo'}</p>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setFormAberto(false); setEditingId(null); setNome(''); setMensagem(''); setFile(null); }}>
                          Cancelar
                        </Button>
                      </div>

                      <Input placeholder="Nome do catálogo" value={nome} onChange={e => setNome(e.target.value)} className="h-10 rounded-xl" />

                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensagem personalizada</label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="text-muted-foreground hover:text-foreground"><Info size={13} /></button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs p-3 max-w-xs">
                                Use: <code>{'{nome}'}</code>, <code>{'{cidade}'}</code>, <code>{'{valor}'}</code>, <code>{'{excursao}'}</code>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea placeholder="Olá {nome}! Segue nosso catálogo..." value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} className="resize-none rounded-xl text-sm" />
                        <div className="flex gap-2 mt-1.5">
                          {['{nome}', '{cidade}', '{valor}'].map(tag => (
                            <button key={tag} onClick={() => setMensagem(p => p + tag)} className="text-[10px] bg-secondary px-2 py-0.5 rounded-md" type="button">{tag}</button>
                          ))}
                        </div>
                      </div>

                      <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center text-center relative min-h-[90px] bg-secondary/20">
                        <input type="file" accept="application/pdf,image/*,video/mp4" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                        {file ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 size={20} className="text-primary mb-1" />
                            <p className="text-xs font-medium truncate max-w-[200px]">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center mt-2">
                            <UploadCloud size={20} className="text-muted-foreground/50 mb-1" />
                            <p className="text-xs text-muted-foreground">{editingId ? 'Substituir arquivo (opcional)' : 'PDF, imagem ou vídeo — máx 25MB'}</p>
                          </div>
                        )}
                      </div>

                      <Button className="w-full h-10 rounded-xl font-bold" onClick={handleSave} disabled={uploading || (!editingId && !file)}>
                        {uploading ? <><Loader2 size={14} className="mr-2 animate-spin" />Salvando...</> : <><CheckCircle2 size={14} className="mr-2" />{editingId ? 'Salvar alterações' : 'Criar catálogo'}</>}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Lista de catálogos */}
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
                ) : catalogos.length === 0 ? (
                  <Card className="neu-card border-none rounded-2xl p-8 text-center">
                    <FileText size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum catálogo. Clique em "Novo catálogo" para criar.</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {catalogos.map(cat => (
                      <div key={cat.id} className={cn(
                        'flex items-center gap-3 p-3 rounded-2xl border transition-all group',
                        cat.ativo
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-background border-border hover:border-border/80'
                      )}>
                        {/* Ícone */}
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cat.ativo ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}>
                          <FileText size={16} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold truncate">{cat.nome}</p>
                            {cat.ativo && <Badge className="text-[9px] h-4 px-1.5 bg-primary text-white shrink-0">ATIVO</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {enviosPorCatalogo[cat.id] ?? 0} pessoas receberam
                            {cat.last_edited_at && <span className="ml-2 text-primary/70">· editado recentemente</span>}
                          </p>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            className="h-7 px-3 rounded-lg text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => abrirModal(cat.id)}
                          >
                            <Send size={11} /> Enviar
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(cat)}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handlePreview(cat)}>
                            <Eye size={13} />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className={cn('h-7 w-7 rounded-lg', cat.ativo ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity')}
                            onClick={() => ativarCatalogo(cat.id, cat.ativo)}
                          >
                            <Star size={13} className={cn(cat.ativo && 'fill-current')} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(cat)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CSV IMPORT */}
              <Card className="neu-card border-none rounded-2xl overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Lista CSV</p>
                      <p className="text-[11px] text-muted-foreground">Importe contatos externos para um disparo pontual</p>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-blue-200 dark:border-blue-900/30 rounded-xl p-4 relative text-center bg-blue-50/30 dark:bg-blue-950/10 min-h-[70px] flex items-center justify-center">
                    <input type="file" accept=".csv" onChange={handleCSVUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    {csvFileName ? (
                      <div>
                        <CheckCircle2 size={16} className="text-blue-500 mx-auto mb-1" />
                        <p className="text-xs font-medium">{csvFileName} · {importedContacts.length} contatos</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Clique para selecionar .csv (colunas: Nome, Telefone)</p>
                    )}
                  </div>

                  {importedContacts.length > 0 && (
                    <Button variant="outline" className="w-full h-9 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 font-bold text-xs gap-2" onClick={handleTransmitirCSV} disabled={savingCSV}>
                      {savingCSV ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : <><Send size={13} />Transmitir para {importedContacts.length} contatos</>}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── ABA HISTÓRICO ─── */}
            <TabsContent value="historico" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(['semana', 'mes', 'tudo'] as const).map(p => (
                    <Button key={p} variant={filtroPeriodo === p ? 'default' : 'outline'} size="sm" className="rounded-xl h-8 text-xs" onClick={() => setFiltroPeriodo(p)}>
                      {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mês' : 'Tudo'}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={carregarHistorico}><RefreshCw size={13} /></Button>
              </div>

              {loadingHistorico ? (
                <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
              ) : historico.length === 0 ? (
                <Card className="neu-card border-none rounded-2xl p-12 text-center">
                  <BarChart3 size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma campanha no período.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {historico.map((camp: any) => (
                    <Card key={camp.id} className="neu-card border-none rounded-2xl overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate">{camp.nome_campanha}</p>
                              <Badge variant="outline" className="text-[9px] rounded-lg shrink-0 capitalize">{camp.velocidade?.replace('_', ' ')}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(camp.data_disparo).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              {camp.filtros_aplicados && <span className="ml-2">· {formatFiltros(camp.filtros_aplicados)}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 text-right">
                            <div>
                              <p className="text-lg font-black text-emerald-600">{camp.sucessos}</p>
                              <p className="text-[9px] text-muted-foreground uppercase">Enviados</p>
                            </div>
                            <div>
                              <p className="text-lg font-black text-rose-500">{camp.falhas}</p>
                              <p className="text-[9px] text-muted-foreground uppercase">Falhas</p>
                            </div>
                            <div>
                              <p className="text-lg font-black text-slate-600">{camp.total_contatos}</p>
                              <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                            </div>
                          </div>
                        </div>
                        {camp.total_contatos > 0 && (
                          <div className="mt-3">
                            <Progress value={(camp.sucessos / camp.total_contatos) * 100} className="h-1 bg-rose-100" />
                            <p className="text-[10px] text-muted-foreground mt-1 text-right">{Math.round((camp.sucessos / camp.total_contatos) * 100)}% taxa de entrega</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── ABA BLACKLIST ─── */}
            <TabsContent value="blacklist" className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-400">Números nesta lista nunca receberão envios em massa.</p>
              </div>

              <Card className="neu-card border-none rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input placeholder="DDD + número" value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)} className="pl-10 h-9 rounded-xl text-sm" onKeyDown={e => e.key === 'Enter' && handleAdicionarBlacklist()} />
                    </div>
                    <Input placeholder="Motivo (opcional)" value={novoMotivo} onChange={e => setNovoMotivo(e.target.value)} className="flex-1 h-9 rounded-xl text-sm" />
                    <Button className="h-9 rounded-xl px-3" onClick={handleAdicionarBlacklist} disabled={addingBlacklist}>
                      {addingBlacklist ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {loadingBlacklist ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
              ) : blacklist.length === 0 ? (
                <Card className="neu-card border-none rounded-2xl p-12 text-center">
                  <UserX size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum número bloqueado.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {blacklist.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.telefone}</p>
                        <p className="text-xs text-muted-foreground">{item.motivo || 'Sem motivo'} · {new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-lg shrink-0" onClick={() => handleRemoverBlacklist(item.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── ABA CONFIG ─── */}
            <TabsContent value="config">
              <Card className="neu-card border-none rounded-2xl max-w-md">
                <CardContent className="p-6 space-y-6">
                  <h3 className="font-bold">Controle de Envios</h3>
                  {loadingConfig ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center gap-4">
                        <div>
                          <p className="font-semibold text-sm">Limite de mensagens/dia</p>
                          <p className="text-xs text-muted-foreground">Recomendado até 500</p>
                        </div>
                        <Input type="number" value={limiteDiario} onChange={e => setLimiteDiario(Number(e.target.value))} className="w-24 text-right rounded-lg h-9" min={1} max={1000} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Pausa inteligente</p>
                          <p className="text-xs text-muted-foreground">Delay randômico entre envios</p>
                        </div>
                        <Switch checked={pausaInteligente} onCheckedChange={setPausaInteligente} />
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-2">
                        <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800 dark:text-blue-400">O limite é verificado antes de cada campanha. Se já atingido, o disparo é bloqueado.</p>
                      </div>
                      <Button className="w-full h-10 rounded-xl font-bold gap-2" onClick={handleSalvarConfig} disabled={savingConfig}>
                        {savingConfig ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : <><Save size={13} />Salvar configurações</>}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <BottomNavigation />

      {/* Preview de arquivo */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <Card className="w-full max-w-4xl p-6 rounded-3xl bg-background shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Eye size={18} /></div>
                <div>
                  <h3 className="font-bold">{previewName}</h3>
                  <p className="text-xs text-muted-foreground">Preview do catálogo</p>
                </div>
              </div>
              <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl" onClick={() => setPreviewUrl(null)}><XCircle size={18} /></Button>
            </div>
            <div className="bg-secondary/30 rounded-2xl overflow-hidden border border-border">
              <iframe src={previewUrl} className="w-full h-[65vh]" title="Preview" />
            </div>
          </Card>
        </div>
      )}

      {/* Modal de transmissão — catálogo específico ou filtrado */}
      <TransmissaoManagerModal
        open={modalAberto}
        onOpenChange={(v) => { setModalAberto(v); if (!v) carregarMetricas(); }}
        clientes={clientesFiltradosParaEnvio.length > 0 ? clientesFiltradosParaEnvio : clientes}
        filtroAtual={filtroCategoria}
      />

      {/* Modal CSV */}
      <TransmissaoManagerModal
        open={isTransmissaoCSVOpen}
        onOpenChange={setIsTransmissaoCSVOpen}
        clientes={importedContacts}
        filtroAtual="csv-imported"
      />
    </div>
  );
};

export default ConfigCatalogo;
