

## Plano: Integração Produção ↔ Estoque com Custo Médio (Incremental e Seguro)

### Resumo Executivo

Este plano implementa a integração entre Produção e Estoque de forma **100% não-destrutiva**, preservando todos os dados existentes e mantendo o sistema funcionando durante a migração.

### Auditoria do Sistema Atual

#### Tabelas Analisadas

| Tabela | Colunas Relevantes | Status |
|--------|-------------------|--------|
| `producao` | `integrado_estoque` (bool), `quantidade`, `modelo_nome_cache` | 11 lotes, 1 já integrado |
| `estoque_itens` | `quantidade`, `preco_unitario` (preço venda), `nome` | 145 produtos acabados |
| `estoque_movimentacoes` | `tipo`, `quantidade`, `preco_aplicado`, `producao_id` | Já tem `preco_aplicado` |
| `lote_custos_config` | `metros_corte`, `valor_metro`, `preco_venda` | Config de custos do tecido |
| `lote_custos_itens` | `tipo`, `valor_unitario`, `is_paid` | Itens de custo por peça |

#### Fluxo Atual de Venda

```text
NovoPedido.tsx (linha 220-228):
├── getItemById(item.produtoId)
├── updateItem(produtoId, { quantidade: novaQuantidade })
└── Não registra movimentação com custo
```

**Problema**: A venda atualiza quantidade mas não registra `custo_aplicado`, impossibilitando cálculo de COGS.

#### Fluxo Atual de Integração (Automático)

```text
Index.tsx (linha 210-246):
└── onMoveNext para "Vendas"
    ├── Chama integrarProducao()
    ├── Marca integrado_estoque = true
    └── Não registra custo unitário do lote
```

**Problema**: Integração automática sem custo; uma vez movido, não há como rastrear custo médio.

### Migrações de Banco (ADITIVAS)

Todas as alterações são **ADD COLUMN** com defaults seguros:

#### A) Tabela `estoque_itens`

```sql
-- Custo médio ponderado (NULL = desconhecido)
ALTER TABLE estoque_itens 
ADD COLUMN IF NOT EXISTS custo_medio NUMERIC NULL;

-- Quantidade que possui custo conhecido
ALTER TABLE estoque_itens 
ADD COLUMN IF NOT EXISTS qtd_com_custo NUMERIC DEFAULT 0;
```

**Impacto**: Produtos existentes ficam com `custo_medio = NULL` e `qtd_com_custo = 0` (sem impacto).

#### B) Tabela `producao`

```sql
-- Data/hora de envio para estoque
ALTER TABLE producao 
ADD COLUMN IF NOT EXISTS posted_to_stock_at TIMESTAMPTZ NULL;

-- Custo unitário calculado do lote
ALTER TABLE producao 
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NULL;

-- Custo total do lote
ALTER TABLE producao 
ADD COLUMN IF NOT EXISTS total_cost NUMERIC NULL;
```

**Impacto**: Lotes existentes ficam com NULL (sem impacto).

#### C) Tabela `estoque_movimentacoes`

```sql
-- Tipo de origem da movimentação
ALTER TABLE estoque_movimentacoes 
ADD COLUMN IF NOT EXISTS source_type TEXT NULL;  -- 'LOT', 'SALE', 'ADJUSTMENT'

-- ID da origem (lote ou pedido)
ALTER TABLE estoque_movimentacoes 
ADD COLUMN IF NOT EXISTS source_id UUID NULL;

-- Custo aplicado (diferente de preco_aplicado que é preço de venda)
ALTER TABLE estoque_movimentacoes 
ADD COLUMN IF NOT EXISTS custo_aplicado NUMERIC NULL;
```

**Impacto**: Movimentações existentes ficam com NULL (sem impacto).

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useEnviarParaEstoque.ts` | Hook para integração manual lote→estoque com custo médio |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/entities/Producao.ts` | Adicionar tipos `posted_to_stock_at`, `unit_cost`, `total_cost` |
| `src/hooks/useEstoqueData.ts` | Adicionar `custoMedio`, `qtdComCusto` no mapeamento |
| `src/components/production/CustosLoteModal.tsx` | Seção "Integração com Estoque" + botão "Enviar para Estoque" |
| `src/components/production/ProductionCard.tsx` | Badge atualizado para indicar status de integração |
| `src/pages/Index.tsx` | **Remover** integração automática ao mover para "Vendas" |
| `src/pages/NovoPedido.tsx` | Registrar movimentação de saída com `custo_aplicado` |
| `src/hooks/useDashboardData.ts` | Adicionar KPIs de COGS e Lucro Bruto (opcional, fase 2) |

### Fluxo 1: Enviar Lote para Estoque (Manual)

#### Localização no UI

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Custos do Lote #1019                                                │
│ PLS Short Saia jeans Plus Size Lycra 560 - 252 peças               │
├─────────────────────────────────────────────────────────────────────┤
│  [Seções existentes: Tecido, Custos, Resumo]                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Integração com Estoque                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Status: ⚠️ Não enviado ao estoque                                  │
│                                                                     │
│  Modelo: PLS Short Saia jeans Plus Size Lycra 560                  │
│  (será criado se não existir)                                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Preview do Custo Médio                                      │   │
│  │ ───────────────────────────────────────────────────────────  │   │
│  │ Estoque atual:       0 pç × R$ --                          │   │
│  │ + Este lote:       252 pç × R$ 28,50 (custo lote)          │   │
│  │ = Novo estoque:    252 pç × R$ 28,50 (custo médio)         │   │
│  │                                                             │   │
│  │ Obs: Apenas qtd_com_custo entra no cálculo de valor        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [🚀 Enviar para Estoque]                                          │
│                                                                     │
│  ⚠️ Ação irreversível. O estoque será atualizado imediatamente.    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Condições de Exibição do Botão

- Lote **deve estar** na coluna "Vendas/Estoque"
- `posted_to_stock_at` **deve ser NULL**
- Se `integrado_estoque = true` mas `posted_to_stock_at = NULL`: exibir "Já integrado (antes do sistema de custos)"

#### Validação de Idempotência

Antes de executar:

```typescript
// 1. Verificar posted_to_stock_at
if (lote.posted_to_stock_at) {
  throw new Error('Lote já enviado ao estoque');
}

// 2. Verificar movimentação duplicada
const { data: movExistente } = await supabase
  .from('estoque_movimentacoes')
  .select('id')
  .eq('source_type', 'LOT')
  .eq('source_id', lote.id)
  .maybeSingle();

if (movExistente) {
  throw new Error('Movimentação já existe para este lote');
}
```

#### Cálculo do Custo Médio

```typescript
async function enviarParaEstoque(loteId: string) {
  // 1. Buscar lote
  const lote = await getLote(loteId);
  
  // 2. Calcular custo total do lote
  const custoTecido = config.metros_corte * config.valor_metro;
  const custoItens = itens.reduce((sum, i) => sum + (i.valor_unitario * lote.quantidade), 0);
  const custoTotal = custoTecido + custoItens;
  const custoUnitario = custoTotal / lote.quantidade;
  
  // 3. Buscar/criar produto no estoque
  let produto = await buscarPorNome(lote.modelo_nome_cache);
  if (!produto) {
    produto = await criarProduto({ ... });
  }
  
  // 4. Calcular novo custo médio
  const oldQty = produto.qtd_com_custo || 0;
  const oldAvg = produto.custo_medio;  // pode ser NULL
  const lotQty = lote.quantidade;
  
  let newAvg: number;
  if (oldQty === 0 || oldAvg === null) {
    // Primeira entrada com custo conhecido
    newAvg = custoUnitario;
  } else {
    // Média ponderada
    newAvg = (oldQty * oldAvg + lotQty * custoUnitario) / (oldQty + lotQty);
  }
  
  const newQtdComCusto = oldQty + lotQty;
  
  // 5. Atualizar estoque_itens
  await supabase
    .from('estoque_itens')
    .update({
      quantidade: produto.quantidade + lotQty,
      custo_medio: newAvg,
      qtd_com_custo: newQtdComCusto
    })
    .eq('id', produto.id);
  
  // 6. Registrar movimentação
  await supabase
    .from('estoque_movimentacoes')
    .insert({
      user_id: user.id,
      item_id: produto.id,
      tipo: 'entrada',
      quantidade: lotQty,
      motivo: `Entrada via Produção - Lote #${lote.id_producao}`,
      producao_id: lote.id,
      custo_aplicado: custoUnitario,
      source_type: 'LOT',
      source_id: lote.id
    });
  
  // 7. Marcar lote como enviado
  await supabase
    .from('producao')
    .update({
      posted_to_stock_at: new Date().toISOString(),
      unit_cost: custoUnitario,
      total_cost: custoTotal,
      integrado_estoque: true
    })
    .eq('id', lote.id);
}
```

### Fluxo 2: Saída na Venda (COGS)

#### Alteração em NovoPedido.tsx

```typescript
// Linha ~220-228 - Subtrair do estoque
for (const item of items) {
  const produto = getItemById(item.produtoId);
  if (produto) {
    const novaQuantidade = produto.quantidade - item.quantidade;
    
    // Atualizar quantidade
    updateItem(item.produtoId, { quantidade: novaQuantidade });
    
    // NOVO: Registrar movimentação com custo aplicado
    await supabase.from('estoque_movimentacoes').insert({
      user_id: user.id,
      item_id: item.produtoId,
      tipo: 'saida',
      quantidade: item.quantidade,
      motivo: 'Venda',
      custo_aplicado: produto.custoMedio,  // pode ser NULL
      source_type: 'SALE',
      source_id: novoPedido.id  // ID do pedido criado
    });
  }
}
```

**Observação**: Se `custo_aplicado` for NULL, o COGS desse item não será contabilizado (comportamento esperado para estoque antigo).

### Fluxo 3: Remoção da Integração Automática

#### Alteração em Index.tsx

```typescript
// Linha 210-246 - REMOVER este bloco:
// if (newStage === 'Vendas' && !lot.integrado_estoque) {
//   integrarProducao(...);
//   ...
// }

// SUBSTITUIR por:
if (newStage === 'Vendas') {
  toast.success('Lote movido para Vendas. Abra os Custos para enviar ao estoque.');
}
```

### UI: Badge no ProductionCard

```typescript
// Linha 152-157 - Atualizar lógica do badge:
{lot.posted_to_stock_at ? (
  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 ...">
    <PackageCheck size={10} className="mr-1" />
    Estoque ✓
  </Badge>
) : lot.integrado_estoque ? (
  <Badge variant="outline" className="bg-amber-50 text-amber-600 ...">
    <Package size={10} className="mr-1" />
    Integrado (sem custo)
  </Badge>
) : null}
```

### Dashboard: KPIs de Lucratividade (Fase 2 - Opcional)

Se o sistema atual estiver funcionando sem quebrar:

```typescript
// COGS do período
const { data: saidasComCusto } = await supabase
  .from('estoque_movimentacoes')
  .select('quantidade, custo_aplicado')
  .eq('source_type', 'SALE')
  .not('custo_aplicado', 'is', null)
  .gte('created_at', startDate)
  .lte('created_at', endDate);

const cogs = saidasComCusto.reduce(
  (sum, m) => sum + (m.quantidade * m.custo_aplicado), 
  0
);

// Lucro bruto (parcial)
const lucroBruto = faturamento - cogs;

// Aviso de dados parciais
const totalSaidas = await countMovimentacoes('SALE', periodo);
const saidasSemCusto = totalSaidas - saidasComCusto.length;
if (saidasSemCusto > 0) {
  // Exibir: "COGS parcial: {saidasSemCusto} itens sem custo conhecido"
}
```

### Critérios de Aceite

| # | Critério | Verificação |
|---|----------|-------------|
| 1 | Nada quebra | Estoque e pedidos funcionam como antes |
| 2 | Migração aditiva | Apenas ADD COLUMN, sem remoções |
| 3 | Idempotência | Botão bloqueado após envio; duplicação impossível |
| 4 | Custo NULL | Produtos antigos mantêm `custo_medio = NULL` |
| 5 | COGS parcial | Dashboard indica quando há itens sem custo |
| 6 | Manual | Integração requer clique no botão, não é automática |
| 7 | Preview | Modal mostra cálculo antes de confirmar |

### Ordem de Implementação

```text
Fase 1 (Essencial):
├── 1. Migração SQL (aditiva)
├── 2. Atualizar tipos TypeScript
├── 3. Hook useEnviarParaEstoque
├── 4. Seção no CustosLoteModal
├── 5. Badge atualizado no ProductionCard
└── 6. Remover integração automática em Index.tsx

Fase 2 (Após validação):
├── 7. Registrar custo na saída (NovoPedido.tsx)
└── 8. KPIs de COGS no Dashboard
```

### Rollback

Se algo der errado, as colunas adicionadas podem ser ignoradas sem afetar o sistema:
- `custo_medio`, `qtd_com_custo`: não são lidas pelo código atual
- `posted_to_stock_at`, `unit_cost`, `total_cost`: não são lidas pelo código atual
- `source_type`, `source_id`, `custo_aplicado`: não são lidas pelo código atual

O código pode continuar funcionando com a lógica antiga até que as novas features sejam validadas.

