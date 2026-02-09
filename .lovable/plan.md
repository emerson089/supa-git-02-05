

## Adicionar Campo de Busca na Tela de Excursoes

### O que muda

Adicionar um campo de busca (input de texto) acima da lista de excursoes para filtrar pelo nome em tempo real.

### Implementacao

**Arquivo**: `src/pages/ConfigExcursoes.tsx`

1. Adicionar estado `searchTerm` e usar o hook `useDebouncedValue` (ja existe no projeto) com 300ms de delay
2. Adicionar um `Input` com icone de lupa (`Search` do lucide) na area de acoes, acima da lista
3. Filtrar a lista `excursoes` pelo nome antes de renderizar, usando `nome.toLowerCase().includes(debouncedSearch.toLowerCase())`
4. Atualizar o contador do "Selecionar Tudo" para refletir apenas os itens filtrados

### Visual

```text
[🔍 Buscar excursao...                    ]

[✓ Selecionar Tudo (3)]    [Importar CSV] [+ Nova Excursao]

  ✓ 🚌 Regis Tur        R$ 15,00    [toggle] [✏️] [🗑️]
  ✓ 🚌 Central Tur      R$ 12,00    [toggle] [✏️] [🗑️]
  ...
```

### Detalhes Tecnicos

- Usar `useDebouncedValue` de `src/hooks/useDebouncedValue.ts` para evitar filtragem a cada tecla
- O filtro e apenas visual (client-side), sem alterar a query do banco
- "Selecionar Tudo" opera sobre os itens filtrados (visíveis)
- Limpar busca mostra todos novamente

