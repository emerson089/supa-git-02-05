## Objetivo

Adicionar um log temporário no webhook `webhook-comprovantes` para capturar o ID do grupo de WhatsApp da próxima mensagem que chegar (texto ou imagem), permitindo descobrir o ID do "Grupo de confirmação de pagamento".

## Por que isso é necessário

Atualmente o webhook descarta silenciosamente qualquer mensagem que não contenha imagem (`return Ignorado` antes de qualquer log). Por isso, a mensagem de texto "Grupo de confirmação de pagamento" que você enviou não deixou rastro nem nos logs nem no banco.

## Mudanças

### 1. `supabase/functions/webhook-comprovantes/index.ts`

Adicionar um `console.log` no início do handler que captura `groupHost`, `sender`, `text` e `chatName` de **toda** requisição recebida — antes de qualquer filtro de documento/imagem. Essa instrumentação fica gravada nos logs da edge function e dura só até a captura.

```ts
// [DEBUG TEMP] Log de descoberta de Group ID
const debugGroupHost = body?.phone || "Private";
const debugSender   = body?.participantPhone || body?.author || "Desconhecido";
const debugText     = body?.text?.message || body?.image?.caption || ...;
console.log("[GROUP-ID-DISCOVERY]", JSON.stringify({
  groupHost: debugGroupHost,
  sender: debugSender,
  text: debugText,
  isGroup: body?.isGroup ?? null,
  chatName: body?.chatName ?? null,
}));
```

Nada mais muda — o resto da lógica (filtro de grupo autorizado, processamento OpenAI, etc.) segue idêntica.

### 2. Após a captura

Assim que eu ler o ID nos logs e confirmar com você, faço uma segunda passagem para **remover** o bloco `[DEBUG TEMP]` para não poluir os logs em produção a longo prazo.

## Próximos passos depois da aprovação

1. Aplico a mudança no webhook.
2. Aguardo você reenviar uma mensagem qualquer no grupo (a "Grupo de confirmação de pagamento 1" que você acabou de enviar provavelmente já cairá na próxima execução).
3. Leio os logs com `supabase--edge_function_logs` filtrando por `GROUP-ID-DISCOVERY`.
4. Te informo o ID capturado.
5. Pergunto se quer atualizar o secret `WHATSAPP_GROUP_ID` (caso seja um grupo novo) ou se era só pra confirmar.
6. Removo o log de debug.
