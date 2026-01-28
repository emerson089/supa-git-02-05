

## Plano: Corrigir Modal "Ajustar Estoque" Cortado no Mobile

### Problema Atual
O modal usa `grid-cols-3` com `gap-4` e `px-6` de padding, o que não cabe em telas de celular. A coluna "Diferença" está sendo cortada.

### Solução
Aplicar o padrão responsivo já estabelecido no projeto: **Drawer (Bottom Sheet) no mobile + Dialog no desktop**.

### Alterações no Arquivo

**`src/components/estoque/AjusteEstoqueModal.tsx`**

| Área | Problema | Correção |
|------|----------|----------|
| Componente raiz | Sempre usa Dialog | Usar Drawer no mobile, Dialog no desktop |
| Container | `px-6` muito largo | `px-4 sm:px-6` |
| Grid 3 colunas | Colunas muito estreitas | Reduzir gap para `gap-2 sm:gap-4` |
| Input fonte | Pode causar zoom no iOS | Adicionar `text-base md:text-sm` |
| Altura | Fixa no mobile | Drawer com `h-[85vh]` |

### Estrutura de Código

```
// Padrão responsivo
const isMobile = useIsMobile();

if (isMobile) {
  return <Drawer>...</Drawer>  // Bottom Sheet
} else {
  return <Dialog>...</Dialog>  // Modal centralizado
}
```

### Mudanças CSS Principais

```css
/* Container */
px-4 sm:px-6

/* Grid de quantidades */
grid-cols-3 gap-2 sm:gap-4

/* Texto do input - previne zoom iOS */
text-base sm:text-2xl

/* Padding das colunas */
p-2 sm:p-4
```

### Resultado Esperado

- Mobile: Bottom Sheet ocupando 85% da tela, todas as 3 colunas visíveis
- Desktop: Modal centralizado como antes
- Input com fonte 16px para evitar zoom automático no iOS

### Arquivos Impactados

1. `src/components/estoque/AjusteEstoqueModal.tsx` - Refatorar para padrão responsivo

