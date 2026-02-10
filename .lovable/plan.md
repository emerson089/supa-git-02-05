
## Correcao: Ajuste de Estoque Nao Deve Contar Como Venda

### Problema

Hoje, **toda** movimentacao do tipo `AJUSTE_SAIDA` e tratada como venda nos relatorios e metricas ("Desde ultima contagem", "Relatorio de Saidas"). Porem, ajustes como "Inventario / Conferencia fisica", "Perda / Avaria" ou "Erro de lancamento" nao sao vendas -- apenas correcoes de quantidade.

Somente o tipo "Venda / loja" deveria contar como venda nas metricas financeiras.

### Solucao

Adicionar uma flag `conta_como_venda` na tabela `tipos_ajuste_estoque` para que cada tipo de ajuste indique se deve ou nao ser contabilizado como venda. Em seguida, atualizar as queries que calculam vendas para considerar essa flag.

### Mudancas

| Arquivo / Recurso | Alteracao |
|---|---|
| **Migracao SQL** | Adicionar coluna `conta_como_venda BOOLEAN DEFAULT false` em `tipos_ajuste_estoque`. Setar `true` apenas para tipos com nome contendo "Venda" |
| **`src/hooks/useContagensEstoque.ts`** | Na query "vendas desde contagem": incluir `tipo_ajuste_id` no select, buscar IDs dos tipos que `conta_como_venda = true`, e filtrar apenas movimentacoes `AJUSTE_SAIDA` que tenham esses IDs (ou tipo `VENDA_FEIRA`/`VENDA`) |
| **`src/hooks/useRelatorioSaidas.ts`** | Renomear label de `AJUSTE_SAIDA` de "Ajuste/Venda" para "Ajuste Estoque". O relatorio de saidas continua mostrando TODOS os ajustes (para auditoria), mas o resumo financeiro marca quais sao vendas |
| **`src/hooks/useTiposAjuste.ts`** | Expor o campo `conta_como_venda` no tipo retornado |
| **`src/pages/ConfigTiposAjuste.tsx`** | Adicionar toggle "Conta como venda?" na tela de gerenciamento de tipos de ajuste, para o usuario configurar quais tipos sao vendas |

### Fluxo Apos Correcao

```text
Tipos de Ajuste:
  - Venda / loja          [conta_como_venda: SIM]
  - Inventario            [conta_como_venda: NAO]
  - Perda / Avaria        [conta_como_venda: NAO]
  - Erro de lancamento    [conta_como_venda: NAO]
  - Bonificacao / Brinde  [conta_como_venda: NAO]

Ao ajustar estoque com tipo "Inventario":
  -> Movimentacao AJUSTE_SAIDA criada com tipo_ajuste_id do "Inventario"
  -> NAO contabiliza como venda nas metricas
  -> Aparece normalmente no historico de movimentacoes

Ao ajustar estoque com tipo "Venda / loja":
  -> Movimentacao AJUSTE_SAIDA criada com tipo_ajuste_id do "Venda / loja"
  -> CONTABILIZA como venda nas metricas (Desde ultima contagem, Dashboard)
```

### Detalhes Tecnicos

**Migracao:**
```sql
ALTER TABLE tipos_ajuste_estoque ADD COLUMN conta_como_venda BOOLEAN DEFAULT false;
UPDATE tipos_ajuste_estoque SET conta_como_venda = true WHERE nome ILIKE '%venda%';
```

**useContagensEstoque.ts** - Logica atualizada:
- Buscar `tipos_ajuste_estoque` onde `conta_como_venda = true` para obter IDs
- Na query de movimentacoes, incluir `tipo_ajuste_id` no select
- Filtrar: contar como venda apenas se `tipo IN ('VENDA_FEIRA', 'VENDA')` OU (`tipo = 'AJUSTE_SAIDA'` E `tipo_ajuste_id` esta na lista de tipos-venda)

**ConfigTiposAjuste.tsx:**
- Adicionar coluna/toggle "Conta como venda?" na listagem
- Ao criar/editar tipo, permitir marcar se conta como venda

### Impacto

- Campo "Estoque Atual" continua editavel no modal de ajuste (sem mudanca)
- Ajustes de inventario/perda/erro nao inflam mais as metricas de venda
- Apenas ajustes marcados como "venda" serao contabilizados financeiramente
- Retroativo: movimentacoes existentes serao reclassificadas pelo `tipo_ajuste_id` que ja possuem
- Nenhuma mudanca na RPC de ajuste
