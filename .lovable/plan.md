

## Plano: Alterar Acesso do Vendedor de Banca para Loja

### Situação Atual

| Configuração | Valor |
|--------------|-------|
| Vendedor | `emerson089@gmail.com` |
| Acesso atual | "Banca da Feira" (tipo: banca) |
| Permissões atuais | Ver, Ajustar Estoque, Editar Preço |

### Ação Necessária

Atualizar a entrada na tabela `user_locations` para apontar para "Loja Parque das Feiras" em vez de "Banca da Feira".

### Dados da Alteração

| Campo | Valor Atual | Novo Valor |
|-------|-------------|------------|
| local_id | `e1e0b6df-...` (Banca da Feira) | `d42e5bcc-...` (Loja Parque das Feiras) |
| can_view | true | true (mantido) |
| can_adjust_stock | true | true (mantido) |
| can_edit_price | true | true (mantido) |

### Operação de Banco de Dados

Atualizar o registro existente na tabela `user_locations`:

```sql
UPDATE user_locations 
SET local_id = 'd42e5bcc-0d39-4623-8166-d78018675264',
    updated_at = now()
WHERE id = '381d3bda-4f55-447c-8f96-ccf2bc7de11c';
```

### Por que Não Vai Quebrar Nada

1. **Código já suporta 'loja'**: A lógica em `Transferencias.tsx` prioriza locais tipo 'loja' antes de 'banca'
2. **RLS já configurado**: As policies de `has_location_access()` funcionam para qualquer tipo de local
3. **Permissões mantidas**: As mesmas permissões (ver, ajustar, editar preço) serão preservadas
4. **Estoque da loja tem dados**: "Loja Parque das Feiras" tem 1038 peças e 79 modelos

### Resultado Esperado

Após a alteração, o vendedor verá:
- **1038 peças** em vez de 852
- **79 modelos** em vez de 27
- Mesmos totais que o admin vê atualmente

### Arquivos Impactados

Nenhum código precisa ser alterado. Apenas a configuração no banco de dados.

