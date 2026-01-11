import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useClientesContext } from '@/contexts/ClientesContext';
import { useClientesBatchImport } from '@/hooks/useClientesBatchImport';
import { ClienteInsertWithDate } from '@/hooks/useClientesData';

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVRow {
  nome?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  excursao?: string;
  datahora?: string;
}

const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const parseCSV = (content: string): CSVRow[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,;]/).map(normalizeHeader);
  
  // Map column indices
  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    if (header === 'nome') columnMap.nome = index;
    else if (header === 'telefone') columnMap.telefone = index;
    else if (header === 'cidade') columnMap.cidade = index;
    else if (header === 'estado') columnMap.estado = index;
    else if (header === 'excursao') columnMap.excursao = index;
    else if (['data/hora', 'datahora', 'data', 'data_cadastro', 'created_at', 'data_criacao'].includes(header)) {
      columnMap.datahora = index;
    }
  });

  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,;]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
    
    if (values.length === 0 || values.every(v => !v)) continue;

    const row: CSVRow = {
      nome: columnMap.nome !== undefined ? values[columnMap.nome] : '',
      telefone: columnMap.telefone !== undefined ? values[columnMap.telefone] : '',
      cidade: columnMap.cidade !== undefined ? values[columnMap.cidade] : '',
      estado: columnMap.estado !== undefined ? values[columnMap.estado] : '',
      excursao: columnMap.excursao !== undefined ? values[columnMap.excursao] : '',
      datahora: columnMap.datahora !== undefined ? values[columnMap.datahora] : undefined,
    };

    // Only include rows with at least a name
    if (row.nome) {
      rows.push(row);
    }
  }

  return rows;
};

export function ImportCSVModal({ open, onOpenChange }: ImportCSVModalProps) {
  const { clientes } = useClientesContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [totalToImport, setTotalToImport] = useState(0);

  const handleProgress = useCallback((imported: number, total: number) => {
    setImportedCount(imported);
    setProgress((imported / total) * 100);
  }, []);

  const batchImportMutation = useClientesBatchImport({ onProgress: handleProgress });

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo .csv');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setImportedCount(0);

    try {
      const content = await file.text();
      const rows = parseCSV(content);

      if (rows.length === 0) {
        toast.error('Nenhum cliente válido encontrado no arquivo. Verifique se as colunas estão corretas (Nome, Telefone, Cidade, Estado, Excursão).');
        setIsProcessing(false);
        return;
      }

      // Create a set of existing client names (normalized) for duplicate detection
      const existingNames = new Set(
        clientes.map(c => c.nome.toLowerCase().trim())
      );

      // Filter out duplicates and prepare data for batch import
      const clientesToImport: ClienteInsertWithDate[] = [];
      let skippedCount = 0;

      for (const row of rows) {
        const normalizedName = (row.nome || '').toLowerCase().trim();
        
        // Skip if client with same name already exists
        if (existingNames.has(normalizedName)) {
          skippedCount++;
          continue;
        }

        // Parse date if provided (format: YYYY-MM-DD)
        let createdAt: string | undefined;
        if (row.datahora) {
          const dateMatch = row.datahora.match(/^\d{4}-\d{2}-\d{2}/);
          if (dateMatch) {
            createdAt = new Date(dateMatch[0]).toISOString();
          }
        }

        clientesToImport.push({
          nome: row.nome || '',
          telefone: row.telefone || '',
          cidade: row.cidade || '',
          estado: row.estado || '',
          excursao: row.excursao || '',
          created_at: createdAt,
        });

        // Add to existing names to prevent duplicates within the same import
        existingNames.add(normalizedName);
      }

      if (clientesToImport.length === 0) {
        toast.info(`Todos os ${skippedCount} cliente${skippedCount !== 1 ? 's' : ''} já existem no sistema.`);
        setIsProcessing(false);
        return;
      }

      setTotalToImport(clientesToImport.length);

      // Batch import all clients
      const result = await batchImportMutation.mutateAsync(clientesToImport);
      const importedTotal = result.imported.length;

      if (importedTotal > 0 && skippedCount > 0) {
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" />
            <span>{importedTotal} importado{importedTotal !== 1 ? 's' : ''}, {skippedCount} duplicado{skippedCount !== 1 ? 's' : ''} ignorado{skippedCount !== 1 ? 's' : ''}</span>
          </div>
        );
      } else if (importedTotal > 0) {
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" />
            <span>{importedTotal} cliente{importedTotal !== 1 ? 's' : ''} importado{importedTotal !== 1 ? 's' : ''} com sucesso!</span>
          </div>
        );
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar o arquivo. Verifique o formato.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setImportedCount(0);
      setTotalToImport(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleClick = () => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-hidden bg-background shadow-[8px_8px_20px_hsl(216_26%_84%/0.6),-8px_-8px_20px_hsl(0_0%_100%/0.8)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-primary" />
            Importar Planilha
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Selecione um arquivo CSV com os dados dos clientes
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="space-y-4 pr-4">
            {/* Progress Bar - shown during import */}
            {isProcessing && totalToImport > 0 && (
              <div className="space-y-2 p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Importando clientes...</span>
                  <span className="text-muted-foreground">{importedCount} de {totalToImport}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Aguarde, isso pode levar alguns segundos...
                </p>
              </div>
            )}

            {/* Drop Zone */}
            <div
              onClick={handleClick}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-all duration-200
                ${dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-secondary/50'
                }
                ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleInputChange}
                className="hidden"
                disabled={isProcessing}
              />
              
              <div className="flex flex-col items-center gap-3">
                <div className={`
                  w-16 h-16 rounded-xl flex items-center justify-center
                  ${dragActive ? 'bg-primary/20' : 'bg-secondary'}
                `}>
                  <Upload size={28} className={dragActive ? 'text-primary' : 'text-muted-foreground'} />
                </div>
                
                <div>
                  <p className="font-medium text-foreground">
                    {isProcessing ? 'Processando...' : 'Clique ou arraste o arquivo aqui'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Suporta arquivos com mais de 4.000 linhas
                  </p>
                </div>
              </div>
            </div>

            {/* Column Info */}
            <div className="neu-input p-4 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-2">Formato esperado das colunas:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    <div><span className="font-medium text-foreground">Nome</span> → Nome do Cliente</div>
                    <div><span className="font-medium text-foreground">Telefone</span> → Telefone</div>
                    <div><span className="font-medium text-foreground">Cidade</span> → Cidade</div>
                    <div><span className="font-medium text-foreground">Estado</span> → Estado</div>
                    <div><span className="font-medium text-foreground">Excursão</span> → Excursão</div>
                    <div><span className="font-medium text-foreground">Data/Hora</span> → YYYY-MM-DD</div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Separador: ponto e vírgula (;) ou vírgula (,)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
                className="flex-1 h-11 rounded-xl neu-button border-0 text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
