

## Plano: Trocar "Quantidade de Peças" por "Quantidade de Rolos" ao Criar Novo Lote

### Problema Atual

O formulário de criação de lote pede **"Quantidade"** (peças), mas na prática essa informação só é conhecida **depois do corte**. O que o usuário sabe no momento da criação é quantos **rolos de tecido** serão usados.

### Solução

1. **No formulário de criação** (`ProducaoForm.tsx`): substituir o campo "Quantidade" por "Qtd de rolos de tecido" (apenas para novos lotes)
2. **Salvar os rolos** na `observacoes` do lote (ex: "Rolos: 3") e definir `quantidade` como 0 por padrão
3. **Na transição Corte -> Costura/Facção** (`StageTransitionModal.tsx`): adicionar o campo "Qtd de peças cortadas" para que o usuário informe as peças nesse momento, atualizando `producao.quantidade`
4. **No formulário de edição**: manter o campo "Quantidade" editável normalmente (para correções)

### Mudanças por Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/producao/ProducaoForm.tsx` | Para novos lotes: trocar campo "Quantidade" por "Qtd de rolos de tecido", salvar rolos na observação, e enviar quantidade=0 |
| `src/components/production/StageTransitionModal.tsx` | Na config da etapa `Costura/Facção`: adicionar extraField `{ key: 'pecas', label: 'Qtd de peças cortadas', type: 'number' }` |
| `src/pages/Index.tsx` | Ao confirmar transição para Costura/Facção com campo `pecas`: atualizar `producao.quantidade` com o valor informado |
| `src/lib/validations.ts` | Ajustar `ProducaoFormSchema` para aceitar `quantidade` = 0 (já aceita, min é 0) |

### Fluxo Novo

```text
1. Criar Lote:
   - Referência: 5001
   - Modelo: Wide Leg
   - Qtd de rolos de tecido: [3]    <-- NOVO campo
   - Responsável (cortador): Ildo
   - ...

2. Lote criado com quantidade=0, observações="Rolos: 3"

3. Ao mover Corte -> Costura/Facção:
   ┌─────────────────────────────────────────┐
   │ Mover lote 5001 para Costura/Facção     │
   │                                         │
   │ Qtd de peças cortadas: [120]  <-- NOVO  │
   │                                         │
   │ Responsável: [▼ Selecione facção]       │
   │ Observação:  [                  ]       │
   │                                         │
   │        [Cancelar]    [Confirmar]         │
   └─────────────────────────────────────────┘

4. Ao confirmar: atualiza producao.quantidade = 120
```

### Detalhes Técnicos

**ProducaoForm.tsx** (novo lote):
- Adicionar campo `rolos` (number) no lugar de `quantidade`
- Ao submeter: `quantidade: 0`, concatenar `Rolos: ${rolos}` nas observações
- Para edição de lote existente: manter campo "Quantidade" como está

**StageTransitionModal.tsx**:
- Adicionar na config de `Costura/Facção`:
  ```typescript
  'Costura/Facção': {
    showResponsavel: true,
    responsavelLabel: 'Facção / Costureira',
    extraFields: [
      { key: 'pecas', label: 'Qtd de peças cortadas', type: 'number' }
    ]
  }
  ```

**Index.tsx** (ao confirmar transição):
- Se `toStage === 'Costura/Facção'` e `extras.pecas`: atualizar `producao.quantidade` com o valor

### Impacto

- Nenhuma migração de banco necessária
- Campo `quantidade` continua existindo, apenas inicia com 0 e é preenchido ao sair do Corte
- Rolos ficam registrados nas observações do lote
- Formulário de edição mantém acesso ao campo quantidade para correções
