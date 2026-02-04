

## Plano: Melhorias no Módulo de Produção

### Situação Atual

Analisando o código, descobri algo importante: **O log de movimentações JÁ está sendo salvo no banco de dados!** 

O problema é que **não existe uma interface visual para visualizar este histórico**. A tabela `producao_log` tem registros com:
- `processo_anterior` e `processo_novo`
- `created_at` (data/hora da movimentação)
- `responsavel` (quem estava responsável na hora)
- `observacao` (campo disponível mas não utilizado)

Dados atuais no banco mostram movimentações reais sendo registradas:
- "Travete" → "Destroyed" em 04/02/2026 às 16:31
- "Corte" → "Costura/Facção" em 04/02/2026 às 13:40
- etc.

---

### Melhorias Propostas

#### 1. Modal de Histórico de Movimentações (PRINCIPAL)

Criar um novo componente `HistoricoProducaoModal` que mostra a timeline completa de movimentações de um lote.

**O que exibirá:**
- Lista cronológica de todas as movimentações
- Para cada movimentação: data/hora, etapa anterior → nova etapa, responsável
- Tempo total em produção (desde criação)
- Tempo médio por etapa

**Acesso:**
- Novo item no menu dropdown do card: "Ver Histórico"
- Ícone de relógio com timeline

---

#### 2. Indicador Visual de Movimentações no Card

Adicionar ao `ProductionCard`:
- Contador de movimentações (quantas vezes o lote mudou de etapa)
- Tooltip com última movimentação ao passar o mouse no indicador de tempo

---

#### 3. Adicionar Observação na Movimentação

Atualmente o campo `observacao` existe na tabela `producao_log` mas não é utilizado. 

**Melhoria:**
- Ao mover lote para outra etapa via setas ou drag-and-drop, mostrar um diálogo opcional para adicionar observação
- Opção de "Mover rapidamente sem observação" (comportamento atual)
- Opção de "Adicionar nota desta movimentação"

---

#### 4. Relatório de Lead Time (Tempo de Produção)

Criar funcionalidade para analisar:
- Tempo médio que lotes ficam em cada etapa
- Identificar gargalos (qual etapa demora mais)
- Comparar com períodos anteriores

**Interface:**
- Novo botão no header "Relatório de Tempo"
- Modal com gráfico de barras por etapa
- Tabela com detalhes

---

#### 5. Filtro por Período de Criação

Adicionar ao header de filtros:
- Filtrar lotes por data de criação
- Opções: Hoje, Últimos 7 dias, Últimos 30 dias, Período customizado

---

#### 6. Notificações de Lotes Atrasados

Cards que estão há mais de X dias na mesma etapa podem gerar alertas:
- Configuração de limite de dias por etapa
- Badge de "Atrasado" no card
- Filtro rápido para ver apenas atrasados

---

### Alterações Técnicas

#### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/production/HistoricoProducaoModal.tsx` | Modal de histórico de movimentações |
| `src/hooks/useProducaoLog.ts` | Hook para buscar logs de um lote específico |

#### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/entities/ProducaoLog.ts` | Adicionar campo de contagem e estatísticas |
| `src/components/production/ProductionCard.tsx` | Adicionar opção "Ver Histórico" no dropdown |
| `src/components/production/MobileProductionCard.tsx` | Adicionar opção "Ver Histórico" no dropdown |
| `src/pages/Index.tsx` | Controlar modal de histórico, adicionar diálogo de observação |
| `src/components/production/ProductionHeader.tsx` | Adicionar filtro de período e botão de relatório |

---

### Layout do Modal de Histórico

```text
┌──────────────────────────────────────────────────────────────┐
│ 📋 Histórico do Lote 1021                                ✕   │
│ PLS Short Saia jeans Plus Size 100% 590                      │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ⏱️ Tempo Total: 14 dias  |  🔄 8 movimentações           │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ────────────── Timeline ──────────────                       │
│                                                              │
│ 📍 04/02/2026 16:31                                          │
│ │  Travete → Destroyed                                       │
│ │  👤 Ivan                                                   │
│ │  ⏱️ 2 dias nesta etapa                                    │
│ │                                                            │
│ 📍 02/02/2026 10:15                                          │
│ │  Costura/Facção → Travete                                  │
│ │  👤 Regina                                                 │
│ │  💬 "Encaminhar para acabamento"                           │
│ │  ⏱️ 5 dias nesta etapa                                    │
│ │                                                            │
│ 📍 28/01/2026 09:00                                          │
│ │  Corte → Costura/Facção                                    │
│ │  👤 Zeze                                                   │
│ │  ⏱️ 3 dias nesta etapa                                    │
│ │                                                            │
│ 🎯 25/01/2026 14:30 - Lote Criado                            │
│    Etapa inicial: Corte                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Diálogo de Observação na Movimentação (Opcional)

```text
┌─────────────────────────────────────────────────────┐
│ Mover Lote 1021                                  ✕  │
│                                                     │
│ De: Corte → Para: Costura/Facção                    │
│                                                     │
│ Adicionar observação (opcional):                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Ex: Entregue para Patricia às 14h               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│        [Mover sem nota]    [Mover com nota]         │
└─────────────────────────────────────────────────────┘
```

---

### Prioridade de Implementação

1. **Essencial**: Modal de Histórico de Movimentações (maior impacto)
2. **Alta**: Indicador de movimentações no card
3. **Média**: Observação opcional na movimentação
4. **Bônus**: Relatório de Lead Time
5. **Bônus**: Filtro por período e notificações de atraso

---

### Resultado Esperado

1. Visualizar todo o histórico de um lote em um clique
2. Saber exatamente quando cada movimentação aconteceu
3. Registrar observações importantes nas movimentações
4. Identificar gargalos no processo produtivo
5. Acompanhar lotes que estão demorando demais em alguma etapa

