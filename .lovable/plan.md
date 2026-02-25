

## Corrigir conteudo cortado no Modal de Historico

### Problema
O modal de historico de movimentacoes tem o conteudo cortado na parte inferior porque os containers flexbox nao permitem scroll corretamente. Em CSS flexbox, elementos com `flex-1` tem `min-height: auto` por padrao, impedindo que encolham abaixo do tamanho do conteudo.

### Solucao
Adicionar `min-h-0` nos containers flex intermediarios para permitir que o conteudo role corretamente dentro do espaco disponivel.

### Alteracoes

**Arquivo:** `src/components/production/HistoricoProducaoModal.tsx`

1. No container principal do conteudo (linha 80): adicionar `min-h-0`
   - De: `flex flex-col h-full`
   - Para: `flex flex-col h-full min-h-0`

2. No container da timeline (linha 137): adicionar `min-h-0`
   - De: `flex-1 mt-4 overflow-y-auto pr-2`
   - Para: `flex-1 mt-4 overflow-y-auto pr-2 min-h-0`

3. No wrapper do Dialog desktop (linha 237): adicionar `min-h-0`
   - De: `flex-1 overflow-hidden`
   - Para: `flex-1 overflow-hidden min-h-0`

4. No wrapper do Drawer mobile (linha 220): adicionar `min-h-0`
   - De: `flex-1 overflow-hidden px-4 pb-4`
   - Para: `flex-1 overflow-hidden min-h-0 px-4 pb-4`

Isso garante que toda a cadeia flex (DialogContent/DrawerContent -> wrapper -> content -> timeline) permita que o scroll funcione, tanto no desktop quanto no mobile.
