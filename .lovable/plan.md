

## Plano: Correção Global de Scroll em Dropdowns

### Diagnóstico do Problema

O problema de scroll afeta múltiplos componentes do sistema:

1. **`SelectContent`** em `src/components/ui/select.tsx`:
   - Usa `overflow-hidden` no container principal
   - O Viewport do Radix Select não tem estilos de scroll adequados
   - Depende de ScrollUpButton/ScrollDownButton para navegação em vez de scroll nativo

2. **`PopoverContent`** com listas customizadas:
   - Containers internos não têm `onWheel` para prevenir propagação
   - Quando dentro de modais com `overflow-hidden`, eventos de wheel são bloqueados

3. **`DropdownMenuContent`** em `src/components/ui/dropdown-menu.tsx`:
   - Similar ao SelectContent, usa `overflow-hidden`

---

## Solução

### 1. Corrigir SelectContent (Base UI Component)

**Arquivo**: `src/components/ui/select.tsx`

**Alterações no SelectContent**:

| Mudança | Antes | Depois |
|---------|-------|--------|
| Container overflow | `overflow-hidden` | `overflow-auto` |
| Viewport scroll | `p-1` | `p-1 max-h-[300px] overflow-y-auto` |
| Wheel event | Não tratado | `onWheel={(e) => e.stopPropagation()}` |

**Código Proposto**:

```tsx
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md ...",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1 max-h-[300px] overflow-y-auto",
          position === "popper" && "..."
        )}
        onWheel={(e) => e.stopPropagation()}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
```

---

### 2. Corrigir DropdownMenuContent (Base UI Component)

**Arquivo**: `src/components/ui/dropdown-menu.tsx`

**Alterações similares**:

```tsx
const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] max-h-[300px] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md ...",
        className,
      )}
      onWheel={(e) => e.stopPropagation()}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
```

---

### 3. Corrigir PopoverContent (Base UI Component)

**Arquivo**: `src/components/ui/popover.tsx`

**Alterações**:

```tsx
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none ...",
        className,
      )}
      onWheel={(e) => e.stopPropagation()}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
```

---

### 4. Adicionar Componente ScrollableList Reutilizável

**Novo arquivo**: `src/components/ui/scrollable-list.tsx`

Criar componente wrapper para listas scrolláveis dentro de popovers:

```tsx
interface ScrollableListProps {
  children: React.ReactNode;
  maxHeight?: number;
  className?: string;
}

export function ScrollableList({ 
  children, 
  maxHeight = 280,
  className 
}: ScrollableListProps) {
  return (
    <div 
      className={cn(
        "overflow-y-auto overscroll-contain",
        className
      )}
      style={{ maxHeight }}
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
```

---

### 5. Atualizar RelatorioSaidasModal

**Arquivo**: `src/components/estoque/RelatorioSaidasModal.tsx`

**Alterações no container de modelos (linha 349)**:

Atual:
```tsx
<div className="max-h-[200px] overflow-y-auto border rounded-md">
```

Proposto:
```tsx
<div 
  className="max-h-[280px] overflow-y-auto border rounded-md overscroll-contain"
  onWheel={(e) => e.stopPropagation()}
>
```

**Alterações no container de tipos de ajuste (linha 450)**:

Atual:
```tsx
<div className="max-h-[200px] overflow-y-auto space-y-1">
```

Proposto:
```tsx
<div 
  className="max-h-[280px] overflow-y-auto space-y-1 overscroll-contain"
  onWheel={(e) => e.stopPropagation()}
>
```

---

### 6. Atualizar AjusteEstoqueModal

**Arquivo**: `src/components/estoque/AjusteEstoqueModal.tsx`

O Select de Tipo de Ajuste já usa o componente base que será corrigido globalmente.

---

### 7. Adicionar CSS Global para Overscroll

**Arquivo**: `src/index.css`

Adicionar regra global:

```css
/* Enable wheel scroll in dropdowns and popovers */
[data-radix-popper-content-wrapper] {
  pointer-events: auto !important;
}

/* Ensure scrollable containers work properly */
.scrollable-dropdown {
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

---

## Resumo de Arquivos Impactados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/components/ui/select.tsx` | Base Component | Adicionar scroll no Viewport + onWheel |
| `src/components/ui/dropdown-menu.tsx` | Base Component | Adicionar max-height, overflow, onWheel |
| `src/components/ui/popover.tsx` | Base Component | Adicionar onWheel no Content |
| `src/components/ui/scrollable-list.tsx` | Novo | Componente reutilizável para listas |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Modal | Aplicar onWheel nos containers de lista |
| `src/index.css` | Global | Adicionar estilos para overscroll |

---

## Testes de Validação

Após implementação, testar:

| Componente | Cenário | Esperado |
|------------|---------|----------|
| Select de Local (RelatorioSaidasModal) | Scroll com roda do mouse | Lista rola normalmente |
| Select de Tipo de Ajuste (AjusteEstoqueModal) | Scroll com trackpad | Lista rola suavemente |
| Multi-select de Modelos (PopoverContent) | Scroll com mouse wheel | Lista rola sem afetar modal pai |
| DropdownMenu de ações | Mobile swipe | Lista rola corretamente |
| Qualquer dropdown dentro de Dialog | Scroll em lista longa | Não propaga para o modal |

---

## Critérios de Aceite

- Todos os dropdowns/selects permitem scroll com roda do mouse
- Scroll com trackpad funciona em todos os componentes
- Mobile swipe funciona em listas dentro de drawers
- Modal pai não rola quando scrollando dentro de dropdown
- Layout existente não é afetado
- Altura máxima de 280-320px aplicada consistentemente

