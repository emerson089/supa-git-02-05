import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, DollarSign, Calculator, TrendingUp, Ruler, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProducaoData } from '@/entities/Producao';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CustoItemSchema, CustoConfigSchema } from '@/lib/validations';

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
  // Local state for instant UI updates
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
  
  // Debounce ref for config save
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const quantidade = lot?.quantidade || 0;

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Load data from database
  useEffect(() => {
    if (lot && open) {
      loadData();
    }
  }, [lot, open]);

  const loadData = async () => {
    if (!lot) return;
    setLoading(true);
    
    try {
      // Load config
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

      // Load cost items
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
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error loading data:', error);
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
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }, [lot]);

  const handleConfigChange = (field: keyof LoteCustosConfig, value: string) => {
    let numValue = parseFloat(value) || 0;
    
    // Apply validation limits
    const limits: Record<keyof LoteCustosConfig, number> = {
      metros_corte: 100000,
      valor_metro: 10000,
      preco_venda: 100000
    };
    
    numValue = Math.max(0, Math.min(numValue, limits[field]));
    const newConfig = { ...localConfig, [field]: numValue };
    
    // Validate before updating
    const result = CustoConfigSchema.safeParse(newConfig);
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || 'Valor inválido');
      return;
    }
    
    // Update UI immediately
    setLocalConfig(newConfig);
    
    // Debounced save to database (500ms delay)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveConfig(newConfig);
    }, 500);
  };

  const handleAddCusto = async () => {
    if (!lot) return;
    
    // Validate input
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
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error adding cost:', error);
      toast.error('Erro ao adicionar custo');
    }
  };

  const handleRemoveCusto = async (id: string) => {
    try {
      await supabase.from('lote_custos_itens').delete().eq('id', id);
      setCustos(custos.filter(c => c.id !== id));
      toast.success('Custo removido');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error removing cost:', error);
      toast.error('Erro ao remover custo');
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
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating cost:', error);
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
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating date:', error);
    }
  };

  // Calculations using localConfig for instant updates
  const custoTecido = localConfig.metros_corte * localConfig.valor_metro;
  const custoItens = custos.reduce((sum, c) => sum + (c.valor_unitario * quantidade), 0);
  const custoTotal = custoTecido + custoItens;
  const custoUnitario = quantidade > 0 ? custoTotal / quantidade : 0;
  const lucroUnitario = localConfig.preco_venda - custoUnitario;
  const lucroTotal = lucroUnitario * quantidade;
  const margem = localConfig.preco_venda > 0 ? (lucroUnitario / localConfig.preco_venda) * 100 : 0;

  const totalPago = custos.filter(c => c.is_paid).reduce((sum, c) => sum + (c.valor_unitario * quantidade), 0);
  const totalPendente = custoItens - totalPago;

  if (!lot) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="text-primary" size={20} />
            Custos do Lote {lot.id_producao}
          </DialogTitle>
          <DialogDescription>
            {lot.modelo_nome_cache || 'Sem modelo'} - {quantidade} peças
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Fabric section */}
          <div className="neu-card p-4 space-y-3">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Ruler size={16} className="text-primary" />
              Dados do Tecido
              {saving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                  <Loader2 size={12} className="animate-spin" />
                  Salvando...
                </span>
              )}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Metros de Corte</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={localConfig.metros_corte || ''}
                  onChange={(e) => handleConfigChange('metros_corte', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor por Metro (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={localConfig.valor_metro || ''}
                  onChange={(e) => handleConfigChange('valor_metro', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Custo do Tecido</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md font-semibold text-foreground">
                  R$ {custoTecido.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Add new cost */}
          <div className="neu-card p-4 space-y-3">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              Adicionar Custo (Valor por Peça)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger>
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
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="R$/peça"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddCusto} size="icon" className="shrink-0">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          </div>

          {/* Costs list */}
          <div className="space-y-2">
            {custos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhum custo registrado
              </div>
            ) : (
              custos.map(custo => {
                const custoTotalLinha = custo.valor_unitario * quantidade;
                return (
                  <div 
                    key={custo.id} 
                    className={`neu-card p-3 flex items-center gap-3 ${custo.is_paid ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-primary bg-secondary px-2 py-0.5 rounded">
                          {custo.tipo}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          custo.is_paid 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                        }`}>
                          {custo.is_paid ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1 truncate">{custo.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {custo.valor_unitario.toFixed(2)}/peça × {quantidade} = <span className="font-semibold text-foreground">R$ {custoTotalLinha.toFixed(2)}</span>
                      </p>
                      {custo.is_paid && custo.data_pagamento && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Pago em: {new Date(custo.data_pagamento).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={custo.is_paid}
                          onCheckedChange={() => handleTogglePaid(custo.id)}
                        />
                      </div>

                      {custo.is_paid && (
                        <Input
                          type="date"
                          value={custo.data_pagamento || ''}
                          onChange={(e) => handleDateChange(custo.id, e.target.value)}
                          className="w-32 h-8 text-xs"
                        />
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveCusto(custo.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pricing section */}
          <div className="neu-card p-4 space-y-3">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Precificação
            </h4>
            <div>
              <Label className="text-xs text-muted-foreground">Preço de Venda Sugerido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={localConfig.preco_venda || ''}
                onChange={(e) => handleConfigChange('preco_venda', e.target.value)}
                className="max-w-[200px]"
              />
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Calculator size={16} className="text-primary" />
            Resumo Financeiro
          </h4>
          
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo do Tecido:</span>
              <span className="font-medium">R$ {custoTecido.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo dos Itens:</span>
              <span className="font-medium">R$ {custoItens.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground font-semibold">Custo Total:</span>
              <span className="font-bold text-foreground">R$ {custoTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo Unitário:</span>
              <span className="font-medium">R$ {custoUnitario.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço Venda:</span>
              <span className="font-medium">R$ {localConfig.preco_venda.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lucro Unitário:</span>
              <span className={`font-medium ${lucroUnitario >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                R$ {lucroUnitario.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground font-semibold">Lucro Total:</span>
              <span className={`font-bold ${lucroTotal >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                R$ {lucroTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margem:</span>
              <span className={`font-medium ${margem >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {margem.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="border-t pt-3 mt-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-emerald-600 font-medium">Total Pago:</span>
                <span className="font-semibold text-emerald-600">R$ {totalPago.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-600 font-medium">Total Pendente:</span>
                <span className="font-semibold text-amber-600">R$ {totalPendente.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
