

## Correções necessárias

### 1. Corrigir erro de build em `ConfigCatalogo.tsx` (linhas 42-49)

O código tem um bloco `if/else` duplicado — resquício de uma edição parcial. Substituir toda a lógica de verificação por `createSignedUrl`:

```typescript
// Substituir linhas 42-49 por:
const { data, error: signedError } = await supabase.storage
  .from(BUCKET_NAME)
  .createSignedUrl(FILE_PATH, 3600);

if (signedError || !data?.signedUrl) {
  setCurrentUrl(null);
} else {
  setCurrentUrl(data.signedUrl);
}
```

Também remover as linhas 33-40 (o `list` + `getPublicUrl` que não são mais necessários).

### 2. Corrigir `TransmissaoManagerModal.tsx` (linhas 103-106)

Substituir `getPublicUrl` por `createSignedUrl` com 7 dias de validade:

```typescript
const { data: signedData, error: signedError } = await supabase.storage
  .from('lotes')
  .createSignedUrl(`${user.id}/catalogos/oficial.pdf`, 604800);

if (signedError || !signedData?.signedUrl) {
  throw new Error("Catálogo não encontrado. Faça upload nas Configurações.");
}

// Usar signedData.signedUrl como documentUrl na chamada da edge function
```

### Resultado
- Build error resolvido
- Catálogo carrega corretamente na página de configurações
- Transmissão em massa envia o PDF real via WhatsApp

