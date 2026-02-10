

## Plano: Novos Tipos de Ajuste + Exclusao de Movimentacoes

### Parte 1: Tipos de Ajuste - Adicionar e Remover

**Adicionar novos tipos:**
- "Ajuste de estoque"
- "Devoluçao para estoque central"

**Remover tipos (desativar, pois alguns estao em uso):**
- "Inventario / Conferencia fisica" (em uso com 5 movimentacoes - sera **desativado**)
- "Erro de lancamento" (em uso com 2 movimentacoes - sera **desativado**)
- "Bonificacao / Brinde" (sem uso - sera **excluido**)

**Arquivos alterados:**

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useTiposAjuste.ts` | Atualizar lista de `tiposPadrao` em `useCriarTiposPadrao`: remover os 3 tipos e adicionar os 2 novos |
| **Migracao SQL** | INSERT dos 2 novos tipos para usuarios existentes; UPDATE `ativo = false` para "Inventario / Conferencia fisica" e "Erro de lancamento"; DELETE de "Bonificacao / Brinde" onde nao esta em uso |

### Parte 2: Exclusao de Movimentacoes no Relatorio de Saidas

Adicionar funcionalidade para excluir movimentacoes diretamente no relatorio de saidas, com selecao individual ou em lote.

**Arquivos alterados:**

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useRelatorioSaidas.ts` | Adicionar hook `useExcluirMovimentacoes` que: (1) reverte o estoque em `estoque_por_local` somando a quantidade de volta, (2) deleta os registros de `estoque_movimentacoes` |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Adicionar: (1) coluna de checkbox na tabela para selecionar movimentacoes, (2) checkbox "selecionar todas" no header, (3) barra de acoes com botao "Excluir selecionadas" quando ha selecao, (4) dialog de confirmacao antes de excluir, (5) estado para rastrear IDs selecionados |

**Fluxo de exclusao:**

```text
1. Usuario aplica filtros no relatorio
2. Seleciona movimentacoes via checkbox individual ou "selecionar todas"
3. Clica em "Excluir selecionadas (N)"
4. Dialog de confirmacao aparece com quantidade e aviso
5. Ao confirmar:
   - Para cada movimentacao: reverte quantidade no estoque_por_local
   - Deleta os registros de estoque_movimentacoes
   - Invalida queries relacionadas
   - Recarrega o relatorio
```

**Logica de reversao de estoque:**
- Se tipo = `AJUSTE_SAIDA`: soma a quantidade de volta ao `estoque_por_local`
- Se tipo = `AJUSTE_ENTRADA`: subtrai a quantidade do `estoque_por_local`
- Se tipo = `VENDA_FEIRA`, `ENVIO_FEIRA`, `TRANSFERENCIA`, `RETORNO_FEIRA`: soma/subtrai conforme o tipo (saida = soma de volta, entrada = subtrai)

### Detalhes Tecnicos

**Migracao SQL:**
```sql
-- Inserir novos tipos para todos os usuarios
INSERT INTO tipos_ajuste_estoque (user_id, nome, ativo, conta_como_venda)
SELECT DISTINCT user_id, 'Ajuste de estoque', true, false
FROM tipos_ajuste_estoque
ON CONFLICT (user_id, nome) DO NOTHING;

INSERT INTO tipos_ajuste_estoque (user_id, nome, ativo, conta_como_venda)
SELECT DISTINCT user_id, 'Devolução para estoque central', true, false
FROM tipos_ajuste_estoque
ON CONFLICT (user_id, nome) DO NOTHING;

-- Desativar tipos em uso
UPDATE tipos_ajuste_estoque SET ativo = false
WHERE nome IN ('Inventário / Conferência física', 'Erro de lançamento');

-- Excluir tipos sem uso (Bonificacao / Brinde)
DELETE FROM tipos_ajuste_estoque
WHERE nome = 'Bonificação / Brinde'
AND id NOT IN (SELECT DISTINCT tipo_ajuste_id FROM estoque_movimentacoes WHERE tipo_ajuste_id IS NOT NULL);
```

**Hook de exclusao (useExcluirMovimentacoes):**
- Recebe array de `{ id, itemId, localId, quantidade, tipo }`
- Para cada movimentacao, calcula delta de reversao
- Agrupa por `item_id + local_id` para fazer updates em batch
- Atualiza `estoque_por_local` e deleta `estoque_movimentacoes`
- Invalida queries: `estoque-detalhado-por-local`, `relatorio-saidas`, `vendas-desde-contagem`

**UI de selecao na tabela:**
- Checkbox na primeira coluna de cada linha
- Checkbox "selecionar todas" no header da tabela
- Barra flutuante aparece quando ha selecao: "N selecionada(s) | [Excluir selecionadas]"
- AlertDialog de confirmacao com texto: "Tem certeza que deseja excluir N movimentacao(oes)? O estoque sera revertido automaticamente."

