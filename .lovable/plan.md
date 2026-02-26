

## Corrigir visibilidade de movimentacoes no Relatorio de Saidas

### Problema identificado

Existem **dois problemas** impedindo que as vendas aparecam no relatorio:

**1. Politica de seguranca (RLS) bloqueia movimentacoes de vendedores**
A tabela `estoque_movimentacoes` so permite leitura onde `auth.uid() = user_id`. Quando o vendedor registra uma venda no local do admin, o `user_id` da movimentacao e o ID do vendedor. Resultado: o admin nao consegue ver essas movimentacoes, mesmo filtrando por local.

Dados confirmados:
- Todas as vendas recentes (AJUSTE_SAIDA com tipo "Venda / loja") foram feitas pelo vendedor
- O admin e dono do local "Loja Parque das Feiras"
- A query filtra corretamente por `local_id`, mas o banco rejeita os registros antes de retorna-los

**2. Campo "conta como venda" nao esta ativado**
O tipo "Venda / loja" esta com `conta_como_venda = false`. Isso afeta a logica que inclui automaticamente registros de VENDA_FEIRA nos resultados filtrados.

### Solucao

**Alteracao 1 - Nova politica RLS (migracao SQL)**

Adicionar uma politica que permite admins lerem movimentacoes de locais que eles possuem:

```sql
CREATE POLICY "admin can read own locations movimentacoes"
  ON public.estoque_movimentacoes
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND local_id IN (
      SELECT id FROM public.estoque_locais
      WHERE user_id = auth.uid()
    )
  );
```

Isso garante que o admin veja todas as movimentacoes feitas por qualquer usuario nos locais que ele e dono.

**Alteracao 2 - Corrigir `conta_como_venda` no banco**

Atualizar o tipo "Venda / loja" do admin para `conta_como_venda = true`:

```sql
UPDATE tipos_ajuste_estoque
SET conta_como_venda = true
WHERE nome = 'Venda / loja';
```

### Impacto

- Admin passa a ver no relatorio todas as vendas feitas por vendedores nos seus locais
- O filtro "Venda / loja" funciona corretamente, incluindo registros de VENDA_FEIRA quando aplicavel
- Nenhuma alteracao de codigo e necessaria - as queries ja estao corretas apos a correcao anterior

### Arquivos alterados

Apenas migracoes SQL (sem alteracao de codigo frontend).

