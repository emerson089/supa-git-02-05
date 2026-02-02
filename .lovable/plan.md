

## Plano: Gerar Referência Automática com Números Aleatórios

### Objetivo

Alterar a geração de referência para usar números **aleatórios de 3 dígitos** (não sequenciais), garantindo que nunca sejam repetidos.

**Exemplo de comportamento:**
- Primeiro produto: `345`
- Segundo produto: `782`
- Terceiro produto: `156`
- E assim por diante... (números aleatórios, nunca iguais)

---

### Alterações no Arquivo

**Arquivo:** `src/pages/Estoque.tsx`

**Linhas a modificar:** 538-577 (função `handleOpenNovoModelo`)

#### Código Atual (Sequencial)
```typescript
// Encontrar o primeiro número disponível entre 001 e 999
let nextRefNum = 1;
while (referenciasUsadas.has(nextRefNum) && nextRefNum <= 999) {
  nextRefNum++;
}
```

#### Código Novo (Aleatório)
```typescript
const handleOpenNovoModelo = async () => {
  // Buscar todas as referências numéricas já usadas
  const referenciasUsadas = new Set<number>();
  const produtosAcabadosExistentes = itens.filter(item => item.tipo === 'acabado');
  
  produtosAcabadosExistentes.forEach(item => {
    const match = item.nome.match(/ - (\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 999) {
        referenciasUsadas.add(num);
      }
    }
  });

  // Gerar número aleatório único entre 001 e 999
  let nextRefNum: number;
  const maxTentativas = 1000;
  let tentativas = 0;
  
  // Se ainda há números disponíveis na faixa 001-999
  if (referenciasUsadas.size < 999) {
    do {
      // Gerar número aleatório entre 1 e 999
      nextRefNum = Math.floor(Math.random() * 999) + 1;
      tentativas++;
    } while (referenciasUsadas.has(nextRefNum) && tentativas < maxTentativas);
  } else {
    // Todos os 999 números estão em uso - usar 1 como fallback
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
| Nenhum produto existente | Número aleatório (ex: `427`) |
| Alguns produtos existentes | Número aleatório diferente dos existentes (ex: `156`) |
| 998 produtos cadastrados | Um dos números restantes aleatório |
| Todos 999 números em uso | Fallback para `001` |

---

### Exemplos de Referências Geradas

```
Abertura do modal 1: 345
Abertura do modal 2: 782
Abertura do modal 3: 156
Abertura do modal 4: 903
Abertura do modal 5: 267
```

Os números são sempre:
- Aleatórios (não sequenciais)
- Únicos (nunca repetidos com produtos existentes)
- Formatados com 3 dígitos (ex: `007`, `042`, `156`)

---

### Resumo de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Estoque.tsx` | Alterar lógica de `handleOpenNovoModelo` para gerar números aleatórios únicos (linhas 538-577) |

