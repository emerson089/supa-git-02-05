import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { useAuth } from '@/contexts/AuthContext';

const ConfigCatalogo = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(true);

  const BUCKET_NAME = 'lotes';
  const FILE_PATH = user?.id ? `${user.id}/catalogos/oficial.pdf` : 'catalogos/oficial.pdf';

  // Carregar Catálogo Atual
  useEffect(() => {
    if (user?.id) fetchCurrentCatalog();
  }, [user?.id]);

  const fetchCurrentCatalog = async () => {
    setIsLoadingUrl(true);
    try {
      // Usa a API do Supabase para listar e checar se o arquivo existe em vez de usar um fetch (que pode falhar por CORS)
      const folderPath = user?.id ? `${user.id}/catalogos` : 'catalogos';
      const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list(folderPath, {
        search: 'oficial.pdf'
      });

      const fileExists = files && files.some(f => f.name === 'oficial.pdf');

      if (fileExists && !error) {
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(FILE_PATH);
        setCurrentUrl(data.publicUrl + '?t=' + new Date().getTime()); // cache buster
      } else {
        setCurrentUrl(null);
      }
    } catch (e) {
      console.error('Erro ao verificar catálogo:', e);
      setCurrentUrl(null);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        toast.error('O arquivo precisa ser um PDF.');
        return;
      }
      if (selectedFile.size > 25 * 1024 * 1024) { // 25MB
        toast.error('O arquivo deve ter no máximo 25MB.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const { error } = await supabase.storage.from(BUCKET_NAME).upload(FILE_PATH, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (error) throw error;

      toast.success('Catálogo enviado com sucesso!');
      setFile(null);
      fetchCurrentCatalog();
    } catch (error: any) {
      console.error('Error uploading catalog:', error);
      toast.error(`Erro ao salvar: ${error.message || 'Verifique sua conexão'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      {isMobile && <MobileHeader title="Catálogo Digital" />}
      {!isMobile && <AppSidebar />}

      <main className={cn("flex-1 p-6 lg:p-8 overflow-auto", isMobile && "pt-20")}>
        <div className="max-w-4xl space-y-6">
          <header>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Catálogo PDF</h1>
            <p className="text-muted-foreground mt-1">Gerencie o catálogo que será importado e enviado aos seus clientes via WhatsApp</p>
          </header>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Upload Painel */}
            <Card className="p-6 neu-card border-none flex flex-col gap-5 rounded-2xl relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Novo Catálogo</h3>
                  <p className="text-sm text-muted-foreground">Envie ou atualize o arquivo (.pdf)</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center bg-secondary/30 relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                
                {file ? (
                  <div className="flex flex-col items-center">
                    <FileText size={40} className="text-primary mb-3" />
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud size={40} className="text-muted-foreground mb-3 opacity-50" />
                    <p className="font-medium text-foreground">Clique ou arraste um PDF aqui</p>
                    <p className="text-xs text-muted-foreground mt-1">Tamanho máximo: 25MB</p>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-2">
                <Button 
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Enviando Arquivo...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} className="mr-2" />
                      Salvar Catálogo
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Current Catalog Info */}
            <Card className="p-6 neu-card border-none flex flex-col rounded-2xl relative overflow-hidden bg-emerald-50/30 dark:bg-emerald-950/20">
              <h3 className="font-semibold text-lg mb-4 text-emerald-800 dark:text-emerald-400">Status do Catálogo</h3>
              
              {isLoadingUrl ? (
                <div className="flex flex-col items-center justify-center p-8 h-full">
                  <Loader2 size={32} className="text-emerald-500 animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Verificando arquivo atual...</p>
                </div>
              ) : currentUrl ? (
                <div className="flex flex-col flex-1">
                  <div className="bg-emerald-100/50 dark:bg-emerald-900/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-4 mb-auto">
                    <div className="bg-emerald-500 rounded-lg p-2.5 shadow-sm mt-1">
                      <FileText size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-300">Catálogo Ativo</h4>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1 mb-2 leading-relaxed">
                        Seus clientes irão receber este arquivo quando você usar a função de envio pelo Zap.
                      </p>
                      
                      <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 underline decoration-emerald-600/30 underline-offset-2">
                        Visualizar Catálogo Atual
                      </a>
                    </div>
                  </div>

                  <div className="mt-6 flex items-start gap-3 bg-yellow-50 dark:bg-yellow-950/40 p-4 rounded-xl border border-yellow-200/60 dark:border-yellow-900/40">
                    <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800 dark:text-yellow-400 leading-relaxed">
                      Ao enviar um novo PDF, o arquivo antigo é imediatamente substituído em todo o sistema pela nova versão.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-emerald-200/50 dark:border-emerald-900/50 rounded-xl h-full">
                  <AlertTriangle size={32} className="text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum catálogo disponível</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Faça o upload do seu PDF oficial ao lado para começar.</p>
                </div>
              )}
            </Card>

          </div>
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
};

export default ConfigCatalogo;
