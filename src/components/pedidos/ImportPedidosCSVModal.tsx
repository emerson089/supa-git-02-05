import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface ImportPedidosCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVPedidoRow {
  data: string;
  cliente: string;
  qtdTotal: number;
  valorTotal: number;
  statusPagamento: string;
  statusPedido: string;
  statusEntrega: string;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
  clientesNaoEncontrados: string[];
  errorMessages: string[];
}

const BATCH_SIZE = 100;

const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const normalizeStatus = (status: string, type: 'pagamento' | 'pedido' | 'entrega'): string => {
  const normalized = status.toUpperCase().trim();
  
  const pagamentoMap: Record<string, string> = {
    'PAGO': 'PAGO',
    'PENDENTE': 'PENDENTE',
    'CANCELADO': 'CANCELADO',
    'INCOMPLETO': 'INCOMPLETO',
    'PEND. ENTREGA': 'PEND. ENTREGA',
    'PEND.ENTREGA': 'PEND. ENTREGA',
    'PENDENTREGA': 'PEND. ENTREGA',
    'GOLPE CANCELADO': 'GOLPE CANCELADO',
    'GOLPECANCELADO': 'GOLPE CANCELADO',
  };
  
  const pedidoMap: Record<string, string> = {
    'SEPARADO': 'SEPARADO',
    'NAO SEPARADO': 'NÃO SEPARADO',
    'NÃO SEPARADO': 'NÃO SEPARADO',
    'NAOSEPARADO': 'NÃO SEPARADO',
    'AMANHA': 'AMANHÃ',
    'AMANHÃ': 'AMANHÃ',
    'INCOMPLETO': 'INCOMPLETO',
    'CANCELADO': 'CANCELADO',
    'GOLPE CANCELADO': 'GOLPE CANCELADO',
    'GOLPECANCELADO': 'GOLPE CANCELADO',
  };
  
  const entregaMap: Record<string, string> = {
    'ENTREGUE': 'ENTREGUE',
    'RETIRADA': 'RETIRADA',
    'PROX. SEMANA': 'PRÓX. SEMANA',
    'PROX.SEMANA': 'PRÓX. SEMANA',
    'PRÓX. SEMANA': 'PRÓX. SEMANA',
    'PROXSEMANA': 'PRÓX. SEMANA',
    'PEND. ENTREGA': 'PEND. ENTREGA',
    'PEND.ENTREGA': 'PEND. ENTREGA',
    'PENDENTREGA': 'PEND. ENTREGA',
    'NAO ENTREGOU': 'NÃO ENTREGOU',
    'NÃO ENTREGOU': 'NÃO ENTREGOU',
    'NAOENTREGOU': 'NÃO ENTREGOU',
    'ENTREGOU ERRADO': 'ENTREGOU ERRADO',
    'ENTREGOUERRADO': 'ENTREGOU ERRADO',
    'CANCELADO': 'CANCELADO',
  };
  
  if (type === 'pagamento') return pagamentoMap[normalized] || 'PENDENTE';
  if (type === 'pedido') return pedidoMap[normalized] || 'NÃO SEPARADO';
  return entregaMap[normalized] || 'PEND. ENTREGA';
};

const parseDate = (dateStr: string): string => {
  // Try DD/MM/YYYY format
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
  }
  
  // Try YYYY-MM-DD format
  const yyyymmdd = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    return `${dateStr}T00:00:00`;
  }
  
  // Default to now
  return new Date().toISOString();
};

const parseNumber = (value: string): number => {
  if (!value) return 0;
  // Handle Brazilian format (1.234,56) and standard format (1234.56)
  const cleaned = value
    .replace(/[^\d.,]/g, '')
    .replace(/\.(?=.*\.)/g, '') // Remove thousands separators
    .replace(',', '.'); // Convert decimal comma to point
  return parseFloat(cleaned) || 0;
};

const parseCSV = (content: string): CSVPedidoRow[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[;,]/).map(normalizeHeader);
  
  // Map column indices
  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    if (header === 'data') columnMap.data = index;
    else if (header === 'cliente') columnMap.cliente = index;
    else if (header.includes('qtd') || header === 'qtdtotal' || header === 'quantidade') columnMap.qtdTotal = index;
    else if (header.includes('valor') || header === 'valortotal') columnMap.valorTotal = index;
    else if (header.includes('pagamento') || header === 'statuspagamento') columnMap.statusPagamento = index;
    else if (header.includes('pedido') || header === 'statuspedido') columnMap.statusPedido = index;
    else if (header.includes('entrega') || header === 'statusentrega') columnMap.statusEntrega = index;
  });

  const rows: CSVPedidoRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[;,]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
    
    if (values.length === 0 || values.every(v => !v)) continue;

    const row: CSVPedidoRow = {
      data: columnMap.data !== undefined ? values[columnMap.data] : '',
      cliente: columnMap.cliente !== undefined ? values[columnMap.cliente] : '',
      qtdTotal: columnMap.qtdTotal !== undefined ? parseNumber(values[columnMap.qtdTotal]) : 0,
      valorTotal: columnMap.valorTotal !== undefined ? parseNumber(values[columnMap.valorTotal]) : 0,
      statusPagamento: columnMap.statusPagamento !== undefined ? values[columnMap.statusPagamento] : 'PENDENTE',
      statusPedido: columnMap.statusPedido !== undefined ? values[columnMap.statusPedido] : 'NÃO SEPARADO',
      statusEntrega: columnMap.statusEntrega !== undefined ? values[columnMap.statusEntrega] : 'PEND. ENTREGA',
    };

    // Only include rows with at least a client name
    if (row.cliente) {
      rows.push(row);
    }
  }

  return rows;
};

export function ImportPedidosCSVModal({ open, onOpenChange }: ImportPedidosCSVModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewRows, setPreviewRows] = useState<CSVPedidoRow[]>([]);

  const resetState = useCallback(() => {
    setProgress(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setResult(null);
    setPreviewRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      resetState();
      onOpenChange(false);
    }
  }, [isProcessing, onOpenChange, resetState]);

  const checkDuplicate = async (
    clienteNome: string, 
    data: string, 
    valorTotal: number, 
    existingPedidos: Array<{ cliente_nome: string; created_at: string; valor_total: number }>
  ): Promise<boolean> => {
    const pedidoDate = new Date(data).toDateString();
    
    return existingPedidos.some(p => {
      const pDate = new Date(p.created_at).toDateString();
      return (
        p.cliente_nome.toLowerCase() === clienteNome.toLowerCase() &&
        pDate === pedidoDate &&
        Math.abs((p.valor_total || 0) - valorTotal) < 0.01
      );
    });
  };

  const processImport = async (rows: CSVPedidoRow[]) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsProcessing(true);
    setPreviewRows([]);
    
    const importResult: ImportResult = {
      total: rows.length,
      imported: 0,
      duplicates: 0,
      errors: 0,
      clientesNaoEncontrados: [],
      errorMessages: [],
    };

    try {
      // Verify user session is still valid
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        setIsProcessing(false);
        return;
      }

      // Fetch ALL existing clients with pagination (Supabase limit is 1000)
      let allClientes: Array<{ id: string; nome: string }> = [];
      let clientePage = 0;
      let hasMoreClientes = true;
      const pageSize = 1000;

      while (hasMoreClientes) {
        const { data: clientes } = await supabase
          .from('clientes')
          .select('id, nome')
          .eq('user_id', user.id)
          .range(clientePage * pageSize, (clientePage + 1) * pageSize - 1);

        if (clientes && clientes.length > 0) {
          allClientes = [...allClientes, ...clientes];
          hasMoreClientes = clientes.length === pageSize;
          clientePage++;
        } else {
          hasMoreClientes = false;
        }
      }

      const clientesMap = new Map<string, string>();
      allClientes.forEach(c => {
        clientesMap.set(c.nome.toLowerCase(), c.id);
      });

      // Fetch ALL existing pedidos for duplicate check with pagination
      let existingPedidos: Array<{ cliente_nome: string; created_at: string; valor_total: number | null }> = [];
      let pedidoPage = 0;
      let hasMorePedidos = true;

      while (hasMorePedidos) {
        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('cliente_nome, created_at, valor_total')
          .eq('user_id', user.id)
          .range(pedidoPage * pageSize, (pedidoPage + 1) * pageSize - 1);

        if (pedidos && pedidos.length > 0) {
          existingPedidos = [...existingPedidos, ...pedidos];
          hasMorePedidos = pedidos.length === pageSize;
          pedidoPage++;
        } else {
          hasMorePedidos = false;
        }
      }

      const batches = Math.ceil(rows.length / BATCH_SIZE);
      setTotalBatches(batches);

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        // Check session before each batch to prevent RLS errors
        if (batchIndex > 0 && batchIndex % 10 === 0) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) {
            importResult.errors += rows.length - (batchIndex * BATCH_SIZE);
            importResult.errorMessages.push('Sessão expirada durante a importação. Faça login novamente.');
            break;
          }
        }

        setCurrentBatch(batchIndex + 1);
        const batchStart = batchIndex * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
        const batch = rows.slice(batchStart, batchEnd);

        const pedidosToInsert: Array<{
          user_id: string;
          cliente_id: string | null;
          cliente_nome: string;
          created_at: string;
          total_pecas: number;
          valor_total: number;
          status_pagamento: string;
          status_pedido: string;
          status_entrega: string;
        }> = [];

        for (const row of batch) {
          // Check for duplicates
          const isDuplicate = await checkDuplicate(
            row.cliente, 
            parseDate(row.data), 
            row.valorTotal,
            existingPedidos
          );

          if (isDuplicate) {
            importResult.duplicates++;
            continue;
          }

          // Find client ID
          const clienteId = clientesMap.get(row.cliente.toLowerCase()) || null;
          
          if (!clienteId && !importResult.clientesNaoEncontrados.includes(row.cliente)) {
            importResult.clientesNaoEncontrados.push(row.cliente);
          }

          pedidosToInsert.push({
            user_id: user.id,
            cliente_id: clienteId,
            cliente_nome: row.cliente,
            created_at: parseDate(row.data),
            total_pecas: row.qtdTotal,
            valor_total: row.valorTotal,
            status_pagamento: normalizeStatus(row.statusPagamento, 'pagamento'),
            status_pedido: normalizeStatus(row.statusPedido, 'pedido'),
            status_entrega: normalizeStatus(row.statusEntrega, 'entrega'),
          });
        }

        if (pedidosToInsert.length > 0) {
          const { error } = await supabase
            .from('pedidos')
            .insert(pedidosToInsert);

          if (error) {
            importResult.errors += pedidosToInsert.length;
            if (error.message.includes('row-level security')) {
              importResult.errorMessages.push(`Lote ${batchIndex + 1}: Erro de permissão - verifique se você está logado corretamente`);
            } else {
              importResult.errorMessages.push(`Lote ${batchIndex + 1}: ${error.message}`);
            }
          } else {
            importResult.imported += pedidosToInsert.length;
            
            // Add inserted pedidos to existingPedidos to prevent duplicates within same import
            pedidosToInsert.forEach(p => {
              existingPedidos.push({
                cliente_nome: p.cliente_nome,
                created_at: p.created_at,
                valor_total: p.valor_total,
              });
            });
          }
        }

        setProgress(Math.round(((batchIndex + 1) / batches) * 100));
      }

      setResult(importResult);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });

      if (importResult.imported > 0) {
        toast.success(`${importResult.imported} pedidos importados com sucesso!`);
      }
    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error('Erro ao processar importação');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo .csv');
      return;
    }

    resetState();

    try {
      const content = await file.text();
      const rows = parseCSV(content);

      if (rows.length === 0) {
        toast.error('Nenhum pedido válido encontrado no arquivo.');
        return;
      }

      // Show preview
      setPreviewRows(rows.slice(0, 5));
      
      // Start import
      await processImport(rows);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar o arquivo. Verifique o formato.');
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="neu-card border-0 rounded-2xl max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-primary" />
            Importar Pedidos (CSV)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Importe pedidos em massa a partir de um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="space-y-4 pr-4">
            {/* Result Summary */}
            {result && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="neu-input p-3 rounded-xl flex items-center gap-3">
                    <CheckCircle size={20} className="text-emerald-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Importados</p>
                      <p className="font-bold text-foreground">{result.imported}</p>
                    </div>
                  </div>
                  <div className="neu-input p-3 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} className="text-amber-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Duplicatas ignoradas</p>
                      <p className="font-bold text-foreground">{result.duplicates}</p>
                    </div>
                  </div>
                </div>
                
                {result.errors > 0 && (
                  <div className="neu-input p-3 rounded-xl flex items-center gap-3 border-l-4 border-red-500">
                    <XCircle size={20} className="text-red-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Erros</p>
                      <p className="font-bold text-foreground">{result.errors}</p>
                    </div>
                  </div>
                )}

                {result.clientesNaoEncontrados.length > 0 && (
                  <div className="neu-input p-3 rounded-xl">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground mb-1">
                          {result.clientesNaoEncontrados.length} clientes não encontrados
                        </p>
                        <p className="text-muted-foreground text-xs mb-2">
                          Os pedidos foram criados sem vinculação ao cadastro do cliente
                        </p>
                        <div className="max-h-24 overflow-y-auto">
                          {result.clientesNaoEncontrados.slice(0, 10).map((nome, i) => (
                            <span key={i} className="inline-block bg-secondary px-2 py-0.5 rounded text-xs mr-1 mb-1">
                              {nome}
                            </span>
                          ))}
                          {result.clientesNaoEncontrados.length > 10 && (
                            <span className="text-xs text-muted-foreground">
                              +{result.clientesNaoEncontrados.length - 10} outros
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Processando lote {currentBatch} de {totalBatches}...
                  </span>
                  <span className="font-medium text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Drop Zone */}
            {!result && (
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
                      Suporta arquivos com mais de 4.000 linhas
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Column Info */}
            {!result && !isProcessing && (
              <div className="neu-input p-4 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-2">Formato esperado das colunas:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                      <div><span className="font-medium text-foreground">Data</span> → DD/MM/YYYY</div>
                      <div><span className="font-medium text-foreground">Cliente</span> → Nome do Cliente</div>
                      <div><span className="font-medium text-foreground">Qtd Total</span> → Quantidade</div>
                      <div><span className="font-medium text-foreground">Valor Total</span> → Valor em R$</div>
                      <div><span className="font-medium text-foreground">Status Pagamento</span> → PAGO, PENDENTE...</div>
                      <div><span className="font-medium text-foreground">Status Pedido</span> → SEPARADO, NÃO SEPARADO...</div>
                      <div><span className="font-medium text-foreground">Status Entrega</span> → ENTREGUE, RETIRADA...</div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Separador: ponto e vírgula (;) ou vírgula (,)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {result ? (
                <Button
                  onClick={handleClose}
                  className="flex-1 h-11 rounded-xl"
                >
                  Concluir
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="flex-1 h-11 rounded-xl neu-button border-0 text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
