

## Alterar referência base para 3 dígitos aleatórios únicos

### Arquivo: `src/hooks/useModelosPadronizados.ts`

**Função `gerarReferenciaBase`** (linhas 146-178):

1. Manter o prefixo `TIPO+AAMM-` (ex: `CA2603-`)
2. Buscar todos os números já usados para o prefixo (igual ao atual)
3. Em vez de pegar `max + 1`, gerar um número aleatório entre 1 e 999
4. Verificar se já está na lista de usados; se sim, gerar outro
5. Formatar com 3 dígitos: `padStart(3, '0')`
6. Fallback: se todos 999 estiverem ocupados, usar o próximo disponível acima de 999

**Atualização do fallback** (linha 176): mudar de `0001` para um aleatório de 3 dígitos.

### Sem impacto em outros arquivos
- As variações continuam usando `referencia-TAMANHO`
- O campo é texto livre, então nenhuma migração de BD é necessária
- Modelos existentes não são afetados

