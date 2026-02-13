

## Correcao: Filtro "Venda / Loja" no Relatorio de Saidas

### Problema

O filtro "Venda / Loja" busca apenas movimentacoes do tipo `VENDA_FEIRA`, mas as vendas na loja sao registradas como `AJUSTE_SAIDA` com `tipo_ajuste_id` de um tipo que tem `conta_como_venda=true`. Resultado: filtro retorna vazio mesmo com 35 vendas no periodo.

### Solucao

Quando o usuario selecionar "Venda / Loja" no filtro de Tipo de Saida, a query tambem deve incluir registros `AJUSTE_SAIDA` cujo `tipo_ajuste_id` pertenca a um tipo de ajuste com `conta_como_venda=true`.

### Logica da Query Atualizada

```text
Se tiposSelecionados inclui "VENDA_FEIRA":
  1. Buscar IDs dos tipos_ajuste com conta_como_venda = true
  2. Query: tipo IN (tipos selecionados + AJUSTE_SAIDA) 
     OU (tipo = AJUSTE_SAIDA AND tipo_ajuste_id IN (ids_conta_como_venda))
  
  Como o Supabase nao suporta OR complexo facilmente, 
  a abordagem sera:
  - Remover VENDA_FEIRA dos tipos da query
  - Fazer 2 queries separadas e unir os resultados:
    Query 1: tipos normais selecionados (sem VENDA_FEIRA)
    Query 2: tipo = VENDA_FEIRA OR (tipo = AJUSTE_SAIDA AND tipo_ajuste_id IN ids_venda)
  
  OU mais simples:
  - Buscar todos os tipos selecionados normalmente
  - Quando VENDA_FEIRA esta selecionado, adicionar AJUSTE_SAIDA 
    aos tipos e filtrar no JS os AJUSTE_SAIDA que nao tem 
    conta_como_venda
```

A abordagem mais simples e robusta:

1. Buscar os `tipo_ajuste_id` que tem `conta_como_venda=true` (ja disponivel via `useTiposAjusteParaFiltro`)
2. Quando `VENDA_FEIRA` esta nos tipos selecionados, adicionar `AJUSTE_SAIDA` na lista de tipos da query
3. Apos receber os resultados, manter apenas:
   - Todos os registros dos tipos selecionados originalmente
   - AJUSTE_SAIDA somente se `tipo_ajuste_id` esta na lista de "conta_como_venda"
4. Para os AJUSTE_SAIDA que sao vendas, mostrar o label "Venda / Loja" em vez de "Ajuste Estoque"

### Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useRelatorioSaidas.ts` | Alterar a logica de filtragem por tipo: quando VENDA_FEIRA esta selecionado, incluir AJUSTE_SAIDA na query e filtrar no pos-processamento. Buscar tipos_ajuste com conta_como_venda=true para identificar quais AJUSTE_SAIDA sao vendas. Atualizar o label desses registros para "Venda / Loja" |

### Detalhes Tecnicos

No `useRelatorioSaidas`, dentro do `queryFn`:

```typescript
// 1. Verificar se VENDA_FEIRA esta nos tipos selecionados
const incluiVendaLoja = tiposParaFiltrar.includes('VENDA_FEIRA');

// 2. Se sim, buscar IDs de tipos_ajuste com conta_como_venda
let idsContaComoVenda: string[] = [];
if (incluiVendaLoja) {
  const { data: tiposVenda } = await supabase
    .from('tipos_ajuste_estoque')
    .select('id')
    .eq('user_id', user.id)
    .eq('conta_como_venda', true);
  idsContaComoVenda = tiposVenda?.map(t => t.id) || [];
  
  // Adicionar AJUSTE_SAIDA aos tipos da query se nao estiver
  if (!tiposParaFiltrar.includes('AJUSTE_SAIDA')) {
    tiposParaFiltrar = [...tiposParaFiltrar, 'AJUSTE_SAIDA'];
  }
}

// 3. Fazer a query normal com os tipos expandidos

// 4. Pos-processamento: filtrar AJUSTE_SAIDA indesejaveis
// Se o usuario NAO selecionou AJUSTE_SAIDA originalmente,
// manter apenas os que tem conta_como_venda
let movFiltradas = movimentacoes;
if (incluiVendaLoja && !filtros.tiposMovimento?.includes('AJUSTE_SAIDA')) {
  movFiltradas = movimentacoes.filter(m => 
    m.tipo !== 'AJUSTE_SAIDA' || 
    idsContaComoVenda.includes(m.tipo_ajuste_id)
  );
}

// 5. Para os AJUSTE_SAIDA que sao vendas, usar label "Venda / Loja"
// No mapeamento de saidas:
const tipoLabel = (m.tipo === 'AJUSTE_SAIDA' && 
  idsContaComoVenda.includes(m.tipo_ajuste_id))
  ? 'Venda / Loja'
  : TIPO_LABELS[m.tipo] || m.tipo;
```

### Cenarios cobertos

- **Usuario seleciona so "Venda / Loja"**: busca VENDA_FEIRA + AJUSTE_SAIDA com conta_como_venda. Ambos aparecem com label "Venda / Loja"
- **Usuario seleciona "Ajuste Estoque" + "Venda / Loja"**: busca AJUSTE_SAIDA (todos) + VENDA_FEIRA. Os AJUSTE_SAIDA com conta_como_venda mostram label "Venda / Loja", os demais "Ajuste Estoque"
- **Usuario nao seleciona nada (todos)**: comportamento padrao, todos os tipos sao buscados. AJUSTE_SAIDA com conta_como_venda continua mostrando "Ajuste Estoque" (sem alteracao de label, pois o filtro nao foi explicitamente selecionado)
- **Filtro de Tipo de Ajuste**: continua funcionando normalmente como filtro adicional

