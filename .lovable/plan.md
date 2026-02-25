

## Corrigir scroll do modal Historico de Movimentacoes

### Problema raiz
O DialogContent do Radix aplica estilos internos de grid que sobrescrevem o layout flex, impedindo que a cadeia `flex-col` + `min-h-0` funcione corretamente para restringir a altura e habilitar o scroll.

### Solucao
Reestruturar o layout para nao depender da cadeia flex do Radix. Em vez disso, usar altura explicita com `overflow-y-auto` diretamente no container da timeline.

### Alteracoes

**Arquivo:** `src/components/production/HistoricoProducaoModal.tsx`

1. **Desktop (Dialog):** Alterar o DialogContent para usar `max-h-[90vh]` e remover o wrapper intermediario. O conteudo sera dividido em duas partes:
   - Header info (lote + stats + responsaveis) - fixo, sem scroll
   - Timeline - com `overflow-y-auto` e `max-h` calculado para ocupar o espaco restante

2. **Mobile (Drawer):** Manter `h-[85vh]` no DrawerContent e garantir que a timeline tenha scroll independente

3. **Refatorar o `content`:** Separar em dois componentes/secoes:
   - `headerContent` - informacoes do lote (sempre visivel)
   - `timelineContent` - lista de movimentacoes (scrollavel)

4. **Aplicar `overscroll-contain`** no container de scroll para evitar propagacao do scroll para o body

### Detalhes tecnicos

**DialogContent (desktop):**
```
className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden"
```
- Remover `!grid-rows-none` (causa conflitos)
- Adicionar `overflow-hidden` para conter o scroll interno

**Container da timeline:**
```
className="flex-1 overflow-y-auto overscroll-contain min-h-0 mt-4 pr-2"
```

**Container wrapper interno (tanto Dialog quanto Drawer):**
```
className="flex-1 flex flex-col overflow-hidden min-h-0"
```

O ponto chave e garantir que cada nivel da hierarquia (DialogContent -> wrapper -> content -> timeline) tenha `min-h-0` e `overflow-hidden/auto` corretamente aplicados, e que o DialogContent use `flex flex-col` sem conflito com o grid padrao do Radix.

Tambem sera adicionado `[&>div]:!grid-rows-none` ou aplicado via style inline `display: flex` para sobrescrever o grid do Radix de forma mais confiavel.
