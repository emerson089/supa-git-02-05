

## Corrigir campo Motivo nas transferencias para usar Tipos de Ajuste

### Problema

O campo "Motivo" no modal "Nova Transferencia" ja puxa os nomes dos Tipos de Ajuste configurados (ex: "Ajuste de estoque", "Defeito", "Venda / loja"). Porem, a tabela `transferencias` tem um CHECK constraint que so aceita os valores fixos: `feira`, `reposicao`, `ajuste`, `devolucao`.

Quando o vendedor seleciona um motivo como "Ajuste de estoque" ou "Devolucao de cliente", o banco rejeita o registro com o erro:
```
new row for relation "transferencias" violates check constraint "transferencias_motivo_check"
```

### Solucao

Remover o CHECK constraint `transferencias_motivo_check` da tabela `transferencias`. O campo `motivo` deve aceitar qualquer texto, pois agora ele armazena o nome do tipo de ajuste configurado pelo usuario.

### Alteracao

**Migracao SQL** - Remover o CHECK constraint:

```sql
ALTER TABLE transferencias DROP CONSTRAINT IF EXISTS transferencias_motivo_check;
```

Nenhuma alteracao de codigo frontend e necessaria. O modal ja funciona corretamente, puxando os tipos de ajuste e enviando o nome como motivo.

### Impacto

- Vendedores e demais usuarios poderao criar transferencias com qualquer motivo dos Tipos de Ajuste configurados
- O historico existente nao e afetado (os valores antigos como "feira", "ajuste" continuam validos)
- Sem risco de seguranca, pois o campo motivo e apenas descritivo/informativo

