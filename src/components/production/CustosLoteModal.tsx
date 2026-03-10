import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, DollarSign, TrendingUp, Ruler, Loader2, Check, CircleDollarSign, Percent, Package, PackageCheck, AlertTriangle, Send, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ProducaoData } from '@/entities/Producao';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CustoItemSchema, CustoConfigSchema } from '@/lib/validations';
import { useEnviarParaEstoque } from '@/hooks/useEnviarParaEstoque';
import { useCustosPadrao } from '@/hooks/useCustosPadrao';
import { format } from 'date-fns';

interface CustoItem {
  id: string;
  tipo: string;
  descricao: string;
  valor_unitario: number;
  is_paid: boolean;
  data_pagamento?: string;
}

interface LoteCustosConfig {
  metros_corte: number;
  valor_metro: number;
  preco_venda: number;
}

interface CustosLoteModalProps {
  lot: ProducaoData | null;
  open: boolean;
  onClose: () => void;
}

const TIPOS_CUSTO = [
  'Material',
  'Facção/Costura',
  'Lavanderia',
  'Acabamento',
  'Aviamentos',
  'Transporte',
  'Outros'
];

export function CustosLoteModal({ lot, open, onClose }: CustosLoteModalProps) {
  const [custos, setCustos] = useState<CustoItem[]>([]);
  const [localConfig, setLocalConfig] = useState<LoteCustosConfig>({
    metros_corte: 0,
    valor_metro: 0,
    preco_venda: 0
  });
  const [novoTipo, setNovoTipo] = useState('Material');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aplicandoPadrao, setAplicandoPadrao] = useState(false);
  
  // Hook para custos padrão
  const { custosAtivos } = useCustosPadrao();
  
  // Hook para integração com estoque
  const { 
    enviarParaEstoque, 
    calcularPreview, 
    verificarJaEnviado, 
    isLoading: isEnviando 
  } = useEnviarParaEstoque();
  const [previewCustoMedio, setPreviewCustoMedio] = useState<{
    produtoExistente: boolean;
    produtoNome: string;
    estoqueAtualQty: number;
    estoqueAtualCustoMedio: number | null;
    qtdComCustoAtual: number;
    loteQty: number;
    loteCustoUnitario: number;
    novoCustoMedio: number;
    novaQtdComCusto: number;
    novoEstoqueTotal: number;
  } | null>(null);
  const [statusIntegracao, setStatusIntegracao] = useState<{
    jaEnviado: boolean;
    dataEnvio?: string;
    integradoSemCusto?: boolean;
  } | null>(null);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const quantidade = lot?.quantidade || 0;

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lot && open) {
      loadData();
      // Carregar status de integração
      verificarJaEnviado(lot.id).then(setStatusIntegracao);
    }
  }, [lot, open]);

  const loadData = async () => {
    if (!lot) return;
    setLoading(true);
    
    try {
      const { data: configData } = await supabase
        .from('lote_custos_config')
        .select('*')
        .eq('producao_id', lot.id)
        .maybeSingle();

      if (configData) {
        setLocalConfig({
          metros_corte: Number(configData.metros_corte) || 0,
          valor_metro: Number(configData.valor_metro) || 0,
          preco_venda: Number(configData.preco_venda) || 0
        });
      } else {
        setLocalConfig({ metros_corte: 0, valor_metro: 0, preco_venda: 0 });
      }

      const { data: itensData } = await supabase
        .from('lote_custos_itens')
        .select('*')
        .eq('producao_id', lot.id)
        .order('created_at', { ascending: true });

      if (itensData) {
        setCustos(itensData.map(item => ({
          id: item.id,
          tipo: item.tipo,
          descricao: item.descricao,
          valor_unitario: Number(item.valor_unitario),
          is_paid: item.is_paid,
          data_pagamento: item.data_pagamento || undefined
        })));
      } else {
        setCustos([]);
      }
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = useCallback(async (newConfig: LoteCustosConfig) => {
    if (!lot) return;
    setSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado');
        setSaving(false);
        return;
      }

      const { data: existing } = await supabase
        .from('lote_custos_config')
        .select('id')
        .eq('producao_id', lot.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('lote_custos_config')
          .update({
            metros_corte: newConfig.metros_corte,
            valor_metro: newConfig.valor_metro,
            preco_venda: newConfig.preco_venda
          })
          .eq('producao_id', lot.id);
      } else {
        await supabase
          .from('lote_custos_config')
          .insert({
            producao_id: lot.id,
            metros_corte: newConfig.metros_corte,
            valor_metro: newConfig.valor_metro,
            preco_venda: newConfig.preco_venda,
            user_id: user.id
          });
      }
    } catch {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }, [lot]);

  const handleConfigChange = (field: keyof LoteCustosConfig, value: string) => {
    let numValue = parseFloat(value) || 0;
    
    const limits: Record<keyof LoteCustosConfig, number> = {
      metros_corte: 100000,
      valor_metro: 10000,
      preco_venda: 100000
    };
    
    numValue = Math.max(0, Math.min(numValue, limits[field]));
    const newConfig = { ...localConfig, [field]: numValue };
    
    const result = CustoConfigSchema.safeParse(newConfig);
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || 'Valor inválido');
      return;
    }
    
    setLocalConfig(newConfig);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveConfig(newConfig);
    }, 500);
  };

  const handleAddCusto = async () => {
    if (!lot) return;
    
    const valorNum = parseFloat(novoValor) || 0;
    const custoData = {
      tipo: novoTipo,
      descricao: novaDescricao.trim(),
      valor_unitario: valorNum
    };
    
    const result = CustoItemSchema.safeParse(custoData);
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || 'Dados inválidos');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const { data, error } = await supabase
        .from('lote_custos_itens')
        .insert({
          producao_id: lot.id,
          tipo: custoData.tipo,
          descricao: custoData.descricao,
          valor_unitario: custoData.valor_unitario,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setCustos([...custos, {
        id: data.id,
        tipo: data.tipo,
        descricao: data.descricao,
        valor_unitario: Number(data.valor_unitario),
        is_paid: data.is_paid,
        data_pagamento: data.data_pagamento || undefined
      }]);
      
      setNovaDescricao('');
      setNovoValor('');
      toast.success('Custo adicionado');
    } catch {
      toast.error('Erro ao adicionar custo');
    }
  };

  const handleRemoveCusto = async (id: string) => {
    try {
      await supabase.from('lote_custos_itens').delete().eq('id', id);
      setCustos(custos.filter(c => c.id !== id));
      toast.success('Custo removido');
    } catch {
      toast.error('Erro ao remover custo');
    }
  };

  // Aplicar custos padrão
  const handleAplicarCustosPadrao = async () => {
    if (!lot || custosAtivos.length === 0) return;
    
    setAplicandoPadrao(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      // Verificar custos já existentes (por tipo+descricao)
      const custosExistentes = new Set(
        custos.map(c => `${c.tipo}|${c.descricao.toLowerCase()}`)
      );

      // Filtrar custos padrão que ainda não existem
      const custosNovos = custosAtivos.filter(
        cp => !custosExistentes.has(`${cp.tipo}|${cp.descricao.toLowerCase()}`)
      );

      if (custosNovos.length === 0) {
        toast.info('Todos os custos padrão já estão aplicados');
        return;
      }

      // Inserir novos custos
      const inserts = custosNovos.map(cp => ({
        producao_id: lot.id,
        tipo: cp.tipo,
        descricao: cp.descricao,
        valor_unitario: cp.valor_unitario,
        user_id: user.id
      }));

      const { data, error } = await supabase
        .from('lote_custos_itens')
        .insert(inserts)
        .select();

      if (error) throw error;

      // Adicionar aos custos locais
      const novosCustos = (data || []).map(item => ({
        id: item.id,
        tipo: item.tipo,
        descricao: item.descricao,
        valor_unitario: Number(item.valor_unitario),
        is_paid: item.is_paid,
        data_pagamento: item.data_pagamento || undefined
      }));

      setCustos([...custos, ...novosCustos]);
      toast.success(`${custosNovos.length} custos padrão aplicados`);
    } catch {
      toast.error('Erro ao aplicar custos padrão');
    } finally {
      setAplicandoPadrao(false);
    }
  };

  const handleTogglePaid = async (id: string) => {
    const custo = custos.find(c => c.id === id);
    if (!custo) return;

    const newIsPaid = !custo.is_paid;
    const newDate = newIsPaid ? new Date().toISOString().split('T')[0] : null;

    try {
      await supabase
        .from('lote_custos_itens')
        .update({
          is_paid: newIsPaid,
          data_pagamento: newDate
        })
        .eq('id', id);

      setCustos(custos.map(c => {
        if (c.id === id) {
          return {
            ...c,
            is_paid: newIsPaid,
            data_pagamento: newDate || undefined
          };
        }
        return c;
      }));
    } catch {
      toast.error('Erro ao atualizar custo');
    }
  };

  const handleDateChange = async (id: string, date: string) => {
    try {
      await supabase
        .from('lote_custos_itens')
        .update({ data_pagamento: date })
        .eq('id', id);

      setCustos(custos.map(c => {
        if (c.id === id) {
          return { ...c, data_pagamento: date };
        }
        return c;
      }));
    } catch {
      // Date update failed silently - user can retry
    }
  };

  // Calculations
  const custoTecido = localConfig.metros_corte * localConfig.valor_metro;
  const custoItens = custos.reduce((sum, c) => sum + (c.valor_unitario * quantidade), 0);
  const custoTotal = custoTecido + custoItens;
  const custoUnitario = quantidade > 0 ? custoTotal / quantidade : 0;
  const lucroUnitario = localConfig.preco_venda - custoUnitario;
  const lucroTotal = lucroUnitario * quantidade;
  const margem = localConfig.preco_venda > 0 ? (lucroUnitario / localConfig.preco_venda) * 100 : 0;

  const totalPago = custos.filter(c => c.is_paid).reduce((sum, c) => sum + (c.valor_unitario * quantidade), 0);
  const totalPendente = custoItens - totalPago;

  // Atualizar preview quando custos mudam
  useEffect(() => {
    if (lot && open && lot.processo_atual === 'Vendas' && custoUnitario > 0) {
      calcularPreview({
        modeloNome: lot.modelo_nome_cache || `Lote ${lot.id_producao}`,
        quantidade: lot.quantidade,
        custoUnitario,
      }).then(setPreviewCustoMedio);
    }
  }, [lot, open, custoUnitario]);

  // Função para enviar para estoque
  const handleEnviarParaEstoque = async () => {
    if (!lot) return;
    
    if (custoTotal <= 0) {
      toast.error('Preencha os custos antes de enviar para o estoque');
      return;
    }

    const success = await enviarParaEstoque({
      loteId: lot.id,
      loteIdProducao: lot.id_producao,
      modeloNome: lot.modelo_nome_cache || `Lote ${lot.id_producao}`,
      quantidade: lot.quantidade,
      imagemUrl: lot.imagem_url,
      precoVenda: localConfig.preco_venda,
      custoUnitario,
      custoTotal,
    });

    if (success) {
      setStatusIntegracao({ jaEnviado: true, dataEnvio: new Date().toISOString() });
      onClose();
    }
  };

  // Condições para mostrar seção de integração
  const podeEnviarParaEstoque = lot?.processo_atual === 'Vendas' && !statusIntegracao?.jaEnviado && !statusIntegracao?.integradoSemCusto;
  const jaIntegradoSemCusto = statusIntegracao?.integradoSemCusto;
  const jaEnviadoComData = statusIntegracao?.jaEnviado && statusIntegracao?.dataEnvio;

  // Margin color logic
  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'text-emerald-600 dark:text-emerald-400';
    if (margin >= 15) return 'text-amber-600 dark:text-amber-400';
    return 'text-destructive';
  };

  const getMarginBgColor = (margin: number) => {
    if (margin >= 30) return 'bg-emerald-500';
    if (margin >= 15) return 'bg-amber-500';
    return 'bg-destructive';
  };

  if (!lot) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <DollarSign className="text-primary" size={20} />
            Custos do Lote {lot.id_producao}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {lot.modelo_nome_cache || 'Sem modelo'} - {quantidade} peças
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-4">
          {/* Fabric section - Responsive */}
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Ruler size={16} className="text-primary" />
                Tecido
              </h4>
              {saving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Metros</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={localConfig.metros_corte || ''}
                  onChange={(e) => handleConfigChange('metros_corte', e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">R$/Metro</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={localConfig.valor_metro || ''}
                  onChange={(e) => handleConfigChange('valor_metro', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Custo Total</Label>
                <div className="h-9 flex items-center px-3 bg-background rounded-md font-semibold text-sm border">
                  R$ {custoTecido.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Botão Aplicar Custos Padrão */}
          {custosAtivos.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Wand2 size={16} className="text-primary" />
                    Custos Padrão
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {custosAtivos.length} custos configurados
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleAplicarCustosPadrao}
                  disabled={aplicandoPadrao}
                  className="h-9 shrink-0 border-primary/30 hover:bg-primary/10"
                >
                  {aplicandoPadrao ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} className="mr-2" />
                      Aplicar Custos Padrão
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Add new cost - Compact */}
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              Adicionar Custo Avulso
              <span className="text-xs font-normal text-muted-foreground">(por peça)</span>
            </h4>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger className="h-9 sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CUSTO.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Descrição"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                className="h-9 flex-1"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="R$"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  className="h-9 w-20 sm:w-24"
                />
                <Button onClick={handleAddCusto} size="sm" className="h-9 px-3">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          </div>

          {/* Costs list - Compact */}
          {custos.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground">
                Custos ({custos.length})
              </h4>
              {custos.map(custo => {
                const custoTotalLinha = custo.valor_unitario * quantidade;
                return (
                  <div 
                    key={custo.id} 
                    className={`rounded-lg border p-2.5 sm:p-3 transition-colors ${
                      custo.is_paid 
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' 
                        : 'bg-background'
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <Checkbox
                          checked={custo.is_paid}
                          onCheckedChange={() => handleTogglePaid(custo.id)}
                          className="h-5 w-5"
                        />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {custo.tipo}
                            </span>
                            <span className={`text-sm font-medium truncate ${custo.is_paid ? 'line-through opacity-60' : ''}`}>
                              {custo.descricao}
                            </span>
                          </div>
                          <span className="text-sm font-bold whitespace-nowrap">
                            R$ {custoTotalLinha.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            R$ {custo.valor_unitario.toFixed(2)} × {quantidade} pç
                          </span>
                          <div className="flex items-center gap-1.5">
                            {custo.is_paid && (
                              <Input
                                type="date"
                                value={custo.data_pagamento || ''}
                                onChange={(e) => handleDateChange(custo.id, e.target.value)}
                                className="h-7 w-[120px] text-xs px-2"
                              />
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveCusto(custo.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {custos.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
              Nenhum custo registrado
            </div>
          )}

          {/* Seção de Integração com Estoque - Apenas para lotes em "Vendas" */}
          {lot.processo_atual === 'Vendas' && (
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-lg p-3 sm:p-4 space-y-3 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <PackageCheck size={16} />
                  Integração com Estoque
                </h4>
                {jaEnviadoComData && (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                    <Check size={12} className="mr-1" />
                    Enviado em {format(new Date(statusIntegracao.dataEnvio!), 'dd/MM/yyyy')}
                  </Badge>
                )}
                {jaIntegradoSemCusto && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                    <AlertTriangle size={12} className="mr-1" />
                    Integrado (antes do sistema de custos)
                  </Badge>
                )}
              </div>

              {/* Preview do Custo Médio */}
              {podeEnviarParaEstoque && previewCustoMedio && (
                <div className="bg-background/80 rounded-lg p-3 space-y-2 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs font-medium text-muted-foreground">Preview do Custo Médio</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estoque atual:</span>
                      <span>
                        {previewCustoMedio.estoqueAtualQty} pç × R$ {previewCustoMedio.estoqueAtualCustoMedio?.toFixed(2) || '--'}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>+ Este lote:</span>
                      <span>
                        {previewCustoMedio.loteQty} pç × R$ {previewCustoMedio.loteCustoUnitario.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                      <span>= Novo estoque:</span>
                      <span>
                        {previewCustoMedio.novoEstoqueTotal} pç × R$ {previewCustoMedio.novoCustoMedio.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    * Apenas qtd_com_custo ({previewCustoMedio.novaQtdComCusto} pç) entra no cálculo de valor do estoque
                  </p>
                </div>
              )}

              {/* Botão Enviar para Estoque */}
              {podeEnviarParaEstoque && (
                <div className="space-y-2">
                  <Button
                    onClick={handleEnviarParaEstoque}
                    disabled={isEnviando || custoTotal <= 0}
                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isEnviando ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Enviar para Estoque
                      </>
                    )}
                  </Button>
                  {custoTotal <= 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Preencha os custos antes de enviar
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    ⚠️ Ação irreversível. O estoque será atualizado imediatamente.
                  </p>
                </div>
              )}

              {/* Status para lotes já enviados */}
              {(jaEnviadoComData || jaIntegradoSemCusto) && (
                <p className="text-xs text-muted-foreground">
                  {jaEnviadoComData 
                    ? `Este lote foi integrado ao estoque com custo unitário de R$ ${lot.unit_cost?.toFixed(2) || custoUnitario.toFixed(2)}`
                    : 'Este lote foi integrado antes do sistema de custos. Não é possível recalcular o custo médio.'
                  }
                </p>
              )}
            </div>
          )}

          {/* Pricing & Summary Card */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-3 sm:p-4 space-y-4 border border-primary/20">
            {/* Preço de Venda */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp size={12} />
                  Preço de Venda
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={localConfig.preco_venda || ''}
                  onChange={(e) => handleConfigChange('preco_venda', e.target.value)}
                  className="h-10 text-lg font-bold mt-1"
                />
              </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Custo Total */}
              <div className="bg-background rounded-lg p-2.5 sm:p-3 text-center border">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Package size={12} />
                  <span className="text-[10px] sm:text-xs font-medium">Custo</span>
                </div>
                <p className="text-sm sm:text-base font-bold">
                  R$ {custoTotal.toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  R$ {custoUnitario.toFixed(2)}/pç
                </p>
              </div>

              {/* Lucro Total */}
              <div className={`bg-background rounded-lg p-2.5 sm:p-3 text-center border ${
                lucroTotal >= 0 ? 'border-emerald-200 dark:border-emerald-900' : 'border-destructive/50'
              }`}>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <CircleDollarSign size={12} />
                  <span className="text-[10px] sm:text-xs font-medium">Lucro</span>
                </div>
                <p className={`text-sm sm:text-base font-bold ${lucroTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  R$ {lucroTotal.toFixed(0)}
                </p>
                <p className={`text-[10px] ${lucroUnitario >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  R$ {lucroUnitario.toFixed(2)}/pç
                </p>
              </div>

              {/* Margem */}
              <div className={`bg-background rounded-lg p-2.5 sm:p-3 text-center border ${
                margem >= 30 ? 'border-emerald-200 dark:border-emerald-900' : 
                margem >= 15 ? 'border-amber-200 dark:border-amber-900' : 'border-destructive/50'
              }`}>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Percent size={12} />
                  <span className="text-[10px] sm:text-xs font-medium">Margem</span>
                </div>
                <p className={`text-sm sm:text-base font-bold ${getMarginColor(margem)}`}>
                  {margem.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {margem >= 30 ? 'Ótima' : margem >= 15 ? 'Média' : 'Baixa'}
                </p>
              </div>
            </div>

            {/* Margin Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Margem de Lucro</span>
                <span className={`font-medium ${getMarginColor(margem)}`}>{margem.toFixed(1)}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className={`h-full transition-all ${getMarginBgColor(margem)}`}
                  style={{ width: `${Math.min(Math.max(margem, 0), 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span className="text-amber-500">15%</span>
                <span className="text-emerald-500">30%</span>
                <span>50%+</span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="flex items-center gap-2 pt-2 border-t border-primary/20">
              <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-950/50 rounded-md">
                <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300">Pago</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {totalPago.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 bg-amber-100 dark:bg-amber-950/50 rounded-md">
                <DollarSign size={14} className="text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-300">Pendente</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    R$ {totalPendente.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
