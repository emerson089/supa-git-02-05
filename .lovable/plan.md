

## Adicionar excursão direto no cadastro rápido de cliente

### Como vai funcionar (visão do usuário)
No modal **"Novo Cliente"** (atalho do Novo Pedido), ao clicar no campo **Excursão** e digitar algo que não existe (ex: "Mar"):

- Se houver matches → aparecem normalmente como hoje.
- Se **não houver match exato**, aparece logo no topo da lista uma sugestão destacada:
  
  ```
  + Cadastrar nova excursão "Mar..."
  ```
- Ao clicar, abre um mini-modal sobreposto **"Nova Excursão"** já com o nome preenchido, pedindo:
  - **Nome** (preenchido, editável)
  - **Taxa (R$)** — obrigatório, default `0,00`
  - **Contato** (opcional)
  - **Localização** (opcional)
- Ao salvar:
  - Cria a excursão no banco (mesma tabela usada na aba Excursões — `useAddExcursao`)
  - Invalida o cache → ela passa a aparecer na aba Excursões automaticamente
  - Seleciona a nova excursão no campo do cliente
  - Fecha o mini-modal e volta para o "Novo Cliente" pronto pra salvar
- Toast: `Excursão "X" cadastrada e selecionada`

### Mudanças técnicas

**1. Novo componente `src/components/excursoes/QuickAddExcursaoModal.tsx`**
- Props: `open`, `onOpenChange`, `defaultNome: string`, `onCreated: (excursao: Excursao) => void`
- Form com 4 campos (nome, taxa, contato, localizacao) usando `Input` + máscara monetária BR para taxa
- Usa `useAddExcursao()` do hook existente
- Validação: nome obrigatório (≥2 chars), taxa ≥ 0
- Responsivo: Dialog desktop / Drawer mobile (segue padrão `responsive-modal-drawer-pattern-v2`)

**2. `src/pages/NovoPedido.tsx` — modal "Novo Cliente"**
- Capturar o valor digitado no `CommandInput` via state local `excursaoSearch`
- No `CommandList`, antes do `.map(excursoesAtivas)`:
  - Se `excursaoSearch.trim().length >= 2` E não existir match exato (case-insensitive) na lista filtrada
  - Renderizar um `CommandItem` destacado (ícone `Plus`, texto primary): `+ Cadastrar nova excursão "{search}"`
  - `onSelect` → fecha popover, abre `QuickAddExcursaoModal` com `defaultNome={search}`
- Adicionar state: `quickAddExcursaoOpen`, `quickAddExcursaoNome`
- Callback `onCreated` → `setNovoCliente(prev => ({ ...prev, excursao: nova.nome }))` + toast

**3. Nada muda em**
- Aba `/excursoes` (Excursões) — nova excursão já aparece via React Query cache invalidation
- Tabela `excursoes` ou hooks
- Outros modais (cadastro completo de cliente em `/clientes` permanece igual — só este fluxo rápido ganha o atalho)

### Detalhes técnicos
- O componente `Command` (cmdk) expõe o valor digitado via `onValueChange` no `CommandInput` — sem precisar de hack
- A invalidação `['excursoes-ativas']` já está no `useAddExcursao` → o popover do Novo Cliente recarrega na hora
- Máscara da taxa: reusa padrão BR `R$ 0,00` (igual ao usado no `ResumoCard`)

### Como validar
1. Abrir Novo Pedido → clicar `+` ao lado de Cliente
2. Em Excursão, digitar "Teste123"
3. Clicar em `+ Cadastrar nova excursão "Teste123"`
4. Preencher Taxa = 15,00 → Salvar
5. Excursão aparece selecionada no cliente, aba Excursões já contém "Teste123" com R$ 15,00

