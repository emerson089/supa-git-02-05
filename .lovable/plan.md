

## Plano: Adicionar Título às Cargas de Feira

### Objetivo
Permitir que o usuário defina um título/nome para cada carga (ex: "Alfaiataria", "Jeans") para facilitar a identificação no histórico e nas cargas em andamento.

### Abordagem Técnica
Utilizar o campo `observacoes` já existente na tabela `transferencias` como título da carga. Isso evita alterações no banco de dados e aproveita a estrutura existente.

### Alterações Necessárias

#### 1. Componente de Seleção de Produtos - `NovaCargaStepProdutos.tsx`
Adicionar um campo de Input para o título da carga no header, antes da busca de produtos.

| Mudança | Descrição |
|---------|-----------|
| Nova prop `titulo` | Valor atual do título |
| Nova prop `onTituloChange` | Callback para atualizar o título |
| Input de título | Campo opcional no topo do modal |

#### 2. Componente Bottom Sheet Mobile - `NovaCargaBottomSheet.tsx`
Mostrar o título no header quando definido.

#### 3. Página Feira - `Feira.tsx`
- Adicionar estado `tituloCarga`
- Passar o título para o `useCriarCargaFeira` via campo `observacoes`
- Resetar título após criação bem-sucedida

#### 4. Alerta de Cargas Ativas - `CargasAtivasAlerta.tsx`
- Exibir o título (observacoes) antes ou no lugar do horário quando disponível
- Layout: `"Alfaiataria" 18:35 • 284 pç • R$ 11.787,00`

#### 5. Histórico Agrupado - `HistoricoAgrupado.tsx`
- Exibir o título nas linhas de cargas concluídas

#### 6. Detalhes da Carga - `DetalhesCargaModal.tsx`
- Mostrar o título no cabeçalho do modal

### Fluxo de Uso

```text
1. Usuário clica em "+ Nova Carga"
2. Modal abre com campo "Título da carga (opcional)"
   Placeholder: "Ex: Alfaiataria, Jeans..."
3. Usuário digita "Alfaiataria" 
4. Seleciona os produtos
5. Confirma criação
6. Na lista de "Cargas em Andamento":
   "Alfaiataria" 18:35 • 284 pç • R$ 11.787,00
```

### UI/UX Mobile

```
┌──────────────────────────────────────┐
│ 🚚 Nova Carga                     X  │
├──────────────────────────────────────┤
│ Título da carga (opcional)           │
│ ┌──────────────────────────────────┐ │
│ │ Ex: Alfaiataria, Jeans...        │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ 🔍 Buscar produto...                 │
├──────────────────────────────────────┤
│ Produtos (42)                        │
├──────────────────────────────────────┤
│ ... lista de produtos ...            │
└──────────────────────────────────────┘
```

### Exibição no Alerta de Cargas Ativas

**Com título:**
```
⏰ "Alfaiataria" 18:35  284 peças  R$ 11.787,00  [Editar] [PDF] [Retorno]
```

**Sem título:**
```
⏰ 18:35  284 peças  R$ 11.787,00  [Editar] [PDF] [Retorno]
```

### Arquivos Impactados

| Arquivo | Tipo de Alteração |
|---------|------------------|
| `src/pages/Feira.tsx` | Adicionar estado e passar para criação |
| `src/components/feira/NovaCargaStepProdutos.tsx` | Adicionar campo de título |
| `src/components/feira/NovaCargaBottomSheet.tsx` | Mostrar título no header |
| `src/components/feira/CargasAtivasAlerta.tsx` | Exibir título nas cargas |
| `src/components/feira/HistoricoAgrupado.tsx` | Exibir título no histórico |
| `src/components/feira/DetalhesCargaModal.tsx` | Mostrar título no modal |

### Sem Alterações no Banco de Dados
O campo `observacoes` (text, nullable) já existe na tabela `transferencias` e será reutilizado como título.

