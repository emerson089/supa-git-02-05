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
  Info, History, UserX, ShieldCheck, AlertCircle, Clock, Settings2,
  Image as ImageIcon, Video, Plus, BarChart3, Edit2, FileSpreadsheet,
  Send, Calendar, Phone, RefreshCw, XCircle, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalogos, Catalogo } from '@/hooks/useCatalogos';
import { useMassSending } from '@/hooks/useMassSending';
import { Progress } from '@/components/ui/progress';
import { TransmissaoManagerModal } from '@/components/clientes/TransmissaoManagerModal';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

const ConfigCatalogo = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { catalogos, loading, uploadCatalogo, ativarCatalogo, excluirCatalogo, updateCatalogo } = useCatalogos();
  const {
    getEnviosHojeCount, getBlacklist, addToBlacklist, removeFromBlacklist,
    getCampanhasHistorico, getPerfilConfig, savePerfilConfig,
  } = useMassSending();

  const [activeTab, setActiveTab] = useState('gestao');
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [enviosHoje, setEnviosHoje] = useState(0);

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

  useEffect(() => {
    getEnviosHojeCount().then(setEnviosHoje);
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') carregarHistorico();
    if (activeTab === 'blacklist') carregarBlacklist();
    if (activeTab === 'config') carregarConfig();
  }, [activeTab, filtroPeriodo]);

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
      const data = await getCampanhasHistorico(desde);
      setHistorico(data);
    } finally {
      setLoadingHistorico(false);
    }
  }, [filtroPeriodo]);

  const carregarBlacklist = useCallback(async () => {
    setLoadingBlacklist(true);
    try {
      const data = await getBlacklist();
      setBlacklist(data);
    } finally {
      setLoadingBlacklist(false);
    }
  }, []);

  const carregarConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const data = await getPerfilConfig();
      if (data) {
        setLimiteDiario(data.limite_diario_mensagens ?? 500);
        setPausaInteligente(data.pausa_inteligente ?? true);
      }
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const handleSalvarConfig = async () => {
    setSavingConfig(true);
    try {
      await savePerfilConfig({ limite_diario_mensagens: limiteDiario, pausa_inteligente: pausaInteligente });
      toast.success('Configurações salvas!');
    } catch {
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAdicionarBlacklist = async () => {
    const digits = novoTelefone.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('Número inválido. Digite com DDD.'); return; }
    const tel = digits.length <= 11 ? '55' + digits : digits;
    setAddingBlacklist(true);
    try {
      await addToBlacklist(tel, novoMotivo || 'Adicionado manualmente', 'manual');
      setNovoTelefone('');
      setNovoMotivo('');
      await carregarBlacklist();
      toast.success('Número adicionado à blacklist.');
    } finally {
      setAddingBlacklist(false);
    }
  };

  const handleRemoverBlacklist = async (id: string) => {
    await removeFromBlacklist(id);
    setBlacklist(prev => prev.filter(b => b.id !== id));
    toast.success('Número removido da blacklist.');
  };

  const percentualUso = Math.min((enviosHoje / limiteDiario) * 100, 100);

  const getSaudeColor = (pct: number) => {
    if (pct < 60) return 'bg-emerald-500';
    if (pct < 85) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      if (!['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'].includes(f.type)) {
        toast.error('Tipo de arquivo não suportado. Use PDF, JPG, PNG ou MP4.'); return;
      }
      if (f.size > 25 * 1024 * 1024) { toast.error('O arquivo deve ter no máximo 25MB.'); return; }
      setFile(f);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Dê um nome ao catálogo.'); return; }
    setUploading(true);
    try {
      if (editingId) {
        await updateCatalogo(editingId, { nome: nome.trim(), mensagem }, file || undefined);
        toast.success('Catálogo atualizado!');
        setEditingId(null);
      } else {
        if (!file) { toast.error('Selecione um arquivo.'); return; }
        await uploadCatalogo(file, nome.trim(), mensagem);
        toast.success('Catálogo criado com sucesso!');
      }
      setFile(null); setNome(''); setMensagem('');
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message || 'Verifique sua conexão'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) { toast.error('Por favor, selecione um arquivo CSV.'); return; }
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
      if (nameIdx === -1 || phoneIdx === -1) {
        toast.error('CSV inválido. Certifique-se de ter as colunas "Nome" e "Telefone".'); return;
      }
      const contacts = lines.slice(1).filter(l => l.trim()).map((line, idx) => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        return {
          id: `csv-${idx}`,
          nome: cols[nameIdx] || 'Cliente',
          telefone: cols[phoneIdx]?.replace(/\D/g, '') || '',
          cidade: cityIdx !== -1 ? cols[cityIdx] : '',
          estado: stateIdx !== -1 ? cols[stateIdx] : '',
          excursao: excIdx !== -1 ? cols[excIdx] : '',
          created_at: new Date().toISOString(),
        };
      }).filter(c => c.telefone.length >= 8);
      setImportedContacts(contacts);
      toast.success(`${contacts.length} contatos prontos para envio.`);
    };
    reader.readAsText(f);
  };

  const handleTransmitirCSV = async () => {
    if (importedContacts.length === 0) return;
    setSavingCSV(true);
    let criados = 0;
    let existentes = 0;
    try {
      for (const c of importedContacts) {
        if (!c.telefone) continue;
        const tel = c.telefone.length <= 11 ? '55' + c.telefone : c.telefone;
        const { data: existing } = await supabase
          .from('clientes')
          .select('id')
          .eq('user_id', user!.id)
          .eq('telefone', tel)
          .maybeSingle();
        if (existing) {
          existentes++;
          c.id = existing.id;
        } else {
          const { data: novo } = await supabase
            .from('clientes')
            .insert({ user_id: user!.id, nome: c.nome, telefone: tel, cidade: c.cidade, estado: c.estado, excursao: c.excursao, categoria: 'Importado' })
            .select('id')
            .single();
          if (novo) { c.id = novo.id; criados++; }
        }
      }
      toast.success(`${criados} clientes criados, ${existentes} já existiam.`);
      setIsTransmissaoCSVOpen(true);
    } catch (err: any) {
      toast.error('Erro ao salvar contatos: ' + err.message);
    } finally {
      setSavingCSV(false);
    }
  };

  const handleEdit = (cat: Catalogo) => {
    setEditingId(cat.id); setNome(cat.nome); setMensagem(cat.mensagem || ''); setFile(null);
    setActiveTab('gestao');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreview = async (catalogo: Catalogo) => {
    const { data } = await supabase.storage.from('lotes').createSignedUrl(catalogo.file_path, 3600);
    if (data?.signedUrl) { setPreviewUrl(data.signedUrl); setPreviewName(catalogo.nome); }
    else toast.error('Não foi possível gerar o preview.');
  };

  const handleDelete = async (catalogo: Catalogo) => {
    if (!window.confirm(`Excluir "${catalogo.nome}"? Esta ação não pode ser desfeita.`)) return;
    await excluirCatalogo(catalogo);
  };

  const formatFiltros = (filtros: any) => {
    if (!filtros) return '';
    const parts = [];
    if (filtros.cidade) parts.push(filtros.cidade);
    if (filtros.categoria && filtros.categoria !== 'todos') parts.push(filtros.categoria);
    if (filtros.excursao) parts.push(filtros.excursao);
    return parts.join(' • ') || 'Todos';
  };

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      {isMobile && <MobileHeader title="Envios em Massa" />}
      {!isMobile && <AppSidebar />}

      <main className={cn('flex-1 p-6 lg:p-8 overflow-auto', isMobile && 'pt-20')}>
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-foreground tracking-tight">Envios em Massa</h1>
              <p className="text-muted-foreground">Potencialize suas vendas através do WhatsApp CRM</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Card className="p-4 rounded-2xl border-none neu-card flex items-center gap-4 min-w-[240px]">
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', getSaudeColor(percentualUso).replace('bg-', 'bg-') + '/10', getSaudeColor(percentualUso).replace('bg-', 'text-'))}>
                  <ShieldCheck size={24} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span>Limite Diário</span>
                    <span>{enviosHoje}/{limiteDiario}</span>
                  </div>
                  <Progress value={percentualUso} className={cn('h-1.5', getSaudeColor(percentualUso))} />
                </div>
              </Card>
              <Card className="p-4 rounded-2xl border-none neu-card flex items-center gap-4 min-w-[200px]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Qualidade do Número</p>
                  <p className="text-sm font-black text-emerald-600">MUITO SAUDÁVEL</p>
                </div>
              </Card>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-secondary/50 p-1 rounded-2xl h-14 w-full md:w-fit overflow-x-auto justify-start inline-flex">
              <TabsTrigger value="gestao" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Plus size={16} className="mr-2" /> Gestão
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <History size={16} className="mr-2" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="blacklist" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <UserX size={16} className="mr-2" /> Blacklist
                {blacklist.length > 0 && <Badge className="ml-2 h-4 px-1 text-[9px]">{blacklist.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="config" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Settings2 size={16} className="mr-2" /> Ajustes
              </TabsTrigger>
            </TabsList>

            {/* ABA GESTÃO */}
            <TabsContent value="gestao" className="mt-0 focus-visible:outline-none">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6 neu-card border-none flex flex-col gap-4 rounded-2xl h-fit">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        {editingId ? <Edit2 size={20} /> : <UploadCloud size={20} />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{editingId ? 'Editar Catálogo' : 'Novo Catálogo'}</h3>
                        <p className="text-sm text-muted-foreground">Personalize o envio</p>
                      </div>
                    </div>
                    {editingId && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setNome(''); setMensagem(''); setFile(null); }}>Cancelar</Button>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Nome do Catálogo</label>
                    <Input placeholder="Ex: Coleção Verão 2026" value={nome} onChange={e => setNome(e.target.value)} disabled={uploading} className="h-11 rounded-xl" />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensagem Personalizada</label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors"><Info size={14} /></button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed p-3">
                            <p className="font-semibold mb-1.5">Variáveis disponíveis:</p>
                            <div className="grid grid-cols-2 gap-2">
                              {['{nome}', '{cidade}', '{valor}', '{excursao}'].map(t => (
                                <code key={t} className="bg-muted p-1 rounded text-[10px]">{t}</code>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea placeholder="Olá {nome}! Segue nosso catálogo..." value={mensagem} onChange={e => setMensagem(e.target.value)} disabled={uploading} rows={4} className="resize-none rounded-xl" />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['{nome}', '{cidade}', '{valor}'].map(tag => (
                        <button key={tag} onClick={() => setMensagem(prev => prev + tag)} className="text-[10px] font-medium bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md transition-colors" type="button">+ {tag}</button>
                      ))}
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center bg-secondary/30 relative min-h-[140px]">
                    <input type="file" accept="application/pdf,image/*,video/mp4" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploading} />
                    {file ? (
                      <div className="flex flex-col items-center">
                        {file.type.startsWith('image/') ? <ImageIcon size={32} className="text-primary mb-2" /> : file.type.startsWith('video/') ? <Video size={32} className="text-primary mb-2" /> : <FileText size={32} className="text-primary mb-2" />}
                        <p className="font-medium text-foreground text-sm line-clamp-1 px-4">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB • Clique para trocar</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <UploadCloud size={32} className="text-muted-foreground mb-2 opacity-50" />
                        <p className="font-medium text-foreground text-sm">{editingId ? 'Substituir arquivo (opcional)' : 'Clique ou arraste um arquivo'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">PDF, Imagens ou Vídeos (Máx: 25MB)</p>
                      </div>
                    )}
                  </div>

                  <Button className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/10" onClick={handleSave} disabled={uploading || (!editingId && !file)}>
                    {uploading ? <><Loader2 size={18} className="mr-2 animate-spin" />Salvando...</> : <><CheckCircle2 size={18} className="mr-2" />{editingId ? 'Salvar Alterações' : 'Criar Catálogo'}</>}
                  </Button>

                  <Separator className="my-2 bg-border/40" />

                  {/* CSV Import */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <FileSpreadsheet size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Público Customizado (CSV)</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Importe uma lista externa</p>
                      </div>
                    </div>
                    <div className="border-2 border-dashed border-blue-200 dark:border-blue-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-blue-50/30 dark:bg-blue-950/10 relative min-h-[100px]">
                      <input type="file" accept=".csv" onChange={handleCSVUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      {csvFileName ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle2 size={24} className="text-blue-500 mb-1" />
                          <p className="font-medium text-foreground text-xs line-clamp-1">{csvFileName}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{importedContacts.length} contatos prontos</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadCloud size={24} className="text-muted-foreground mb-1 opacity-50" />
                          <p className="font-medium text-foreground text-xs">Carregar Lista .csv</p>
                          <p className="text-[9px] text-muted-foreground">Colunas: Nome, Telefone (obrigatórias)</p>
                        </div>
                      )}
                    </div>
                    {importedContacts.length > 0 && (
                      <Button variant="outline" className="w-full h-10 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-bold text-xs" onClick={handleTransmitirCSV} disabled={savingCSV}>
                        {savingCSV ? <><Loader2 size={14} className="mr-2 animate-spin" />Salvando contatos...</> : <><Send size={14} className="mr-2" />Transmitir para CSV ({importedContacts.length})</>}
                      </Button>
                    )}
                  </div>
                </Card>

                {/* Lista de catálogos */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    Seus Catálogos <Badge variant="outline" className="rounded-full bg-secondary/50 text-xs">{catalogos.length}</Badge>
                  </h3>
                  {loading ? (
                    <div className="flex items-center justify-center p-8"><Loader2 size={24} className="text-muted-foreground animate-spin" /></div>
                  ) : catalogos.length === 0 ? (
                    <Card className="p-8 neu-card border-none rounded-2xl flex flex-col items-center justify-center text-center">
                      <FileText size={32} className="text-muted-foreground mb-3 opacity-30" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhum catálogo cadastrado</p>
                    </Card>
                  ) : catalogos.map(cat => (
                    <Card key={cat.id} className={cn('p-4 neu-card border-none rounded-2xl transition-all group overflow-hidden relative', cat.ativo && 'ring-2 ring-primary/20 bg-primary/[0.02]')}>
                      {cat.ativo && <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-primary/10 rotate-45 pointer-events-none" />}
                      <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm transition-colors', cat.ativo ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}>
                            <FileText size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-foreground truncate">{cat.nome}</h4>
                              {cat.ativo && <Badge variant="default" className="text-[9px] uppercase tracking-tighter px-1.5 py-0 h-4 bg-primary text-white border-none">Ativo</Badge>}
                            </div>
                            {cat.mensagem && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">"{cat.mensagem}"</p>}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                <Calendar size={10} /> {new Date(cat.created_at).toLocaleDateString('pt-BR')}
                              </span>
                              {cat.last_edited_at && <span className="text-[10px] text-primary/70 flex items-center gap-1 font-medium"><Clock size={10} /> Editado recentemente</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(cat)}><Edit2 size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handlePreview(cat)}><Eye size={14} /></Button>
                          <Button variant="ghost" size="icon" className={cn('h-8 w-8 rounded-lg', cat.ativo ? 'text-primary bg-primary/10' : 'text-muted-foreground')} onClick={() => ativarCatalogo(cat.id, cat.ativo)}>
                            <Star size={14} className={cn(cat.ativo && 'fill-current')} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(cat)}><Trash2 size={14} /></Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ABA HISTÓRICO */}
            <TabsContent value="historico" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(['semana', 'mes', 'tudo'] as const).map(p => (
                    <Button key={p} variant={filtroPeriodo === p ? 'default' : 'outline'} size="sm" className="rounded-xl h-8 text-xs capitalize" onClick={() => setFiltroPeriodo(p)}>
                      {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mês' : 'Tudo'}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={carregarHistorico}>
                  <RefreshCw size={13} />
                </Button>
              </div>

              {loadingHistorico ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
              ) : historico.length === 0 ? (
                <Card className="p-12 border-none rounded-2xl neu-card flex flex-col items-center justify-center text-center">
                  <BarChart3 size={32} className="text-muted-foreground opacity-30 mb-3" />
                  <h3 className="text-lg font-bold">Nenhuma campanha no período</h3>
                  <p className="text-sm text-muted-foreground mt-1">As campanhas disparadas aparecerão aqui.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {historico.map((camp: any) => (
                    <Card key={camp.id} className="p-4 neu-card border-none rounded-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm truncate">{camp.nome_campanha}</p>
                            <Badge variant="outline" className="text-[9px] rounded-lg capitalize">{camp.velocidade?.replace('_', ' ')}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(camp.data_disparo).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            {camp.filtros_aplicados && <span className="ml-2">· {formatFiltros(camp.filtros_aplicados)}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div className="text-center">
                            <p className="text-lg font-black text-emerald-600">{camp.sucessos}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Enviados</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-rose-500">{camp.falhas}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Falhas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-slate-600">{camp.total_contatos}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                          </div>
                        </div>
                      </div>
                      {camp.total_contatos > 0 && (
                        <div className="mt-3">
                          <Progress value={(camp.sucessos / camp.total_contatos) * 100} className="h-1.5 bg-rose-100" />
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">
                            {Math.round((camp.sucessos / camp.total_contatos) * 100)}% de taxa de entrega
                          </p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA BLACKLIST */}
            <TabsContent value="blacklist" className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  Números nesta lista nunca receberão envios em massa, independente do catálogo ou campanha.
                </p>
              </div>

              <Card className="p-4 neu-card border-none rounded-2xl space-y-3">
                <h4 className="font-semibold text-sm">Adicionar número</h4>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input placeholder="Ex: 81 99999-1111" value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)} className="pl-10 h-10 rounded-xl" onKeyDown={e => e.key === 'Enter' && handleAdicionarBlacklist()} />
                  </div>
                  <Input placeholder="Motivo (opcional)" value={novoMotivo} onChange={e => setNovoMotivo(e.target.value)} className="flex-1 h-10 rounded-xl" />
                  <Button className="h-10 rounded-xl" onClick={handleAdicionarBlacklist} disabled={addingBlacklist}>
                    {addingBlacklist ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </Button>
                </div>
              </Card>

              {loadingBlacklist ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
              ) : blacklist.length === 0 ? (
                <Card className="p-12 border-none rounded-2xl neu-card flex flex-col items-center justify-center text-center">
                  <UserX size={32} className="text-muted-foreground opacity-30 mb-3" />
                  <h3 className="text-lg font-bold">Blacklist vazia</h3>
                  <p className="text-sm text-muted-foreground mt-1">Nenhum número bloqueado ainda.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {blacklist.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center shrink-0">
                          <XCircle size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.telefone}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.motivo || 'Sem motivo'} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0" onClick={() => handleRemoverBlacklist(item.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA CONFIG */}
            <TabsContent value="config">
              <div className="max-w-lg space-y-4">
                <Card className="p-6 rounded-2xl border-none neu-card space-y-6">
                  <h3 className="font-bold text-lg">Controle de Envios</h3>

                  {loadingConfig ? (
                    <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center gap-4">
                        <div>
                          <p className="font-semibold">Limite de mensagens/dia</p>
                          <p className="text-xs text-muted-foreground">Recomendado até 500 para números novos</p>
                        </div>
                        <Input
                          type="number"
                          value={limiteDiario}
                          onChange={e => setLimiteDiario(Number(e.target.value))}
                          className="w-24 text-right rounded-lg h-10"
                          min={1} max={1000}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">Pausa Inteligente</p>
                          <p className="text-xs text-muted-foreground">Delay randômico entre mensagens para evitar bloqueio</p>
                        </div>
                        <Switch checked={pausaInteligente} onCheckedChange={setPausaInteligente} />
                      </div>

                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800 dark:text-blue-400">
                          O limite diário é verificado antes de iniciar cada campanha. Se o limite já foi atingido, o disparo será bloqueado.
                        </p>
                      </div>

                      <Button className="w-full h-11 rounded-xl font-bold" onClick={handleSalvarConfig} disabled={savingConfig}>
                        {savingConfig ? <><Loader2 size={14} className="mr-2 animate-spin" />Salvando...</> : <><Save size={14} className="mr-2" />Salvar Configurações</>}
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview de arquivo */}
          {previewUrl && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <Card className="w-full max-w-4xl p-6 rounded-3xl bg-background shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Eye size={20} /></div>
                    <div>
                      <h3 className="font-bold text-xl">Preview: {previewName}</h3>
                      <p className="text-xs text-muted-foreground">Visualizando como o cliente receberá</p>
                    </div>
                  </div>
                  <Button variant="ghost" className="rounded-xl h-10 w-10 p-0" onClick={() => setPreviewUrl(null)}>
                    <XCircle size={20} />
                  </Button>
                </div>
                <div className="bg-secondary/30 rounded-2xl overflow-hidden border border-border">
                  <iframe src={previewUrl} className="w-full h-[65vh]" title="Preview" />
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      <BottomNavigation />

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
