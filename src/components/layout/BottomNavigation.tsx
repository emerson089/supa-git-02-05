import { LayoutDashboard, ShoppingCart, Warehouse, Factory, Plus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const leftNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Vendas', icon: ShoppingCart, path: '/pedidos/criados' },
];

const rightNavItems = [
  { label: 'Estoque', icon: Warehouse, path: '/estoque' },
  { label: 'Produção', icon: Factory, path: '/' },
];

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const NavItem = ({ item }: { item: typeof leftNavItems[0] }) => {
    const active = isActive(item.path);
    return (
      <button
        onClick={() => navigate(item.path)}
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full min-w-[60px] min-h-[44px] gap-1 transition-colors rounded-lg",
          active 
            ? "text-primary" 
            : "text-muted-foreground active:text-foreground"
        )}
      >
        <item.icon size={22} strokeWidth={active ? 2.5 : 2} />
        <span className={cn(
          "text-[10px] font-medium",
          active && "font-semibold"
        )}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-pb">
      <div className="relative flex justify-around items-center h-16 px-2">
        {/* Left items */}
        {leftNavItems.map((item) => (
          <NavItem key={item.path} item={item} />
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
          <NavItem key={item.path} item={item} />
        ))}
      </div>
    </nav>
  );
}