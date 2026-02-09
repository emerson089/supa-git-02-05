

## Plano: Prompt de Informações ao Mover Lotes Entre Etapas

### Problema

Quando um lote avança de etapa (ex: Corte para Costura), a transição acontece instantaneamente sem pedir nenhuma informação. Dados importantes se perdem:

- Na etapa **Corte**: quantos rolos de tecido foram cortados
- Na etapa **Costura/Facção**: qual facção/costureira fez o serviço
- Na etapa **Lavanderia**: qual lavanderia foi usada
- E assim por diante...

### Solução

Criar um **modal de transição** que aparece quando o lote é movido para a próxima etapa, pedindo informações específicas de cada etapa. Essas informações ficam salvas no log de movimentação (`producao_log.observacao`) e também atualizáveis na tabela `producao`.

### Campos por Etapa

| De (Saindo de) | Para (Entrando em) | Campos Solicitados |
|---------|--------------|---------------------|
| -- | Corte | Responsável (cortador), Qtd de rolos |
| Corte | Costura/Facção | Responsável (facção), Observação |
| Costura/Facção | Travete | Responsável, Observação |
| Travete | Destroyed | Responsável, Observação |
| Destroyed | Lavanderia | Responsável (lavanderia), Observação |
| Lavanderia | Limpado | Responsável, Observação |
| Limpado | Aprontamento | Responsável, Observação |
| Aprontamento | Vendas | (mantém checklist existente) |

O campo **Responsável** usa o `ResponsavelSelector` já existente, que lista prestadores cadastrados por etapa.

### Como Funciona

```text
Usuário clica "Avançar" no card do lote 1024
         │
         ▼
┌──────────────────────────────────────────────┐
│  Mover lote 1024 para Costura/Facção         │
│                                              │
│  Responsável:  [▼ Selecione a facção    ]    │
│                                              │
│  Observação:   [                        ]    │
│                (opcional)                    │
│                                              │
│          [Cancelar]    [Confirmar]            │
└──────────────────────────────────────────────┘
         │
         ▼
  Salva responsável no lote + registra log
  com observação e responsável da nova etapa
```

Para a etapa **Corte** especificamente, o modal terá um campo extra:

```text
┌──────────────────────────────────────────────┐
│  Mover lote 1024 para Costura/Facção         │
│  (Saindo de: Corte)                          │
│                                              │
│  Qtd de rolos cortados:  [___]               │
│                                              │
│  Responsável:  [▼ Selecione a facção    ]    │
│                                              │
│  Observação:   [                        ]    │
│                                              │
│          [Cancelar]    [Confirmar]            │
└──────────────────────────────────────────────┘
```

### Onde Salvar os Dados

- **Responsável da nova etapa**: Atualiza `producao.responsavel` com o nome selecionado
- **Observação**: Salva em `producao_log.observacao` no registro de movimentação
- **Qtd de rolos** e campos extras: Salva em `producao_log.observacao` como texto formatado (ex: "Rolos: 3 | Obs: tecido preto")

### Estrutura Técnica

#### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/production/StageTransitionModal.tsx` | Modal que aparece ao mover entre etapas, com campos dinâmicos por etapa |

#### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Index.tsx` | Interceptar `handleStageChange` para abrir o modal ao invés de mover direto |
| `src/components/production/ProductionCard.tsx` | Exibir informação do responsável atual e dados da etapa no card |
| `src/components/production/MobileProductionCard.tsx` | Mesma exibição mobile |

#### Fluxo no Index.tsx

Atualmente o `handleStageChange` move direto. A mudança:

1. Ao clicar "Avançar" ou arrastar, ao invés de mover imediatamente, abre o `StageTransitionModal`
2. O modal mostra campos específicos da etapa de destino
3. Ao confirmar, executa a movimentação + salva as informações extras
4. Ao cancelar, nada acontece

#### Configuração dos Campos por Etapa

```typescript
const STAGE_FIELDS = {
  'Corte': {
    showResponsavel: true,
    extraFields: [
      { key: 'rolos', label: 'Qtd de rolos', type: 'number' }
    ]
  },
  'Costura/Facção': {
    showResponsavel: true,
    extraFields: []
  },
  'Travete': {
    showResponsavel: true,
    extraFields: []
  },
  'Destroyed': {
    showResponsavel: true,
    extraFields: []
  },
  'Lavanderia': {
    showResponsavel: true,
    extraFields: []
  },
  'Limpado': {
    showResponsavel: true,
    extraFields: []
  },
  'Aprontamento': {
    showResponsavel: true,
    extraFields: []
  },
  'Vendas': {
    showResponsavel: false,
    extraFields: []
  }
};
```

#### Dados Visíveis no Card

Após a transição, o card exibirá:
- O **responsável da etapa atual** (já exibe, mas agora será atualizado corretamente a cada transição)
- O campo **Qtd de rolos** ficará visível no histórico de movimentações do lote

### Ordem de Implementação

```text
1. Criar StageTransitionModal.tsx com campos dinâmicos
2. Modificar Index.tsx para interceptar movimentações e abrir o modal
3. Salvar responsável + observação no banco ao confirmar
4. Garantir que drag-and-drop também abre o modal
5. Manter comportamento existente do checklist de Aprontamento
```

### Resultado Esperado

- Cada transição de etapa pede as informações relevantes
- O responsável é atualizado automaticamente ao entrar na nova etapa
- Informações extras (rolos, observações) ficam salvas no histórico
- O histórico de movimentações fica mais rico e rastreável
- Tudo funciona tanto no desktop (Kanban) quanto no mobile

