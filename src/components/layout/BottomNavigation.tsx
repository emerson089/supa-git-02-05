import { LayoutDashboard, ShoppingCart, Warehouse, Factory } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const bottomNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Vendas', icon: ShoppingCart, path: '/pedidos/criados' },
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-pb">
      <div className="flex justify-around items-center h-16 px-2">
        {bottomNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
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
              {active && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
