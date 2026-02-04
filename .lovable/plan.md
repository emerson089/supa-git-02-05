
## Plano: Melhorar Legibilidade dos Cards do Dashboard

### Objetivo

Garantir que os nomes de modelos, status de pedidos e etapas de produção estejam sempre acessíveis e legíveis em qualquer dispositivo, sem truncamento incompreensível.

---

### 1. Card "Top 5 Modelos"

**Problema Atual:**
- Linha 833: `truncate max-w-[120px]` força truncamento em todas as telas
- Apenas atributo `title` existe (funciona apenas em desktop com hover)

**Alterações:**

#### 1.1 Remover truncamento forçado e permitir wrap

```typescript
// ANTES (linha 833)
<span className="flex-1 leading-tight truncate max-w-[120px]" title={modelo.nome}>

// DEPOIS
<span 
  className="flex-1 leading-tight line-clamp-2 break-words min-w-0" 
  title={modelo.nome}
  aria-label={modelo.nome}
>
```

#### 1.2 Adicionar Tooltip em desktop

Envolver o item com `Tooltip` do Radix para mostrar nome completo no hover:

```typescript
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// Dentro do map de modelos:
<TooltipProvider delayDuration={200}>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="..."> {/* item existente */}
    </TooltipTrigger>
    <TooltipContent>
      <p className="font-medium">{modelo.nome}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### 1.3 Adicionar Modal para Mobile

Criar estado para modal de detalhes do modelo:

```typescript
const [selectedModelo, setSelectedModelo] = useState<TopModelo | null>(null);

// No onClick do item (mobile):
onClick={() => isMobile ? setSelectedModelo(modelo) : navigate(...)}

// Modal simples:
<Dialog open={!!selectedModelo} onOpenChange={(open) => !open && setSelectedModelo(null)}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Detalhes do Modelo</DialogTitle>
    </DialogHeader>
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">Nome do Modelo</p>
        <p className="font-medium">{selectedModelo?.nome}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Quantidade Vendida</p>
        <p className="text-lg font-bold text-primary">{selectedModelo?.quantidade} un</p>
      </div>
      <Button onClick={() => navigate(`/estoque?search=${encodeURIComponent(selectedModelo?.nome || '')}`)}>
        Ver no Estoque
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

### 2. Card "Produção — Peças por etapa"

**Problema Atual:**
- Linha 974-976: `etapa.etapa.slice(0, 4).` exibe apenas 4 letras + ponto (ex: "Cort.")
- Card fica quase vazio quando há poucas etapas
- Não mostra total geral claramente

**Alterações:**

#### 2.1 Mostrar Total no Topo

```typescript
// Calcular total antes do render
const totalPecasProducao = data.producaoKanban.reduce((sum, e) => sum + e.pecas, 0);
const etapasAtivas = data.producaoKanban.filter(e => e.pecas > 0);

// Renderizar total no topo do CardContent
<div className="text-center mb-3 pb-2 border-b">
  <span className="text-2xl font-bold text-foreground">
    {formatNumber(totalPecasProducao)}
  </span>
  <span className="text-sm text-muted-foreground ml-1">peças</span>
</div>
```

#### 2.2 Exibir Lista de Etapas com Nomes Completos

Substituir grid de colunas por lista vertical ou horizontal responsiva:

```typescript
// Se total = 0
if (totalPecasProducao === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Factory size={24} className="mb-2 opacity-50" />
      <span className="text-sm">Sem peças em produção</span>
    </div>
  );
}

// Se tem peças mas etapasAtivas está vazio (fallback)
if (etapasAtivas.length === 0) {
  return (
    <div className="space-y-2">
      <div className="text-center">
        <span className="text-2xl font-bold">{totalPecasProducao}</span>
        <span className="text-sm text-muted-foreground ml-1">peças</span>
      </div>
      <p className="text-xs text-amber-600 text-center">Etapas não encontradas</p>
    </div>
  );
}

// Render normal: lista com nomes completos
<div className="space-y-2">
  {etapasAtivas.map(etapa => (
    <div 
      key={etapa.etapa} 
      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
      style={{ backgroundColor: `${etapa.color}10` }}
      onClick={() => navigate("/")}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: etapa.color }} />
        <span className="text-sm truncate max-w-[100px]" title={etapa.etapa}>
          {etapa.etapa}
        </span>
        {etapa.isBottleneck && <AlertTriangle size={12} className="text-amber-500" />}
      </div>
      <span className="text-sm font-bold" style={{ color: etapa.color }}>
        {formatNumber(etapa.pecas)}
      </span>
    </div>
  ))}
</div>
```

---

### 3. Card "Status de Pedidos"

**Problema Atual:**
- Linha 927: `truncate max-w-[50px]` trunca severamente (ex: "PEND...")
- Grid de 2 colunas não tem espaço suficiente

**Alterações:**

#### 3.1 Permitir Wrap na Legenda

```typescript
// ANTES (linha 927)
<span className="text-[10px] text-muted-foreground truncate max-w-[50px]">

// DEPOIS
<span 
  className="text-[10px] text-muted-foreground line-clamp-2 break-words min-w-0"
  title={status.status}
  aria-label={status.status}
>
```

#### 3.2 Expandir Grid para Comportar Textos

```typescript
// ANTES (linha 918)
<div className="w-full grid grid-cols-2 gap-x-2 gap-y-0.5">

// DEPOIS - Aumentar gap e permitir mais espaço
<div className="w-full grid grid-cols-2 gap-x-3 gap-y-1">
```

#### 3.3 Adicionar Tooltip para Desktop

Envolver cada item da legenda com Tooltip:

```typescript
<TooltipProvider delayDuration={200}>
  <Tooltip>
    <TooltipTrigger asChild>
      <button className="...">
        {/* conteúdo existente */}
      </button>
    </TooltipTrigger>
    <TooltipContent>
      <p className="font-medium">{status.status}</p>
      <p className="text-xs text-muted-foreground">
        {status.count} pedidos ({percentage}%)
      </p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### 3.4 Modal para Mobile (Opcional)

Similar ao Top 5 Modelos, criar modal ao tocar:

```typescript
const [selectedStatus, setSelectedStatus] = useState<StatusPedido | null>(null);

// onClick do item da legenda:
onClick={() => {
  if (isMobile) {
    setSelectedStatus(status);
  } else if (isClickable) {
    navigate(`/pedidos-criados?status=${status.status}`);
  }
}}

// Modal:
<Dialog open={!!selectedStatus} onOpenChange={(open) => !open && setSelectedStatus(null)}>
  <DialogContent className="max-w-xs">
    <DialogHeader>
      <DialogTitle>Status do Pedido</DialogTitle>
    </DialogHeader>
    <div className="space-y-3 text-center">
      <div className="w-4 h-4 rounded-full mx-auto" style={{ backgroundColor: selectedStatus?.color }} />
      <p className="text-lg font-bold">{selectedStatus?.status}</p>
      <p className="text-3xl font-bold text-primary">{selectedStatus?.count}</p>
      <p className="text-sm text-muted-foreground">{percentage}% do total</p>
      <Button onClick={() => navigate(`/pedidos-criados?status=${selectedStatus?.status}`)}>
        Ver Pedidos
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

### 4. Resumo dos Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Importar Tooltip, Dialog; Adicionar estados para modais; Modificar renderização dos 3 cards |

---

### 5. Comportamento Esperado

| Card | Desktop/iPad | Mobile |
|------|--------------|--------|
| **Top 5 Modelos** | Nome em até 2 linhas + tooltip no hover | Toque abre modal com detalhes completos |
| **Produção** | Total no topo + lista de etapas com nomes completos | Mesmo layout, clicável para Kanban |
| **Status Pedidos** | Legenda com wrap (2 linhas) + tooltip no hover | Toque abre modal com status/quantidade/% |

---

### 6. Acessibilidade

- Todos os itens terão `title` e `aria-label` com texto completo
- Tooltips acessíveis via teclado (Radix)
- Modais focáveis e fecháveis via ESC
