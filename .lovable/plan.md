
## Plano: Corrigir Modal de Nova Transferência

### Problemas Identificados

1. **Filtros desalinhados**: O componente `FiltrosTransferencias` está dentro do cabeçalho mas está mal posicionado em relação ao título "Transferências" e ao botão "Nova"

2. **Campo de motivo ausente no modal**: O modal de "Nova Transferência" **não possui o campo de seleção de motivo** (dropdown). O estado `motivoNovo` existe (linha 129), a validação existe (linha 435), mas **não há o campo Select no JSX** para o usuário selecionar. Por isso a mensagem "Selecione o motivo da transferência" aparece mas o usuário não consegue selecionar nada.

3. **Erro na passagem do motivo para RPC**: Atualmente no `handleCriarTransferencia`, o campo `motivoNovo` está sendo passado como `observacoes` (linha 451), quando deveria ser passado como `motivo`. O hook `useCriarTransferencia` recebe `observacoes` e manda para `p_motivo` da RPC - isso está invertido.

---

### Correções Propostas

#### 1. Ajustar Layout dos Filtros (Desktop)

No arquivo `src/pages/Transferencias.tsx`, ajustar o layout do header para:
- Título "Transferências" à esquerda alinhado
- Botão "Nova" e filtros lado a lado, à direita

#### 2. Adicionar Campo de Motivo no Modal

No modal de nova transferência (linhas ~871), adicionar um `Select` para escolher o motivo **antes** da seção de produtos:

```typescript
{/* Seleção de Motivo */}
<div>
  <Label className="text-sm font-medium mb-2 block">Motivo *</Label>
  <Select value={motivoNovo} onValueChange={(v) => setMotivoNovo(v as MotivoTransferencia)}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione o motivo" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="reposicao">Reposição</SelectItem>
      <SelectItem value="feira">Feira</SelectItem>
      <SelectItem value="ajuste">Ajuste</SelectItem>
      <SelectItem value="devolucao">Devolução</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### 3. Corrigir Hook para Separar Motivo e Observações

**Arquivo: `src/hooks/useTransferencias.ts`** (linha 940-966)

Atualizar a interface e chamada RPC:

```typescript
mutationFn: async ({
  origemId,
  destinoId,
  itens,
  motivo,         // Novo campo para o enum
  observacoes,    // Campo separado para texto livre
}: {
  origemId: string;
  destinoId: string;
  itens: { itemId: string; quantidade: number }[];
  motivo: MotivoTransferencia;      // Obrigatório
  observacoes?: string;             // Opcional
}) => {
  // ...
  const { data, error } = await supabase.rpc('rpc_criar_transferencia', {
    p_origem_local_id: origemId,
    p_destino_local_id: destinoId,
    p_itens: itensJson,
    p_user_id: user.id,
    p_motivo: motivo,               // Motivo correto
    p_observacoes: observacoes || null   // Observações separadas
  });
  // ...
}
```

#### 4. Atualizar Chamada no Componente

**Arquivo: `src/pages/Transferencias.tsx`** (linha 444-452)

```typescript
await criarTransferencia.mutateAsync({
  origemId,
  destinoId,
  itens: itensTransferencia.map(i => ({
    itemId: i.itemId,
    quantidade: i.quantidade
  })),
  motivo: motivoNovo,     // Motivo separado
  observacoes: undefined, // Por enquanto não temos campo de observações no modal
});
```

---

### Layout do Modal Atualizado

```text
┌─────────────────────────────────────────────────────┐
│  Nova Transferência                            [X] │
├─────────────────────────────────────────────────────┤
│  De:                          Para:                 │
│  ┌─────────────────┐          ┌─────────────────┐   │
│  │ Estoque Central │          │ Loja Parque...  │   │
│  └─────────────────┘          └─────────────────┘   │
│                                                     │
│  Motivo *                                           │
│  ┌─────────────────────────────────────────────┐    │
│  │ Reposição                              ▼    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌── Produtos Disponíveis ─────────────────────┐    │
│  │  [Buscar...]                                │    │
│  │  ...produtos...                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌── Itens para Transferir ────────────────────┐    │
│  │  ...itens selecionados...                   │    │
│  └─────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│  Total: 1 itens (5 peças)    [Cancelar] [Transferir]│
└─────────────────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Transferencias.tsx` | Adicionar Select de motivo no modal, corrigir chamada do hook, ajustar layout header |
| `src/hooks/useTransferencias.ts` | Separar `motivo` e `observacoes` na interface e chamada RPC |

---

### Resultado Esperado

1. O usuário conseguirá selecionar o motivo da transferência no modal
2. O toast "Selecione o motivo da transferência" deixará de aparecer após selecionar
3. A transferência será criada com o motivo correto no banco
4. Layout dos filtros ficará melhor organizado
