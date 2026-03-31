

## Integração InfinitePay — Plano de Implementação

### Visão Geral do Fluxo

```text
Criar Pedido → Edge Function cria link InfinitePay → Link enviado via WhatsApp
                                                   ↓
                        InfinitePay confirma pagamento via Webhook
                                                   ↓
                     Edge Function Webhook atualiza status_pagamento → "PAGO"
```

### 1. Salvar o handle como secret

Armazenar `INFINITEPAY_HANDLE` = `delookii-confeccoes-769` como secret no projeto.

### 2. Criar Edge Function `create-infinitepay-link`

**Arquivo:** `supabase/functions/create-infinitepay-link/index.ts`

- Recebe: `pedido_id`, lista de itens (nome, quantidade, preco em centavos), nome/email/telefone do cliente
- Chama `POST https://api.infinitepay.io/invoices/public/checkout/links` com:
  - `handle`: secret `INFINITEPAY_HANDLE`
  - `order_nsu`: o `pedido_id` do sistema
  - `items`: itens do pedido
  - `webhook_url`: URL da edge function de webhook (passo 3)
  - `customer`: dados do cliente
- Retorna o link de checkout gerado
- Valida JWT do usuario autenticado

### 3. Criar Edge Function `infinitepay-webhook`

**Arquivo:** `supabase/functions/infinitepay-webhook/index.ts`

- Endpoint publico (sem validacao JWT — chamado pela InfinitePay)
- Recebe POST com `order_nsu`, `paid_amount`, `capture_method`, etc.
- Usa `order_nsu` para localizar o pedido na tabela `pedidos`
- Atualiza `status_pagamento` para `PAGO` usando service role client
- Trata idempotencia: se ja esta PAGO, ignora
- Responde `200 OK`

### 4. Alterar `NovoPedido.tsx`

Apos criar o pedido com sucesso:
1. Chamar `create-infinitepay-link` passando os dados do pedido
2. Incluir o link de pagamento na mensagem WhatsApp, substituindo/complementando a secao de PIX manual:

```
Para dar andamento, realize o pagamento pelo link:

🔗 *Link de Pagamento:* ${linkInfinitePay}

Ou via PIX manual:
🔑 *Chave PIX:* 40548049000106
...
```

### 5. Migração SQL (opcional)

Adicionar coluna para armazenar o link de pagamento e NSU da transacao:

```sql
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS infinitepay_link text,
ADD COLUMN IF NOT EXISTS infinitepay_nsu text;
```

### Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/functions/create-infinitepay-link/index.ts` |
| Criar | `supabase/functions/infinitepay-webhook/index.ts` |
| Editar | `src/pages/NovoPedido.tsx` |
| Migracao | Nova coluna `infinitepay_link` e `infinitepay_nsu` em `pedidos` |
| Secret | `INFINITEPAY_HANDLE` = `delookii-confeccoes-769` |

