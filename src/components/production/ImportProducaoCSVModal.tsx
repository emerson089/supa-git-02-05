import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Producao, ProducaoInsert } from '@/entities/Producao';
import { STAGES } from '@/data/production-data';
import { 
  ProducaoCSVRowSchema,
  sanitizeString,
  safeParseInt,
  validateCSVFile 
} from '@/lib/csv-validation-schemas';

interface ImportProducaoCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedLote {
  referencia: string;
  modelo: string;
  quantidade: number;
  etapa: string;
  responsavel: string;
  prioridade: string;
  observacoes: string;
}

const VALID_PRIORITIES = ['normal', 'atencao', 'urgente'];

export function ImportProducaoCSVModal({ open, onOpenChange, onSuccess }: ImportProducaoCSVModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedLote[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setPreviewData([]);
    setErrors([]);
    setIsProcessing(false);
  };

  const parseCSV = (text: string): ParsedLote[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headerLine = lines[0].toLowerCase();
    const hasHeader = headerLine.includes('referencia') || headerLine.includes('modelo') || 
                      headerLine.includes('quantidade') || headerLine.includes('etapa');

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const lotes: ParsedLote[] = [];
    const parseErrors: string[] = [];

    dataLines.forEach((line, index) => {
      const values = line.split(',').map(v => sanitizeString(v.replace(/^"|"$/g, '')));
      
      if (values.length < 3) {
        parseErrors.push(`Linha ${index + 2}: Dados insuficientes`);
        return;
      }

      const referencia = values[0] || '';
      const modelo = values[1] || '';
      const quantidade = safeParseInt(values[2]);
      let etapa = (values[3] || 'Corte').trim();
      const responsavel = values[4] || '';
      let prioridade = (values[5] || 'normal').toLowerCase().trim();
      const observacoes = values[6] || '';

      // Validate with Zod schema
      const rawRow = { referencia, modelo, quantidade, etapa, responsavel, prioridade, observacoes };
      const validation = ProducaoCSVRowSchema.safeParse(rawRow);
      
      if (!validation.success) {
        const errs = validation.error.errors.map(e => `Linha ${index + 2}: ${e.message}`);
        parseErrors.push(...errs);
        return;
      }

      // Validate stage - find matching stage
      const matchedStage = STAGES.find(s => 
        s.label.toLowerCase() === etapa.toLowerCase() || 
        s.id.toLowerCase() === etapa.toLowerCase()
      );
      etapa = matchedStage?.id || 'Corte';

      // Validate priority
      if (!VALID_PRIORITIES.includes(prioridade)) {
        prioridade = 'normal';
      }

      if (!modelo && !referencia) {
        parseErrors.push(`Linha ${index + 2}: Referência ou modelo é obrigatório`);
        return;
      }

      lotes.push({
        referencia,
        modelo,
        quantidade,
        etapa,
        responsavel,
        prioridade,
        observacoes
      });
    });

    setErrors(parseErrors);
    return lotes;
  };

  const handleFile = (file: File) => {
    // Validate file
    const fileValidation = validateCSVFile(file);
    if (!fileValidation.valid) {
      toast.error(fileValidation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setPreviewData(parsed);
      
      if (parsed.length === 0 && errors.length === 0) {
        toast.error('Nenhum lote válido encontrado no arquivo.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const lote of previewData) {
        try {
          // Generate reference if not provided
          let referencia = lote.referencia;
          if (!referencia) {
            referencia = await Producao.getNextReference();
          }

          const insertData: ProducaoInsert = {
            id_producao: referencia,
            modelo_nome_cache: lote.modelo,
            quantidade: lote.quantidade,
            processo_atual: lote.etapa,
            responsavel: lote.responsavel || null,
            prioridade: lote.prioridade as 'normal' | 'atencao' | 'urgente',
            observacoes: lote.observacoes || null,
          };

          await Producao.create(insertData);
          successCount++;
        } catch (err) {
          console.error('Erro ao importar lote:', err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} lote(s) importado(s) com sucesso!`);
        onSuccess();
        onOpenChange(false);
        resetState();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} lote(s) não puderam ser importados.`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Lotes de Produção
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV com os lotes de produção.
          </DialogDescription>
        </DialogHeader>

        {previewData.length === 0 ? (
          <>
            {/* Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste um arquivo CSV ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Colunas: Referência, Modelo, Quantidade, Etapa, Responsável, Prioridade, Observações
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="hidden"
            />

            {/* Format Guide */}
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="font-medium mb-1">Formato esperado:</p>
              <code className="block bg-background px-2 py-1 rounded text-[10px]">
                Referência,Modelo,Quantidade,Etapa,Responsável,Prioridade,Observações<br/>
                L001,Vestido Floral,50,Corte,Maria,normal,Lote prioritário
              </code>
              <p className="mt-2">
                Etapas válidas: {STAGES.map(s => s.label).join(', ')}<br/>
                Prioridades: normal, atencao, urgente
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {previewData.length} lote(s) encontrado(s)
                </span>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  Escolher outro arquivo
                </Button>
              </div>

              {errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
                    <AlertCircle size={16} />
                    {errors.length} erro(s) encontrado(s)
                  </div>
                  <ul className="text-xs text-destructive/80 list-disc list-inside">
                    {errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {errors.length > 5 && <li>... e mais {errors.length - 5}</li>}
                  </ul>
                </div>
              )}

              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Ref.</th>
                      <th className="p-2 text-left">Modelo</th>
                      <th className="p-2 text-center">Qtd</th>
                      <th className="p-2 text-left">Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 10).map((lote, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{lote.referencia || '(auto)'}</td>
                        <td className="p-2 truncate max-w-[120px]">{lote.modelo}</td>
                        <td className="p-2 text-center">{lote.quantidade}</td>
                        <td className="p-2">{lote.etapa}</td>
                      </tr>
                    ))}
                    {previewData.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-center text-muted-foreground">
                          ... e mais {previewData.length - 10} lotes
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => { onOpenChange(false); resetState(); }}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 gap-2"
                  onClick={handleImport}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>Importando...</>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Importar {previewData.length} Lote(s)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}