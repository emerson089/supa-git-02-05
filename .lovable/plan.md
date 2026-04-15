

## Plano: Corrigir valor incorreto na mensagem WhatsApp + Erros de build

### Problema identificado

Na `NovoPedido.tsx`, a mensagem WhatsApp (linha 312) usa a variável local `valorTotal` computada no render, mas deveria usar o valor retornado pelo banco de dados após a criação do pedido (`pedidoCriado.valorTotal`). Isso garante que o valor enviado é sempre o mesmo que está salvo no sistema.

### Correções

**1. `src/pages/NovoPedido.tsx`** — Usar `pedidoCriado.valorTotal` na construção da mensagem WhatsApp (tanto para cliente quanto para gerência):

```typescript
// Antes (linha 312):
const valorFormatado = valorTotal.toLocaleString(...)

// Depois:
const valorFormatado = pedidoCriado.valorTotal.toLocaleString(...)
```

Também usar `pedidoCriado.totalPecas` na mensagem para gerência (linha 382).

**2. `src/components/clientes/TransmissaoManagerModal.tsx`** (linha 302) — Corrigir erro TS2769: tipo `"envios_agendados"` não é assignável. Ajustar a chamada `from()` para o nome de tabela correto (`catalogo_envios`).

**3. `src/components/estoque/MobileModeloPadronizadoCard.tsx`** (linha 315) — Adicionar import do `Loader2` de `lucide-react`.

### Arquivos alterados
- `src/pages/NovoPedido.tsx`
- `src/components/clientes/TransmissaoManagerModal.tsx`
- `src/components/estoque/MobileModeloPadronizadoCard.tsx`

