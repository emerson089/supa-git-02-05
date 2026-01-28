

## Plano: Corrigir Acesso do Vendedor à Aba Estoque por Local

### Diagnóstico

O vendedor não vê os produtos porque o frontend está **buscando um local do tipo 'loja'**, mas a configuração em `user_locations` dá acesso a uma **'banca'**:

| Configuração | Valor |
|--------------|-------|
| Vendedor | `emerson089@gmail.com` |
| Local permitido | "Banca da Feira" (tipo: `banca`) |
| Owner do local | Admin (`delockjeans@gmail.com`) |
| Estoque no local | 25+ produtos com quantidade > 0 |

**Problema no código** (Transferencias.tsx, linha 91):
```typescript
// Procura apenas 'loja', ignora 'banca'
const allowedLoja = userLocations.find(ul => ul.localTipo === 'loja' && ul.canView);
```

Como o vendedor só tem acesso a uma "banca", a variável `allowedLoja` é `undefined`, e `lojaId` fica `null`.

---

### Solução

Modificar a lógica de seleção de local para aceitar **qualquer tipo de local permitido** (loja, banca, ou central), priorizando por ordem de preferência.

---

### Alterações Técnicas

#### Arquivo: `src/pages/Transferencias.tsx`

**Modificar linhas 87-99** - Lógica de seleção do local para o vendedor:

```typescript
// Encontrar local - para vendedor, usar o primeiro local permitido
// Prioridade: loja > banca > central
const selectedLocal = useMemo(() => {
  if (isVendedor) {
    // Vendedor: buscar primeiro local permitido (priorizar loja, depois banca)
    const allowedLocations = userLocations.filter(ul => ul.canView);
    
    // Tentar primeiro uma 'loja', depois 'banca', depois qualquer outro
    const priorityOrder = ['loja', 'banca', 'central'];
    for (const tipo of priorityOrder) {
      const found = allowedLocations.find(ul => ul.localTipo === tipo);
      if (found) {
        return locais.find(l => l.id === found.localId) || null;
      }
    }
    
    // Fallback: usar primeiro local permitido
    if (allowedLocations.length > 0) {
      return locais.find(l => l.id === allowedLocations[0].localId) || null;
    }
    
    return null;
  }
  
  // Admin/Gerente: usar qualquer loja ou banca
  return locais.find(l => l.tipo === 'loja' || l.tipo === 'banca') || null;
}, [locais, isVendedor, userLocations]);

const lojaId = selectedLocal?.id || null;
const lojaNome = selectedLocal?.nome || 'Local';
```

#### Atualizar nome da variável

Renomear `lojaLocal` para `selectedLocal` e `lojaNome` para refletir que pode ser qualquer tipo de local.

---

### Resultado Esperado

Após a correção:

| Antes | Depois |
|-------|--------|
| `lojaLocal = null` | `selectedLocal = { id: "e1e0b6df...", nome: "Banca da Feira" }` |
| `lojaId = null` | `lojaId = "e1e0b6df-3dc3-4eae-a84b-300b4f0f1031"` |
| `estoqueDetalhado = []` | `estoqueDetalhado = [25+ produtos]` |
| Mensagem "Nenhum produto" | Lista de produtos visível |

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Transferencias.tsx` | Corrigir lógica de seleção de local para aceitar 'banca' |

---

### Critérios de Aceite

| Cenário | Resultado Esperado |
|---------|-------------------|
| Vendedor com acesso a "banca" | Ver produtos da banca |
| Vendedor com acesso a "loja" | Ver produtos da loja |
| Vendedor sem acesso configurado | Ver alerta "Acesso não configurado" |
| Admin/Gerente | Ver qualquer local disponível |

