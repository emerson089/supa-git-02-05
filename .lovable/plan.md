

## Garantir que o nome do Cortador apareca em "Lote Criado"

### Diagnostico

O lote 080 (e varios outros) nao possuem o log inicial (null -> Corte) no banco de dados. Isso acontece porque o codigo de criacao de lote so cria esse log quando o campo `responsavel` esta preenchido no formulario. Como resultado, a busca pelo cortador no historico retorna vazio.

### Solucao em 2 partes

#### 1. Corrigir criacao de lotes futuros
**Arquivo:** `src/pages/Index.tsx`
- Remover a condicao `if (responsavel)` ao criar o log inicial, para que o log seja sempre criado mesmo sem responsavel preenchido
- Isso garante que lotes futuros sempre tenham o registro inicial

#### 2. Criar logs iniciais retroativos para lotes existentes
**Migracao SQL** para inserir o log inicial (null -> Corte) nos lotes que nao possuem, usando a `created_date` do lote como data do log. O campo `responsavel` ficara vazio nesses casos pois a informacao original foi perdida.

#### 3. Ajustar exibicao no modal
**Arquivo:** `src/components/production/HistoricoProducaoModal.tsx`
- Mesmo quando o cortador nao e conhecido, exibir "Cortador: Nao registrado" em vez de esconder completamente a informacao
- Isso deixa claro para o usuario que a informacao nao foi registrada naquele lote

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/Index.tsx` | Sempre criar log inicial ao criar lote |
| `src/components/production/HistoricoProducaoModal.tsx` | Mostrar "Nao registrado" quando cortador nao existe |
| Migracao SQL | Criar logs iniciais retroativos para lotes existentes |
