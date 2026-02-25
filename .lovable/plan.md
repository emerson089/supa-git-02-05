

## Usar Tipos de Ajuste nas Transferencias

### Contexto

Atualmente, o modal "Nova Transferencia" usa um dropdown fixo com 4 opcoes hardcoded (Reposicao, Feira, Ajuste, Devolucao). O usuario quer que esse campo use os mesmos **Tipos de Ajuste** configuráveis da tela "Tipos de Ajuste" (tabela `tipos_ajuste_estoque`), permitindo editar/criar motivos personalizados.

### Abordagem

O campo `motivo` na tabela `transferencias` ja e `text` livre, entao podemos salvar o **nome** do tipo de ajuste selecionado (ex: "Reposicao", "Defeito") sem precisar alterar o banco. Isso mantem compatibilidade com os dados existentes.

### Alteracoes

#### 1. Transferencias.tsx -- Substituir dropdown hardcoded por tipos do banco

- Importar `useTiposAjuste` para carregar os tipos ativos do usuario
- Trocar o Select de motivo para listar os tipos da tabela em vez das 4 opcoes fixas
- O estado `motivoNovo` passa a armazenar o **nome** do tipo selecionado (string livre) em vez do enum
- Na listagem de transferencias, exibir o motivo diretamente (ja e texto)

#### 2. DetalhesTransferenciaModal.tsx -- Usar tipos do banco na edicao

- Importar `useTiposAjuste` para popular o dropdown de edicao do motivo
- Remover referencia ao `MOTIVOS_LABELS` hardcoded
- O campo motivo editavel mostra os tipos do banco; o campo somente-leitura mostra o texto salvo

#### 3. FiltrosTransferencias.tsx -- Usar tipos do banco nos filtros

- Importar `useTiposAjuste` para popular o filtro de motivo
- Remover o tipo `MotivoTransferencia` enum e usar `string` para o filtro
- Manter opcao "Todos" + listar tipos ativos dinamicamente

#### 4. useTransferencias.ts -- Ajustar tipo do motivo

- Mudar o tipo de `motivo` de `MotivoTransferencia` para `string` na interface da mutacao `useCriarTransferencia`
- Mesma mudanca em `useAtualizarTransferencia`

---

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/Transferencias.tsx` | Importar `useTiposAjuste`, trocar dropdown fixo por tipos do banco, ajustar estado e labels |
| `src/components/transferencias/DetalhesTransferenciaModal.tsx` | Importar `useTiposAjuste`, trocar dropdown fixo por tipos do banco na edicao |
| `src/components/transferencias/FiltrosTransferencias.tsx` | Importar `useTiposAjuste`, trocar filtro fixo por tipos do banco |
| `src/hooks/useTransferencias.ts` | Mudar tipo `motivo` de enum para `string` |

### Impacto no backend
- **Zero** alteracoes no banco -- o campo `motivo` ja e `text` livre
- Dados antigos com valores como "reposicao" continuam funcionando (exibidos como texto)

