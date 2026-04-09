

## Corrigir erros de build nas Edge Functions

Há 3 erros idênticos de TypeScript: `'error' is of type 'unknown'` nos blocos `catch` de 3 Edge Functions. O fix é simples — usar `(error as Error).message` ou `error instanceof Error ? error.message : 'Unknown error'`.

### Arquivos a corrigir

| Arquivo | Linha | Correção |
|---------|-------|----------|
| `supabase/functions/brazilian-holidays/index.ts` | 133 | `error.message` → `(error instanceof Error ? error.message : 'Unknown error')` |
| `supabase/functions/create-infinitepay-link/index.ts` | 109 | idem |
| `supabase/functions/infinitepay-webhook/index.ts` | 71 | idem |

### Impacto
- Apenas tipagem TypeScript nos catch blocks
- Sem alteração de lógica ou comportamento
- Resolve todos os 3 erros de build reportados

