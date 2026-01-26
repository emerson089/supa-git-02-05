

### Objetivo
Corrigir o campo “Buscar por nome ou código” na tela **/transferencias** para que você consiga digitar vários números em sequência (ex.: “170”) e para que a lista só seja filtrada **depois que você parar de digitar** (debounce).

---

## O que está acontecendo (causa real)
Mesmo com o debounce no filtro, o componente **ainda re-renderiza a cada tecla**, porque o input é controlado por `searchEstoque`.

Além disso, dentro de `src/pages/Transferencias.tsx`, a seção que contém o campo de busca (`EstoqueLocalSection`) está declarada **dentro** do componente `Transferencias` e está sendo renderizada como:

- `<EstoqueLocalSection />`

Como essa “sub-seção” é recriada em todo render do pai, o React trata como um **componente novo**, desmonta e monta de novo (remount) — e isso faz o input **perder foco** após o primeiro dígito, parecendo que “não dá para digitar mais de um número”.

O debounce que já foi aplicado está correto, mas ele não evita o problema de foco porque o remount está acontecendo **antes** (no render do pai).

---

## Correção proposta (sem mudar o comportamento visual)
Vamos impedir o remount do input, mantendo o debounce.

### Opção escolhida (mais segura e com menor mudança)
Transformar `EstoqueLocalSection` e `HistoricoTransferenciasSection` em **funções de renderização** (não “componentes React”) e renderizar chamando a função:

- Trocar:
  - `<EstoqueLocalSection />`
  - `<HistoricoTransferenciasSection />`

- Por:
  - `{renderEstoqueLocalSection()}`
  - `{renderHistoricoTransferenciasSection()}`

Isso mantém a árvore de elementos estável e evita o “desmonta/monta” do input a cada tecla.

---

## Passo a passo de implementação

### 1) Ajustar `src/pages/Transferencias.tsx`
1. Renomear:
   - `const EstoqueLocalSection = () => (` para `const renderEstoqueLocalSection = () => (`
   - `const HistoricoTransferenciasSection = () => (` para `const renderHistoricoTransferenciasSection = () => (`

2. Atualizar os locais onde são renderizados (mobile e desktop):
   - Substituir `<EstoqueLocalSection />` por `{renderEstoqueLocalSection()}`
   - Substituir `<HistoricoTransferenciasSection />` por `{renderHistoricoTransferenciasSection()}`

### 2) Manter o debounce já implementado
Não remover nada do debounce atual:
- `const debouncedSearchEstoque = useDebouncedValue(searchEstoque, 300);`
- filtro usando `debouncedSearchEstoque`

Assim, o resultado só atualiza após ~300ms sem digitar.

---

## Como vamos validar (checklist)
1. Ir em **Estoque por Local** (/transferencias)
2. Clicar no campo **Buscar por nome ou código**
3. Digitar rapidamente: `170` (sem clicar de novo no input)
4. Confirmar:
   - o cursor não “some” após o primeiro número
   - o campo aceita `170` normalmente
   - a lista só muda depois que você para de digitar (~300ms)

---

## Arquivo afetado
- `src/pages/Transferencias.tsx` (somente)

