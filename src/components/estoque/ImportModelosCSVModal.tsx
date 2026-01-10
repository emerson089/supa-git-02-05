import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useEstoque, ItemEstoque } from '@/contexts/EstoqueContext';

interface ImportModelosCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DuplicateInfo {
  referencia: string;
  nome: string;
  quantidadeNova: number;
  preco: number;
  itemExistente: ItemEstoque;
}

export function ImportModelosCSVModal({ open, onOpenChange }: ImportModelosCSVModalProps) {
  const { itens, addItem, updateItem } = useEstoque();
  const [isDragging, setIsDragging] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingData, setPendingData] = useState<{ nome: string; referencia: string; quantidade: number; preco: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headerLine = lines[0].toLowerCase();
    const separator = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(separator).map(h => h.trim().replace(/"/g, ''));

    // Mapear colunas
    const referenciaIdx = headers.findIndex(h => h.includes('referencia') || h.includes('referência') || h === 'ref');
    const modeloIdx = headers.findIndex(h => h.includes('modelo') || h.includes('nome'));
    const quantidadeIdx = headers.findIndex(h => h.includes('quantidade') || h.includes('qtd') || h.includes('qtde'));
    const precoIdx = headers.findIndex(h => h.includes('preco') || h.includes('preço') || h.includes('valor'));

    const data: { nome: string; referencia: string; quantidade: number; preco: number }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
      
      const referencia = referenciaIdx >= 0 ? values[referenciaIdx] || '' : '';
      const nome = modeloIdx >= 0 ? values[modeloIdx] || '' : '';
      const quantidade = quantidadeIdx >= 0 ? parseInt(values[quantidadeIdx]) || 0 : 0;
      const preco = precoIdx >= 0 ? parseFloat(values[precoIdx]?.replace(',', '.')) || 0 : 0;

      if (nome || referencia) {
        data.push({ referencia, nome, quantidade, preco });
      }
    }

    return data;
  };

  const processImport = useCallback((data: { nome: string; referencia: string; quantidade: number; preco: number }[], handleDuplicates: 'sum' | 'skip' | 'ask') => {
    const duplicatesFound: DuplicateInfo[] = [];
    const toImport: typeof data = [];
    
    data.forEach(item => {
      const nomeCompleto = item.referencia ? `${item.nome} - ${item.referencia}` : item.nome;
      
      // Verificar por referência ou nome completo
      const existente = itens.find(i => 
        i.tipo === 'acabado' && (
          (item.referencia && i.nome.toLowerCase().includes(item.referencia.toLowerCase())) ||
          i.nome.toLowerCase() === nomeCompleto.toLowerCase()
        )
      );

      if (existente) {
        if (handleDuplicates === 'ask') {
          duplicatesFound.push({
            referencia: item.referencia,
            nome: item.nome,
            quantidadeNova: item.quantidade,
            preco: item.preco,
            itemExistente: existente
          });
        } else if (handleDuplicates === 'sum') {
          updateItem(existente.id, {
            quantidade: existente.quantidade + item.quantidade,
            precoUnitario: item.preco || existente.precoUnitario
          });
        }
        // skip - não faz nada
      } else {
        toImport.push(item);
      }
    });

    // Adicionar novos itens
    toImport.forEach(item => {
      const nomeCompleto = item.referencia ? `${item.nome} - ${item.referencia}` : item.nome;
      addItem({
        nome: nomeCompleto,
        tipo: 'acabado',
        categoria: 'Importado CSV',
        quantidade: item.quantidade,
        unidade: 'peças',
        quantidadeMinima: 0,
        precoUnitario: item.preco,
        localizacao: 'Estoque Produção',
        imagemUrl: undefined,
      });
    });

    if (duplicatesFound.length > 0 && handleDuplicates === 'ask') {
      setDuplicates(duplicatesFound);
      setShowDuplicateModal(true);
      return { imported: toImport.length, pending: duplicatesFound.length };
    }

    return { imported: toImport.length + (handleDuplicates === 'sum' ? data.length - toImport.length : 0), pending: 0 };
  }, [itens, addItem, updateItem]);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo .csv');
      return;
    }

    const text = await file.text();
    const data = parseCSV(text);

    if (data.length === 0) {
      toast.error('Nenhum dado válido encontrado no arquivo');
      return;
    }

    setPendingData(data);
    
    // Verificar se há duplicados
    const hasDuplicates = data.some(item => {
      const nomeCompleto = item.referencia ? `${item.nome} - ${item.referencia}` : item.nome;
      return itens.some(i => 
        i.tipo === 'acabado' && (
          (item.referencia && i.nome.toLowerCase().includes(item.referencia.toLowerCase())) ||
          i.nome.toLowerCase() === nomeCompleto.toLowerCase()
        )
      );
    });

    if (hasDuplicates) {
      const result = processImport(data, 'ask');
      if (result.imported > 0) {
        toast.success(`${result.imported} novos modelos adicionados ao estoque!`);
      }
    } else {
      const result = processImport(data, 'skip');
      toast.success(`${result.imported} novos modelos adicionados ao estoque com sucesso!`);
      onOpenChange(false);
    }
  };

  const handleDuplicatesAction = (action: 'sum' | 'skip') => {
    duplicates.forEach(dup => {
      if (action === 'sum') {
        updateItem(dup.itemExistente.id, {
          quantidade: dup.itemExistente.quantidade + dup.quantidadeNova,
          precoUnitario: dup.preco || dup.itemExistente.precoUnitario
        });
      }
    });

    if (action === 'sum') {
      toast.success(`${duplicates.length} modelos atualizados (quantidade somada)!`);
    } else {
      toast.info(`${duplicates.length} modelos duplicados ignorados`);
    }

    setShowDuplicateModal(false);
    setDuplicates([]);
    onOpenChange(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md shadow-[12px_12px_30px_hsl(var(--muted)/0.4),-12px_-12px_30px_hsl(var(--background))] border-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="text-primary" size={24} />
              Importar Lista de Modelos
            </DialogTitle>
            <DialogDescription>
              Selecione um arquivo CSV com as colunas: Referencia, Modelo, Quantidade, Preco
            </DialogDescription>
          </DialogHeader>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              mt-4 p-8 border-2 border-dashed rounded-xl cursor-pointer
              transition-all duration-200 text-center
              shadow-[inset_4px_4px_10px_hsl(var(--muted)/0.3),inset_-4px_-4px_10px_hsl(var(--background))]
              ${isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="hidden"
            />
            <Upload size={40} className={`mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm text-muted-foreground">
              {isDragging ? 'Solte o arquivo aqui' : 'Arraste um arquivo CSV ou clique para selecionar'}
            </p>
          </div>

          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
            <p className="font-medium mb-1">Formato esperado:</p>
            <code className="block bg-background/50 p-2 rounded text-[10px]">
              Referencia;Modelo;Quantidade;Preco<br />
              001;Calça Jeans Classic;50;89.90
            </code>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Duplicados */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="max-w-md shadow-[12px_12px_30px_hsl(var(--muted)/0.4),-12px_-12px_30px_hsl(var(--background))] border-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle size={24} />
              Modelos Duplicados Encontrados
            </DialogTitle>
            <DialogDescription>
              {duplicates.length} modelo(s) já existem no estoque. O que deseja fazer?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-48 overflow-auto space-y-2">
            {duplicates.slice(0, 5).map((dup, idx) => (
              <div key={idx} className="p-2 bg-muted/30 rounded-lg text-sm">
                <span className="font-medium">{dup.nome}</span>
                {dup.referencia && <span className="text-muted-foreground"> ({dup.referencia})</span>}
                <span className="text-muted-foreground"> - +{dup.quantidadeNova} peças</span>
              </div>
            ))}
            {duplicates.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                E mais {duplicates.length - 5} item(ns)...
              </p>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => handleDuplicatesAction('sum')}
              className="flex-1 gap-2 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))]"
            >
              Somar Quantidades
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDuplicatesAction('skip')}
              className="flex-1 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))]"
            >
              Ignorar Duplicados
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
