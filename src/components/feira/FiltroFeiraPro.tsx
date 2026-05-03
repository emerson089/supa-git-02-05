import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Calendar, 
  TrendingUp, 
  Filter, 
  X, 
  Zap, 
  AlertTriangle, 
  Package, 
  ChevronDown,
  ArrowUpDown
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { PeriodoFeira, PeriodoTipo, calcularPeriodo } from '@/hooks/useFeiraHistorico';
import { FiltroPeriodo } from './FiltroPeriodo';

export interface FiltrosFeiraPro {
  periodo: PeriodoFeira;
  busca: string;
  classe: 'todas' | 'curvaA' | 'curvaB' | 'curvaC';
  estoque: 'todos' | 'disponivel' | 'baixo' | 'zerado';
  verComparativo: boolean;
}

interface Props {
  filtros: FiltrosFeiraPro;
  onChange: (filtros: FiltrosFeiraPro) => void;
  totalModelos?: number;
}

export function FiltroFeiraPro({ filtros, onChange, totalModelos }: Props) {
  const isMobile = useIsMobile();

  const handlePeriodoChange = (periodo: PeriodoFeira) => {
    onChange({ ...filtros, periodo });
  };

  const handleBuscaChange = (busca: string) => {
    onChange({ ...filtros, busca });
  };

  const setClasse = (classe: FiltrosFeiraPro['classe']) => {
    onChange({ ...filtros, classe });
  };

  const setEstoque = (estoque: FiltrosFeiraPro['estoque']) => {
    onChange({ ...filtros, estoque });
  };

  const limparFiltros = () => {
    onChange({
      periodo: filtros.periodo,
      busca: '',
      classe: 'todas',
      estoque: 'todos',
      verComparativo: true
    });
  };

  const temFiltrosAtivos = filtros.busca !== '' || filtros.classe !== 'todas' || filtros.estoque !== 'todos';

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile: período em linha própria compacta; Desktop: lado a lado */}
      {isMobile ? (
        <FiltroPeriodo
          periodo={filtros.periodo}
          onChange={handlePeriodoChange}
          compact
        />
      ) : (
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 group">
            <Search className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors",
              filtros.busca ? "text-primary" : "text-muted-foreground"
            )} />
            <Input
              placeholder="Buscar..."
              value={filtros.busca}
              onChange={(e) => handleBuscaChange(e.target.value)}
              className="pl-9 pr-8 bg-white dark:bg-slate-900 border-none shadow-none h-10 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/20 text-sm"
            />
            {filtros.busca && (
              <button
                onClick={() => handleBuscaChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <FiltroPeriodo
            periodo={filtros.periodo}
            onChange={handlePeriodoChange}
          />
        </div>
      )}

      {/* Segmentação Horizontal - Scroll Suave */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setClasse('todas')}
          className={cn(
            "h-8 rounded-full px-4 text-[10px] font-bold uppercase border transition-all shrink-0",
            filtros.classe === 'todas' 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-white dark:bg-slate-900 border-border/50 text-muted-foreground"
          )}
        >
          Todos
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setClasse('curvaA')}
          className={cn(
            "h-8 rounded-full px-4 text-[10px] font-bold uppercase border transition-all shrink-0 gap-1.5",
            filtros.classe === 'curvaA' 
              ? "bg-emerald-500 text-white border-emerald-500" 
              : "bg-white dark:bg-slate-900 border-border/50 text-muted-foreground"
          )}
        >
          <Zap size={10} className={filtros.classe === 'curvaA' ? "fill-white" : ""} />
          Curva A
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setClasse('curvaB')}
          className={cn(
            "h-8 rounded-full px-4 text-[10px] font-bold uppercase border transition-all shrink-0 gap-1.5",
            filtros.classe === 'curvaB' 
              ? "bg-amber-500 text-white border-amber-500" 
              : "bg-white dark:bg-slate-900 border-border/50 text-muted-foreground"
          )}
        >
          <TrendingUp size={10} />
          Curva B
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setClasse('curvaC')}
          className={cn(
            "h-8 rounded-full px-4 text-[10px] font-bold uppercase border transition-all shrink-0 gap-1.5",
            filtros.classe === 'curvaC' 
              ? "bg-slate-600 text-white border-slate-600" 
              : "bg-white dark:bg-slate-900 border-border/50 text-muted-foreground"
          )}
        >
          Curva C
        </Button>

        {/* Separador vertical */}
        <div className="w-[1px] h-4 bg-border/50 shrink-0" />

        {/* Dropdown de Estoque Minimalista */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={cn(
              "h-8 rounded-full px-4 text-[10px] font-bold uppercase border transition-all shrink-0 gap-1.5",
              filtros.estoque !== 'todos' ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-slate-900 border-border/50 text-muted-foreground"
            )}>
              <Package size={10} />
              Estoque
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuItem onClick={() => setEstoque('todos')}>Todos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEstoque('disponivel')}>Disponível</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEstoque('baixo')}>Baixo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEstoque('zerado')} className="text-destructive">Zerado</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {temFiltrosAtivos && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={limparFiltros}
            className="h-8 rounded-full px-3 text-[10px] font-bold text-destructive shrink-0"
          >
            Limpar
          </Button>
        )}

        {totalModelos !== undefined && (
          <div className="ml-auto shrink-0">
            <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest bg-primary/5 px-2 py-1 rounded-full">
              {totalModelos} Mod
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
