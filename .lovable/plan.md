
Plano fechado. Captura via legenda, resposta segmentada, cards separados.

## Categorização Jeans/Alfaiataria nos Comprovantes

### 1. Banco de dados
Migration única:
- Criar enum `comprovante_categoria` com valores `jeans`, `alfaiataria`, `nao_classificado`
- Adicionar coluna `categoria comprovante_categoria NOT NULL DEFAULT 'nao_classificado'` em `comprovantes`
- Index em `(user_id, categoria, created_at)` para performance dos cards

### 2. Edge Function `webhook-comprovantes`
- Capturar `body.image.caption` (Z-API envia legenda no `caption` da mensagem de imagem)
- Função `detectarCategoria(caption)`:
  - Normaliza (lowercase, sem acento, trim)
  - `jeans` → contém "jeans" ou começa com "j" sozinho/curto
  - `alfaiataria` → contém "alfaiataria", "alfaiat", ou começa com "a" sozinho/curto
  - Caso contrário → `nao_classificado`
- Salvar `categoria` no insert
- Verificação de duplicidade mantém comportamento atual
- Resposta no WhatsApp passa a mostrar **3 totais do dia**: Jeans, Alfaiataria, Geral. Cabeçalho indica a categoria do comprovante atual (ou aviso de "não classificado — corrija na tela" quando aplicável)

### 3. Hook `useComprovantes`
- Adicionar filtro opcional `categoria?: string`
- Adicionar query separada `useTotaisCategoria(periodo)` que retorna `{ jeans, alfaiataria, naoClassificado }` independente dos filtros de busca (para alimentar os cards)
- Expor `categoria` no tipo `Comprovante` e no update mutation

### 4. UI `/comprovantes`
- **Cards de resumo (topo)**: substituir os 3 atuais por 4 — `Jeans` (azul), `Alfaiataria` (roxo), `Não Classificado` (âmbar, destaque se >0), `Qtd. Documentos`. Total Validado vira "Total Geral" pequeno abaixo dos cards específicos.
- **Filtro de categoria**: novo Select ao lado do filtro de status (`Todas / Jeans / Alfaiataria / Não Classificadas`)
- **Tabela**: nova coluna `Categoria` com badge colorido entre Pagador e Valor
- **Modal de edição** (`ComprovanteModal`): dropdown `Categoria` no topo, permitindo correção manual

### 5. Memória do projeto
Salvar nova memória em `mem://features/comprovantes/categorizacao-jeans-alfaiataria` documentando: enum, captura via caption (J/A), fallback `nao_classificado`, totais segmentados na resposta WhatsApp, cards separados.

### Detalhes técnicos
- Detecção tolerante: aceita "J", "j", "jeans", "JEANS", "Jeans" e qualquer variante com a palavra; idem alfaiataria/A/alf/alfaiat
- Comprovantes antigos ficam como `nao_classificado` automaticamente (default) → aparecem no card âmbar para o usuário classificar manualmente
- Cards usam mesma query base com `group by categoria` para 1 round-trip ao DB
- Cores dos cards seguem padrão atual (Tailwind: blue-600/purple-600/amber-600)
