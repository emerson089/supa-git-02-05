

## Problema

O bucket `lotes` é **privado** (`Is Public: No`), mas o código usa `getPublicUrl()` que gera uma URL pública. Como o bucket não é público, o HEAD request retorna 403 e o catálogo aparece como "não disponível" mesmo após upload bem-sucedido.

O mesmo problema afeta o `WhatsAppCatalogButton` que também usa `getPublicUrl` para enviar o catálogo via WhatsApp.

## Correção

### 1. `src/pages/ConfigCatalogo.tsx` - Exibir catálogo atual

Substituir `getPublicUrl` + HEAD check por `createSignedUrl` (URL temporária autenticada):

```typescript
const fetchCurrentCatalog = async () => {
  setIsLoadingUrl(true);
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(FILE_PATH, 3600); // 1h

    if (error || !data?.signedUrl) {
      setCurrentUrl(null);
    } else {
      setCurrentUrl(data.signedUrl);
    }
  } catch (e) {
    console.error(e);
    setCurrentUrl(null);
  } finally {
    setIsLoadingUrl(false);
  }
};
```

### 2. `src/components/clientes/WhatsAppCatalogButton.tsx` - Enviar catálogo via WhatsApp

Substituir `getPublicUrl` por `createSignedUrl` com validade longa (ex: 7 dias = 604800s) para que o link funcione quando o cliente abrir:

```typescript
const { data, error } = await supabase.storage
  .from('lotes')
  .createSignedUrl(`${user.id}/catalogos/oficial.pdf`, 604800);

if (error || !data?.signedUrl) {
  throw new Error("Catálogo PDF não encontrado.");
}
// Usar data.signedUrl como documentUrl
```

### Resumo

| Arquivo | Problema | Solução |
|---------|----------|---------|
| ConfigCatalogo.tsx | `getPublicUrl` em bucket privado = 403 | `createSignedUrl` (1h) |
| WhatsAppCatalogButton.tsx | `getPublicUrl` gera link inacessível | `createSignedUrl` (7 dias) |

