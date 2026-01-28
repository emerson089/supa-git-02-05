import { Search, LayoutGrid, List, Plus, RefreshCw, Download, Upload, DollarSign, FileText, Image, ChevronDown, Filter, X } from 'lucide-react';
import { ViewMode } from '@/types/production';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FiltrosProducao } from '@/hooks/useProducaoPorEtapa';
interface ProductionHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewLot: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onExportPDF?: () => void;
  onImport?: () => void;
  onExportCustos?: () => void;
  onImportCustos?: () => void;
  loading?: boolean;
  totalLots?: number;
  // Novos filtros
  filtros?: FiltrosProducao;
  onFiltrosChange?: (filtros: FiltrosProducao) => void;
  responsaveisDisponiveis?: string[];
}
export function ProductionHeader({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onNewLot,
  onRefresh,
  onExport,
  onExportPDF,
  onImport,
  onExportCustos,
  onImportCustos,
  loading,
  totalLots = 0,
  filtros,
  onFiltrosChange,
  responsaveisDisponiveis = []
}: ProductionHeaderProps) {
  const hasActiveFilters = filtros && (filtros.prioridade && filtros.prioridade !== 'todos' || filtros.responsavel);
  const clearFilters = () => {
    onFiltrosChange?.({
      prioridade: 'todos',
      responsavel: undefined
    });
  };
  return <header className="p-6 pb-4 flex flex-col gap-4">
      {/* First Row: Title + Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CONTROLE DE PRODUCAO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Carregando dados...' : `${totalLots} lotes encontrados`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Refresh Button */}
          {onRefresh && <button onClick={onRefresh} disabled={loading} className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50" title="Atualizar">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>}

          {/* Export Dropdown */}
          {(onExport || onExportPDF) && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1" title="Exportar CSV">
                  <Download size={18} />
                  <ChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onExport && <DropdownMenuItem onClick={onExport} className="gap-2 cursor-pointer">
                    <FileText size={16} />
                    Exportar CSV (texto)
                  </DropdownMenuItem>}
                {onExportPDF && <DropdownMenuItem onClick={onExportPDF} className="gap-2 cursor-pointer">
                    <Image size={16} />
                    Exportar PDF (com imagens)
                  </DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>}

          {/* Import Button */}
          {onImport && <button onClick={onImport} className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors" title="Importar CSV">
              <Upload size={18} />
            </button>}

          {/* Separator */}
          {(onExportCustos || onImportCustos) && <div className="h-6 w-px bg-border mx-1" />}

          {/* Export Custos Button */}
          {onExportCustos && <button onClick={onExportCustos} className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1" title="Exportar Custos CSV">
              <DollarSign size={14} />
              <Download size={14} />
            </button>}

          {/* Import Custos Button */}
          {onImportCustos && <button onClick={onImportCustos} className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1" title="Importar Custos CSV">
              <DollarSign size={14} />
              <Upload size={14} />
            </button>}

          {/* View Toggle */}
          <div className="flex p-1 rounded-xl neu-button">
            <button onClick={() => onViewModeChange('kanban')} className={`p-2.5 rounded-lg transition-all duration-200 ${viewMode === 'kanban' ? 'text-primary bg-muted/50 shadow-inner' : 'text-muted-foreground hover:text-foreground'}`} title="Visualização Kanban">
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => onViewModeChange('list')} className={`p-2.5 rounded-lg transition-all duration-200 ${viewMode === 'list' ? 'text-primary bg-muted/50 shadow-inner' : 'text-muted-foreground hover:text-foreground'}`} title="Visualização Lista">
              <List size={18} />
            </button>
          </div>

          {/* New Lot Button */}
          <button onClick={onNewLot} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 text-sm font-medium transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]">
            <Plus size={16} />
            <span className="hidden sm:inline">Novo Lote</span>
          </button>
        </div>
      </div>

      {/* Second Row: Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search Input */}
        <div className="relative group flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
          <input type="text" placeholder="Buscar modelo, lote ou responsável..." value={search} onChange={e => onSearchChange(e.target.value)} className="neu-input pl-10 pr-4 py-2.5 text-sm w-full" />
        </div>

        {/* Filter Icon */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter size={16} />
        </div>

        {/* Priority Filter */}
        {onFiltrosChange && <Select value={filtros?.prioridade || 'todos'} onValueChange={value => onFiltrosChange({
        ...filtros,
        prioridade: value as FiltrosProducao['prioridade']
      })}>
            <SelectTrigger className="w-[140px] h-10 neu-input border-0">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="urgente">🔴 Urgente</SelectItem>
              <SelectItem value="atencao">🟡 Atenção</SelectItem>
              <SelectItem value="normal">🔵 Normal</SelectItem>
            </SelectContent>
          </Select>}

        {/* Responsible Filter */}
        {onFiltrosChange && responsaveisDisponiveis.length > 0 && <Select value={filtros?.responsavel || 'todos'} onValueChange={value => onFiltrosChange({
        ...filtros,
        responsavel: value === 'todos' ? undefined : value
      })}>
            <SelectTrigger className="w-[150px] h-10 neu-input border-0">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {responsaveisDisponiveis.map(resp => <SelectItem key={resp} value={resp}>{resp}</SelectItem>)}
            </SelectContent>
          </Select>}

        {/* Clear Filters Button */}
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 px-3 text-muted-foreground hover:text-foreground">
            <X size={14} className="mr-1" />
            Limpar
          </Button>}
      </div>
    </header>;
}