
## Plano: Corrigir Referência Automática de 3 Dígitos no Modal "Novo Modelo Acabado"

### Diagnóstico do Problema

O campo de referência atual não está funcionando corretamente porque:

1. **Regex limitado**: O código atual usa `/ - (\d{3})$/` que só detecta referências com exatamente 3 dígitos
2. **Referências de 4 dígitos existentes**: O banco possui itens como "Macaquito fivela - 1000" e "Conjunto - 1001" que não são capturados
3. **Resultado errado**: Como 1000 e 1001 não são detectados, o sistema encontra 999 como máximo e sugere 1000 (4 dígitos)

### Dados Atuais no Banco

- Maior referência existente: `1001` ("Conjunto - 1001")
- Referências variam de `015` a `1001`
- O sistema deveria sugerir a próxima disponível que seja válida

### Solução Proposta

Para garantir referências únicas de 3 dígitos:

1. **Buscar todas as referências numéricas** (qualquer tamanho de dígitos)
2. **Filtrar apenas as de 3 dígitos** (001-999) para encontrar gaps
3. **Encontrar o primeiro número disponível** na faixa 001-999 que não esteja em uso
4. **Formatar sempre com 3 dígitos** usando `padStart(3, '0')`

---

### Alterações no Arquivo

**Arquivo:** `src/pages/Estoque.tsx`

**Linhas a modificar:** 538-561 (função `handleOpenNovoModelo`)

#### Código Atual (Problemático)
```typescript
const handleOpenNovoModelo = async () => {
  let maxRef = 0;
  const produtosAcabadosExistentes = itens.filter(item => item.tipo === 'acabado');
  produtosAcabadosExistentes.forEach(item => {
    // Procura padrão " - NNN" no final do nome
    const match = item.nome.match(/ - (\d{3})$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRef) maxRef = num;
    }
  });
  // Próxima referência: max + 1, formatada com 3 dígitos
  const nextRef = String(maxRef + 1).padStart(3, '0');
  ...
};
```

#### Código Corrigido
```typescript
const handleOpenNovoModelo = async () => {
  // Buscar todas as referências numéricas já usadas (1+ dígitos no final)
  const referenciasUsadas = new Set<number>();
  const produtosAcabadosExistentes = itens.filter(item => item.tipo === 'acabado');
  
  produtosAcabadosExistentes.forEach(item => {
    // Captura qualquer sequência de dígitos no final do nome (após " - ")
    const match = item.nome.match(/ - (\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      // Considerar apenas referências na faixa válida de 3 dígitos (001-999)
      if (num >= 1 && num <= 999) {
        referenciasUsadas.add(num);
      }
    }
  });

  // Encontrar o primeiro número disponível entre 001 e 999
  let nextRefNum = 1;
  while (referenciasUsadas.has(nextRefNum) && nextRefNum <= 999) {
    nextRefNum++;
  }

  // Se todos os 999 números estiverem em uso, começar do 001 (sobrescreve)
  if (nextRefNum > 999) {
    nextRefNum = 1;
  }

  // Formatar sempre com 3 dígitos
  const nextRef = String(nextRefNum).padStart(3, '0');
  
  setNovoModeloForm({
    nome: '',
    referencia: nextRef,
    quantidade: 0,
    precoVenda: 0,
    imagemUrl: '',
    imagemPreview: ''
  });
  setShowNovoModeloModal(true);
};
```

---

### Comportamento Esperado

| Cenário | Resultado |
|---------|-----------|
| Nenhum produto existente | `001` |
| Produtos com refs 001, 002, 003 | `004` |
| Produtos com refs 001, 003, 005 | `002` (preenche gap) |
| Produtos com refs até 999 | `001` (recicla) |
| Produtos com refs 4 dígitos (1000, 1001) | Ignorados, busca na faixa 001-999 |

---

### Resultado Visual

Modal "Novo Modelo Acabado" sempre mostrará uma referência de 3 dígitos no formato:
- `001`, `002`, `003`, ..., `999`
- Nunca `1000` ou mais
- Sempre preenchida automaticamente com zeros à esquerda

---

### Validação Adicional (Opcional)

Se quiser garantir que o usuário não digite manualmente uma referência inválida, podemos também atualizar a validação no schema Zod:

**Arquivo:** `src/lib/validations.ts`

```typescript
referencia: z.string()
  .regex(/^\d{3}$/, { message: 'Referência deve ter exatamente 3 dígitos (ex: 001, 164)' })
  .optional()
```

---

### Resumo de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Estoque.tsx` | Corrigir lógica de `handleOpenNovoModelo` para encontrar gaps e limitar a 3 dígitos (linhas 538-561) |
| `src/lib/validations.ts` | (Opcional) Adicionar validação de formato 3 dígitos no schema |
