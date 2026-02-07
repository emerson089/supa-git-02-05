

## Plano: Template de Custos Padrão para Lotes

### Problema Identificado

Atualmente você precisa adicionar **cada custo manualmente**, um por um, toda vez que abre um novo lote. Isso é trabalhoso porque:

1. Os mesmos custos se repetem em quase todos os lotes (Facção, Lavanderia, Botão, Zíper, Travete, Bolsa, Aprontamento, Limpado)
2. Você precisa lembrar o valor de cada um
3. Quando o valor muda, precisa digitar manualmente

### Análise dos Seus Custos Atuais

Com base nos dados do sistema, identifiquei os custos mais usados:

| Tipo | Descrição | Valor/pç | Uso |
|------|-----------|----------|-----|
| Acabamento | bolsa | R$ 0,20 | 4x |
| Aviamentos | zíper | R$ 0,70 | 3x |
| Lavanderia | Sky Blue | R$ 4,00 | 3x |
| Aviamentos | botao | R$ 0,20 | 2x |
| Acabamento | travete | R$ 0,50 | 2x |
| Facção/Costura | Izabel | R$ 7,00 | 2x |

### Solução Proposta

Criar um sistema de **Templates de Custos** com:

#### 1. Lista de Custos Padrão (Configurável)

Uma nova página/seção de configuração onde você cadastra os custos que sempre usa:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ⚙️ Custos Padrão                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✓ Facção/Costura    Izabel          R$ 9,50/pç                    │
│  ✓ Lavanderia        Sky Blue        R$ 4,00/pç                    │
│  ✓ Aviamentos        Botão           R$ 0,20/pç                    │
│  ✓ Aviamentos        Zíper           R$ 0,70/pç                    │
│  ✓ Acabamento        Travete         R$ 0,50/pç                    │
│  ✓ Acabamento        Bolsa           R$ 0,20/pç                    │
│  ✓ Acabamento        Aprontamento    R$ 0,60/pç                    │
│  ✓ Acabamento        Limpado         R$ 0,40/pç                    │
│                                                                     │
│  [+ Adicionar Custo Padrão]                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. Botão "Aplicar Custos Padrão" no Modal

No modal de custos do lote, um botão que aplica todos os custos padrão de uma vez:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ $ Custos do Lote 1025                                               │
│ PLS Saia cargo jeans - 150 peças                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [🔄 Aplicar Custos Padrão]     ← Adiciona todos de uma vez!        │
│                                                                     │
│  Custos (8)                                                         │
│  ─────────────────────────────────────────────────────────────────  │
│  ✓ Facção/Costura   Izabel        R$ 9,50   →   R$ 1.425,00        │
│  ○ Lavanderia       Sky Blue      R$ 4,00   →   R$ 600,00          │
│  ○ Aviamentos       Botão         R$ 0,20   →   R$ 30,00           │
│  ...                                                                │
│                                                                     │
│  [+ Adicionar Custo Avulso]     ← Para custos que não são padrão   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3. Edição Rápida de Valores

Permitir editar o valor diretamente na lista (clicando no valor), sem precisar excluir e adicionar novamente.

#### 4. Custo "Outros" com Descrição Livre

Manter a opção "Outros" para custos específicos que não estão no padrão, onde você pode digitar a descrição.

### Estrutura do Banco de Dados

Nova tabela `custos_padrao`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Identificador |
| user_id | UUID | Proprietário |
| tipo | TEXT | Categoria (Facção, Lavanderia, etc.) |
| descricao | TEXT | Nome do prestador/serviço |
| valor_unitario | NUMERIC | Valor padrão por peça |
| ativo | BOOLEAN | Se está ativo |
| ordem | INTEGER | Ordem de exibição |

### Fluxo de Uso

```text
1. Configuração (uma vez):
   → Acessar "Configurações" > "Custos Padrão"
   → Cadastrar: Facção Izabel R$ 9,50, Lavanderia Sky Blue R$ 4,00, etc.

2. Uso no Lote (todo lote novo):
   → Abrir modal de custos
   → Clicar "Aplicar Custos Padrão"
   → Todos os custos são adicionados automaticamente!
   → Ajustar valores se necessário (ex: Facção pode variar)
   → Adicionar custo avulso se precisar (ex: "Outros - Bordado")
```

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/xxx_custos_padrao.sql` | Tabela de custos padrão |
| `src/pages/ConfigCustosPadrao.tsx` | Página de configuração |
| `src/hooks/useCustosPadrao.ts` | Hook para gerenciar custos padrão |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/production/CustosLoteModal.tsx` | Botão "Aplicar Custos Padrão" + edição inline de valores |
| `src/components/layout/AppSidebar.tsx` | Link para página de configuração |
| `src/App.tsx` | Rota para nova página |

### Funcionalidades Extras (Fase 2)

1. **Edição inline de valores**: Clicar no valor R$ 9,50 abre input para editar direto
2. **Sincronização com Prestadores**: Vincular custos padrão aos prestadores já cadastrados
3. **Histórico de valores**: Ver quanto era o custo de facção no mês passado
4. **Sugestão inteligente**: Sistema sugere valores baseado nos últimos lotes

### Critérios de Aceite

1. Usuário consegue cadastrar lista de custos padrão
2. Botão "Aplicar Custos Padrão" adiciona todos de uma vez
3. Custos já existentes no lote não são duplicados ao aplicar padrão
4. Valores podem ser editados após aplicar
5. Opção "Outros" permite descrição livre para custos avulsos
6. Sistema lembra os custos padrão entre sessões

### Ordem de Implementação

```text
Fase 1 (Essencial):
├── 1. Criar tabela custos_padrao
├── 2. Criar página de configuração
├── 3. Criar hook useCustosPadrao
├── 4. Adicionar botão no CustosLoteModal
└── 5. Lógica para aplicar custos sem duplicar

Fase 2 (Melhorias):
├── 6. Edição inline de valores no modal
├── 7. Vincular com prestadores existentes
└── 8. Importar custos mais usados como sugestão inicial
```

