

## Plano: Integrar Z-API para envio direto de WhatsApp

### Visão geral
Criar uma Edge Function que chama a Z-API para enviar mensagens diretamente, sem abrir WhatsApp Web. O modal de edição de mensagem será mantido — o botão "Enviar" passa a chamar a API no backend.

### Passo 1 — Configurar secrets
Armazenar as credenciais da Z-API como secrets do projeto:
- `ZAPI_INSTANCE_ID` = `3F0E4D03C05BA1CA797B6A1199C38405`
- `ZAPI_TOKEN` = `3C1E5A529E915B6921E6436A`

### Passo 2 — Criar Edge Function `send-whatsapp`
**Arquivo**: `supabase/functions/send-whatsapp/index.ts`

- Recebe `{ phone, message }` no body
- Valida JWT do usuário autenticado
- Chama `POST https://api.z-api.io/instances/{ID}/token/{TOKEN}/send-text` com body `{ phone, message }`
- Retorna sucesso/erro com CORS headers
- Adicionar entrada no `supabase/config.toml` com `verify_jwt = false`

### Passo 3 — Atualizar `WhatsAppButton.tsx`
Substituir a função `enviarWhatsApp` (que abre WhatsApp Web/deep link) por:

1. Adicionar estado `enviando` (boolean) para loading no botão
2. Chamar `supabase.functions.invoke('send-whatsapp', { body: { phone, message } })`
3. Mostrar toast de sucesso ("Mensagem enviada!") ou erro
4. Remover toda a lógica de deep links, `window.location.href`, e criação de `<a>` tags
5. Manter botão "Copiar mensagem" como fallback

### Resumo técnico
- 2 secrets configurados
- 1 Edge Function criada
- 1 componente alterado (`WhatsAppButton.tsx`)
- ~30 linhas removidas (lógica de deep links), ~15 adicionadas (chamada à API)

