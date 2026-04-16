import {
  Package, LayoutDashboard, Warehouse, Users,
  ShoppingCart, Settings, HelpCircle, LogOut,
  ChevronDown, ChevronRight, List, ArrowLeftRight, 
  Store, Factory, UserPlus, Settings2, Bus, DollarSign, Wrench, FileText, MessageSquare, Receipt
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
  },
  {
    label: 'Comprovantes',
    icon: <Receipt size={18} />,
    path: '/comprovantes',
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
    label: 'Envios em Massa',
    icon: <FileText size={18} />,
    path: '/configuracoes/catalogo',
    roles: ['admin', 'gerente']
  },
  {
    label: 'Notificações',
    icon: <MessageSquare size={18} />,
    path: '/configuracoes/notificacoes',
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
            w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-all duration-200 outline-none
            ${isSubItem ? 'pl-[42px] pr-3 py-2 relative' : ''}
            ${
              active || (!isSubItem && isParentActive) 
                ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.02)]' 
                : 'text-slate-500 font-medium hover:text-slate-800 hover:bg-slate-100/60'
            }
          `}
        >
          {isSubItem && (
            <div 
              className={`absolute left-[22px] top-1/2 -translate-y-1/2 rounded-full transition-colors duration-200
                ${active ? 'bg-indigo-600 w-[5px] h-[5px]' : 'bg-slate-300 w-1 h-1 group-hover/btn:bg-slate-400'}`} 
            />
          )}
          
          <div className="flex items-center gap-[14px] overflow-hidden">
            {item.icon && (
              <span className={`flex-shrink-0 transition-colors duration-200 ${active || isParentActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                {item.icon}
              </span>
            )}
            <span className={`truncate transition-all duration-300 ${isSidebarExpanded || isSubItem ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0'}`}>
              {item.label}
            </span>
          </div>

          {(hasSubItems && isSidebarExpanded) && (
            <span className={`flex-shrink-0 transition-all duration-300 ${isGroupExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-400'}`}>
              <ChevronRight size={14} />
            </span>
          )}
        </button>

        {/* SubItems Render */}
        {hasSubItems && isGroupExpanded && isSidebarExpanded && (
          <div className="mt-1 mb-2 relative space-y-0.5">
            {/* Thread line guiding nested items */}
            <div className="absolute left-[24px] top-0 bottom-3 w-[1.5px] bg-slate-100/80 rounded-full" />
            {item.subItems?.map(subItem => (
               <div key={subItem.label} className="group/btn relative">
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
      className={`group flex-shrink-0 flex flex-col justify-between p-4 bg-white transition-all duration-300 ease-in-out border-r border-slate-200/60 shadow-sm z-20 sticky top-0 h-screen ${isSidebarExpanded ? 'w-[260px]' : 'w-20'}`}
      onMouseEnter={() => setIsSidebarExpanded(true)}
      onMouseLeave={() => setIsSidebarExpanded(false)}
      style={{ willChange: 'width' }}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar pb-4 space-y-6">
        <div className={`flex items-center gap-[14px] px-2 mb-2 transition-all duration-300 ${isSidebarExpanded ? 'justify-start' : 'justify-center'}`}>
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex-shrink-0 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 transition-all">
            <Package size={18} strokeWidth={2.5} />
          </div>
          <span 
            className={`text-[15px] font-bold text-slate-900 tracking-tight whitespace-nowrap transition-all duration-300 
            ${isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0 overflow-hidden'}`}
          >
            Deloockii Jeans
          </span>
        </div>

        <div>
          {isSidebarExpanded && (
            <div className="px-3 mb-2 text-[11px] font-bold tracking-widest text-slate-400/80 uppercase">
              Principal
            </div>
          )}
          <nav className="space-y-1">
            {visibleNavGroups.map(group => renderNavItem(group))}
          </nav>
        </div>
      </div>

      <div className="flex-shrink-0 bg-white pt-3 border-t border-slate-100">
        <div>
          {isSidebarExpanded && (
            <div className="px-3 mb-2 text-[11px] font-bold tracking-widest text-slate-400/80 uppercase">
              Ajustes
            </div>
          )}
          <div className="space-y-1">
            {visibleBottomGroups.map(group => renderNavItem(group))}
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100">
          <div className={`flex items-center gap-[14px] px-3 py-2 transition-all duration-300 ${isSidebarExpanded ? 'justify-start' : 'justify-center'}`}>
            <div className="w-[34px] h-[34px] rounded-full bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center text-slate-600 font-bold text-[13px] shadow-sm">
              {userInitial}
            </div>
            <div className={`flex flex-col transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
              <span className="text-[13px] font-semibold text-slate-800 leading-tight">Membro</span>
              <span className="text-[11px] font-medium text-slate-400 truncate max-w-[140px]">
                {userEmail}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title={!isSidebarExpanded ? 'Sair' : undefined}
            className={`mt-2 w-full flex items-center gap-[14px] px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 outline-none ${!isSidebarExpanded ? 'justify-center' : ''}`}
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span className={`transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 -translate-x-0' : 'opacity-0 -translate-x-4 w-0 hidden'}`}>
              Sair
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}