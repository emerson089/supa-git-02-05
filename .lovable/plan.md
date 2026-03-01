

## Fix: Build error in Feira.tsx - missing properties

The `convertToTransferenciaComItens` function in `src/pages/Feira.tsx` (line 307) converts a `TransferenciaComItensHistorico` to `TransferenciaComItens`, but is missing 3 required properties from the `Transferencia` interface:

- `localOrigemNome` (string | null)
- `localDestinoNome` (string | null)  
- `userId` (string)

### Changes

**File: `src/pages/Feira.tsx` (line ~307-331)**

Add the 3 missing properties to the conversion object:
- `localOrigemNome`: use `carga.localOrigemNome` if available in `TransferenciaComItensHistorico`, otherwise `null`
- `localDestinoNome`: use `carga.localDestinoNome` if available, otherwise `null`
- `userId`: use `user?.id` from the auth context (already available in the component) or extract from `carga` if present

I will check the `TransferenciaComItensHistorico` interface to map the correct fields.

