import { Package, LayoutDashboard, Factory, Warehouse, Users, ShoppingCart, FileText, Settings, HelpCircle, LogOut, Store, ArrowLeftRight, Tag, Bus, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppRole } from '@/types/roles';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles?: AppRole[];
}

const navItems: NavItem[] = [{
  label: 'Dashboard',
  icon: <LayoutDashboard size={18} />,
  path: '/dashboard',
  roles: ['admin', 'gerente']
}, {
  label: 'Clientes',
  icon: <Users size={18} />,
  path: '/clientes',
  roles: ['admin', 'gerente']
}, {
  label: 'Estoque',
  icon: <Warehouse size={18} />,
  path: '/estoque',
  roles: ['admin', 'gerente']
}, {
  label: 'Feira',
  icon: <Store size={18} />,
  path: '/feira',
  roles: ['admin', 'gerente', 'vendedor']
}, {
  label: 'Transferências',
  icon: <ArrowLeftRight size={18} />,
  path: '/transferencias',
  roles: ['admin', 'gerente', 'vendedor']
}, {
  label: 'Novo Pedido',
  icon: <ShoppingCart size={18} />,
  path: '/pedidos/novo',
  roles: ['admin', 'gerente']
}, {
  label: 'Pedidos Criados',
  icon: <FileText size={18} />,
  path: '/pedidos/criados',
  roles: ['admin', 'gerente']
}, {
  label: 'Produção',
  icon: <Factory size={18} />,
  path: '/producao',
  roles: ['admin', 'gerente']
}];

const bottomNavItems: NavItem[] = [{
  label: 'Usuários',
  icon: <Users size={18} />,
  path: '/configuracoes/usuarios',
  roles: ['admin']
}, {
  label: 'Tipos de Movimentações',
  icon: <Tag size={18} />,
  path: '/configuracoes/tipos-ajuste',
  roles: ['admin', 'gerente']
}, {
  label: 'Excursões',
  icon: <Bus size={18} />,
  path: '/configuracoes/excursoes',
  roles: ['admin', 'gerente']
}, {
  label: 'Custos Padrão',
  icon: <DollarSign size={18} />,
  path: '/configuracoes/custos-padrao',
  roles: ['admin', 'gerente']
}, {
  label: 'Ajuda',
  icon: <HelpCircle size={18} />,
  path: '/ajuda'
}];

// Pages that should preserve their URL params
const PAGES_WITH_PARAMS = ['/estoque', '/producao', '/clientes', '/pedidos/criados'];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Save current URL when leaving pages with params
  useEffect(() => {
    const currentPath = location.pathname;
    const shouldSave = PAGES_WITH_PARAMS.some(p => currentPath.startsWith(p));

    if (shouldSave && location.search) {
      sessionStorage.setItem(`lastUrl_${currentPath}`, currentPath + location.search);
    }
  }, [location.pathname, location.search]);

  const handleNavigate = useCallback((targetPath: string) => {
    // If already on the same path, don't navigate (preserves current params)
    if (location.pathname === targetPath) return;

    // Check if target page has saved URL params
    const savedUrl = sessionStorage.getItem(`lastUrl_${targetPath}`);
    if (savedUrl && savedUrl.startsWith(targetPath)) {
      navigate(savedUrl);
    } else {
      navigate(targetPath);
    }
  }, [location.pathname, navigate]);

  if (isMobile) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;
  const filterByRole = (items: NavItem[]) => items.filter(item => !item.roles || role && item.roles.includes(role));
  const visibleNavItems = filterByRole(navItems);
  const visibleBottomItems = filterByRole(bottomNavItems);
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const userEmail = user?.email || '';

  return (
    <aside className="w-20 lg:w-64 flex-shrink-0 flex flex-col justify-between p-4 bg-background">
      <div>
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl neu-button flex items-center justify-center text-primary">
            <Package size={20} />
          </div>
          <span className="hidden lg:block text-lg font-semibold">Deloockii Jeans</span>
        </div>

        <nav className="space-y-1">
          {visibleNavItems.map(item => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive(item.path) ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="hidden lg:block truncate whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-1">
        {visibleBottomItems.map(item => (
          <button
            key={item.path}
            onClick={() => handleNavigate(item.path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive(item.path) ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="hidden lg:block truncate whitespace-nowrap">{item.label}</span>
          </button>
        ))}

        <div className="pt-4 mt-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {userInitial}
            </div>
            <span className="hidden lg:block text-sm text-muted-foreground truncate max-w-[140px]">
              {userEmail}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
          >
            <LogOut size={18} />
            <span className="hidden lg:block">Sair</span>
          </button>
        </div>
      </div>
    </aside>
  );
}