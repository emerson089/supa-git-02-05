
## Plano: Persistir Busca Entre Navegações (Estoque e Produção)

### Problema Identificado

1. **Página de Produção (`/producao`)**: Usa estado local (`useState`) para busca - perde dados ao navegar
2. **Navegação**: Os botões de menu usam `navigate('/estoque')` sem preservar query params existentes

### Solução Proposta

#### Parte 1: Migrar Produção para URL Params

Alterar a página de Produção para usar `useSearchParams` ao invés de `useState` para a busca e filtros.

**Arquivo:** `src/pages/Index.tsx`

```typescript
// ANTES (estado local - perde ao navegar)
const [search, setSearch] = useState('');
const [filtros, setFiltros] = useState<FiltrosProducao>({ prioridade: 'todos' });

// DEPOIS (URL params - persiste entre navegações)
import { useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();
const search = searchParams.get('q') || '';
const filtros: FiltrosProducao = {
  prioridade: (searchParams.get('prioridade') as FiltrosProducao['prioridade']) || 'todos',
  responsavel: searchParams.get('responsavel') || undefined
};

// Helper para atualizar URL params
const updateParams = (updates: Record<string, string | undefined>) => {
  const newParams = new URLSearchParams(searchParams);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === 'todos') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
  });
  setSearchParams(newParams, { replace: true });
};

// Handlers atualizados
const handleSearchChange = (value: string) => updateParams({ q: value || undefined });
const handleFiltrosChange = (newFiltros: FiltrosProducao) => {
  updateParams({
    prioridade: newFiltros.prioridade === 'todos' ? undefined : newFiltros.prioridade,
    responsavel: newFiltros.responsavel
  });
};
```

---

#### Parte 2: Preservar Query Params na Navegação

Modificar os componentes de navegação para preservar os query params ao retornar para a mesma página.

**Arquivos:**
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/BottomNavigation.tsx`

**Lógica**: Ao navegar, verificar se já estamos na mesma rota base. Se sim, não alterar (já está com params). Se não, navegar para a rota base.

```typescript
// AppSidebar.tsx - Atualizar handleNavigate
const handleNavigate = (path: string) => {
  // Se já estamos na mesma rota, não fazer nada (preserva params)
  if (location.pathname === path) return;
  
  // Se está retornando para uma página que já visitou (tem params salvos)
  // Podemos preservar via sessionStorage ou simplesmente navegar
  navigate(path);
};
```

**Alternativa mais robusta** usando sessionStorage para salvar a última URL completa de cada página:

```typescript
// Ao navegar PARA FORA de uma página, salvar URL completa
useEffect(() => {
  return () => {
    sessionStorage.setItem(`lastUrl_${location.pathname}`, location.pathname + location.search);
  };
}, [location]);

// Ao clicar para navegar
const handleNavigate = (targetPath: string) => {
  const savedUrl = sessionStorage.getItem(`lastUrl_${targetPath}`);
  if (savedUrl && savedUrl.startsWith(targetPath)) {
    navigate(savedUrl);
  } else {
    navigate(targetPath);
  }
};
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Index.tsx` | Migrar `search` e `filtros` de `useState` para `useSearchParams` |
| `src/components/layout/AppSidebar.tsx` | Salvar e restaurar URL completa via sessionStorage |
| `src/components/layout/BottomNavigation.tsx` | Salvar e restaurar URL completa via sessionStorage |

---

### Comportamento Esperado

| Ação | Resultado |
|------|-----------|
| Pesquisar "calça" em Estoque | URL: `/estoque?q=calça` |
| Navegar para Produção | URL: `/producao` |
| Voltar para Estoque | URL: `/estoque?q=calça` (busca preservada!) |
| Pesquisar "lote 123" em Produção | URL: `/producao?q=lote+123` |
| Navegar para Clientes | URL: `/clientes` |
| Voltar para Produção | URL: `/producao?q=lote+123` (busca preservada!) |

---

### Detalhes Técnicos

- **sessionStorage**: Dados persistem apenas na sessão atual do navegador
- **Chave de armazenamento**: `lastUrl_/estoque`, `lastUrl_/producao`, etc.
- **Compatibilidade**: Funciona com BrowserRouter sem alterações na configuração do React Router
