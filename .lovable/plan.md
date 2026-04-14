

## Plano: Filtro de duplicatas por catálogo + Randomização de saudações

### Problema atual

O sistema registra contatos na tabela `cliente_contatos` com canal genérico "whatsapp", sem vincular ao catálogo específico. Isso impede saber se um cliente já recebeu um determinado catálogo. Além disso, as saudações já existem mas não incluem o sufixo ", tudo bem?" de forma consistente.

### 1. Nova tabela `catalogo_envios` (migração SQL)

Tabela para registrar cada envio bem-sucedido de catálogo por cliente:

```sql
CREATE TABLE public.catalogo_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  catalogo_id UUID NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own catalogo_envios" ON public.catalogo_envios
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_catalogo_envios_lookup 
  ON public.catalogo_envios (user_id, catalogo_id, cliente_id);
```

### 2. Refatorar `TransmissaoManagerModal.tsx`

- **Ao abrir o modal ou trocar o catálogo selecionado**: consultar `catalogo_envios` filtrando por `catalogo_id` selecionado para obter a lista de `cliente_id` que já receberam
- Se `all_active` estiver selecionado, buscar envios de todos os catálogos ativos e filtrar clientes que já receberam **todos** eles
- Criar estado `clientesFiltrados` = clientes originais menos os já enviados
- O card "Público Alvo" mostrará a contagem filtrada, com indicação de quantos foram removidos (ex: "1000 → 850 pendentes (150 já receberam)")
- O botão "Iniciar Transmissão" usará `clientesFiltrados` em vez de `clientes`
- Após cada envio bem-sucedido, inserir registro em `catalogo_envios` (para cada catálogo enviado)
- Manter o `marcarContato` existente para compatibilidade

### 3. Randomização de saudações aprimorada

O array `SAUDACOES` será atualizado para conter apenas saudações curtas (sem sufixo). A lógica de composição da mensagem ficará:

```
{saudação} {primeiro_nome}, tudo bem? {mensagem_do_catálogo}
```

Variações do sufixo também serão randomizadas:

```typescript
const SUFIXOS = [
  ', tudo bem?', ', tudo certo?', ', como vai?', 
  ', tudo bom?', '! Tudo tranquilo?', '! Como está?'
];
```

Resultado final: `"Oii Maria, tudo certo? Segue nosso catálogo..."` — cada mensagem com início único.

### 4. Exibição no modal

- Novo indicador visual no card de Público Alvo mostrando "X já receberam" em azul e "Y pendentes" em destaque
- O contador `jaEnviados` que já existe no UI será alimentado com dados reais do banco
- Loading state enquanto consulta os envios anteriores

### Arquivos alterados
- Nova migração SQL (tabela `catalogo_envios`)
- `src/components/clientes/TransmissaoManagerModal.tsx` — filtro de duplicatas, randomização, inserção de envios
- Array de saudações e sufixos refinado

