import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useClientesContext } from '@/contexts/ClientesContext';

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
  const { addCliente, clientes } = useClientesContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo .csv');
      return;
    }

    setIsProcessing(true);

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

      let importedCount = 0;
      let skippedCount = 0;

      for (const row of rows) {
        try {
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

          await addCliente({
            nome: row.nome || '',
            telefone: row.telefone || '',
            cidade: row.cidade || '',
            estado: row.estado || '',
            excursao: row.excursao || '',
          }, createdAt);
          
          // Add to existing names to prevent duplicates within the same import
          existingNames.add(normalizedName);
          importedCount++;
        } catch (error) {
          console.error('Erro ao importar cliente:', row.nome, error);
        }
      }

      if (importedCount > 0 && skippedCount > 0) {
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" />
            <span>{importedCount} importado{importedCount !== 1 ? 's' : ''}, {skippedCount} duplicado{skippedCount !== 1 ? 's' : ''} ignorado{skippedCount !== 1 ? 's' : ''}</span>
          </div>
        );
      } else if (importedCount > 0) {
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" />
            <span>{importedCount} cliente{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''} com sucesso!</span>
          </div>
        );
      } else if (skippedCount > 0) {
        toast.info(`Todos os ${skippedCount} cliente${skippedCount !== 1 ? 's' : ''} já existem no sistema.`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar o arquivo. Verifique o formato.');
    } finally {
      setIsProcessing(false);
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
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neu-card border-0 rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-primary" />
            Importar Planilha
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Selecione um arquivo CSV com os dados dos clientes
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
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
                  Apenas arquivos .csv
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
                <ul className="text-muted-foreground space-y-1">
                  <li><span className="font-medium text-foreground">Nome</span> → Nome do Cliente</li>
                  <li><span className="font-medium text-foreground">Telefone</span> → Telefone</li>
                  <li><span className="font-medium text-foreground">Cidade</span> → Cidade</li>
                  <li><span className="font-medium text-foreground">Estado</span> → Estado</li>
                  <li><span className="font-medium text-foreground">Excursão</span> → Excursão</li>
                  <li><span className="font-medium text-foreground">Data/Hora</span> → Data de cadastro (YYYY-MM-DD)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 rounded-xl neu-button border-0 text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
