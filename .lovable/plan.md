

## Unificar Transferencia e Mostrar Estoque no Destino

### Resumo

Duas alteracoes combinadas: (1) remover o botao "+ Adicionar" redundante do Estoque por Local, e (2) melhorar o modal "Nova Transferencia" para mostrar a quantidade que ja existe no destino, assim como o antigo modal de Adicionar fazia com os badges "Central: X pcs" e "Local: X pcs".

### Alteracao 1: Remover botao "Adicionar" e modal

No arquivo `src/pages/Transferencias.tsx`:
- Remover o import de `AdicionarProdutoLocalModal`
- Remover o estado `showAdicionarModal`
- Remover o botao "Adicionar" da barra de acoes do estoque local (linhas 507-510)
- Remover o componente `<AdicionarProdutoLocalModal>` do JSX (linha 809)

### Alteracao 2: Mostrar estoque no destino no modal Nova Transferencia

No mesmo arquivo, na secao "Produtos Disponiveis" do modal (linhas 897-930), adicionar um badge mostrando a quantidade ja existente no destino quando um destino estiver selecionado:

**Na lista de produtos disponiveis**: Cada produto passara a mostrar:
- Badge azul: "Origem: X pcs" (quantidade disponivel na origem, substitui o atual "Disp: X")
- Badge verde: "Destino: X pcs" (quantidade ja existente no destino, visivel apenas quando destino selecionado e quantidade > 0)

Isso replica o comportamento visual do antigo `AdicionarProdutoLocalModal` que mostrava "Central: X pcs" e "Local: X pcs".

A funcao `getDisponivelNoLocal` ja existe e aceita qualquer localId, entao basta chamar com o `destinoId` para obter a quantidade no destino.

### Detalhes tecnicos

Na renderizacao de cada produto na lista (linha ~900-923):
- Calcular `const disponivelDestino = destinoId ? getDisponivelNoLocal(produto.id, destinoId) : 0;`
- Substituir o texto "Disp: X" por badges visuais semelhantes ao AdicionarProdutoLocalModal
- Usar as mesmas classes de cor: azul para origem, verde para destino

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/pages/Transferencias.tsx` | Remover botao Adicionar + estado + modal; adicionar badge de estoque no destino na lista de produtos |

