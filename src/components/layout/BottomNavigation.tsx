import { forwardRef } from 'react';
import { LayoutDashboard, ShoppingCart, Warehouse, Factory, Plus, LucideIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItemType {
  label: string;
  icon: LucideIcon;
  path: string;
}

const leftNavItems: NavItemType[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Vendas', icon: ShoppingCart, path: '/pedidos/criados' },
];

const rightNavItems: NavItemType[] = [
  { label: 'Estoque', icon: Warehouse, path: '/estoque' },
  { label: 'Produção', icon: Factory, path: '/' },
];

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

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-pb">
      <div className="relative flex justify-around items-center h-16 px-2">
        {/* Left items */}
        {leftNavItems.map((item) => (
          <NavItem 
            key={item.path} 
            item={item} 
            isActive={isActive(item.path)}
            onClick={() => navigate(item.path)}
          />
        ))}
        
        {/* FAB Central - Novo Pedido */}
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => navigate('/pedidos/novo')}
            className="absolute -top-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>
        
        {/* Right items */}
        {rightNavItems.map((item) => (
          <NavItem 
            key={item.path} 
            item={item} 
            isActive={isActive(item.path)}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>
    </nav>
  );
}
