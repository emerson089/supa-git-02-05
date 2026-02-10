

## Vincular Excursoes Cadastradas ao Campo "Excursao" no Formulario de Cliente

### Objetivo

Substituir o campo de texto livre "Excursao" no formulario de criar/editar cliente por um **combobox com busca** que lista as excursoes ativas cadastradas no sistema. O usuario podera selecionar uma excursao existente, garantindo consistencia dos dados.

### O que muda

- O campo "Excursao" no modal de Novo/Editar Cliente deixa de ser um `Input` de texto livre
- Passa a ser um **Combobox** (Popover + Command) com busca, listando apenas excursoes ativas
- Ao digitar, filtra as opcoes em tempo real
- Ao selecionar, preenche o campo `excursao` com o nome da excursao escolhida

### Arquivo alterado

**`src/pages/Clientes.tsx`**

1. Importar `useExcursoesAtivas` de `@/hooks/useExcursoes`
2. Importar componentes `Popover`, `PopoverTrigger`, `PopoverContent` e `Command`, `CommandInput`, `CommandList`, `CommandItem`, `CommandEmpty`
3. Adicionar estado `excursaoPopoverOpen` para controlar abertura do combobox
4. Substituir o `Input` do campo "Excursao" (linhas 601-607) por um Combobox que:
   - Mostra o valor atual ou placeholder "Selecione a excursao"
   - Lista as excursoes ativas com busca
   - Ao selecionar, seta `formData.excursao` com o nome da excursao
   - Exibe icone de check ao lado da opcao selecionada

### Comportamento

- Lista apenas excursoes com `ativo = true` (hook `useExcursoesAtivas` ja existe)
- Busca client-side dentro do Command (componente ja suporta filtro nativo)
- Clientes existentes que ja tem excursao preenchida verao o valor atual selecionado ao abrir o modal de edicao
- Se a excursao do cliente nao existir mais na lista ativa, o campo mostra o nome atual mas sem selecao visual

### Detalhes Tecnicos

```text
Antes:
  <Input value={formData.excursao} onChange={...} placeholder="Nome da excursao" />

Depois:
  <Popover open={excursaoPopoverOpen} onOpenChange={setExcursaoPopoverOpen}>
    <PopoverTrigger asChild>
      <Button variant="outline" role="combobox">
        {formData.excursao || "Selecione a excursao"}
        <ChevronsUpDown />
      </Button>
    </PopoverTrigger>
    <PopoverContent>
      <Command>
        <CommandInput placeholder="Buscar excursao..." />
        <CommandList>
          <CommandEmpty>Nenhuma excursao encontrada</CommandEmpty>
          {excursoesAtivas.map(exc => (
            <CommandItem onSelect={() => {
              setFormData(prev => ({...prev, excursao: exc.nome}));
              setExcursaoPopoverOpen(false);
            }}>
              <Check className={formData.excursao === exc.nome ? "opacity-100" : "opacity-0"} />
              {exc.nome}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
```

### Impacto

- Nenhuma migracao de banco necessaria
- O campo `excursao` no banco continua sendo texto (nome da excursao)
- Clientes existentes mantem seus valores atuais
- Importacao CSV continua funcionando normalmente (usa texto direto)

