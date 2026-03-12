

## Correção do Erro de Build

### Problema
Na linha 199 de `src/hooks/usePedidosData.ts`, há uma referência a `process.env.NODE_ENV` que não é reconhecida no ambiente Vite/browser sem `@types/node`.

### Solução
Substituir `process.env.NODE_ENV === 'development'` por `import.meta.env.DEV`, que é a forma correta no Vite:

```typescript
// Antes
process.env.NODE_ENV === 'development' && console.warn('...');

// Depois  
import.meta.env.DEV && console.warn('...');
```

### Sobre o GitHub
O projeto está sincronizado automaticamente. Após corrigir esse erro de build, o push será feito automaticamente para o repositório.

