

## Plano: Melhorias no Modal de Ajuste e Relatório de Saídas

### Resumo das Alterações
Duas melhorias solicitadas:
1. **Modal "Ajustar Estoque"**: Tornar o campo "Estoque Atual" editável
2. **Modal "Relatório de Saídas"**: Adicionar filtro de modelos com seleção múltipla

---

## 1. Modal "Ajustar Estoque" - Campo Editável

### Situação Atual
- "Estoque Atual" é somente leitura (exibe `item.quantidade`)
- "Novo Estoque" é editável
- "Diferença" é calculada como `novoEstoque - item.quantidade`

### Nova Lógica

| Campo | Comportamento |
|-------|---------------|
| **Estoque Atual** | Input numérico editável (>= 0) |
| **Novo Estoque** | Input numérico editável (>= 0) |
| **Diferença** | Somente leitura: `novoEstoque - estoqueAtualEditavel` |

### Regras de Inicialização e Sincronização
1. Ao abrir modal:
   - `estoqueAtualEditavel` = valor do banco (`item.quantidade`)
   - `novoEstoque` = valor do banco (`item.quantidade`)
   - `diferenca` = 0
   
2. Ao alterar "Estoque Atual":
   - Se "Novo Estoque" ainda não foi alterado manualmente → sincronizar `novoEstoque = estoqueAtualEditavel`
   - Se "Novo Estoque" já foi alterado → não sobrescrever

3. Ao salvar:
   - `delta = novoEstoque - estoqueAtualEditavel`
   - Chamar RPC com `novaQuantidade = novoEstoque` (mantém lógica atual)

### Arquivo Impactado
- `src/components/estoque/AjusteEstoqueModal.tsx`

### Alterações de Estado

**Antes:**
```typescript
const [novaQuantidade, setNovaQuantidade] = useState('');
const diferenca = novaQtd - item.quantidade;
```

**Depois:**
```typescript
const [estoqueAtualEditavel, setEstoqueAtualEditavel] = useState('');
const [novaQuantidade, setNovaQuantidade] = useState('');
const [novoEstoqueManualmenteAlterado, setNovoEstoqueManualmenteAlterado] = useState(false);
const diferenca = novaQtd - estoqueAtualInt;
```

---

## 2. Relatório de Saídas - Filtro de Modelos

### Situação Atual
Filtros existentes:
- Data Inicial / Data Final
- Local
- Tipo de Saída

### Nova Funcionalidade
Adicionar filtro "Modelos" com:
- MultiSelect com busca (autocomplete)
- Debounce de 300ms para performance
- Exibição: "Nome - Código" (ex: "Short Alfaiataria - 163")
- Placeholder: "Todos os modelos"
- Contador: "X modelo(s) selecionado(s)"

### Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useRelatorioSaidas.ts` | Adicionar `modeloIds?: string[]` ao filtro e à query |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Adicionar UI do filtro de modelos |

### Novo Hook: useModelosParaFiltro
Buscar modelos com debounce para autocomplete:

```typescript
export function useModelosParaFiltro(searchTerm: string) {
  return useQuery({
    queryKey: ['modelos-para-filtro', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('estoque_itens')
        .select('id, nome, categoria')
        .order('nome')
        .limit(50);
      
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,categoria.ilike.%${searchTerm}%`);
      }
      
      return data;
    },
    enabled: searchTerm.length >= 2 || searchTerm === '',
  });
}
```

### Alteração na Query de Movimentações
Adicionar filtro por `item_id`:

```typescript
// No hook useRelatorioSaidas
if (filtros.modeloIds && filtros.modeloIds.length > 0) {
  query = query.in('item_id', filtros.modeloIds);
}
```

### UI do Filtro de Modelos (Popover com Busca + Checkboxes)

```text
┌─────────────────────────────────────────────────┐
│  Modelos                                        │
│  ┌─────────────────────────────────────────┐    │
│  │ 2 modelo(s) selecionado(s)          ▼  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ 🔍 Buscar modelo...                     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ☑ Short Alfaiataria - 163                     │
│  ☑ Short Jeans Cargo - 497                     │
│  ☐ Calça Pantalona - 285                       │
│  ☐ Saia Midi - 412                             │
│  ...                                            │
│                                                 │
│  [Limpar seleção]                               │
└─────────────────────────────────────────────────┘
```

### Interface FiltrosSaidas Atualizada

```typescript
export interface FiltrosSaidas {
  dataInicial: Date;
  dataFinal: Date;
  localId?: string;
  tiposMovimento?: string[];
  modeloIds?: string[];  // NOVO
}
```

---

## Resumo de Arquivos

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/components/estoque/AjusteEstoqueModal.tsx` | Adicionar estado editável para "Estoque Atual" |
| `src/hooks/useRelatorioSaidas.ts` | Adicionar filtro `modeloIds` + novo hook `useModelosParaFiltro` |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Adicionar UI do filtro de modelos |

---

## Critérios de Aceite

### Modal Ajustar Estoque
- ✅ Campo "Estoque Atual" é editável
- ✅ Diferença reage corretamente quando mudo qualquer input
- ✅ Modal sempre inicia com diferença 0
- ✅ Salvar funciona e registra delta consistente

### Relatório de Saídas
- ✅ Filtro de modelos com busca e seleção múltipla
- ✅ Lista e totais respeitam o filtro de modelos
- ✅ Sem seleção = comportamento anterior
- ✅ Performance: busca com debounce, limite de 50 resultados

