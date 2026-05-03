import { forwardRef, useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Plus,
  MoreHorizontal,
  Store,
  ArrowLeftRight,
  Users,
  Factory,
  FileText,
  Settings,
  HelpCircle,
  UserPlus,
  LogOut,
  DollarSign,
  Tag,
  Bus,
  Receipt,
  LucideIcon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { AppRole } from '@/types/roles';
import { toast } from 'sonner';

interface NavItemType {
  label: string;
  icon: LucideIcon;
  path: string;
  roles?: AppRole[];
}

interface QuickActionType {
  label: string;
  icon: LucideIcon;
  path: string;
  roles?: AppRole[];
}

const leftNavItems: NavItemType[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'gerente'] },
  { label: 'Vendas', icon: ShoppingCart, path: '/pedidos/criados', roles: ['admin', 'gerente'] },
];

const rightNavItems: NavItemType[] = [
  { label: 'Estoque', icon: Warehouse, path: '/estoque', roles: ['admin', 'gerente'] },
  { label: 'Feira', icon: Store, path: '/feira', roles: ['admin', 'gerente', 'vendedor'] },
];

const quickActions: QuickActionType[] = [
  { label: 'Novo Pedido', icon: ShoppingCart, path: '/pedidos/novo', roles: ['admin', 'gerente'] },
  { label: 'Nova Carga (Feira)', icon: Store, path: '/feira', roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Novo Cliente', icon: UserPlus, path: '/clientes', roles: ['admin', 'gerente'] },
];

// Pages that should preserve their URL params
const PAGES_WITH_PARAMS = ['/estoque', '/producao', '/clientes'];

interface NavItemProps {
  item: NavItemType;
  isActive: boolean;
  onClick: () => void;
}

const NavItem = forwardRef<HTMLButtonElement, NavItemProps>(
  ({ item, isActive, onClick }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full min-w-[60px] min-h-[44px] gap-1 transition-all duration-300 rounded-lg relative overflow-hidden",
          isActive
            ? "text-primary"
            : "text-muted-foreground active:text-foreground active:bg-muted/50"
        )}
      >
        <div className={cn(
          "transition-transform duration-300 ease-out",
          isActive && "scale-110 -translate-y-0.5"
        )}>
          <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className={cn(
          "text-[10px] font-medium transition-all duration-300",
          isActive ? "font-semibold opacity-100" : "opacity-80"
        )}>
          {item.label}
        </span>
        {isActive && (
          <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary animate-in fade-in zoom-in duration-500" />
        )}
      </button>
    );
  }
);

NavItem.displayName = 'NavItem';

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { role } = useRole();
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Save current URL when leaving pages with params
  useEffect(() => {
    const currentPath = location.pathname;
    const shouldSave = PAGES_WITH_PARAMS.some(p => currentPath.startsWith(p));

    if (shouldSave && location.search) {
      sessionStorage.setItem(`lastUrl_${currentPath}`, currentPath + location.search);
    }
  }, [location.pathname, location.search]);

  // Filter items by role
  const filterByRole = <T extends { roles?: AppRole[] }>(items: T[]): T[] =>
    items.filter(item => !item.roles || (role && item.roles.includes(role)));

  const visibleLeftItems = filterByRole(leftNavItems);
  const visibleRightItems = filterByRole(rightNavItems);
  const visibleQuickActions = filterByRole(quickActions);

  const isActive = (path: string) => {
    if (path === '/producao') return location.pathname === '/producao';
    if (path === '/feira') return location.pathname === '/feira';
    return location.pathname.startsWith(path);
  };

  const handleNavigate = useCallback((targetPath: string) => {
    // Evita navegação redundante se já estivermos no exato mesmo caminho
    if (location.pathname === targetPath && !location.search) {
      setQuickActionsOpen(false);
      return;
    }

    // Se estivermos em uma página com parâmetros e clicarmos no mesmo item raiz,
    // mantemos os parâmetros atuais em vez de resetar
    if (location.pathname.startsWith(targetPath) && PAGES_WITH_PARAMS.some(p => targetPath.startsWith(p))) {
      setQuickActionsOpen(false);
      return;
    }

    // Check if target page has saved URL params
    const savedUrl = sessionStorage.getItem(`lastUrl_${targetPath}`);
    if (savedUrl && savedUrl.startsWith(targetPath)) {
      navigate(savedUrl);
    } else {
      navigate(targetPath);
    }
    setQuickActionsOpen(false);
  }, [location.pathname, location.search, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    navigate('/auth');
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50 z-50 md:hidden pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative flex justify-around items-center h-16 px-4">
          {/* Left items */}
          <div className="flex flex-1 justify-around items-center h-full max-w-[40%]">
            {visibleLeftItems.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isActive={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>

          <div className="flex-1" />

          {/* Right items */}
          <div className="flex flex-1 justify-around items-center h-full max-w-[45%]">
            {visibleRightItems.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isActive={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Quick Actions Sheet */}
      <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-left">Ações Rápidas</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {visibleQuickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleNavigate(action.path)}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors min-h-[90px]"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <action.icon size={24} />
                </div>
                <span className="text-sm font-medium text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* End */}
    </>
  );
}
