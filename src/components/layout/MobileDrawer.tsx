import { useState } from 'react';
import {
  Menu,
  Users,
  ShoppingCart,
  Settings,
  HelpCircle,
  LogOut,
  Package,
  LayoutDashboard,
  Warehouse,
  Store,
  ArrowLeftRight,
  Factory,
  FileText,
  DollarSign,
  Tag,
  Bus,
  LucideIcon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppRole } from '@/types/roles';

interface DrawerNavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  roles?: AppRole[];
}

const drawerNavItems: DrawerNavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'gerente'] },
  { label: 'Pedidos Criados', icon: FileText, path: '/pedidos/criados', roles: ['admin', 'gerente'] },
  { label: 'Novo Pedido', icon: ShoppingCart, path: '/pedidos/novo', roles: ['admin', 'gerente'] },
  { label: 'Clientes', icon: Users, path: '/clientes', roles: ['admin', 'gerente'] },
];

const drawerOperationsItems: DrawerNavItem[] = [
  { label: 'Estoque', icon: Warehouse, path: '/estoque', roles: ['admin', 'gerente'] },
  { label: 'Feira', icon: Store, path: '/feira', roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Transferências', icon: ArrowLeftRight, path: '/transferencias', roles: ['admin', 'gerente'] },
  { label: 'Produção', icon: Factory, path: '/producao', roles: ['admin', 'gerente'] },
];

const drawerBottomItems: DrawerNavItem[] = [
  { label: 'Usuários', icon: Settings, path: '/configuracoes/usuarios', roles: ['admin'] },
  { label: 'Tipos de Movimentações', icon: Tag, path: '/configuracoes/tipos-ajuste', roles: ['admin', 'gerente'] },
  { label: 'Excursões', icon: Bus, path: '/configuracoes/excursoes', roles: ['admin', 'gerente'] },
  { label: 'Custos Padrão', icon: DollarSign, path: '/configuracoes/custos-padrao', roles: ['admin', 'gerente'] },
  { label: 'Ajuda', icon: HelpCircle, path: '/ajuda' },
];

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const filterByRole = (items: DrawerNavItem[]): DrawerNavItem[] => {
    return items.filter(item => !item.roles || (role && item.roles.includes(role)));
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    navigate('/auth');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const userEmail = user?.email || '';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
        >
          <Menu size={24} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl neu-button flex items-center justify-center text-primary">
              <Package size={20} />
            </div>
            <div>
              <SheetTitle className="text-left font-bold text-xl tracking-tight text-foreground">
                Delookii
              </SheetTitle>
              <p className="text-[10px] text-muted-foreground">ERP Jeans</p>
            </div>
          </div>
        </SheetHeader>

        <Separator className="my-2" />

        {/* User Profile */}
        <div className="p-4 pt-2">
          <div className="p-3 rounded-xl neu-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
              {userInitial}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {userEmail.split('@')[0]}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Main Navigation */}
        {filterByRole(drawerNavItems).length > 0 && (
          <nav className="p-4 pt-2 pb-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Principal</p>
            {filterByRole(drawerNavItems).map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px]",
                    active
                      ? 'neu-button-pressed bg-background text-primary font-semibold shadow-neu-inset'
                      : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon size={18} />
                  <span className="text-sm">{item.label}</span>
                  {active && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Operations Navigation */}
        {filterByRole(drawerOperationsItems).length > 0 && (
          <nav className="p-4 pt-1 pb-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Operações</p>
            {filterByRole(drawerOperationsItems).map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px]",
                    active
                      ? 'neu-button-pressed bg-background text-primary font-semibold shadow-neu-inset'
                      : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon size={18} />
                  <span className="text-sm">{item.label}</span>
                  {active && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        <Separator className="my-2" />

        {/* Bottom Navigation */}
        <nav className="p-4 pt-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Configurações</p>
          {filterByRole(drawerBottomItems).map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px]",
                  active
                    ? 'neu-button-pressed bg-background text-primary font-semibold shadow-neu-inset'
                    : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon size={18} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-destructive/10 text-muted-foreground hover:text-destructive min-h-[44px]"
          >
            <LogOut size={18} />
            <span className="text-sm">Sair</span>
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
