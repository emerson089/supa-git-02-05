
## Plano: Adicionar Modal de Detalhes de Transferência

### Problema Identificado

O **modal de detalhes de transferência não está sendo renderizado**. Apesar de:
- O componente `DetalhesTransferenciaModal` estar importado (linha 38)
- Os estados existirem (`showDetalhesModal`, `transferenciaSelecionada`)
- A função `handleOpenDetalhes()` ser chamada ao clicar em uma transferência

O componente **nunca é adicionado ao JSX**. Por isso, ao clicar na transferência pendente, nada acontece.

---

### Correção

Adicionar o componente `DetalhesTransferenciaModal` no final do arquivo `src/pages/Transferencias.tsx`, junto com os outros modais.

### Código a Adicionar

```tsx
{/* Modal de Detalhes da Transferência */}
<DetalhesTransferenciaModal 
  open={showDetalhesModal} 
  onOpenChange={setShowDetalhesModal} 
  transferencia={transferenciaCompleta}
  itensDetalhados={itensDetalhados}
/>
```

Este código deve ser adicionado logo após o `RelatorioSaidasModal` e antes do fechamento do `</div>` principal.

---

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Transferencias.tsx` | Adicionar renderização do `DetalhesTransferenciaModal` |

---

### Resultado Esperado

1. Ao clicar em uma transferência **pendente** na lista, o modal de detalhes abrirá
2. No modal, o usuário verá:
   - Informações da transferência (origem, destino, data)
   - Lista de itens transferidos
   - Campos para editar motivo e observações
   - Botões **"Concluir"** e **"Cancelar"**
3. Ao clicar em "Concluir", o estoque será movimentado e a transferência marcada como concluída
