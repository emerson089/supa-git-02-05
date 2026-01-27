

## Plano: Persistir Busca, Filtros e Scroll na Tela de Estoque

### Objetivo
Quando você buscar por nome ou referência na tela **Controle de Estoque** (`/estoque`), ao sair e voltar (editar item, trocar de rota, recarregar), a tela deve manter:
- O texto de busca aplicado (`q`)
- A aba/filtro selecionado (`tab` e `filtro`)
- A posição do scroll (restauração)

A busca só será limpa ao clicar explicitamente em um botão **Limpar**.

---

### Abordagem Escolhida

| Dado | Método de Persistência | Motivo |
|------|------------------------|--------|
| Busca (`q`) | URL query params | Compartilhável, persiste navegação/reload |
| Tab (`tab`) | URL query params | Sincronizado com busca |
| Filtro rápido (`filtro`) | URL query params | Sincronizado com busca |
| Página atual (`page`) | URL query params | Restaurar mesma posição na lista |
| Posição do scroll | sessionStorage | Efêmero por sessão, restauração ao voltar |

**URL exemplo:** `/estoque?q=REF530&tab=produto_acabado&filtro=baixo&page=0`

---

### Alterações Técnicas

**Arquivo:** `src/pages/Estoque.tsx`

#### 1. Adicionar imports necessários
```typescript
import { useSearchParams } from 'react-router-dom';
```

#### 2. Substituir estado local por URL params
**Antes:**
```typescript
const [search, setSearch] = useState('');
const [activeTab, setActiveTab] = useState<'materia_prima' | 'produto_acabado'>('produto_acabado');
const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>('todos');
const [currentPage, setCurrentPage] = useState(0);
```

**Depois:**
```typescript
const [searchParams, setSearchParams] = useSearchParams();

// Ler valores iniciais da URL (ou defaults)
const search = searchParams.get('q') || '';
const activeTab = (searchParams.get('tab') as 'materia_prima' | 'produto_acabado') || 'produto_acabado';
const filtroRapido = (searchParams.get('filtro') as FiltroRapido) || 'todos';
const currentPage = parseInt(searchParams.get('page') || '0', 10);
```

#### 3. Criar funções para atualizar URL params
```typescript
const updateParams = (updates: Record<string, string | undefined>) => {
  const newParams = new URLSearchParams(searchParams);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
  });
  setSearchParams(newParams, { replace: true });
};

const handleSearchChange = (value: string) => {
  updateParams({ q: value, page: '0' });
};

const handleTabChange = (tab: 'materia_prima' | 'produto_acabado') => {
  updateParams({ tab, page: '0' });
};

const handleFilterChange = (filtro: FiltroRapido) => {
  updateParams({ filtro: filtro === 'todos' ? undefined : filtro, page: '0' });
};

const handlePageChange = (page: number) => {
  updateParams({ page: page.toString() });
};

const handleClearSearch = () => {
  updateParams({ q: undefined, page: '0' });
};
```

#### 4. Persistir e restaurar posição do scroll
```typescript
const scrollContainerRef = useRef<HTMLDivElement>(null);
const SCROLL_KEY = 'estoque_scroll';

// Salvar posição ao sair
useEffect(() => {
  const handleBeforeUnload = () => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(SCROLL_KEY, scrollContainerRef.current.scrollTop.toString());
    }
  };
  
  return () => {
    // Salvar ao desmontar (sair da rota)
    if (scrollContainerRef.current) {
      sessionStorage.setItem(SCROLL_KEY, scrollContainerRef.current.scrollTop.toString());
    }
  };
}, []);

// Restaurar posição ao voltar (após dados carregados)
useEffect(() => {
  if (!isPaginatedLoading && scrollContainerRef.current) {
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (savedScroll) {
      scrollContainerRef.current.scrollTop = parseInt(savedScroll, 10);
      sessionStorage.removeItem(SCROLL_KEY); // Limpar após restaurar
    }
  }
}, [isPaginatedLoading]);
```

#### 5. Adicionar referência ao container de scroll
**No JSX:**
```tsx
<div 
  ref={scrollContainerRef}
  className={cn("flex-1 overflow-auto", isMobile ? "p-4" : "p-6")}
>
```

#### 6. Adicionar botão "Limpar busca" (ícone X)
**Desktop (linha ~655-663):**
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
  <Input
    placeholder="Buscar item..."
    value={search}
    onChange={e => handleSearchChange(e.target.value)}
    className="pl-10 pr-8 w-64 bg-background shadow-[...] border-0"
  />
  {search && (
    <button
      onClick={handleClearSearch}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
      title="Limpar busca"
    >
      <X size={14} className="text-muted-foreground" />
    </button>
  )}
</div>
```

**Mobile (linha ~670-682):** Mesma estrutura com botão X.

#### 7. Atualizar chamadas existentes
- Substituir `setSearch(...)` por `handleSearchChange(...)`
- Substituir `setActiveTab(...)` por `handleTabChange(...)`
- Substituir `setFiltroRapido(...)` por `handleFilterChange(...)`
- Substituir `setCurrentPage(...)` por `handlePageChange(...)`

---

### Fluxo de Usuário (Critérios de Aceite)

| Cenário | Resultado Esperado |
|---------|-------------------|
| Buscar "REF530" → Editar item → Voltar | Campo mostra "REF530", lista filtrada, mesma posição |
| Selecionar "Estoque Baixo" + busca → Sair/Voltar | Mantém tab + filtro + busca |
| Clicar no X do campo | Remove busca, volta ao padrão |
| Recarregar página (F5) | URL preserva estado, tela abre no mesmo ponto |
| Navegar para /feira → voltar /estoque | Estado preservado via URL |

---

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Estoque.tsx` | Substituir useState por useSearchParams + scroll persistence |

---

### Padrão Existente no Projeto
Esta implementação segue o mesmo padrão usado em:
- `src/pages/PedidosCriados.tsx` (localStorage para filtros + useSearchParams para status)

A diferença é que usaremos **URL params exclusivamente** para garantir persistência em refresh e compartilhamento de links.

