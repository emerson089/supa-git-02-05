import { Package } from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';

interface MobileHeaderProps {
  title?: string;
}

export function MobileHeader({ title = 'Delookii' }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 z-50 md:hidden safe-area-pt">
      <MobileDrawer />
      
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Package size={16} />
        </div>
        <span className="font-bold text-lg">{title}</span>
      </div>
      
      {/* Placeholder for symmetry */}
      <div className="w-11" />
    </header>
  );
}
