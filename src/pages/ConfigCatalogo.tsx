import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UploadCloud, FileText, CheckCircle2, Loader2, Trash2, Star, Eye, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCatalogos, Catalogo } from '@/hooks/useCatalogos';

const ConfigCatalogo = () => {
  const isMobile = useIsMobile();
  const { catalogos, loading, uploadCatalogo, ativarCatalogo, excluirCatalogo } = useCatalogos();

  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        toast.error('O arquivo precisa ser um PDF.');
        return;
      }
      if (selectedFile.size > 25 * 1024 * 1024) {
        toast.error('O arquivo deve ter no máximo 25MB.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !nome.trim()) {
      toast.error('Preencha o nome do catálogo e selecione um arquivo.');
      return;
    }

    setUploading(true);
    try {
      await uploadCatalogo(file, nome.trim(), mensagem);
      toast.success('Catálogo enviado com sucesso!');
      setFile(null);
      setNome('');
      setMensagem('');
    } catch (error: any) {
      console.error('Error uploading catalog:', error);
      toast.error(`Erro ao salvar: ${error.message || 'Verifique sua conexão'}`);
    } finally {
      setUploading(false);
    }
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

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      {isMobile && <MobileHeader title="Catálogo Digital" />}
      {!isMobile && <AppSidebar />}

      <main className={cn("flex-1 p-6 lg:p-8 overflow-auto", isMobile && "pt-20")}>
        <div className="max-w-4xl space-y-6">
          <header>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Catálogos PDF</h1>
            <p className="text-muted-foreground mt-1">Gerencie seus catálogos e personalize a mensagem enviada via WhatsApp</p>
          </header>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Upload Panel */}
            <Card className="p-6 neu-card border-none flex flex-col gap-4 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Novo Catálogo</h3>
                  <p className="text-sm text-muted-foreground">Envie um PDF e dê um nome</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Nome do Catálogo</label>
                <Input
                  placeholder="Ex: Coleção Verão 2026"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-sm font-medium text-foreground">Mensagem Personalizada</label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Info size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed p-3">
                        <p className="font-semibold mb-1.5">Dicas de formatação WhatsApp:</p>
                        <ul className="space-y-0.5">
                          <li><code className="bg-muted px-1 rounded text-[11px]">*texto*</code> → <strong>negrito</strong></li>
                          <li><code className="bg-muted px-1 rounded text-[11px]">_texto_</code> → <em>itálico</em></li>
                          <li><code className="bg-muted px-1 rounded text-[11px]">~texto~</code> → <s>riscado</s></li>
                          <li><code className="bg-muted px-1 rounded text-[11px]">{'{nome}'}</code> → nome do cliente</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  placeholder="Olá {nome}! Segue nosso catálogo..."
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  disabled={uploading}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center bg-secondary/30 relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                {file ? (
                  <div className="flex flex-col items-center">
                    <FileText size={32} className="text-primary mb-2" />
                    <p className="font-medium text-foreground text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud size={32} className="text-muted-foreground mb-2 opacity-50" />
                    <p className="font-medium text-foreground text-sm">Clique ou arraste um PDF</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Máx: 25MB</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full h-11 rounded-xl"
                onClick={handleUpload}
                disabled={!file || !nome.trim() || uploading}
              >
                {uploading ? (
                  <><Loader2 size={18} className="mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><CheckCircle2 size={18} className="mr-2" />Salvar Catálogo</>
                )}
              </Button>
            </Card>

            {/* Catalog List */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Seus Catálogos</h3>

              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 size={24} className="text-muted-foreground animate-spin" />
                </div>
              ) : catalogos.length === 0 ? (
                <Card className="p-8 neu-card border-none rounded-2xl flex flex-col items-center justify-center text-center">
                  <FileText size={32} className="text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum catálogo cadastrado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Faça o upload do seu primeiro PDF ao lado.</p>
                </Card>
              ) : (
                catalogos.map((cat) => (
                  <Card key={cat.id} className={cn(
                    "p-4 neu-card border-none rounded-2xl transition-all",
                    cat.ativo && "ring-2 ring-primary/30 bg-primary/5"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                          cat.ativo
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}>
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-foreground truncate">{cat.nome}</h4>
                            {cat.ativo && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          {cat.mensagem && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cat.mensagem}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(cat.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePreview(cat)}
                          title="Visualizar"
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-8 w-8", cat.ativo ? "text-primary" : "text-muted-foreground")}
                          onClick={() => ativarCatalogo(cat.id, cat.ativo)}
                          title={cat.ativo ? "Desativar para envio" : "Ativar para envio"}
                        >
                          <Star size={14} className={cn(cat.ativo && "fill-current")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(cat)}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Inline PDF Preview */}
          {previewUrl && (
            <Card className="p-4 neu-card border-none rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Preview: {previewName}</h3>
                <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>Fechar</Button>
              </div>
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] rounded-xl border border-border"
                title="Preview do Catálogo PDF"
              />
            </Card>
          )}
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
};

export default ConfigCatalogo;
