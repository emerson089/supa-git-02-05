
## Plano: Melhorias no Sistema de Contagens

Analisei o sistema atual de contagens de estoque e identifiquei várias oportunidades para facilitar sua vida no dia-a-dia. A imagem mostra o **Histórico de Contagens** e o card **"Desde última contagem"**.

---

### Melhorias Propostas

#### 1. Mostrar Variação Entre Contagens

**O que é hoje**: Apenas exibe peças e valor de cada contagem isoladamente.

**Melhoria**: Mostrar a **diferença** entre contagens consecutivas:
- "Vendido: 234 peças (R$ 10.616)" entre 03/02 e 30/01
- Indicador visual verde/vermelho para ganho ou perda de estoque

Isso permite ver rapidamente quanto foi vendido em cada período sem precisar fazer conta.

---

#### 2. Expandir Detalhes por Contagem

**Melhoria**: Ao clicar em uma contagem, expandir para mostrar:
- Lista dos produtos que estavam em estoque naquele momento
- Quantidade de cada produto
- Preço aplicado

Útil para conferir exatamente o que estava na loja naquele dia.

---

#### 3. Gráfico de Evolução

**Melhoria**: Adicionar um mini-gráfico de linha no topo do modal mostrando:
- Eixo X: datas das contagens
- Eixo Y: valor do estoque

Visualização rápida da tendência: estoque crescendo, diminuindo ou estável.

---

#### 4. Métricas Calculadas Automaticamente

Adicionar um resumo no topo do modal:
- **Média de vendas/dia** desde a primeira contagem
- **Total vendido** no período (soma das variações)
- **Ticket médio** por peça vendida

---

#### 5. Ação Rápida de Nova Contagem

**Melhoria**: Botão "+ Nova Contagem" direto no modal de histórico, permitindo registrar sem fechar e reabrir.

---

#### 6. Deletar Contagens Antigas

**Melhoria**: Opção de excluir contagens antigas (com confirmação). Útil para:
- Remover contagens feitas por engano
- Limpar histórico antigo que não é mais relevante

---

### Alterações Técnicas

#### Arquivo: `src/hooks/useContagensEstoque.ts`

1. Criar hook `useContagemDetalhes(contagemId)` para buscar itens de uma contagem específica
2. Criar hook `useContagensComVariacao(localId)` que calcula diferenças entre contagens consecutivas
3. Criar mutation `useExcluirContagem()` para deletar contagens

#### Arquivo: `src/components/estoque/HistoricoContagensModal.tsx`

1. Adicionar cálculo de variação entre contagens
2. Tornar cards expansíveis (Collapsible)
3. Adicionar mini-gráfico com Recharts
4. Adicionar botão "+ Nova Contagem" no header
5. Adicionar botão de exclusão com confirmação
6. Adicionar resumo estatístico no topo

---

### Layout Visual (Proposto)

```text
┌─────────────────────────────────────────────────────────────┐
│ 📋 Histórico de Contagens                 [+ Nova Contagem] │
│ Loja Parque das Feiras                                      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📊 Resumo do Período                                    │ │
│ │ Média vendas/dia: 15 peças | Total vendido: R$ 12.871   │ │
│ │ ┌──────────────────────────────────────────────────────┐│ │
│ │ │  [Mini gráfico de linha - evolução do estoque]       ││ │
│ │ └──────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 📅 03/02/2026 10:03                        [Última] 🗑  │   │
│ │ 📦 Peças: 1019  💵 Valor: R$ 40.770,00                 │   │
│ │ ────────────────────────────────────────────────────── │   │
│ │ 🔻 Vendido desde anterior: 234 peças (-R$ 10.616)      │   │
│ │                                                        │   │
│ │ ▼ Ver itens desta contagem                             │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 📅 30/01/2026 08:41                               🗑    │   │
│ │ 📦 Peças: 1253  💵 Valor: R$ 51.386,00                 │   │
│ │ ────────────────────────────────────────────────────── │   │
│ │ 🔻 Vendido desde anterior: 208 peças (-R$ 10.056)      │   │
│ │                                                        │   │
│ │ ▼ Ver itens desta contagem                             │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useContagensEstoque.ts` | Adicionar hooks para detalhes, variação e exclusão |
| `src/components/estoque/HistoricoContagensModal.tsx` | UI expandida com gráfico, variações, exclusão e nova contagem |

---

### Resultado Esperado

1. Ver instantaneamente quanto vendeu entre cada contagem
2. Visualizar tendência do estoque via gráfico
3. Consultar detalhes de qualquer contagem passada
4. Registrar nova contagem sem sair do histórico
5. Excluir contagens incorretas
6. Ter métricas automáticas (média, total, ticket)

---

### Prioridade de Implementação

Se preferir fazer em etapas:

1. **Essencial**: Variação entre contagens (mais impacto imediato)
2. **Alta**: Botão "+ Nova Contagem" no modal
3. **Média**: Exclusão de contagens
4. **Bônus**: Gráfico e métricas resumidas
