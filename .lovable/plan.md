

## Plano: Remover setas (spinners) dos inputs numéricos

As setas circuladas são os **spinners nativos** do `<input type="number">` do navegador. A solução é adicionar CSS global para ocultá-los em todos os inputs numéricos do projeto.

### Alteração

**Arquivo: `src/index.css`** — Adicionar regras CSS para esconder os spinners:

```css
/* Chrome, Safari, Edge, Opera */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type="number"] {
  -moz-appearance: textfield;
}
```

Alteração mínima — 1 arquivo, ~10 linhas. Remove os spinners de **todos** os inputs numéricos do sistema de uma vez.

