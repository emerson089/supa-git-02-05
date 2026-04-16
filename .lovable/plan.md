

## Plano: Deploy das Edge Functions + Correção de erros de build

### 1. Deploy das Edge Functions

Deployar `webhook-comprovantes` e `discover-group-id` usando a ferramenta de deploy. Também é necessário adicionar as configurações de `verify_jwt = false` no `supabase/config.toml` para ambas, já que são webhooks externos (Z-API) que não enviam JWT.

### 2. Correção de erros de build (obrigatório)

Existem erros de TypeScript que impedem o build. A tabela `comprovantes` não está reconhecida no tipo gerado do banco. Os arquivos afetados:

- **`src/hooks/useComprovantes.ts`** — Usar cast `as any` no `.from('comprovantes')` para contornar a ausência do tipo gerado
- **`src/hooks/useSalesTrendChart.ts`** — Mesmo problema com referência a `comprovantes`

### 3. Configuração no `supabase/config.toml`

Adicionar:
```toml
[functions.webhook-comprovantes]
verify_jwt = false

[functions.discover-group-id]
verify_jwt = false
```

### Arquivos alterados
- `supabase/config.toml`
- `src/hooks/useComprovantes.ts`
- `src/hooks/useSalesTrendChart.ts`

