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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  statusPagamentoOptions,
  statusPedidoOptions,
  statusEntregaOptions,
} from './StatusSelector';

interface MobileFiltersSheetProps {
  filterStatusPagamento: string;
  filterStatusPedido: string;
  filterStatusEntrega: string;
  filterModelo: string;
  startDate?: Date;
  endDate?: Date;
  onFilterStatusPagamentoChange: (value: string) => void;
  onFilterStatusPedidoChange: (value: string) => void;
  onFilterStatusEntregaChange: (value: string) => void;
  onFilterModeloChange: (value: string) => void;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onClearAll: () => void;
  activeCount: number;
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
            {/* Status Pagamento */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status Pagamento</Label>
              <Select value={filterStatusPagamento} onValueChange={onFilterStatusPagamentoChange}>
                <SelectTrigger className="h-11 rounded-xl neu-input border-0 bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Pagamentos</SelectItem>
                  {statusPagamentoOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Pedido */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status do Pedido</Label>
              <Select value={filterStatusPedido} onValueChange={onFilterStatusPedidoChange}>
                <SelectTrigger className="h-11 rounded-xl neu-input border-0 bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Pedidos</SelectItem>
                  {statusPedidoOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Entrega */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status Entrega</Label>
              <Select value={filterStatusEntrega} onValueChange={onFilterStatusEntregaChange}>
                <SelectTrigger className="h-11 rounded-xl neu-input border-0 bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Entregas</SelectItem>
                  {statusEntregaOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
