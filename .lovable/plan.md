

## Adicionar Numeracao das Pecas na Transicao Corte para Costura/Faccao

### Entendimento do Fluxo

O Corte e a primeira etapa. Quando o corte termina, o usuario move o lote para **Costura/Faccao**. Nesse momento e que ele sabe:
- Quantos rolos usou (ja capturado ao entrar no Corte)
- Quantas pecas foram cortadas (ja capturado ao entrar em Costura/Faccao)
- **Qual a numeracao das pecas** (ex: "34 ao 44") -- campo novo

### Alteracoes

#### 1. StageTransitionModal.tsx -- Adicionar campo de numeracao ao Costura/Faccao

O campo `numeracao` sera adicionado na configuracao da etapa `Costura/Faccao`, junto com o campo `pecas` que ja existe:

```text
'Costura/Faccao':
  - Qtd de pecas cortadas (number) -- ja existe
  - Numeracao das pecas (text, placeholder "Ex: 34 ao 44") -- novo
```

#### 2. Index.tsx -- Incluir numeracao no labelMap do log

Atualizar o `labelMap` para incluir `numeracao`, garantindo que o campo apareca formatado na observacao do log:

```text
labelMap: { rolos: 'Rolos', pecas: 'Pecas cortadas', numeracao: 'Numeracao' }
```

Resultado no log: `"Pecas cortadas: 200 | Numeracao: 34 ao 44"`

#### 3. HistoricoProducaoModal.tsx -- Exibir numeracao estruturada na timeline

Parsear o campo `observacao` dos logs para extrair e exibir dados com icones dedicados:

- **Rolos: 3** (icone Package)
- **Pecas cortadas: 200** (icone Scissors)
- **Numeracao: 34 ao 44** (icone Hash)
- Texto livre restante continua como observacao normal

Tambem adicionar secao de **Resumo de Responsaveis por Etapa** no topo do modal, mostrando quem foi responsavel em cada etapa que o lote passou.

#### 4. useProducaoLog.ts -- Adicionar mapa de responsaveis por etapa

Extrair do array de logs um mapa `responsaveisPorEtapa` (o primeiro encontrado para cada `processo_novo`, ja que os logs vem em ordem DESC = mais recente primeiro).

---

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/production/StageTransitionModal.tsx` | Adicionar campo `numeracao` ao config de `Costura/Faccao` |
| `src/pages/Index.tsx` | Adicionar `pecas: 'Pecas cortadas'` e `numeracao: 'Numeracao'` ao `labelMap` |
| `src/components/production/HistoricoProducaoModal.tsx` | Parsear extras (rolos/pecas/numeracao) com icones + resumo de responsaveis |
| `src/hooks/useProducaoLog.ts` | Adicionar `responsaveisPorEtapa` ao retorno |

### Impacto no backend
- **Zero** alteracoes no banco
- Os dados continuam salvos no campo `observacao` do `producao_log` (texto concatenado com `|`)
