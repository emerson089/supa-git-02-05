import {
  Package, LayoutDashboard, Warehouse, Users,
  ShoppingCart, Settings, HelpCircle, LogOut,
  ChevronDown, ChevronRight, List, ArrowLeftRight, 
  Store, Factory, UserPlus, Settings2, Bus, DollarSign, Wrench, FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppRole } from '@/types/roles';

interface NavItem {
  label: string;
  icon?: React.ReactNode;
  path?: string;
  roles?: AppRole[];
  subItems?: NavItem[];
}

const mainNavGroups: NavItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    path: '/dashboard',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Novo Pedido',
    icon: <ShoppingCart size={18} />,
    path: '/pedidos/novo',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Pedidos Criados',
    icon: <List size={18} />,
    path: '/pedidos/criados',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Estoque',
    icon: <Warehouse size={18} />,
    path: '/estoque',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Transferências',
    icon: <ArrowLeftRight size={18} />,
    path: '/transferencias',
    roles: ['admin', 'gerente', 'vendedor']
  },
  {
    label: 'Feira',
    icon: <Store size={18} />,
    path: '/feira',
    roles: ['admin', 'gerente', 'vendedor']
  },
  {
    label: 'Produção',
    icon: <Factory size={18} />,
    path: '/producao',
    roles: ['admin', 'gerente'],
    subItems: [
      {
        label: 'Fluxo de Produção',
        icon: <List size={16} />,
        path: '/producao',
        roles: ['admin', 'gerente'] as AppRole[],
      },
      {
        label: 'Peças em Conserto',
        icon: <Wrench size={16} />,
        path: '/producao/consertos',
        roles: ['admin', 'gerente'] as AppRole[],
      },
    ],
  },
  {
    label: 'Clientes',
    icon: <Users size={18} />,
    path: '/clientes',
    roles: ['admin', 'gerente']
  }
];

const bottomNavGroups: NavItem[] = [
  {
    label: 'Usuários',
    icon: <UserPlus size={18} />,
    path: '/configuracoes/usuarios',
    roles: ['admin']
  },
  {
    label: 'Tipos de Ajuste',
    icon: <Settings2 size={18} />,
    path: '/configuracoes/tipos-ajuste',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Excursões',
    icon: <Bus size={18} />,
    path: '/configuracoes/excursoes',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Custos Padrão',
    icon: <DollarSign size={18} />,
    path: '/configuracoes/custos-padrao',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Catálogo CRM',
    icon: <FileText size={18} />,
    path: '/configuracoes/catalogo',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Ajuda',
    icon: <HelpCircle size={18} />,
    path: '/ajuda'
  }
];

// Pages that should preserve their URL params
const PAGES_WITH_PARAMS = ['/estoque', '/producao', '/clientes'];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Save current URL when leaving pages with params
  useEffect(() => {
    const currentPath = location.pathname;
    const shouldSave = PAGES_WITH_PARAMS.some(p => currentPath.startsWith(p));

    if (shouldSave && location.search) {
      sessionStorage.setItem(`lastUrl_${currentPath}`, currentPath + location.search);
    }
  }, [location.pathname, location.search]);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const handleNavigate = useCallback((targetPath: string) => {
    if (location.pathname === targetPath && !location.search) return;

    if (targetPath === '/pedidos/criados') {
      navigate(targetPath);
      return;
    }

    const savedUrl = sessionStorage.getItem(`lastUrl_${targetPath}`);
    if (savedUrl && savedUrl.startsWith(targetPath)) {
      navigate(savedUrl);
    } else {
      navigate(targetPath);
    }
  }, [location.pathname, location.search, navigate]);

  if (isMobile) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    navigate('/auth');
  };

  const isActive = (path?: string) => path ? location.pathname === path : false;
  const filterByRole = (items: NavItem[]): NavItem[] => {
    return items.reduce<NavItem[]>((acc, item) => {
      const hasRole = !item.roles || (role && item.roles.includes(role));
      if (!hasRole) return acc;
      if (item.subItems) {
        const filteredSubItems = filterByRole(item.subItems);
        if (filteredSubItems.length === 0) return acc;
        return [...acc, { ...item, subItems: filteredSubItems }];
      }
      return [...acc, item];
    }, []);
  };

  const visibleNavGroups = filterByRole(mainNavGroups);
  const visibleBottomGroups = filterByRole(bottomNavGroups);
  
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const userEmail = user?.email || '';

  const renderNavItem = (item: NavItem, isSubItem = false) => {
    const active = isActive(item.path);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isGroupExpanded = expandedGroups[item.label];

    // Check if any sub-item is active to highlight the parent group
    const isParentActive = hasSubItems && item.subItems?.some(sub => isActive(sub.path));

    const handleClick = () => {
      if (hasSubItems) {
        toggleGroup(item.label);
      }
      
      if (item.path) {
        handleNavigate(item.path);
      }
    };

    return (
      <div key={item.label} className="w-full">
        <button
          onClick={handleClick}
          title={!isSidebarExpanded && !isSubItem ? item.label : undefined}
          className={`
            w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
            ${isSubItem ? 'pl-9 pr-3 py-1 text-xs relative' : ''}
            ${active || (!isSubItem && isParentActive) ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}
          `}
        >
          {isSubItem && (
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-gray-300'}`} />
          )}
          
          <div className="flex items-center gap-3 overflow-hidden">
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span className={`truncate transition-opacity duration-300 ${isSidebarExpanded || isSubItem ? 'opacity-100' : 'opacity-0 w-0'}`}>
              {item.label}
            </span>
          </div>

          {(hasSubItems && isSidebarExpanded) && (
            <span className="flex-shrink-0 transition-transform duration-200">
              {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
        </button>

        {/* SubItems Render */}
        {hasSubItems && isGroupExpanded && isSidebarExpanded && (
          <div className="mt-0.5 mb-1 space-y-0.5">
            {item.subItems?.map(subItem => (
               <div key={subItem.label}>
                 {renderNavItem(subItem, true)}
               </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside 
      className={`flex-shrink-0 flex flex-col justify-between p-3 bg-white transition-all duration-300 ease-in-out border-r border-gray-200 shadow-sm z-20 ${isSidebarExpanded ? 'w-60' : 'w-16'}`}
      onMouseEnter={() => setIsSidebarExpanded(true)}
      onMouseLeave={() => setIsSidebarExpanded(false)}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar pb-2">
        <div className={`flex items-center gap-2 mb-4 px-1 transition-all duration-300 ${isSidebarExpanded ? 'justify-start' : 'justify-center'}`}>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex-shrink-0 flex items-center justify-center text-indigo-600">
            <Package size={16} />
          </div>
          <span className={`text-base font-semibold truncate transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
            Deloockii Jeans
          </span>
        </div>

        <nav className="space-y-0.5">
          {visibleNavGroups.map(group => renderNavItem(group))}
        </nav>
      </div>

      <div className="space-y-0.5 flex-shrink-0 bg-white pt-1">
        {visibleBottomGroups.map(group => renderNavItem(group))}

        <div className="pt-2 mt-2 border-t border-gray-100">
          <div className={`flex items-center gap-2 px-3 py-1 transition-all duration-300 ${isSidebarExpanded ? 'justify-start' : 'justify-center'}`}>
            <div className="w-7 h-7 rounded-full bg-indigo-600/10 flex-shrink-0 flex items-center justify-center text-indigo-600 font-semibold text-xs">
              {userInitial}
            </div>
            <span className={`text-xs text-muted-foreground truncate max-w-[130px] transition-all duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
              {userEmail}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            title={!isSidebarExpanded ? 'Sair' : undefined}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200 ${!isSidebarExpanded ? 'justify-center' : ''}`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className={`transition-all duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
              Sair
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}