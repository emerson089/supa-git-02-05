---
name: Categorização de Comprovantes (Jeans/Alfaiataria)
description: Comprovantes do WhatsApp são classificados em Jeans/Alfaiataria via legenda da imagem; cards e respostas mostram totais segmentados.
type: feature
---
- Tabela `comprovantes` tem coluna `categoria` (enum `comprovante_categoria`: `jeans`, `alfaiataria`, `nao_classificado`, default `nao_classificado`).
- Captura via legenda da foto no WhatsApp (`body.image.caption` na Z-API). Aceita "J"/"jeans" e "A"/"alf*"/"alfaiataria" — sem acento, case-insensitive. Tokens isolados curtos (≤3 chars) são interpretados como J/A. Sem legenda → `nao_classificado`.
- Edge Function `webhook-comprovantes` salva `categoria` no insert e responde no WhatsApp com 3 totais do dia (Jeans, Alfaiataria, Total Geral). Quando `nao_classificado`, a resposta orienta a corrigir na tela.
- Hook `useTotaisCategoria(periodo)` em `useComprovantes.ts` agrega `{ jeans, alfaiataria, naoClassificado, total, qtd* }` (somente status `confirmado`).
- Tela `/comprovantes`: 4 cards no topo (Jeans azul, Alfaiataria roxo, Não Classificado âmbar com destaque se >0, Qtd. Documentos com Total Geral abaixo). Filtro `Categoria` ao lado de Status. Coluna `Categoria` na tabela. Modal `ComprovanteModal` tem dropdown `Categoria do Produto` no topo para correção manual.
- Comprovantes antigos ficam `nao_classificado` (default) e aparecem no card âmbar para reclassificação manual.
