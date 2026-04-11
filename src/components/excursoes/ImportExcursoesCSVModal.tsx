import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { validateCSVFile } from '@/lib/csv-validation-schemas';
import { parseExcursoesCSV, useExcursoesBatchImport, ExcursaoParseResult } from '@/hooks/useExcursoesBatchImport';

interface ImportExcursoesCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function ImportExcursoesCSVModal({ open, onOpenChange }: ImportExcursoesCSVModalProps) {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [parsedData, setParsedData] = useState<ExcursaoParseResult[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  
  const batchImport = useExcursoesBatchImport();
  
  const resetState = useCallback(() => {
    setStep('upload');
    setParsedData([]);
    setParseErrors([]);
    setResult(null);
  }, []);
  
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetState, 300);
  };
  
  const processFile = async (file: File) => {
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    
    try {
      const content = await file.text();
      const { excursoes, errors } = parseExcursoesCSV(content);
      
      setParsedData(excursoes);
      setParseErrors(errors);
      setStep('preview');
    } catch (error) {
      toast.error('Erro ao ler arquivo CSV');
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  
  const handleImport = async () => {
    if (parsedData.length === 0) return;
    
    setStep('importing');
    try {
      const result = await batchImport.mutateAsync(parsedData);
      setResult(result);
      setStep('done');
      toast.success(`${result.inserted} excursões importadas!`);
    } catch (error) {
      toast.error('Erro ao importar excursões');
      setStep('preview');
    }
  };
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  
  const content = (
    <div className="space-y-4">
      {step === 'upload' && (
        <>
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm font-medium text-foreground">
              Clique ou arraste o arquivo CSV
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Máximo: 10MB
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium text-foreground mb-2 flex items-center gap-2">
              <FileSpreadsheet size={16} />
              Formato esperado:
            </p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• <code className="bg-muted px-1 rounded">EXCURSAO</code> → Nome da excursão</li>
              <li>• <code className="bg-muted px-1 rounded">CONTATO</code> → WhatsApp/Telefone</li>
              <li>• <code className="bg-muted px-1 rounded">LOCALIZACAO</code> → Ponto/Cidade</li>
              <li>• <code className="bg-muted px-1 rounded">VALOR COBRADO EXCURSAO</code> → Taxa (R$ 10,00)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3 italic">
              Duplicatas serão agrupadas automaticamente
            </p>
          </div>
        </>
      )}
      
      {step === 'preview' && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium text-foreground">{parsedData.length}</span>
              <span className="text-muted-foreground"> excursões encontradas</span>
            </div>
            <Button variant="ghost" size="sm" onClick={resetState}>
              <X size={16} className="mr-1" />
              Cancelar
            </Button>
          </div>
          
          {parseErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <AlertCircle size={16} />
                {parseErrors.length} erros de validação
              </p>
              <ul className="text-xs text-destructive/80 mt-2 space-y-1 max-h-20 overflow-y-auto">
                {parseErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
                {parseErrors.length > 5 && <li>... e mais {parseErrors.length - 5}</li>}
              </ul>
            </div>
          )}
          
          <ScrollArea className="h-[300px] rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Contato</th>
                  <th className="text-left p-3 font-medium">Local</th>
                  <th className="text-right p-3 font-medium">Taxa</th>
                  <th className="text-center p-3 font-medium text-muted-foreground text-xs">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.map((exc, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{exc.nome}</td>
                    <td className="p-3 text-xs text-muted-foreground">{exc.contato || '-'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{exc.localizacao || '-'}</td>
                    <td className="p-3 text-right text-emerald-600 font-medium">
                      {formatCurrency(exc.taxa)}
                    </td>
                    <td className="p-3 text-center text-muted-foreground text-xs">
                      {exc.occurrences}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={parsedData.length === 0} className="flex-1">
              Importar {parsedData.length} excursões
            </Button>
          </div>
        </>
      )}
      
      {step === 'importing' && (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Importando excursões...</p>
        </div>
      )}
      
      {step === 'done' && result && (
        <div className="py-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <div>
            <p className="text-lg font-medium text-foreground">Importação concluída!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {result.inserted} excursões importadas
              {result.skipped > 0 && `, ${result.skipped} já existentes`}
            </p>
          </div>
          <Button onClick={handleClose} className="mt-4">
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
  
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Importar Excursões</DrawerTitle>
            <DrawerDescription>
              Importe excursões de um arquivo CSV
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Excursões</DialogTitle>
          <DialogDescription>
            Importe excursões de um arquivo CSV
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
