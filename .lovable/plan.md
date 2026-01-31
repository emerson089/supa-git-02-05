

## Plano: Implementar Taxa de Excursao nos Pedidos

### Resumo da Solucao

Criar um cadastro de excursoes com taxa fixa associada. Quando um pedido for criado com uma excursao cadastrada, a taxa sera exibida separadamente e somada ao valor total do pedido.

---

### 1. Alteracoes no Banco de Dados

#### Nova Tabela: `excursoes`

```sql
CREATE TABLE excursoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  taxa NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Identificador unico |
| user_id | UUID | Usuario dono do registro |
| nome | TEXT | Nome da excursao (ex: "Regis Tur") |
| taxa | NUMERIC | Valor fixo cobrado (ex: 15.00) |
| ativo | BOOLEAN | Se a excursao esta ativa |

#### Alteracao na Tabela `pedidos`

Adicionar coluna para armazenar a taxa aplicada:

```sql
ALTER TABLE pedidos 
  ADD COLUMN excursao_id UUID REFERENCES excursoes(id),
  ADD COLUMN taxa_excursao NUMERIC DEFAULT 0;
```

| Nova Coluna | Tipo | Descricao |
|-------------|------|-----------|
| excursao_id | UUID | Referencia a excursao cadastrada |
| taxa_excursao | NUMERIC | Valor da taxa no momento do pedido |

---

### 2. Novos Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/ConfigExcursoes.tsx` | Tela de cadastro de excursoes |
| `src/hooks/useExcursoes.ts` | Hook para CRUD de excursoes |
| `src/components/excursoes/ExcursaoForm.tsx` | Formulario de cadastro/edicao |
| `src/components/excursoes/ExcursaoList.tsx` | Lista de excursoes |

---

### 3. Alteracoes em Arquivos Existentes

#### 3.1 `src/pages/NovoPedido.tsx`

**Adicionar:**
- Estado para excursao_id e taxa_excursao
- Busca da taxa ao selecionar excursao
- Calculo do valor total incluindo taxa

```typescript
// Novo calculo
const valorItens = items.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);
const valorTotal = valorItens + taxaExcursao;
```

#### 3.2 `src/components/pedidos/ClienteInfoCard.tsx`

**Alterar:**
- Transformar campo "Excursao" de texto livre para combobox
- Buscar excursoes cadastradas
- Ao selecionar, retornar excursao_id e taxa

#### 3.3 `src/components/pedidos/ResumoCard.tsx`

**Adicionar:**
- Linha separada para taxa de excursao
- Mostrar subtotal dos itens + taxa = total

```
Subtotal Itens:    R$ 1.356,00
Taxa Excursao:     R$    15,00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Valor Total:       R$ 1.371,00
```

#### 3.4 `src/contexts/PedidosContext.tsx`

**Adicionar:**
- Campos excursao_id e taxa_excursao no tipo Pedido
- Mapeamento no transformDBToContext

#### 3.5 `src/hooks/usePedidosData.ts`

**Adicionar:**
- Campos excursao_id e taxa_excursao em PedidoDB, PedidoInsert, PedidoUpdate

#### 3.6 `src/components/layout/AppSidebar.tsx`

**Adicionar:**
- Link para pagina de configuracao de excursoes no menu

---

### 4. Fluxo de Uso

```text
┌─────────────────────────────────────────────────────────────┐
│  CONFIGURACAO (uma vez)                                      │
│                                                              │
│  1. Admin acessa Configuracoes > Excursoes                  │
│  2. Cadastra "Regis Tur" com taxa R$ 15,00                  │
│  3. Cadastra "Walla Tur" com taxa R$ 12,00                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  CRIACAO DE PEDIDO                                           │
│                                                              │
│  1. Vendedor seleciona cliente "Ivana Coelho"               │
│  2. Sistema preenche excursao do cliente (Regis Tur)        │
│  3. Sistema busca taxa: R$ 15,00                            │
│  4. Vendedor adiciona itens: R$ 1.356,00                    │
│  5. Resumo mostra:                                          │
│     - Subtotal: R$ 1.356,00                                 │
│     - Taxa Excursao: R$ 15,00                               │
│     - Total: R$ 1.371,00                                    │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. Migracao de Dados

Os clientes existentes tem excursao como texto livre. A migracao sera gradual:

1. Criar tabela `excursoes` vazia
2. Admin cadastra as excursoes manualmente com suas taxas
3. Ao editar pedidos antigos, manter compatibilidade com texto livre
4. Novos pedidos usam o combobox com taxa

---

### 6. Interface da Tela de Excursoes

```
┌──────────────────────────────────────────────────────────────┐
│  EXCURSOES                                                    │
│  Gerencie as excursoes e suas taxas                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [+ Nova Excursao]                                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Regis Tur                        R$ 15,00    [Editar] │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Walla Tur                        R$ 12,00    [Editar] │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Felipe Excursao                  R$ 10,00    [Editar] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 7. Comportamento Especial

| Cenario | Comportamento |
|---------|---------------|
| Excursao nao cadastrada | Campo permite texto livre, taxa = 0 |
| Cliente sem excursao | Campo vazio, sem taxa |
| Editar pedido antigo | Manter texto livre, taxa = 0 |
| Excursao inativada | Nao aparece no combobox, mas pedidos antigos mantem |

---

### 8. RLS Policies para `excursoes`

```sql
-- SELECT: Usuario ve suas excursoes
-- INSERT: Usuario pode criar suas excursoes
-- UPDATE: Usuario pode editar suas excursoes
-- DELETE: Usuario pode deletar suas excursoes
```

---

### 9. Resumo de Impacto

| Area | Arquivos Impactados |
|------|---------------------|
| Banco de Dados | 1 tabela nova, 1 tabela alterada |
| Paginas | 1 nova pagina |
| Hooks | 1 novo hook |
| Componentes | 2 novos, 3 alterados |
| Contextos | 1 alterado |
| Rotas | 1 nova rota |
| Sidebar | 1 link novo |

---

### 10. Ordem de Implementacao

1. Criar tabela `excursoes` no banco
2. Alterar tabela `pedidos` (adicionar colunas)
3. Criar hook `useExcursoes`
4. Criar pagina `ConfigExcursoes`
5. Alterar `ClienteInfoCard` para usar combobox
6. Alterar `ResumoCard` para mostrar taxa
7. Alterar `NovoPedido` para incluir taxa no calculo
8. Atualizar contextos e hooks de pedidos
9. Adicionar link no menu

