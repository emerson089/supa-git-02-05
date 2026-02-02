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

const moreMenuItems: NavItemType[] = [
  { label: 'Transferências', icon: ArrowLeftRight, path: '/transferencias', roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Clientes', icon: Users, path: '/clientes', roles: ['admin', 'gerente'] },
  { label: 'Produção', icon: Factory, path: '/producao', roles: ['admin', 'gerente'] },
  { label: 'Pedidos Criados', icon: FileText, path: '/pedidos/criados', roles: ['admin', 'gerente'] },
  { label: 'Configurações', icon: Settings, path: '/configuracoes/usuarios', roles: ['admin'] },
  { label: 'Ajuda', icon: HelpCircle, path: '/ajuda' },
];

const quickActions: QuickActionType[] = [
  { label: 'Novo Pedido', icon: ShoppingCart, path: '/pedidos/novo', roles: ['admin', 'gerente'] },
  { label: 'Nova Transferência', icon: ArrowLeftRight, path: '/transferencias', roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Nova Carga (Feira)', icon: Store, path: '/feira', roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Novo Cliente', icon: UserPlus, path: '/clientes', roles: ['admin', 'gerente'] },
];

// Pages that should preserve their URL params
const PAGES_WITH_PARAMS = ['/estoque', '/producao', '/clientes', '/pedidos/criados'];

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
          "flex flex-col items-center justify-center flex-1 h-full min-w-[60px] min-h-[44px] gap-1 transition-colors rounded-lg",
          isActive 
            ? "text-primary" 
            : "text-muted-foreground active:text-foreground"
        )}
      >
        <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
        <span className={cn(
          "text-[10px] font-medium",
          isActive && "font-semibold"
        )}>
          {item.label}
        </span>
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
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
  const visibleMoreItems = filterByRole(moreMenuItems);
  const visibleQuickActions = filterByRole(quickActions);

  const isActive = (path: string) => {
    if (path === '/producao') return location.pathname === '/producao';
    if (path === '/feira') return location.pathname === '/feira';
    return location.pathname.startsWith(path);
  };

  const handleNavigate = useCallback((targetPath: string) => {
    // If already on the same path, don't navigate (preserves current params)
    if (location.pathname === targetPath) {
      setMoreMenuOpen(false);
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
    setMoreMenuOpen(false);
    setQuickActionsOpen(false);
  }, [location.pathname, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    navigate('/auth');
    setMoreMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-pb">
        <div className="relative flex justify-around items-center h-16 px-2">
          {/* Left items */}
          {visibleLeftItems.map((item) => (
            <NavItem 
              key={item.path} 
              item={item} 
              isActive={isActive(item.path)}
              onClick={() => navigate(item.path)}
            />
          ))}
          
          {/* FAB Central - Quick Actions */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setQuickActionsOpen(true)}
              className="absolute -top-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
          </div>
          
          {/* Right items */}
          {visibleRightItems.map((item) => (
            <NavItem 
              key={item.path} 
              item={item} 
              isActive={isActive(item.path)}
              onClick={() => navigate(item.path)}
            />
          ))}

          {/* More Menu Button */}
          <button
            onClick={() => setMoreMenuOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full min-w-[60px] min-h-[44px] gap-1 transition-colors rounded-lg",
              moreMenuOpen 
                ? "text-primary" 
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <MoreHorizontal size={22} strokeWidth={2} />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
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

      {/* More Menu Sheet */}
      <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] flex flex-col">
          <SheetHeader className="pb-2 flex-shrink-0">
            <SheetTitle className="text-left">Mais opções</SheetTitle>
          </SheetHeader>
          
          {/* Scrollable menu items */}
          <div className="flex-1 overflow-y-auto py-2 space-y-1">
            {visibleMoreItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[48px]",
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <item.icon size={20} />
                  <span className="text-sm">{item.label}</span>
                  {active && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Logout button - always visible at bottom */}
          <div className="flex-shrink-0 pt-2 border-t border-border pb-safe">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[48px] hover:bg-destructive/10 text-destructive"
            >
              <LogOut size={20} />
              <span className="text-sm">Sair</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
