

## Plan: Update WhatsApp Message Template

The current message template (lines 312-320 of `NovoPedido.tsx`) still uses the old format. It needs to be updated to match the user's requested template.

### Change

**File:** `src/pages/NovoPedido.tsx` (lines 312-320)

Replace the current message with:

```
Olá, ${clienteNome}! 👋

Seu pedido foi confirmado aqui na *Delookii Jeans*! 🎉

💰 *Total: ${valorFormatado}*

Para dar andamento, realize o pagamento via PIX:

🔑 *Chave PIX:*

\`40548049000106\`

*CNPJ:* 40.548.049/0001-06

*Favorecido:* Delookii Confecções Ltda

Após o pagamento, envie o comprovante aqui e já priorizamos o seu pedido. ✅

Qualquer dúvida é só chamar. Estamos sempre por aqui! 😊

*Delookii Jeans — Toritama/PE*
```

This is a single-line change in one file.

