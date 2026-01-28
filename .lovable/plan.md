
## Plano: Corrigir Imagens do Card "Estoque Crítico" no Dashboard

### Problema Identificado
As imagens do card "Estoque Crítico" não estão carregando porque o código usa `<img src={item.imagem_url}>` diretamente, mas as imagens no bucket `lotes` do Supabase Storage requerem **URLs assinadas** para acesso.

### Diagnóstico Técnico

| Aspecto | Situação Atual | Situação Correta |
|---------|---------------|------------------|
| Renderização | `<img src={item.imagem_url}>` | Usar `LotImage` component |
| URL da imagem | Path relativo (ex: `user_id/produtos/file.jpg`) | URL assinada via `useSignedUrl` |
| Bucket | `lotes` (privado) | Mesmo bucket, mas com signed URL |

### Exemplo do Path no Banco
```
imagem_url: "7dc239f2-8183-4bd8-b5c4-f40c37dc6052/produtos/23784106-b3ec-43ee-a795-a8ae09be075e.jpeg"
```

Este path precisa ser convertido em signed URL antes de ser usado no `<img>`.

### Solução Proposta

Substituir a renderização direta da imagem pelo componente `LotImage` que já existe no projeto e resolve automaticamente a URL assinada:

**Arquivo**: `src/pages/Dashboard.tsx`

**Antes (linha 669-670)**:
```tsx
{item.imagem_url ? (
  <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
) : (
  <Package size={18} className="text-muted-foreground" />
)}
```

**Depois**:
```tsx
<LotImage
  src={item.imagem_url}
  alt={item.nome}
  className="w-full h-full object-cover"
/>
```

### Alterações Necessárias

1. **Import do componente** (no topo do arquivo):
   ```tsx
   import { LotImage } from '@/components/production/LotImage';
   ```

2. **Substituir o bloco de imagem** (linhas 669-670):
   - Remover a tag `<img>` condicional
   - Usar `LotImage` que já trata internamente:
     - URLs assinadas via `useSignedUrl`
     - Placeholder quando não há imagem
     - Loading state

### Por que usar `LotImage`?

O componente `LotImage` já é utilizado em outros locais do projeto (Estoque, Produção) e:
- Chama `useSignedUrl` internamente para obter URL assinada
- Usa cache de URLs para evitar chamadas repetidas
- Mostra placeholder quando não há imagem ou enquanto carrega
- Usa `LazyImage` para carregamento otimizado

### Resultado Esperado

- Imagens dos produtos com estoque crítico serão exibidas corretamente
- Mantém consistência visual com outros cards do sistema
- Carregamento lazy para performance

### Arquivos Impactados

1. `src/pages/Dashboard.tsx` - Adicionar import e substituir renderização de imagem
