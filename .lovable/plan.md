

## Congelar seção inferior do Sidebar

### Problema
A seção inferior do sidebar (Usuários, Tipos de Ajuste, Excursões, Custos Padrão, Catálogo CRM, Ajuda, perfil e Sair) não fica fixa — quando a tela é menor, ela pode ser empurrada para fora da área visível.

### Correção

**Arquivo:** `src/components/layout/AppSidebar.tsx`

A estrutura do sidebar já usa `flex flex-col` com a parte superior tendo `flex-1 overflow-y-auto` e a inferior `flex-shrink-0`. Porém, se o conteúdo inferior for maior que o espaço disponível, ele pode estourar. A correção:

1. Adicionar `overflow-y-auto` na seção inferior para que, se necessário, ela role independentemente
2. Garantir que a seção inferior tenha um `max-height` relativo e `min-h-0` para não ultrapassar o espaço
3. Adicionar `sticky bottom-0` e fundo sólido para garantir que fique sempre visível e colada ao fundo

```text
Antes (linha 283):
  <div className="space-y-1 flex-shrink-0 bg-white pt-2">

Depois:
  <div className="space-y-1 flex-shrink-0 bg-white pt-2 border-t border-gray-100 sticky bottom-0">
```

Também ajustar o container pai (`aside`) para usar `overflow-hidden` e manter a seção superior como única área rolável, removendo o `justify-between` e usando `flex-col` com a parte de cima ocupando todo espaço restante.

### Resultado
Os itens de configuração, perfil do usuário e botão Sair ficarão sempre visíveis na parte inferior do sidebar, independente de quantos itens existam na navegação principal acima.

