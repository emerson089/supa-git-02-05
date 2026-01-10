import { Package, LayoutDashboard, Factory, Warehouse, DollarSign, Settings, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Produção', icon: <Factory size={18} />, active: true },
  { label: 'Estoque', icon: <Warehouse size={18} /> },
  { label: 'Financeiro', icon: <DollarSign size={18} /> },
];

const bottomNavItems: NavItem[] = [
  { label: 'Configurações', icon: <Settings size={18} /> },
  { label: 'Ajuda', icon: <HelpCircle size={18} /> },
];

export function ProductionSidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada');
    navigate('/auth');
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
          <span className="font-bold text-xl tracking-tight text-foreground hidden lg:block">
            Delookii
          </span>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                item.active
                  ? 'neu-button-pressed bg-background text-primary font-semibold shadow-neu-inset'
                  : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`flex items-center justify-center ${item.active ? 'text-primary' : ''}`}>
                {item.icon}
              </div>
              <span className="hidden lg:block text-sm">{item.label}</span>
              {item.active && (
                <div className="ml-auto w-2 h-2 rounded-full bg-primary hidden lg:block" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="space-y-4">
        {/* Bottom Navigation */}
        <nav className="space-y-2">
          {bottomNavItems.map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
            >
              {item.icon}
              <span className="hidden lg:block text-sm">{item.label}</span>
            </button>
          ))}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
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
