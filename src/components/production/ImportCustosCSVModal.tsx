import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, AlertCircle, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  CustoCSVRowSchema, 
  ValidatedCustoCSVRow,
  validateTipoCusto,
  sanitizeString,
  safeParseNumber,
  validateCSVFile 
} from '@/lib/csv-validation-schemas';

interface ImportCustosCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedCusto {
  referencia: string;
  modelo: string;
  quantidade: number;
  metrosTecido: number;
  valorMetro: number;
  precoVenda: number;
  tipoCusto: string;
  descricaoCusto: string;
  valorUnitario: number;
  pago: boolean;
  dataPagamento: string;
  error?: string;
}

const VALID_TIPOS = ['Material', 'Facção/Costura', 'Lavanderia', 'Acabamento', 'Aviamentos', 'Transporte', 'Outros'];

export function ImportCustosCSVModal({ open, onOpenChange, onSuccess }: ImportCustosCSVModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedCusto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const resetState = () => {
    setPreviewData([]);
    setErrors([]);
    setIsDragOver(false);
    setProcessing(false);
  };

  const parseCSV = (text: string): ParsedCusto[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const parsed: ParsedCusto[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => sanitizeString(v.replace(/^"|"$/g, '')));
      
      if (values.length < 6) continue;

      const referencia = values[0] || '';
      const modelo = values[1] || '';
      const quantidade = safeParseNumber(values[2]);
      const metrosTecido = safeParseNumber(values[3]);
      const valorMetro = safeParseNumber(values[4]);
      const precoVenda = safeParseNumber(values[5]);
      const tipoCusto = values[6] || '';
      const descricaoCusto = values[7] || '';
      const valorUnitario = safeParseNumber(values[8]);
      const pagoStr = (values[9] || '').toLowerCase();
      const pago = pagoStr === 'sim' || pagoStr === 'true' || pagoStr === '1';
      const dataPagamento = values[10] || '';

      // Validate with Zod schema
      const rawRow = {
        referencia,
        modelo,
        quantidade,
        metrosTecido,
        valorMetro,
        precoVenda,
        tipoCusto,
        descricaoCusto,
        valorUnitario,
        pago,
        dataPagamento
      };

      const validation = CustoCSVRowSchema.safeParse(rawRow);
      
      let error: string | undefined;
      
      if (!validation.success) {
        error = validation.error.errors.map(e => e.message).join(', ');
      } else if (tipoCusto && !validateTipoCusto(tipoCusto)) {
        error = `Tipo inválido: ${tipoCusto}`;
      }

      parsed.push({
        referencia,
        modelo,
        quantidade,
        metrosTecido,
        valorMetro,
        precoVenda,
        tipoCusto,
        descricaoCusto,
        valorUnitario,
        pago,
        dataPagamento,
        error
      });
    }

    return parsed;
  };

  const handleFile = async (file: File) => {
    // Validate file
    const fileValidation = validateCSVFile(file);
    if (!fileValidation.valid) {
      toast.error(fileValidation.error);
      return;
    }

    setProcessing(true);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      
      if (parsed.length === 0) {
        toast.error('Nenhum dado válido encontrado no CSV');
        return;
      }

      const errs = parsed.filter(p => p.error).map(p => `${p.referencia}: ${p.error}`);
      setErrors(errs);
      setPreviewData(parsed);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo CSV');
    } finally {
      setProcessing(false);
    }
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
    const validData = previewData.filter(p => !p.error);
    if (validData.length === 0) {
      toast.error('Nenhum dado válido para importar');
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Group by referencia
      const grouped = validData.reduce((acc, item) => {
        if (!acc[item.referencia]) {
          acc[item.referencia] = [];
        }
        acc[item.referencia].push(item);
        return acc;
      }, {} as Record<string, ParsedCusto[]>);

      // Process each group
      for (const [referencia, items] of Object.entries(grouped)) {
        try {
          // Find producao by id_producao
          const { data: producao, error: prodError } = await supabase
            .from('producao')
            .select('id')
            .eq('id_producao', referencia)
            .maybeSingle();

          if (prodError || !producao) {
            console.error(`Lote ${referencia} não encontrado`);
            errorCount += items.length;
            continue;
          }

          const producaoId = producao.id;
          const firstItem = items[0];

          // Upsert config if there are fabric costs
          if (firstItem.metrosTecido > 0 || firstItem.valorMetro > 0 || firstItem.precoVenda > 0) {
            const { data: existingConfig } = await supabase
              .from('lote_custos_config')
              .select('id')
              .eq('producao_id', producaoId)
              .maybeSingle();

            if (existingConfig) {
              await supabase
                .from('lote_custos_config')
                .update({
                  metros_corte: firstItem.metrosTecido,
                  valor_metro: firstItem.valorMetro,
                  preco_venda: firstItem.precoVenda,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingConfig.id);
            } else {
              await supabase
                .from('lote_custos_config')
                .insert({
                  producao_id: producaoId,
                  user_id: user.id,
                  metros_corte: firstItem.metrosTecido,
                  valor_metro: firstItem.valorMetro,
                  preco_venda: firstItem.precoVenda
                });
            }
          }

          // Insert cost items
          for (const item of items) {
            if (item.tipoCusto && item.descricaoCusto) {
              // Parse date
              let dataPagamento: string | null = null;
              if (item.dataPagamento) {
                // Try DD/MM/YYYY format
                const parts = item.dataPagamento.split('/');
                if (parts.length === 3) {
                  dataPagamento = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else if (item.dataPagamento.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  dataPagamento = item.dataPagamento;
                }
              }

              await supabase
                .from('lote_custos_itens')
                .insert({
                  producao_id: producaoId,
                  user_id: user.id,
                  tipo: item.tipoCusto,
                  descricao: item.descricaoCusto,
                  valor_unitario: item.valorUnitario,
                  is_paid: item.pago,
                  data_pagamento: dataPagamento
                });
              
              successCount++;
            }
          }
        } catch (err) {
          console.error(`Erro ao importar custos do lote ${referencia}:`, err);
          errorCount += items.length;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} custos importados com sucesso!`);
        onSuccess?.();
        onOpenChange(false);
        resetState();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} custos não puderam ser importados`);
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar custos');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Custos via CSV
          </DialogTitle>
          <DialogDescription>
            Importe custos de produção a partir de um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        {previewData.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
              }
            `}
          >
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Arraste um arquivo CSV aqui ou clique para selecionar
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="hidden"
              id="csv-custos-input"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('csv-custos-input')?.click()}
              disabled={processing}
            >
              {processing ? 'Processando...' : 'Selecionar Arquivo'}
            </Button>

            <div className="mt-6 text-left text-xs text-muted-foreground bg-muted/50 p-4 rounded-lg">
              <p className="font-medium mb-2">Formato esperado do CSV:</p>
              <code className="block bg-background p-2 rounded text-[10px] overflow-x-auto">
                Referência,Modelo,Quantidade,Metros Tecido,Valor/Metro,Preço Venda,Tipo Custo,Descrição Custo,Valor Unitário,Pago,Data Pagamento
              </code>
              <p className="mt-2">
                <strong>Tipos válidos:</strong> {VALID_TIPOS.join(', ')}
              </p>
              <p className="mt-1">
                <strong>Pago:</strong> Sim, Não, true, false, 1, 0
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium text-sm">{errors.length} erros encontrados</span>
                </div>
                <ul className="text-xs text-destructive/80 space-y-1 max-h-24 overflow-y-auto">
                  {errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {errors.length > 5 && (
                    <li>... e mais {errors.length - 5} erros</li>
                  )}
                </ul>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left font-medium">Status</th>
                      <th className="p-2 text-left font-medium">Ref.</th>
                      <th className="p-2 text-left font-medium">Modelo</th>
                      <th className="p-2 text-right font-medium">Metros</th>
                      <th className="p-2 text-right font-medium">R$/Metro</th>
                      <th className="p-2 text-right font-medium">Preço Venda</th>
                      <th className="p-2 text-left font-medium">Tipo Custo</th>
                      <th className="p-2 text-right font-medium">Valor</th>
                      <th className="p-2 text-center font-medium">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((item, i) => (
                      <tr 
                        key={i} 
                        className={`border-t ${item.error ? 'bg-destructive/5' : ''}`}
                      >
                        <td className="p-2">
                          {item.error ? (
                            <X className="w-4 h-4 text-destructive" />
                          ) : (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                        </td>
                        <td className="p-2 font-mono">{item.referencia}</td>
                        <td className="p-2 truncate max-w-[120px]">{item.modelo}</td>
                        <td className="p-2 text-right">{item.metrosTecido || '-'}</td>
                        <td className="p-2 text-right">{item.valorMetro ? `R$ ${item.valorMetro.toFixed(2)}` : '-'}</td>
                        <td className="p-2 text-right">{item.precoVenda ? `R$ ${item.precoVenda.toFixed(2)}` : '-'}</td>
                        <td className="p-2">{item.tipoCusto || '-'}</td>
                        <td className="p-2 text-right">{item.valorUnitario ? `R$ ${item.valorUnitario.toFixed(2)}` : '-'}</td>
                        <td className="p-2 text-center">{item.pago ? 'Sim' : 'Não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {previewData.filter(p => !p.error).length} de {previewData.length} registros válidos
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>
            Cancelar
          </Button>
          {previewData.length > 0 && (
            <Button 
              onClick={handleImport} 
              disabled={processing || previewData.filter(p => !p.error).length === 0}
            >
              {processing ? 'Importando...' : `Importar ${previewData.filter(p => !p.error).length} custos`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
