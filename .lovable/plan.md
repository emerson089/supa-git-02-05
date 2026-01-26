
## Plano: Corrigir Campo de Busca com Debounce

### Problema Identificado

O campo de busca na tela "Estoque por Local" está atualizando o filtro instantaneamente a cada tecla digitada. Isso causa:
- Dificuldade em digitar números em sequência (ex: "170")
- Re-renders excessivos durante a digitação
- Possível travamento/lag na interface

### Solução

Aplicar **debounce** de 300ms no valor de busca, permitindo que você termine de digitar antes do filtro ser aplicado.

---

### Alterações Técnicas

**Arquivo**: `src/pages/Transferencias.tsx`

#### 1. Adicionar import do hook
```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
```

#### 2. Criar valor debounced do estado de busca
Após a declaração do estado `searchEstoque` (linha 62):
```typescript
const [searchEstoque, setSearchEstoque] = useState('');
const debouncedSearchEstoque = useDebouncedValue(searchEstoque, 300);
```

#### 3. Atualizar o useMemo do filtro
Alterar de `searchEstoque` para `debouncedSearchEstoque` na dependência (linhas 117-124):
```typescript
const estoqueFiltrado = useMemo(() => {
  if (!debouncedSearchEstoque.trim()) return estoqueDetalhado;
  const termo = debouncedSearchEstoque.toLowerCase();
  return estoqueDetalhado.filter(item =>
    item.itemNome.toLowerCase().includes(termo) ||
    item.itemCodigo.toLowerCase().includes(termo)
  );
}, [estoqueDetalhado, debouncedSearchEstoque]);
```

---

### Comportamento Esperado

| Antes | Depois |
|-------|--------|
| Filtra a cada tecla digitada | Aguarda 300ms após parar de digitar |
| Interfere na digitação de números | Digitação fluida sem interrupções |
| Re-renders excessivos | Re-render único após debounce |

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Transferencias.tsx` | Adicionar import + debounce no filtro |

---

### Padrão Existente

Esta é a mesma solução utilizada em outros módulos do projeto:
- `src/components/production/ModeloSelector.tsx` (linha 49)
- Debounce de 300ms é o padrão do projeto
