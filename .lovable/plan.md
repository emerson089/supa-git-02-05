

## Reativar Link InfinitePay na Mensagem WhatsApp

### O que será feito

Após criar o pedido, chamar a Edge Function `create-infinitepay-link` para gerar o link de checkout e incluí-lo na mensagem WhatsApp enviada ao cliente, junto com o PIX manual como alternativa.

### Alteração

**Arquivo:** `src/pages/NovoPedido.tsx` (linhas ~304-348)

Após o `toast.success('Pedido cadastrado...')` e antes de montar a mensagem WhatsApp:

1. Chamar `supabase.functions.invoke('create-infinitepay-link')` passando:
   - `pedido_id`: ID do pedido criado
   - `items`: itens do pedido com `description`, `quantity`, `price` (em centavos)
   - `customer`: `{ name: clienteNome, phone_number: telefone }`

2. Capturar o `link` retornado (pode falhar silenciosamente)

3. Atualizar o template da mensagem WhatsApp para incluir o link antes do PIX manual:

```
Olá, {nome}! 👋

Seu pedido foi confirmado aqui na *Delookii Jeans*! 🎉

💰 *Total: R$ X,XX*

Para pagar, acesse o link abaixo:

🔗 *Link de Pagamento:* {linkInfinitePay}

Ou via PIX manual:

🔑 *Chave PIX:*
`40548049000106`
*CNPJ:* 40.548.049/0001-06
*Favorecido:* Delookii Confecções Ltda

Após o pagamento, envie o comprovante aqui e já priorizamos o seu pedido. ✅

*Delookii Jeans — Toritama/PE*
```

Se a chamada do InfinitePay falhar, a mensagem será enviada apenas com o PIX manual (sem o bloco do link).

### Resumo

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/NovoPedido.tsx` — adicionar chamada `create-infinitepay-link` + incluir link na mensagem |

