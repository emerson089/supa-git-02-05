import { SlidersHorizontal, X, Package, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  statusPagamentoOptions,
  statusPedidoOptions,
  statusEntregaOptions,
} from './StatusSelector';
import { cn } from '@/lib/utils';

interface MobileFiltersSheetProps {
  filterStatusPagamento: string[];
  filterStatusPedido: string[];
  filterStatusEntrega: string[];
  filterModelo: string;
  startDate?: Date;
  endDate?: Date;
  onFilterStatusPagamentoChange: (value: string[]) => void;
  onFilterStatusPedidoChange: (value: string[]) => void;
  onFilterStatusEntregaChange: (value: string[]) => void;
  onFilterModeloChange: (value: string) => void;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onClearAll: () => void;
  activeCount: number;
}

interface StatusOption {
  value: string;
  label: string;
}

function MobileMultiSelect({
  label,
  options,
  selected,
  onSelectionChange,
}: {
  label: string;
  options: StatusOption[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
}) {
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter(v => v !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(options.map(o => o.value));
    }
  };

  const allSelected = selected.length === options.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {selected.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selected.length} selecionado{selected.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
      <div 
        className="border rounded-xl bg-background p-2 max-h-[180px] overflow-y-auto overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Select All */}
        <div 
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/50 border-b border-border/50 mb-1 pb-2"
          onClick={handleSelectAll}
        >
          <Checkbox checked={allSelected} />
          <span className="text-sm font-medium">
            {allSelected ? 'Desselecionar todos' : 'Selecionar todos'}
          </span>
        </div>
        
        {/* Options */}
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <div
              key={option.value}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                isSelected && "bg-primary/5"
              )}
              onClick={() => handleToggle(option.value)}
            >
              <Checkbox checked={isSelected} />
              <span className="text-sm">{option.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MobileFiltersSheet({
  filterStatusPagamento,
  filterStatusPedido,
  filterStatusEntrega,
  filterModelo,
  startDate,
  endDate,
  onFilterStatusPagamentoChange,
  onFilterStatusPedidoChange,
  onFilterStatusEntregaChange,
  onFilterModeloChange,
  onStartDateChange,
  onEndDateChange,
  onClearAll,
  activeCount,
}: MobileFiltersSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full h-11 gap-2 rounded-xl neu-button border-0 bg-background">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle>Filtros</SheetTitle>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
              >
                <X className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100%-4rem)] pr-4">
          <div className="space-y-6 py-6">
            {/* Status Pagamento - Multi-Select */}
            <MobileMultiSelect
              label="Status Pagamento"
              options={statusPagamentoOptions}
              selected={filterStatusPagamento}
              onSelectionChange={onFilterStatusPagamentoChange}
            />

            {/* Status Pedido - Multi-Select */}
            <MobileMultiSelect
              label="Status do Pedido"
              options={statusPedidoOptions}
              selected={filterStatusPedido}
              onSelectionChange={onFilterStatusPedidoChange}
            />

            {/* Status Entrega - Multi-Select */}
            <MobileMultiSelect
              label="Status Entrega"
              options={statusEntregaOptions}
              selected={filterStatusEntrega}
              onSelectionChange={onFilterStatusEntregaChange}
            />

            {/* Filtro por Modelo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtrar por Modelo</Label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do modelo..."
                  value={filterModelo}
                  onChange={(e) => onFilterModeloChange(e.target.value)}
                  className="pl-10 h-11 rounded-xl neu-input border-0 bg-background"
                />
              </div>
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Período</Label>
              <div className="grid grid-cols-2 gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl neu-button border-0 bg-background gap-2 justify-start"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={onStartDateChange}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl neu-button border-0 bg-background gap-2 justify-start"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yy") : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="end">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={onEndDateChange}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
