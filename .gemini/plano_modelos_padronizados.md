# Plano - Modelos Padronizados

## Estratégia
- Usar campo `categoria` do `estoque_itens` para marcar "Modelo Padronizado" vs "Modelo Manual"
- Campos extras (tipo, composição, coleção, custo) armazenados em `localizacao` JSON OR em campos existentes + metadata na categoria
- Variações = produtos separados no estoque com categoria "Variação" e nome = ReferênciaBase-Tamanho
- Referência base armazenada no nome do item pai (grupo)
- Implementar totalmente no frontend sem migrações de BD

## Arquivos a criar/modificar
1. `src/components/estoque/NovoModeloPadronizadoModal.tsx` (NOVO)
2. `src/components/estoque/DetalhesModeloPadronizadoModal.tsx` (NOVO)  
3. `src/components/estoque/EtiquetasModal.tsx` (NOVO)
4. `src/hooks/useModelosPadronizados.ts` (NOVO)
5. `src/pages/Estoque.tsx` (MODIFICAR - botão, listagem, agrupamento)
6. `src/components/estoque/ProductCard.tsx` (MODIFICAR - tag de tipo)
