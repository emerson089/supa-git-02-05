import { Package, LayoutDashboard, Factory, Warehouse, Users, ShoppingCart, FileText, Settings, HelpCircle, LogOut, Store, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
  { label: 'Clientes', icon: <Users size={18} />, path: '/clientes' },
  { label: 'Estoque', icon: <Warehouse size={18} />, path: '/estoque' },
  { label: 'Feira', icon: <Store size={18} />, path: '/feira' },
  { label: 'Transferências', icon: <ArrowLeftRight size={18} />, path: '/transferencias' },
  { label: 'Novo Pedido', icon: <ShoppingCart size={18} />, path: '/pedidos/novo' },
  { label: 'Pedidos Criados', icon: <FileText size={18} />, path: '/pedidos/criados' },
  { label: 'Produção', icon: <Factory size={18} />, path: '/producao' },
];

const bottomNavItems: NavItem[] = [
  { label: 'Configurações', icon: <Settings size={18} />, path: '/configuracoes' },
  { label: 'Ajuda', icon: <HelpCircle size={18} />, path: '/ajuda' },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Hide sidebar on mobile - Bottom Navigation takes over
  if (isMobile) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    navigate('/auth');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const userEmail = user?.email || '';

  return (
    <aside className="w-20 lg:w-64 flex-shrink-0 flex flex-col justify-between p-4 bg-background">
      {/* Logo */}
      <div>
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl neu-button flex items-center justify-center text-primary">
            <Package size={20} />
          </div>
          <div className="hidden lg:block">
            <span className="font-bold text-xl tracking-tight text-foreground">
              Delookii
            </span>
            <p className="text-[10px] text-muted-foreground">ERP Jeans</p>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
                  active
                    ? 'neu-button-pressed bg-background text-primary font-semibold shadow-neu-inset'
                    : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className={`flex items-center justify-center ${active ? 'text-primary' : ''}`}>
                  {item.icon}
                </div>
                <span className="hidden lg:block text-sm">{item.label}</span>
                {active && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-primary hidden lg:block" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="space-y-4">
        {/* Bottom Navigation */}
        <nav className="space-y-2">
          {bottomNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
                  active
                    ? 'neu-button-pressed bg-background text-primary font-semibold shadow-neu-inset'
                    : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.icon}
                <span className="hidden lg:block text-sm">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-destructive/10 text-muted-foreground hover:text-destructive min-h-[44px]"
          >
            <LogOut size={18} />
            <span className="hidden lg:block text-sm">Sair</span>
          </button>
        </nav>

        {/* User Profile */}
        <div className="p-3 rounded-xl neu-card flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
            {userInitial}
          </div>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-sm font-semibold text-foreground truncate" title={userEmail}>
              {userEmail.split('@')[0]}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
