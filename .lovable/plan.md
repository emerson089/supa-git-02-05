
## Plano: Reorganizar Filtros em Barra Horizontal

### Situação Atual

O componente `FiltrosTransferencias` renderiza:
- **Mobile**: Um botão "Filtros" que abre um Sheet (bottom sheet)
- **Desktop**: Um card vertical (`rounded-lg border bg-muted/30 p-3`) com filtros empilhados

O usuário quer transformar isso em uma **barra horizontal compacta** onde todos os elementos (Período, Origem, Destino, Status, Motivo, Limpar, Nova) ficam em uma linha só.

---

### Abordagem

Vou **refatorar o componente FiltrosTransferencias** para ter duas variantes:
1. **Mobile**: Manter o comportamento atual (botão que abre Sheet) - funciona bem em telas pequenas
2. **Desktop/Tablet**: Nova barra horizontal inline com todos os filtros lado a lado

O botão "+Nova" será **passado via prop** para que o componente possa posicioná-lo corretamente à direita.

---

### Alterações Técnicas

#### Arquivo: `src/components/transferencias/FiltrosTransferencias.tsx`

1. **Adicionar prop para botão Nova**:
   - Nova prop `onNovaClick?: () => void` para renderizar o botão junto
   - Ou prop `slotNova?: React.ReactNode` para flexibilidade total

2. **Criar layout horizontal para desktop**:
   ```tsx
   // Desktop: barra horizontal
   return (
     <div className="flex flex-wrap items-center gap-2">
       {/* Período */}
       <Select ...>
         <SelectTrigger className="h-9 w-[130px]">...</SelectTrigger>
       </Select>
       
       {/* Calendários se custom */}
       {periodoSelecionado === 'custom' && (
         <>
           <Popover><Button className="h-9">...</Button></Popover>
           <Popover><Button className="h-9">...</Button></Popover>
         </>
       )}
       
       {/* Origem */}
       <Select ...>
         <SelectTrigger className="h-9 w-[120px]">...</SelectTrigger>
       </Select>
       
       {/* Destino */}
       <Select ...>
         <SelectTrigger className="h-9 w-[120px]">...</SelectTrigger>
       </Select>
       
       {/* Status */}
       <Select ...>
         <SelectTrigger className="h-9 w-[110px]">...</SelectTrigger>
       </Select>
       
       {/* Motivo */}
       <Select ...>
         <SelectTrigger className="h-9 w-[110px]">...</SelectTrigger>
       </Select>
       
       {/* Limpar (se tem filtros) */}
       {temFiltrosAtivos && (
         <Button variant="ghost" size="sm" className="h-9">
           <X className="h-4 w-4" />
           Limpar
         </Button>
       )}
       
       {/* Espaço flexível */}
       <div className="flex-1" />
       
       {/* Botão Nova (passado via prop ou slot) */}
       {onNovaClick && (
         <Button size="sm" className="h-9" onClick={onNovaClick}>
           <Plus className="h-4 w-4 mr-1" />
           Nova
         </Button>
       )}
     </div>
   );
   ```

3. **Inputs compactos**:
   - Altura: `h-9` (36px) em vez do padrão `h-10`
   - Larguras fixas para cada tipo: Período (130px), Origem/Destino (120px), Status/Motivo (110px)
   - Usar `placeholder` como label implícito

#### Arquivo: `src/pages/Transferencias.tsx`

1. **Ajustar o header da seção de transferências** (linhas 667-684):
   - Remover estrutura atual que separa título/filtros/botão
   - Passar o callback para nova transferência via prop

2. **Nova estrutura**:
   ```tsx
   <div className="shrink-0 px-3 pt-2 pb-3">
     {/* Título + Barra de Filtros */}
     <div className="flex items-center gap-3 mb-3">
       <div className="flex items-center gap-2 shrink-0">
         <ArrowLeftRight className="h-5 w-5 text-primary" />
         <h2 className="font-semibold">Transferências</h2>
       </div>
       
       {/* Filtros + Nova - ocupa resto do espaço */}
       <FiltrosTransferencias 
         filtros={filtros} 
         onFiltrosChange={setFiltros} 
         locais={locaisDisponiveis}
         onNovaClick={handleOpenModal}  // Nova prop
       />
     </div>
     
     {/* Cards de resumo permanecem iguais */}
     ...
   </div>
   ```

---

### Responsividade

| Viewport | Comportamento |
|----------|---------------|
| **Desktop (> 1024px)** | Todos os filtros + Nova em uma linha |
| **Tablet (768-1024px)** | `flex-wrap` permite quebrar em 2 linhas naturalmente |
| **Mobile (< 768px)** | Botão "Filtros" abre Sheet (mantém comportamento atual) |

---

### Layout Visual (Desktop)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⇄ Transferências  [Período ▼] [Origem ▼] [Destino ▼] [Status ▼] [Motivo ▼] [Limpar]   [+Nova]│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/transferencias/FiltrosTransferencias.tsx` | Reescrever layout desktop para horizontal, adicionar prop para botão Nova |
| `src/pages/Transferencias.tsx` | Ajustar estrutura do header para usar nova interface do componente |

---

### Resultado Esperado

1. Em **desktop**, todos os filtros ficam em uma única linha horizontal
2. O botão **"+Nova"** fica sempre alinhado à direita
3. Em **tablet**, se faltar espaço, os filtros quebram automaticamente em duas linhas (wrap)
4. Em **mobile**, mantém o padrão atual (botão que abre Sheet)
5. Visual limpo com inputs compactos (altura 36px)
