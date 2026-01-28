

## Plano: Meta Automática Inteligente com Persistência

### Objetivo
Implementar uma Meta Mensal **100% automática** baseada na média dos últimos 3 meses + % de crescimento configurável. A meta será calculada e salva automaticamente, eliminando a necessidade de configuração manual de valores.

---

## Problema Atual

1. A Meta Mensal mostra R$ 0,00 porque não há pedidos PAGO nos últimos 3 meses com `paid_at` preenchido
2. O cálculo usa `paid_at` mas os pedidos históricos podem ter sido importados sem essa data
3. Não há persistência - ao trocar dispositivo, perde a configuração
4. Não há histórico de metas para análise retrospectiva

---

## Solução

### 1. Nova Tabela: `metas_mensais`

Armazena metas calculadas automaticamente + % de crescimento usado:

```sql
CREATE TABLE metas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  media_base NUMERIC NOT NULL DEFAULT 0,
  percentual_crescimento NUMERIC NOT NULL DEFAULT 10,
  faturamento_realizado NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ano, mes)
);

-- RLS
ALTER TABLE metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own metas" ON metas_mensais FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own metas" ON metas_mensais FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own metas" ON metas_mensais FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own metas" ON metas_mensais FOR DELETE USING (auth.uid() = user_id);
```

---

### 2. Corrigir Cálculo de Média dos 3 Meses

**Problema:** A query atual usa apenas `paid_at`, mas pedidos históricos podem não ter essa data preenchida.

**Solução:** Usar `COALESCE(paid_at, created_at)` para incluir pedidos antigos:

```typescript
// Antes (linha 453-477):
.gte("paid_at", mes1Inicio.toISOString())
.lte("paid_at", mes1Fim.toISOString())

// Depois: Usar created_at como fallback para pedidos sem paid_at
// E filtrar por OR: paid_at OU created_at no período
```

**Melhor abordagem:** Usar RPC function no banco que faz `COALESCE`:

```sql
CREATE OR REPLACE FUNCTION get_faturamento_periodo(
  p_user_id UUID,
  p_inicio TIMESTAMPTZ,
  p_fim TIMESTAMPTZ
) RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(valor_total), 0)
  FROM pedidos
  WHERE user_id = p_user_id
    AND status_pagamento = 'PAGO'
    AND COALESCE(paid_at, created_at) >= p_inicio
    AND COALESCE(paid_at, created_at) <= p_fim
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

### 3. Atualizar Interface `MetaAutomatica`

```typescript
export interface MetaAutomatica {
  media3Meses: number;           // Média faturamento últimos 3 meses
  percentualCrescimento: number; // % de crescimento (default 10)
  metaCalculada: number;         // Média × (1 + %)
  mesesUsados: string[];         // Lista de meses usados no cálculo
  temHistorico: boolean;         // Se há dados suficientes
  faturamentoAtual: number;      // Faturamento acumulado do mês
  percentualAtingido: number;    // % atingido (faturamento / meta)
  diferencaPrevisao: number;     // Previsão - Meta
  statusMeta: 'acima' | 'abaixo' | 'atingida';
}
```

---

### 4. Novo Hook: `src/hooks/useMetasMensais.ts`

```typescript
export function useMetasMensais() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const anoAtual = getYear(now);
  const mesAtual = getMonth(now) + 1; // 1-12
  
  // Buscar meta do mês atual
  const { data: metaAtual } = useQuery({
    queryKey: ['meta-mensal', user?.id, anoAtual, mesAtual],
    queryFn: async () => {
      const { data } = await supabase
        .from('metas_mensais')
        .select('*')
        .eq('user_id', user!.id)
        .eq('ano', anoAtual)
        .eq('mes', mesAtual)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minuto
  });

  // Buscar histórico de metas (últimos 12 meses)
  const { data: historicoMetas } = useQuery({
    queryKey: ['metas-historico', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('metas_mensais')
        .select('*')
        .eq('user_id', user!.id)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(12);
      return data || [];
    },
    enabled: !!user,
  });

  // Salvar/atualizar meta
  const salvarMeta = useMutation({
    mutationFn: async (params: {
      valorMeta: number;
      mediaBase: number;
      percentualCrescimento: number;
      faturamentoRealizado?: number;
    }) => {
      const { data, error } = await supabase
        .from('metas_mensais')
        .upsert({
          user_id: user!.id,
          ano: anoAtual,
          mes: mesAtual,
          valor_meta: params.valorMeta,
          media_base: params.mediaBase,
          percentual_crescimento: params.percentualCrescimento,
          faturamento_realizado: params.faturamentoRealizado || 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,ano,mes'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-mensal'] });
      queryClient.invalidateQueries({ queryKey: ['metas-historico'] });
    },
  });

  // Atualizar % de crescimento
  const atualizarPercentual = useMutation({
    mutationFn: async (novoPercentual: number) => {
      localStorage.setItem('dashboard-meta-crescimento', String(novoPercentual));
      return novoPercentual;
    },
  });

  return {
    metaAtual,
    historicoMetas,
    salvarMeta,
    atualizarPercentual,
  };
}
```

---

### 5. Atualizar `useDashboardData.ts`

**Mudanças principais:**

1. **Usar fallback `created_at` para pedidos sem `paid_at`:**
```typescript
// Modificar queries dos 3 meses anteriores
// Usar .or() para pegar paid_at OU created_at no período

// Query alternativa: buscar todos os pedidos PAGO dos últimos 4 meses
// e agrupar por mês no JavaScript
const pedidosHistorico = await supabase
  .from("pedidos")
  .select("valor_total, paid_at, created_at")
  .eq("user_id", user.id)
  .eq("status_pagamento", "PAGO")
  .gte("created_at", subMonths(now, 4).toISOString())
  .lt("created_at", startOfMonth(now).toISOString());

// Agrupar por mês usando COALESCE
const faturamentoPorMes: Record<string, number> = {};
(pedidosHistorico.data || []).forEach(p => {
  const dataEfetiva = p.paid_at || p.created_at;
  const mesAno = format(parseISO(dataEfetiva), "yyyy-MM");
  faturamentoPorMes[mesAno] = (faturamentoPorMes[mesAno] || 0) + (p.valor_total || 0);
});
```

2. **Salvar meta automaticamente quando calculada:**
```typescript
// Após calcular a meta, verificar se precisa salvar
if (metaCalculada > 0 && !metaSalvaExiste) {
  // Disparar upsert assíncrono (não bloqueia UI)
  salvarMetaNoDb({
    valorMeta: metaCalculada,
    mediaBase: media3Meses,
    percentualCrescimento: percentualCrescimento * 100,
  });
}
```

3. **Adicionar campos calculados:**
```typescript
const percentualAtingido = metaCalculada > 0 
  ? (faturamentoAtualAcumulado / metaCalculada) * 100 
  : 0;

const diferencaPrevisao = projecaoMensal - metaCalculada;

const statusMeta: 'acima' | 'abaixo' | 'atingida' = 
  faturamentoAtualAcumulado >= metaCalculada ? 'atingida' :
  projecaoMensal >= metaCalculada ? 'acima' : 'abaixo';
```

---

### 6. Atualizar Dashboard.tsx

**Card de Meta Automática reformulado:**

```tsx
<Card className="neu-card border-primary/20 shadow-lg bg-gradient-to-br from-card to-primary/5">
  <CardContent className="p-4 sm:p-6">
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
      {/* Meta Calculada */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Target size={18} className="text-primary" />
          <h3 className="text-sm font-semibold">Meta Mensal</h3>
          <Badge variant="secondary" className="text-[10px]">
            Média 3m + {percentualCrescimento}%
          </Badge>
          {/* Botão de config */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto">
                <Settings size={12} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-3">
                <Label>% de Crescimento</Label>
                <Input 
                  type="number" 
                  value={percentualCrescimento}
                  onChange={handlePercentualChange}
                  min={0}
                  max={100}
                />
                <p className="text-[10px] text-muted-foreground">
                  Base: {mesesUsados.join(', ')}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <p className="text-2xl font-bold">{formatCurrency(metaCalculada)}</p>
        <p className="text-xs text-muted-foreground">
          Média base: {formatCurrency(media3Meses)}
        </p>
      </div>

      {/* Faturamento Atual */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Banknote size={18} className="text-emerald-500" />
          <h3 className="text-sm font-semibold">Faturamento Atual</h3>
        </div>
        <p className="text-2xl font-bold">{formatCurrency(faturamentoAtual)}</p>
        <p className={cn(
          "text-xs font-semibold",
          percentualAtingido >= 100 ? "text-emerald-600" : "text-muted-foreground"
        )}>
          {percentualAtingido.toFixed(1)}% da meta
        </p>
      </div>

      {/* Previsão Mensal */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={18} className="text-blue-500" />
          <h3 className="text-sm font-semibold">Previsão Mensal</h3>
        </div>
        <p className={cn(
          "text-2xl font-bold",
          statusMeta === 'acima' || statusMeta === 'atingida' ? "text-emerald-600" : "text-amber-600"
        )}>
          {formatCurrency(projecaoMensal)}
        </p>
        <p className={cn(
          "text-xs font-semibold",
          diferencaPrevisao >= 0 ? "text-emerald-600" : "text-amber-600"
        )}>
          {diferencaPrevisao >= 0 ? '+' : ''}{formatCurrency(diferencaPrevisao)} vs. meta
        </p>
      </div>
    </div>

    {/* Barra de Progresso */}
    <div className="mt-4">
      <Progress 
        value={Math.min(percentualAtingido, 100)} 
        className={cn(
          "h-3",
          percentualAtingido >= 100 ? "[&>div]:bg-emerald-500" :
          percentualAtingido >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-primary"
        )}
      />
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>Dia {diasDecorridos} de {diasTotais}</span>
        <span>Ritmo: {formatCurrency(mediaDiaria)}/dia</span>
      </div>
    </div>

    {/* Indicador Visual de Status */}
    <div className={cn(
      "mt-4 p-3 rounded-lg",
      statusMeta === 'atingida' ? "bg-emerald-100 dark:bg-emerald-900/20" :
      statusMeta === 'acima' ? "bg-blue-100 dark:bg-blue-900/20" :
      "bg-amber-100 dark:bg-amber-900/20"
    )}>
      <p className={cn(
        "text-sm font-medium",
        statusMeta === 'atingida' ? "text-emerald-700" :
        statusMeta === 'acima' ? "text-blue-700" : "text-amber-700"
      )}>
        {statusMeta === 'atingida' 
          ? '🎉 Meta atingida!'
          : statusMeta === 'acima'
            ? '✅ No ritmo para bater a meta'
            : '⚠️ Ritmo abaixo da meta'
        }
      </p>
    </div>
  </CardContent>
</Card>
```

---

## Fluxo Automático

| Etapa | Descrição |
|-------|-----------|
| 1 | Dashboard carrega |
| 2 | Busca pedidos PAGO dos últimos 3 meses (usando `COALESCE(paid_at, created_at)`) |
| 3 | Calcula média e aplica % de crescimento |
| 4 | Salva meta no banco automaticamente |
| 5 | Exibe comparativos: Meta vs. Faturamento vs. Previsão |

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova tabela `metas_mensais` |
| `src/hooks/useMetasMensais.ts` | Novo hook para CRUD de metas |
| `src/hooks/useDashboardData.ts` | Corrigir fallback `paid_at`, salvar meta, novos campos |
| `src/pages/Dashboard.tsx` | Card reformulado com 3 métricas + indicador visual |

---

## Critérios de Aceite

| Cenário | Resultado Esperado |
|---------|-------------------|
| Dashboard carrega | Meta calculada automaticamente (sem valor manual) |
| Não há histórico 3 meses | Usa `created_at` como fallback, mostra meta baseada nos dados disponíveis |
| Meta calculada | Persiste no banco, disponível após refresh |
| Previsão > Meta | Mostra "✅ No ritmo para bater a meta" em azul |
| Previsão < Meta | Mostra "⚠️ Ritmo abaixo da meta" em amarelo |
| Faturamento >= Meta | Mostra "🎉 Meta atingida!" em verde |
| Alterar % crescimento | Recalcula meta imediatamente |
| Histórico de metas | Disponível na tabela para análises futuras |

