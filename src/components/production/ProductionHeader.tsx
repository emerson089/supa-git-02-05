import { Search, LayoutGrid, List, Plus, RefreshCw, Download, Upload, DollarSign } from 'lucide-react';
import { ViewMode } from '@/types/production';

interface ProductionHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewLot: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onExportCustos?: () => void;
  onImportCustos?: () => void;
  loading?: boolean;
  totalLots?: number;
}

export function ProductionHeader({ 
  search, 
  onSearchChange, 
  viewMode, 
  onViewModeChange,
  onNewLot,
  onRefresh,
  onExport,
  onImport,
  onExportCustos,
  onImportCustos,
  loading,
  totalLots = 0
}: ProductionHeaderProps) {
  return (
    <header className="p-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Controle de Produção
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? 'Carregando dados...' : `${totalLots} lotes encontrados`}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Export Button */}
        {onExport && (
          <button
            onClick={onExport}
            className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors"
            title="Exportar CSV"
          >
            <Download size={18} />
          </button>
        )}

        {/* Import Button */}
        {onImport && (
          <button
            onClick={onImport}
            className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors"
            title="Importar CSV"
          >
            <Upload size={18} />
          </button>
        )}

        {/* Separator */}
        {(onExportCustos || onImportCustos) && (
          <div className="h-6 w-px bg-border mx-1" />
        )}

        {/* Export Custos Button */}
        {onExportCustos && (
          <button
            onClick={onExportCustos}
            className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            title="Exportar Custos CSV"
          >
            <DollarSign size={14} />
            <Download size={14} />
          </button>
        )}

        {/* Import Custos Button */}
        {onImportCustos && (
          <button
            onClick={onImportCustos}
            className="p-2.5 rounded-xl neu-button text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            title="Importar Custos CSV"
          >
            <DollarSign size={14} />
            <Upload size={14} />
          </button>
        )}

        {/* Search Input */}
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Buscar modelo..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="neu-input pl-10 pr-4 py-2.5 text-sm w-48 lg:w-56"
          />
        </div>

        {/* View Toggle */}
        <div className="flex p-1 rounded-xl neu-button">
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              viewMode === 'kanban'
                ? 'text-primary bg-muted/50 shadow-inner'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Visualização Kanban"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              viewMode === 'list'
                ? 'text-primary bg-muted/50 shadow-inner'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Visualização Lista"
          >
            <List size={18} />
          </button>
        </div>

        {/* New Lot Button */}
        <button 
          onClick={onNewLot}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 text-sm font-medium transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Novo Lote</span>
        </button>
      </div>
    </header>
  );
}
