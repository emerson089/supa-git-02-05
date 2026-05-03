## Diagnóstico

Você está logado como admin (confirmado pelos logs de auth e pelos KPIs aparecendo com valores reais). O problema está na **arquitetura da paginação dos filtros CRM** quando o resultado é muito grande:

### O que acontece com "Inativos no Mês"

- Você tem 1.197 clientes e 5.008 pedidos.
- Pelo SQL no banco, **1.043 clientes** deveriam aparecer no filtro (754 com última compra antes do mês + 289 que nunca compraram).
- O hook `useClientesCRMFilter` calcula corretamente esses 1.043 IDs.
- Mas então `useClientesPaginated` recebe esses 1.043 UUIDs em `filterByIds` e tenta um `.in('id', filterByIds)` no Supabase. Isso gera uma URL de ~38KB, **acima do limite de URL do PostgREST (~8KB)**, então a query falha silenciosamente ou retorna vazio/incompleto.
- Resultado: a tela mostra "Nenhum cliente encontrado" e os KPIs do topo zeram quando a página filtrada fica vazia.

### Bugs adicionais encontrados na análise

1. **Falta de `.order()`** em `fetchAllPedidosMinimal` e `fetchAllClientesMinimal` (linhas 167-189 de `useClientesCRMBatch.ts`): paginação sem `ORDER BY` no Postgres não garante ordem estável entre páginas, podendo retornar registros duplicados ou perdidos com 5.008 pedidos.
2. **Limite de 1000 no `dataQuery`** sem `.range()` em `useClientesPaginated` quando `filterByIds` está ativo: mesmo se o `.in()` coubesse, só retornaria 1.000 linhas.
3. **Filtros não-CRM ("Novos", "Pendentes" com lista grande, etc.)** sofrem do mesmo problema sempre que `filterByIds.length > ~200`.

## Plano de correção

### 1. Estabilizar paginação das fontes de dados (`useClientesCRMBatch.ts`)
Adicionar `.order('id', { ascending: true })` em `fetchAllPedidosMinimal` e `fetchAllClientesMinimal` para garantir páginas estáveis e sem duplicatas/buracos.

### 2. Refatorar `useClientesPaginated` para suportar `filterByIds` grande
Quando `filterByIds` tiver mais de ~200 IDs:
- **Não enviar `.in('id', filterByIds)` ao Supabase**.
- Em vez disso, buscar todos os clientes do user (paginando em chunks de 1000 com `.order('id')`), depois filtrar localmente pelo `Set(filterByIds)` em memória, ordenar pela ordem do array `filterByIds` (preservando a prioridade do CRM) e paginar localmente.
- Para listas pequenas (<200 IDs), manter o comportamento atual (`.in()`) que é mais eficiente.

### 3. Aplicar o mesmo limite de chunks à query de contagem (`countQuery`)
Para que o "Total Clientes" no header e a paginação reflitam o número real (1.043 no caso), calcular `count` a partir do array filtrado localmente quando o caminho do chunk for usado.

### 4. Validação manual
Após a correção, abrir `/clientes`, clicar em "Inativos no Mês", e confirmar:
- Card "TOTAL CLIENTES" mostra ~1.043
- Lista renderiza a primeira página com 24 clientes
- Paginação funciona até a última página
- Filtros menores (Novos, VIP) continuam funcionando como antes

### Detalhes técnicos

```
useClientesPaginated:
  if (filterByIds && filterByIds.length > 0):
      if (filterByIds.length <= 200):
          # caminho atual com .in()
      else:
          # buscar todos os clientes do user em chunks de 1000 ordenados por id
          # filtrar localmente: clientes.filter(c => filterByIdsSet.has(c.id))
          # ordenar por idToIndexMap (mantendo prioridade do CRM)
          # paginar localmente, count = array filtrado .length
```

Sem alterações de RLS ou de schema do banco — é apenas correção do hook de leitura no frontend. Nenhuma mudança afeta vendedores; o admin continua sendo o único a ver seus próprios dados.

## Posso aplicar este plano?
