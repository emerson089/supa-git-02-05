

## Correcoes e Melhoria nos Filtros do Relatorio de Saidas

### Problema 1: Dados podem nao ser salvos corretamente

A funcao RPC `rpc_ajustar_estoque_local` cria a movimentacao **sem** `tipo_ajuste_id` e `preco_aplicado`. Depois, o codigo JS faz um UPDATE separado buscando "a ultima movimentacao" para adicionar esses campos. Isso e fragil -- se duas operacoes acontecerem ao mesmo tempo, pode atualizar o registro errado.

**Solucao**: Atualizar a RPC para receber `p_tipo_ajuste_id` e `p_preco_aplicado` como parametros opcionais e ja inserir esses valores diretamente no INSERT da movimentacao, de forma atomica.

### Problema 2: Filtros funcionam mas a logica e complexa

A logica de "Venda/Loja" expandir automaticamente para incluir AJUSTE_SAIDA com `conta_como_venda=true` funciona, mas adiciona complexidade. Isso sera simplificado junto com o problema 3.

### Problema 3: Dois campos de filtro confusos (Tipo de Saida + Tipo de Ajuste)

Atualmente existem dois filtros separados:
- **Tipo de Saida**: Ajuste Estoque, Venda/Loja, Envio Feira, Transferencia, Retorno Feira
- **Tipo de Ajuste**: Ajuste de estoque, Defeito, Devolucao de cliente, Venda/loja, etc.

A proposta e **unificar em um unico filtro "Tipo de Movimentacao"** com uma lista flat que mistura os tipos do sistema com os tipos de ajuste do usuario:

```text
Filtro unico "Tipo de Movimentacao":
  - Venda / Loja          (sistema + ajustes conta_como_venda)
  - Envio Feira            (sistema)
  - Transferencia          (sistema)
  - Retorno Feira          (sistema)
  --- separador ---
  - Ajuste de estoque      (tipo de ajuste do usuario)
  - Defeito                (tipo de ajuste do usuario)
  - Devolucao de cliente   (tipo de ajuste do usuario)
  - Devolucao p/ central   (tipo de ajuste do usuario)
```

Quando o usuario seleciona "Venda / Loja", a query traz VENDA_FEIRA + AJUSTE_SAIDA com conta_como_venda. Quando seleciona um tipo de ajuste especifico (ex: "Defeito"), traz apenas AJUSTE_SAIDA com aquele tipo_ajuste_id.

---

### Alteracoes tecnicas

#### 1. Migracao SQL -- Atualizar RPC para receber tipo_ajuste_id e preco_aplicado

Adicionar dois parametros opcionais a `rpc_ajustar_estoque_local`:

```text
p_tipo_ajuste_id UUID DEFAULT NULL
p_preco_aplicado NUMERIC DEFAULT NULL
```

E incluir esses valores no INSERT da movimentacao, eliminando a necessidade do UPDATE separado no JS.

#### 2. useEstoquePorLocalGerenciamento.ts -- Simplificar mutacao

Remover o bloco que busca "ultima movimentacao" e faz UPDATE separado. Passar `tipoAjusteId` e `precoAplicado` diretamente na chamada da RPC.

#### 3. RelatorioSaidasModal.tsx -- Unificar filtros

- Remover o estado `tiposAjusteSelecionados` e o filtro separado "Tipo de Ajuste"
- Substituir o filtro "Tipo de Saida" por um unico "Tipo de Movimentacao" que combina tipos do sistema e tipos de ajuste do usuario
- Cada opcao tera um identificador que indica se e tipo de sistema ou tipo de ajuste

#### 4. useRelatorioSaidas.ts -- Adaptar query ao filtro unificado

Atualizar `FiltrosSaidas` para usar uma lista unificada de filtros. A logica de query adaptara automaticamente: se o filtro selecionado e um tipo de sistema, filtra por `tipo`; se e um tipo de ajuste, filtra por `tipo_ajuste_id`.

---

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL (nova) | Atualizar RPC com parametros tipo_ajuste_id e preco_aplicado |
| `src/hooks/useEstoquePorLocalGerenciamento.ts` | Passar campos diretamente na RPC, remover UPDATE separado |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Unificar dois filtros em um unico "Tipo de Movimentacao" |
| `src/hooks/useRelatorioSaidas.ts` | Adaptar interface de filtros e logica de query |

