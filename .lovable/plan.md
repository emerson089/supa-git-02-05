

## Sincronizar Filtro "Tipo de Movimentação" com Tipos de Ajuste

### Problema

O filtro "Tipo de Movimentação" no Relatório de Saídas mostra opções duplicadas porque combina tipos de sistema fixos (Venda / Loja, Envio Feira, Transferência, Retorno Feira) com tipos de ajuste do usuário. Quando um tipo de ajuste tem o mesmo nome de um tipo de sistema (ex: "Venda / loja"), aparece duplicado.

### Solução

Modificar a lógica de `opcoesUnificadas` no `RelatorioSaidasModal.tsx` para:

1. Manter os tipos de sistema (Envio Feira, Transferência, Retorno Feira) -- esses são tipos de movimentação que não são ajustes
2. Substituir o tipo de sistema "Venda / Loja" pela lógica existente: tipos de ajuste marcados como `contaComoVenda` já são agrupados automaticamente nessa categoria
3. Filtrar tipos de ajuste para remover nomes que colidem com tipos de sistema (comparação case-insensitive)
4. Deduplicar tipos de ajuste por nome (caso existam registros duplicados de usuários diferentes)

### Alterações técnicas

**Arquivo: `src/components/estoque/RelatorioSaidasModal.tsx`**

No `useMemo` de `opcoesUnificadas` (linhas 110-119):

- Criar um `Set` com os nomes dos tipos de sistema (lowercase) para comparação
- Filtrar tipos de ajuste que tenham nomes iguais a tipos de sistema
- Usar `reduce` para deduplicar por nome (manter apenas o primeiro de cada nome)

```typescript
const opcoesUnificadas = useMemo(() => {
  const nomesSistema = new Set(TIPOS_SISTEMA.map(t => t.label.toLowerCase().trim()));
  
  const tiposAjusteFiltro: FiltroMovimentacao[] = (tiposAjusteDisponiveis || [])
    .filter(t => !t.contaComoVenda)
    .filter(t => !nomesSistema.has(t.nome.toLowerCase().trim()))
    .reduce((acc, t) => {
      if (!acc.some(x => x.label.toLowerCase() === t.nome.toLowerCase())) {
        acc.push({ kind: 'ajuste', value: t.id, label: t.nome });
      }
      return acc;
    }, [] as FiltroMovimentacao[]);
    
  return { sistema: TIPOS_SISTEMA, ajuste: tiposAjusteFiltro };
}, [tiposAjusteDisponiveis]);
```

### Resultado

O filtro mostrará:
- **Tipos de sistema** (fixos): Venda / Loja, Envio Feira, Transferência, Retorno Feira
- **Tipos de ajuste** (do usuário, sem duplicatas): Ajuste de estoque, Defeito, Devolução de cliente, Reposição loja -- conforme configurado na tela de Tipos de Ajuste

Tipos inativos na configuração já não aparecem pois a query filtra por `ativo = true`. Tipos marcados como "Venda" já estão cobertos pela opção "Venda / Loja" do sistema.

### Arquivo modificado

| Arquivo | Alteração |
|---|---|
| `src/components/estoque/RelatorioSaidasModal.tsx` | Deduplicar e filtrar colisões no `opcoesUnificadas` |

