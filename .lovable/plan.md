
## Corrigir envio de mensagem de resumo no WhatsApp + ajustar formato

### Causa raiz
A função `enviarMensagemZApi` dentro de `webhook-comprovantes/index.ts` faz POST para `/send-text` da Z-API **sem o header `Client-Token`**. A função `send-whatsapp/index.ts` (que funciona) envia esse header obrigatório:

```ts
headers: {
  "Content-Type": "application/json",
  "Client-Token": clientToken,   // ← faltando no webhook-comprovantes
}
```

A Z-API rejeita a requisição (geralmente 401), mas como o código usa `.catch(e => console.error(...))` sem await/log estruturado, o erro vira invisível e o webhook responde 200 normalmente. Resultado: comprovante salva, mas resumo nunca chega no grupo.

### Mudanças em `supabase/functions/webhook-comprovantes/index.ts`

**1. Corrigir `enviarMensagemZApi`**
- Ler `ZAPI_CLIENT_TOKEN` do env
- Adicionar header `Client-Token` na requisição
- Logar status e corpo de resposta da Z-API quando der erro (para debug futuro)
- Remover fallback `ZAPI_API_URL` (não é secret cadastrada e confunde) — usar sempre a URL padrão

**2. Aplicar o novo formato de mensagem aprovado anteriormente**
Reescrever o bloco `msg` em `processComprovante` para:
```
✅ *Comprovante registrado!*

💰 Valor: R$ 50,00
👤 Pagador: Daniel Silva Chagas
🏦 Banco: Nubank
📅 Data: 17/04/2026

Total jeans : R$ 2.184,00
Total alfaiataria : R$ 2.015,00
📊 *Total do dia: R$ 4.199,00*
```
- Remove a linha "🏷️ Categoria"
- Remove bullets `•`, ícones 👖/👔 dos totais e o separador `━━━━━`
- Troca "Total geral" por "Total do dia"
- Quando `totalNaoClass > 0`, adiciona linha extra `Total não classificado : {valor}` antes do total do dia
- Quando o comprovante atual for `nao_classificado`, mantém o aviso compacto no fim da mensagem orientando a corrigir (sem reintroduzir a linha de categoria)

### Sem mudanças
- Banco de dados: nenhuma alteração
- Frontend (`/comprovantes`, hook, modal): nenhuma alteração
- `send-whatsapp/index.ts`: já estava correto, não mexer

### Como validar depois
Você manda um comprovante novo no grupo com legenda **J** ou **A** → deve chegar a mensagem de resumo no formato novo em segundos.
