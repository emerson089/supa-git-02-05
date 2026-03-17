

## Diagnóstico

O erro ocorre ao excluir um modelo padronizado porque a tabela `transferencia_itens` possui uma **foreign key sem CASCADE** referenciando `estoque_itens`. A lógica atual tenta limpar esses registros manualmente, mas usa um JOIN complexo com a tabela `transferencias` que pode falhar por causa de RLS (políticas de segurança) ou filtros que não capturam todos os registros.

**Foreign keys atuais em `estoque_itens`:**
- `estoque_movimentacoes` → CASCADE (OK)
- `estoque_por_local` → CASCADE (OK)
- `pedido_itens` → SET NULL (OK)
- `transferencia_itens` → **NO ACTION** (PROBLEMA)

## Plano

### 1. Migração: Alterar FK para CASCADE
Alterar a foreign key `transferencia_itens_item_id_fkey` de NO ACTION para CASCADE, assim quando um `estoque_itens` for deletado, os `transferencia_itens` associados são removidos automaticamente.

```sql
ALTER TABLE transferencia_itens
  DROP CONSTRAINT transferencia_itens_item_id_fkey;

ALTER TABLE transferencia_itens
  ADD CONSTRAINT transferencia_itens_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES estoque_itens(id) ON DELETE CASCADE;
```

### 2. Simplificar lógica de exclusão no código
No `useEstoqueData.ts`, simplificar o step 2 da função `removeItem`: após verificar que não há transferências em andamento, deletar **todos** os `transferencia_itens` do item diretamente com um DELETE simples (sem inner join), como fallback de segurança antes do CASCADE agir.

### Resultado esperado
A exclusão de modelos padronizados funcionará mesmo quando houver histórico de transferências concluídas/canceladas vinculadas ao item.

