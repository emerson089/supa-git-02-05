

## Corrigir autenticação da Edge Function `send-whatsapp`

### Problema
A função usa `supabase.auth.getClaims(token)` que não é suportado no ambiente Edge Functions.

### Correção
Substituir `getClaims` por `auth.getUser()` via service role client, seguindo o padrão já usado nas outras Edge Functions administrativas do projeto.

### Alteração em `supabase/functions/send-whatsapp/index.ts`

Trocar o bloco de validação de auth (linhas 28-38) por:

```typescript
const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
if (userError || !user) {
  return new Response(JSON.stringify({ error: "Token inválido" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

- Remove o `supabase` client com anon key (não é mais necessário para auth)
- Usa `adminClient` com service role para validar o JWT via `getUser(token)`
- Resto da função (validação de body, chamada Z-API) permanece inalterado
- Deploy automático após alteração

