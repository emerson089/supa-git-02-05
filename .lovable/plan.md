

## Correções: Nomes Completos + Vendas Semanais (por produto_id)

### Parte 1: Nome do modelo cortado no card desktop

No `ProductCard.tsx`, linha 147, a classe `truncate` corta nomes longos. Trocar por `line-clamp-2`.

| Arquivo | Alteração |
|---|---|
| `src/components/estoque/ProductCard.tsx` | Linha 147: trocar `truncate` por `line-clamp-2` no `<h3>` do nome |

### Parte 2: Vendas semanais usando produto_id

Criar hook `useVendasSemana` que busca `pedido_itens` da semana atual (segunda 00:00 a domingo 23:59), agrupando por `produto_id` (UUID) e somando `quantidade`. Usar `produto_id` garante que renomear um modelo não quebra a contagem.

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/hooks/useVendasSemana.ts` (novo) | Hook que calcula segunda-feira da semana, busca `pedidos` com `pedido_itens(produto_id, quantidade)` no periodo, agrupa por `produto_id` e retorna `Map<string, number>` |
| `src/components/estoque/ProductCard.tsx` | 1) `truncate` -> `line-clamp-2`. 2) Adicionar prop `vendasSemana?: number`. 3) Substituir linha "Localização" por "Vendidas Semana" com valor |
| `src/components/estoque/MobileProductCard.tsx` | 1) Adicionar prop `vendasSemana?: number`. 2) Substituir seção "Localização" (MapPin) por "Vendidas Semana" (ShoppingBag) |
| `src/pages/Estoque.tsx` | Importar `useVendasSemana`, passar valor para cada card: `vendasSemana={vendasMap?.get(item.id) || 0}` |

### Detalhes Tecnicos

**Hook useVendasSemana:**

```typescript
const hoje = new Date();
const diaSemana = hoje.getDay();
const segunda = new Date(hoje);
segunda.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
segunda.setHours(0, 0, 0, 0);

const domingo = new Date(segunda);
domingo.setDate(segunda.getDate() + 6);
domingo.setHours(23, 59, 59, 999);

// Busca pedidos da semana com itens
const { data } = await supabase
  .from('pedidos')
  .select('pedido_itens(produto_id, quantidade)')
  .gte('created_at', segunda.toISOString())
  .lte('created_at', domingo.toISOString());

// Agrupa por produto_id (UUID do estoque_itens)
const map = new Map<string, number>();
data?.forEach(pedido => {
  pedido.pedido_itens?.forEach(item => {
    if (!item.produto_id) return; // ignora itens manuais sem link
    map.set(item.produto_id, (map.get(item.produto_id) || 0) + item.quantidade);
  });
});
return map;
```

**Match no Estoque.tsx:**

```typescript
// item.id é o UUID do estoque_itens
// produto_id no pedido_itens referencia esse mesmo UUID
vendasSemana={vendasMap?.get(item.id) || 0}
```

**ProductCard -- substituir Localização:**

```
// Antes:
LOCALIZAÇÃO    Estoque Produção

// Depois:
VENDIDAS SEMANA    12 peças   (em azul/indigo)
// ou se 0:
VENDIDAS SEMANA    0 peças    (em cinza)
```

**MobileProductCard -- substituir MapPin:**

```
// Antes:
MapPin icon + "Estoque Produção"

// Depois:
ShoppingBag icon + "12 vendidas na semana" (em azul)
```

### Comportamento

- Reseta automaticamente toda segunda-feira (a query filtra pelo periodo corrente)
- Renomear modelo nao afeta a contagem (match por UUID, nao por nome)
- Itens manuais sem `produto_id` sao ignorados na contagem
- Nenhuma alteracao no banco de dados necessaria

