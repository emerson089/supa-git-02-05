

## Correção: Modal de Cliente e Exibição da Taxa da Excursão

### Problema 1: Conteúdo vazando do modal

O modal "Novo Cliente" não tem `overflow: hidden`, então o conteúdo (inputs, botões) vaza para fora dos limites do dialog. Além disso, o `DialogContent` não tem `overflow-y-auto` para lidar com conteúdo mais alto que a tela.

### Problema 2: Valor da excursão não aparece

Ao selecionar uma excursão no combobox, o usuário não vê a taxa cobrada. Precisa mostrar o valor ao lado do nome na lista e exibir a taxa selecionada abaixo do campo.

### Correções no arquivo `src/pages/Clientes.tsx`

**1. Adicionar `overflow-hidden` no DialogContent:**
```
<DialogContent className="sm:max-w-[450px] overflow-hidden">
```

**2. Mostrar taxa ao lado do nome de cada excursão no CommandItem:**
```
<CommandItem ...>
  <Check ... />
  <span className="flex-1 truncate">{exc.nome}</span>
  <span className="text-xs text-emerald-600 font-semibold ml-2">
    R$ {exc.taxa.toFixed(2)}
  </span>
</CommandItem>
```

**3. Exibir a taxa da excursão selecionada abaixo do combobox:**

Após selecionar uma excursão, buscar a taxa correspondente e exibir em texto pequeno abaixo do campo, como:
```
Excursão
[Deyse S.amarelo V. 138...]
Taxa: R$ 70,00
```

**4. Limitar largura do PopoverContent com `overflow-hidden` para evitar vazamento:**
```
<PopoverContent className="w-[--radix-popover-trigger-width] p-0 overflow-hidden" align="start">
```

**5. Truncar texto longo no botão trigger do combobox:**
Adicionar `truncate` e `max-w` no texto do botão para que nomes longos de excursão não expandam o modal.

### Detalhes Técnicos

- Adicionar `overflow-hidden` no `DialogContent` (linha 565)
- Adicionar `truncate block max-w-[calc(100%-2rem)]` no texto do `PopoverTrigger` button
- No `CommandItem`, usar layout flex com `truncate` no nome e taxa à direita
- Após o `</Popover>`, adicionar um `<p>` condicional mostrando a taxa quando `formData.excursao` estiver preenchido
- Buscar a taxa com: `excursoesAtivas?.find(e => e.nome === formData.excursao)?.taxa`
- Formatar como `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`

### Impacto

- Nenhuma mudança no banco de dados
- Apenas alterações visuais no modal de criar/editar cliente
- O campo `excursao` continua salvando apenas o nome (string)
