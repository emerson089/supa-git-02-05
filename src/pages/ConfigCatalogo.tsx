import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  UploadCloud, FileText, CheckCircle2, Loader2, Trash2, Star, Eye, Info, 
  Calendar, History, UserX, ShieldCheck, AlertCircle, Clock, Settings2,
  Image as ImageIcon, Video, File as FileIcon, Plus, ChevronRight, BarChart3,
  Edit2, FileSpreadsheet, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalogos, Catalogo } from '@/hooks/useCatalogos';
import { useMassSending } from '@/hooks/useMassSending';
import { Progress } from '@/components/ui/progress';
import { TransmissaoManagerModal } from '@/components/clientes/TransmissaoManagerModal';
import { Separator } from '@/components/ui/separator';

const ConfigCatalogo = () => {
  const isMobile = useIsMobile();
  const { catalogos, loading, uploadCatalogo, ativarCatalogo, excluirCatalogo, updateCatalogo } = useCatalogos();
  const { getEnviosHojeCount } = useMassSending();

  const [activeTab, setActiveTab] = useState('gestao');
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [enviosHoje, setEnviosHoje] = useState(0);
  
  // CSV Import States
  const [importedContacts, setImportedContacts] = useState<any[]>([]);
  const [isTransmissaoCSVOpen, setIsTransmissaoCSVOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState('');

  // Saúde do Disparo
  const limiteDiario = 500;
  
  useEffect(() => {
    getEnviosHojeCount().then(setEnviosHoje);
  }, [getEnviosHojeCount]);

  const percentualUso = (enviosHoje / limiteDiario) * 100;
  
  const getSaudeColor = (pct: number) => {
    if (pct < 60) return "bg-emerald-500";
    if (pct < 85) return "bg-amber-500";
    return "bg-rose-500";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error('Tipo de arquivo não suportado. Use PDF, JPG, PNG ou MP4.');
        return;
      }
      if (selectedFile.size > 25 * 1024 * 1024) {
        toast.error('O arquivo deve ter no máximo 25MB.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error('Dê um nome ao catálogo.');
      return;
    }

    setUploading(true);
    try {
      if (editingId) {
        await updateCatalogo(editingId, { nome: nome.trim(), mensagem }, file || undefined);
        toast.success('Catálogo atualizado!');
        setEditingId(null);
      } else {
        if (!file) {
          toast.error('Selecione um arquivo.');
          return;
        }
        await uploadCatalogo(file, nome.trim(), mensagem);
        toast.success('Catálogo criado com sucesso!');
      }
      setFile(null);
      setNome('');
      setMensagem('');
    } catch (error: any) {
      console.error('Error saving catalog:', error);
      toast.error(`Erro ao salvar: ${error.message || 'Verifique sua conexão'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo CSV.');
      return;
    }

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) {
        toast.error('O arquivo CSV parece estar vazio ou sem dados.');
        return;
      }

      // Detect separator and headers
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());

      const nameIdx = headers.findIndex(h => h.includes('nome'));
      const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('cel'));
      const cityIdx = headers.findIndex(h => h.includes('cid'));
      const stateIdx = headers.findIndex(h => h.includes('est'));
      const excursionIdx = headers.findIndex(h => h.includes('exc'));

      if (nameIdx === -1 || phoneIdx === -1) {
        toast.error('CSV inválido. Certifique-se de ter as colunas "Nome" e "Telefone".');
        return;
      }

      const contacts = lines.slice(1).filter(l => l.trim()).map((line, idx) => {
        const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        return {
          id: `csv-${idx}`,
          nome: cols[nameIdx] || 'Cliente',
          telefone: cols[phoneIdx]?.replace(/\D/g, '') || '',
          cidade: cityIdx !== -1 ? cols[cityIdx] : '',
          estado: stateIdx !== -1 ? cols[stateIdx] : '',
          excursao: excursionIdx !== -1 ? cols[excursionIdx] : '',
          created_at: new Date().toISOString()
        };
      }).filter(c => c.telefone.length >= 8);

      setImportedContacts(contacts);
      toast.success(`${contacts.length} contatos importados do CSV!`);
    };
    reader.readAsText(file);
  };

  const handleEdit = (cat: Catalogo) => {
    setEditingId(cat.id);
    setNome(cat.nome);
    setMensagem(cat.mensagem || '');
    setFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreview = async (catalogo: Catalogo) => {
    const { data } = await supabase.storage
      .from('lotes')
      .createSignedUrl(catalogo.file_path, 3600);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewName(catalogo.nome);
    } else {
      toast.error('Não foi possível gerar o preview.');
    }
  };

  const handleDelete = async (catalogo: Catalogo) => {
    const confirm = window.confirm(`Excluir o catálogo "${catalogo.nome}"? Esta ação não pode ser desfeita.`);
    if (!confirm) return;
    await excluirCatalogo(catalogo);
  };

  const renderGestao = () => (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Upload/Edit Panel */}
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
            <Button variant="ghost" size="sm" onClick={() => {
              setEditingId(null);
              setNome('');
              setMensagem('');
              setFile(null);
            }}>Cancelar</Button>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Nome do Catálogo</label>
          <Input
            placeholder="Ex: Coleção Verão 2026"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={uploading}
            className="h-11 rounded-xl"
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensagem Personalizada</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed p-3">
                  <p className="font-semibold mb-1.5">Variáveis disponíveis:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted p-1 rounded text-[10px]">{'{nome}'}</code>
                    <code className="bg-muted p-1 rounded text-[10px]">{'{cidade}'}</code>
                    <code className="bg-muted p-1 rounded text-[10px]">{'{valor}'}</code>
                    <code className="bg-muted p-1 rounded text-[10px]">{'{excursao}'}</code>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Textarea
            placeholder="Olá {nome}! Segue nosso catálogo..."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            disabled={uploading}
            rows={4}
            className="resize-none rounded-xl"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {['{nome}', '{cidade}', '{valor}'].map(tag => (
              <button 
                key={tag}
                onClick={() => setMensagem(prev => prev + tag)}
                className="text-[10px] font-medium bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md transition-colors"
                type="button"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center bg-secondary/30 relative min-h-[140px]">
          <input
            type="file"
            accept="application/pdf,image/*,video/mp4"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          {file ? (
            <div className="flex flex-col items-center">
              {file.type.startsWith('image/') ? <ImageIcon size={32} className="text-primary mb-2" /> :
               file.type.startsWith('video/') ? <Video size={32} className="text-primary mb-2" /> :
               <FileText size={32} className="text-primary mb-2" />}
              <p className="font-medium text-foreground text-sm line-clamp-1 px-4">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(file.size / 1024 / 1024).toFixed(2)} MB • Clique para trocar
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <UploadCloud size={32} className="text-muted-foreground mb-2 opacity-50" />
              <p className="font-medium text-foreground text-sm">
                {editingId ? 'Substituir arquivo (opcional)' : 'Clique ou arraste um arquivo'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, Imagens ou Vídeos (Máx: 25MB)</p>
            </div>
          )}
        </div>

        <Button
          className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/10"
          onClick={handleSave}
          disabled={uploading || (!editingId && !file)}
        >
          {uploading ? (
            <><Loader2 size={18} className="mr-2 animate-spin" />Salvando...</>
          ) : (
            <><CheckCircle2 size={18} className="mr-2" />{editingId ? 'Salvar Alterações' : 'Criar Catálogo'}</>
          )}
        </Button>

        <Separator className="my-2 bg-border/40" />
        
        {/* CSV Import Section */}
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
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {csvFileName ? (
              <div className="flex flex-col items-center">
                <CheckCircle2 size={24} className="text-blue-500 mb-1" />
                <p className="font-medium text-foreground text-xs line-clamp-1">{csvFileName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {importedContacts.length} contatos prontos
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadCloud size={24} className="text-muted-foreground mb-1 opacity-50" />
                <p className="font-medium text-foreground text-xs">Carregar Lista .csv</p>
                <p className="text-[9px] text-muted-foreground">Clique para selecionar</p>
              </div>
            )}
          </div>

          {importedContacts.length > 0 && (
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-bold text-xs"
              onClick={() => setIsTransmissaoCSVOpen(true)}
            >
              <Send size={14} className="mr-2" />
              Transmitir para CSV ({importedContacts.length})
            </Button>
          )}
        </div>
      </Card>

      {/* Catalog List */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          Seus Catálogos 
          <Badge variant="outline" className="rounded-full bg-secondary/50 text-xs">{catalogos.length}</Badge>
        </h3>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 size={24} className="text-muted-foreground animate-spin" />
          </div>
        ) : catalogos.length === 0 ? (
          <Card className="p-8 neu-card border-none rounded-2xl flex flex-col items-center justify-center text-center">
            <FileText size={32} className="text-muted-foreground mb-3 opacity-30" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum catálogo cadastrado</p>
          </Card>
        ) : (
          catalogos.map((cat) => (
            <Card key={cat.id} className={cn(
              "p-4 neu-card border-none rounded-2xl transition-all group overflow-hidden relative",
              cat.ativo && "ring-2 ring-primary/20 bg-primary/[0.02]"
            )}>
              {cat.ativo && (
                <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-primary/10 rotate-45 pointer-events-none" />
              )}
              
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm transition-colors",
                    cat.ativo
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground"
                  )}>
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-foreground truncate">{cat.nome}</h4>
                      {cat.ativo && (
                        <Badge variant="default" className="text-[9px] uppercase tracking-tighter px-1.5 py-0 h-4 bg-primary text-white border-none">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    {cat.mensagem && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">"{cat.mensagem}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Calendar size={10} /> {new Date(cat.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {cat.last_edited_at && (
                        <span className="text-[10px] text-primary/70 flex items-center gap-1 font-medium">
                          <Clock size={10} /> Editado recentemente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(cat)}>
                    <Edit2 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handlePreview(cat)}>
                    <Eye size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8 rounded-lg", cat.ativo ? "text-primary bg-primary/10" : "text-muted-foreground")}
                    onClick={() => ativarCatalogo(cat.id, cat.ativo)}
                  >
                    <Star size={14} className={cn(cat.ativo && "fill-current")} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(cat)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      {isMobile && <MobileHeader title="Envios em Massa" />}
      {!isMobile && <AppSidebar />}

      <main className={cn("flex-1 p-6 lg:p-8 overflow-auto", isMobile && "pt-20")}>
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-foreground tracking-tight">Envios em Massa</h1>
              <p className="text-muted-foreground">Potencialize suas vendas através do WhatsApp CRM</p>
            </div>

            {/* Widgets de Saúde */}
            <div className="flex flex-wrap gap-4">
              <Card className="p-4 rounded-2xl border-none neu-card flex items-center gap-4 min-w-[240px]">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", getSaudeColor(percentualUso).replace('bg-', 'bg-') + "/10", getSaudeColor(percentualUso).replace('bg-', 'text-'))}>
                  <ShieldCheck size={24} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span>Limite Diário</span>
                    <span>{enviosHoje}/{limiteDiario}</span>
                  </div>
                  <Progress value={percentualUso} className={cn("h-1.5", getSaudeColor(percentualUso))} />
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
              <TabsTrigger value="agendados" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Calendar size={16} className="mr-2" /> Agendados
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <History size={16} className="mr-2" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="blacklist" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <UserX size={16} className="mr-2" /> Blacklist
              </TabsTrigger>
              <TabsTrigger value="config" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Settings2 size={16} className="mr-2" /> Ajustes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gestao" className="mt-0 focus-visible:outline-none">
              {renderGestao()}
            </TabsContent>

            <TabsContent value="agendados">
              <Card className="p-12 border-none rounded-2xl neu-card flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                  <Clock size={32} className="text-muted-foreground opacity-30" />
                </div>
                <h3 className="text-lg font-bold">Nenhum envio agendado</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-2">Agende transmissões para horários específicos e deixe o sistema trabalhar por você.</p>
              </Card>
            </TabsContent>

            <TabsContent value="historico">
              <Card className="p-12 border-none rounded-2xl neu-card flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                  <BarChart3 size={32} className="text-muted-foreground opacity-30" />
                </div>
                <h3 className="text-lg font-bold">Histórico de Campanhas</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-2">Suas métricas detalhadas e relatórios de envio aparecerão aqui em breve.</p>
              </Card>
            </TabsContent>

            <TabsContent value="blacklist">
                <Card className="p-12 border-none rounded-2xl neu-card flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                        <UserX size={32} className="text-muted-foreground opacity-30" />
                    </div>
                <h3 className="text-lg font-bold">Lista de Exclusão</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-2">Gerencie contatos que não devem receber envios automáticos para evitar denúncias.</p>
              </Card>
            </TabsContent>

            <TabsContent value="config">
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="p-6 rounded-2xl border-none neu-card space-y-6">
                        <h3 className="font-bold text-lg">Controle Diário</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">Limite de mensagens/dia</p>
                                    <p className="text-xs text-muted-foreground">Recomendado até 500 para números novos</p>
                                </div>
                                <Input type="number" defaultValue={500} className="w-24 text-right rounded-lg" />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">Pausa Inteligente</p>
                                    <p className="text-xs text-muted-foreground">Adiciona delay randômico entre mensagens</p>
                                </div>
                                <div className="h-6 w-11 bg-primary rounded-full relative cursor-pointer">
                                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </TabsContent>
          </Tabs>

          {/* Inline Preview Modulo */}
          {previewUrl && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <Card className="w-full max-w-4xl p-6 rounded-3xl bg-background shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Eye size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl">Preview: {previewName}</h3>
                      <p className="text-xs text-muted-foreground">Visualizando como o cliente receberá</p>
                    </div>
                  </div>
                  <Button variant="ghost" className="rounded-xl h-10 w-10 p-0" onClick={() => setPreviewUrl(null)}>
                    <Trash2 size={20} className="rotate-45" />
                  </Button>
                </div>
                <div className="bg-secondary/30 rounded-2xl overflow-hidden border border-border">
                  <iframe
                    src={previewUrl}
                    className="w-full h-[65vh]"
                    title="Preview do Arquivo"
                  />
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
      <BottomNavigation />
      
      {/* Transmissão Modal para CSV */}
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
