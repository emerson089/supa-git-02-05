

## Persistir itens da carga (Feira) entre fechamentos do modal e reloads

### Problema
Hoje, ao adicionar produtos na **Nova Carga para Feira**, os itens ficam em memória (`useState`). Fechar o modal **mantém** a seleção, mas qualquer **F5**, troca de aba do navegador ou navegação para outra rota **apaga tudo**.

### Como vai funcionar
- Ao adicionar/alterar/remover qualquer item da carga em montagem, o estado é **automaticamente salvo no `localStorage`** do navegador (por usuário).
- Ao abrir a página `/feira` novamente — mesmo após F5, fechar o navegador, ou voltar de outra tela — os itens e o **título da carga** são **restaurados exatamente como estavam**.
- Ao clicar em **Criar Carga** com sucesso → o rascunho é **limpo do localStorage** (já é limpo da memória hoje).
- Indicador visual sutil: se houver rascunho salvo, o botão **"+ Nova Carga"** mostra um badge pequeno com a quantidade de itens em rascunho (ex: `3`), pra ficar claro que tem trabalho em andamento.
- Botão **"Limpar rascunho"** dentro do modal (canto, discreto) para descartar manualmente quando quiser começar do zero.

### Mudanças técnicas

**1. `src/pages/Feira.tsx`**
- Chave do storage: `feira-nova-carga-draft-{user.id}` (escopo por usuário; evita misturar entre contas no mesmo dispositivo).
- Estrutura salva:
  ```ts
  { itensCarga: ItemCarga[]; tituloCarga: string; savedAt: string }
  ```
- **Inicialização**: `useState(() => loadDraft())` para `itensCarga` e `tituloCarga` — hidrata do localStorage no primeiro render.
- **Persistência**: um `useEffect([itensCarga, tituloCarga, user?.id])` grava no localStorage (ou remove a chave se `itensCarga.length === 0` E título vazio).
- **Limpeza pós-criação**: dentro do `onSuccess` de `criarCarga`, além de `setItensCarga([])` e `setTituloCarga('')`, remover explicitamente a chave do localStorage.
- **Validação de rascunho ao carregar**: filtrar itens cujo `itemId` não exista mais em `produtos` (ex: produto deletado entre sessões), mostrar toast informativo se algum for descartado: `"X itens do rascunho foram removidos (produtos não disponíveis)"`.
- **TTL opcional**: descartar rascunhos com mais de 7 dias (evita lixo eterno).

**2. Indicador visual no botão "Nova Carga"**
- Se `itensCarga.length > 0` E modal fechado → badge com a contagem ao lado do ícone (igual padrão do FAB carrinho mobile, mas pequeno no botão desktop).

**3. Botão "Limpar rascunho"**
- Dentro do modal Nova Carga, no header (perto do "Por Grade"), aparece só quando `itensCarga.length > 0`: ícone trash + texto curto. Confirmação simples via `confirm()` ou toast com action `Desfazer`.

**4. Nada muda em**
- `NovaCargaStepProdutos.tsx`, `NovaCargaBottomSheet.tsx`, `NovaCargaBottomBar.tsx` (continuam recebendo as mesmas props)
- Banco de dados (rascunho é 100% local no navegador — não sincroniza entre dispositivos, igual o padrão de "carrinho de compras")
- Fluxo de criação da carga (`useCriarCarga`)

### Detalhes técnicos
- Helpers `loadDraft(userId)` / `saveDraft(userId, data)` / `clearDraft(userId)` no topo de `Feira.tsx` (poderiam ir para `src/utils/feiraDraft.ts` se preferir, mas como é uso único, manter local é mais simples).
- Try/catch em todas operações de localStorage (quota cheia, modo privado).
- Não persistir `buscaProduto` (campo de busca volátil — sempre limpa).

### Como validar
1. Abrir Nova Carga, adicionar 3 produtos, fechar o modal → reabrir: itens permanecem ✅ (já funciona)
2. Adicionar 3 produtos → **F5** na página → reabrir Nova Carga: **itens ainda lá** ✅ (novo)
3. Adicionar produtos → navegar para `/estoque` e voltar para `/feira` → reabrir: itens permanecem ✅
4. Criar a carga → reabrir Nova Carga: vazia ✅
5. Adicionar produtos, deletar um deles em outra aba/usuário admin, F5: rascunho carrega só os válidos + toast informativo ✅

