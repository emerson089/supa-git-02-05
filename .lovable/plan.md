

## Correcoes no Modulo de Producao (4 itens)

### 1. Kezia aparecendo no Corte

Kezia aparece como opcao no seletor de responsavel do Corte porque esta cadastrada na tabela `prestadores_servico` com a etapa "Corte" nas suas etapas. A correcao precisa ser feita no banco de dados (remover "Corte" das etapas de Kezia) ou na tela de configuracao de prestadores. Isso nao e um bug de codigo -- e um dado cadastrado incorretamente. Voce pode corrigir editando os prestadores na configuracao.

**Acao alternativa no codigo**: Posso adicionar uma validacao extra, mas o correto e ajustar o cadastro de Kezia removendo "Corte" das etapas dela. Se preferir, posso verificar se existe uma tela de gerenciamento de prestadores para orientar.

### 2. Cortador no "Lote Criado" no historico

Atualmente, o evento "Lote Criado" no historico nao mostra o responsavel/cortador. O campo `responsavel` do lote armazena quem foi selecionado na criacao, mas o evento de criacao na timeline nao exibe essa informacao.

**Alteracao**: No `HistoricoProducaoModal.tsx`, adicionar o nome do responsavel (cortador) no evento "Lote Criado", usando o fallback `responsavelLote` que ja e passado ao hook mas so e usado no resumo de "Responsaveis por Etapa".

**Arquivo**: `src/components/production/HistoricoProducaoModal.tsx` (linhas 166-187)
- Adicionar abaixo de "Etapa inicial: Corte" uma linha mostrando "Cortador: [nome]" quando o `lot.responsavel` existir.

### 3. Checklist de Aprontamento deve abrir ao ENTRAR em Aprontamento (nao ao sair)

Atualmente o checklist so aparece quando o lote tenta sair de Aprontamento para Vendas (validacao na linha 187-194 do Index.tsx). O usuario quer que o checklist abra automaticamente quando o lote CHEGA em Aprontamento.

**Alteracao**: No `executeStageMove` em `src/pages/Index.tsx`, apos a movimentacao ser concluida com sucesso, se o `newStage === 'Aprontamento'`, abrir automaticamente o modal de checklist. Manter tambem a validacao ao sair para Vendas (para garantir que foi preenchido).

**Arquivo**: `src/pages/Index.tsx` (apos linha 268, dentro do bloco de sucesso)
- Adicionar: se `newStage === 'Aprontamento'`, setar `selectedLoteForChecklist` com o lote atualizado e abrir `showChecklistModal`.

### 4. Corrigir responsaveis por etapa no historico

O resumo "Responsaveis por Etapa" mostra dados incorretos:
- "Cortador: Maria Eduarda" esta errado -- o cortador deveria ser Ildo ou Zeze (quem foi selecionado na criacao do lote)
- "Vendas: Maria Eduarda" nao deveria aparecer -- Vendas nao tem responsavel (showResponsavel: false)

**Alteracoes no `src/hooks/useProducaoLog.ts`**:

a) **Remover "Vendas" do mapa de responsaveis**: Na logica de `responsaveisPorEtapa` (linhas 106-111), ignorar logs onde `processo_novo === 'Vendas'`, ja que Vendas nao tem responsavel configurado.

b) **Cortador fallback**: O fallback para Corte ja existe (linhas 114-116) usando `responsavelLote`. O problema e que `lot.responsavel` pode ter sido sobrescrito pela ultima movimentacao. O campo `responsavel` do lote e atualizado a cada transicao (linha 226-228 do Index.tsx). Entao o fallback `responsavelLote` pode estar com o valor errado.

**Solucao**: Buscar o responsavel do Corte a partir do primeiro log (processo_anterior = null ou processo_novo = primeiro estagio) ou das observacoes do lote. Alternativamente, ao criar o lote, registrar um log inicial com o cortador. A solucao mais simples e: ao mover o lote pela primeira vez (Corte -> Costura), o log registra `processo_anterior: 'Corte'` e `responsavel` e o da nova etapa. O cortador original fica no campo `responsavel` do lote na criacao, mas e sobrescrito nas movimentacoes seguintes.

**Correcao robusta**: Inverter a logica dos logs -- no log de transicao `Corte -> Costura/Faccao`, o `responsavel` registrado e da Costura (novo estagio). Para saber quem foi o cortador, precisamos do log de criacao ou do primeiro responsavel do lote. Como nao ha log de criacao, a melhor abordagem e:
- Criar um log de criacao automaticamente ao criar o lote (processo_anterior: null, processo_novo: 'Corte', responsavel: cortador selecionado)

**Arquivo**: `src/pages/Index.tsx` - na funcao `handleSave` de criacao de lote, apos criar o lote, criar um log inicial.

### Resumo de arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/production/HistoricoProducaoModal.tsx` | Mostrar cortador no evento "Lote Criado" |
| `src/pages/Index.tsx` | Abrir checklist ao entrar em Aprontamento; Criar log inicial ao criar lote |
| `src/hooks/useProducaoLog.ts` | Filtrar "Vendas" do mapa de responsaveis por etapa |

