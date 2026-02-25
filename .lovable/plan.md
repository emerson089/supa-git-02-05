

## Corrigir nome do Cortador incorreto em lotes antigos

### Problema

Para lotes criados antes da implementacao do log inicial, o sistema usa `lot.responsavel` como fallback para o "Cortador". Porem, esse campo e sobrescrito a cada movimentacao de etapa, entao mostra o responsavel da ultima etapa (ex: "Kaysu lavanderia", "Sky Blue") em vez do cortador real.

Isso afeta dois lugares:
- O badge "Cortador: X" no resumo de "Responsaveis por Etapa"
- A linha "Cortador: X" no evento "Lote Criado" da timeline

### Solucao

Remover o fallback para `lot.responsavel`, pois ele nao e confiavel. O cortador so sera exibido quando existir um log inicial (processo_anterior nulo e processo_novo = 'Corte') que foi criado junto com o lote. Para lotes antigos sem esse log, simplesmente nao exibir o cortador ao inves de mostrar informacao errada.

### Alteracoes

**Arquivo: `src/hooks/useProducaoLog.ts`**
- Remover o fallback nas linhas 113-116 que adiciona `responsavelLote` ao mapa de responsaveis por etapa quando nao ha entrada para "Corte"

**Arquivo: `src/components/production/HistoricoProducaoModal.tsx`**
- Na secao "Lote Criado" (linha 189), remover o fallback `|| lot.responsavel`. Usar apenas `logInicial?.responsavel` para que o cortador so apareca se existir o log inicial correto

### Impacto

- Lotes novos (criados apos a implementacao do log inicial): continuam mostrando o cortador corretamente
- Lotes antigos (sem log inicial): nao mostrarao cortador, o que e melhor do que mostrar informacao errada
