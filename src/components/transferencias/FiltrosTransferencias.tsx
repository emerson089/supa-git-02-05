import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X, Filter } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

export type MotivoTransferencia = 'feira' | 'reposicao' | 'ajuste' | 'devolucao';
export type StatusTransferencia = 'em_andamento' | 'concluida' | 'cancelada';

export interface FiltrosTransferenciasState {
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  origemId: string;
  destinoId: string;
  status: StatusTransferencia | '';
  motivo: MotivoTransferencia | '';
}

interface Local {
  id: string;
  nome: string;
  tipo: string;
}

interface FiltrosTransferenciasProps {
  filtros: FiltrosTransferenciasState;
  onFiltrosChange: (filtros: FiltrosTransferenciasState) => void;
  locais: Local[];
}

const PERIODOS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Últimos 7 dias', value: '7dias' },
  { label: 'Últimos 30 dias', value: '30dias' },
  { label: 'Personalizado', value: 'custom' },
] as const;

const MOTIVOS_LABELS: Record<MotivoTransferencia, string> = {
  feira: 'Feira',
  reposicao: 'Reposição',
  ajuste: 'Ajuste',
  devolucao: 'Devolução',
};

const STATUS_LABELS: Record<StatusTransferencia, string> = {
  em_andamento: 'Pendente',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export function FiltrosTransferencias({ filtros, onFiltrosChange, locais }: FiltrosTransferenciasProps) {
  const isMobile = useIsMobile();
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const handlePeriodoChange = (periodo: string) => {
    setPeriodoSelecionado(periodo);
    const hoje = new Date();
    
    let novaDataInicio: Date | undefined;
    let novaDataFim: Date | undefined;
    
    switch (periodo) {
      case 'hoje':
        novaDataInicio = startOfDay(hoje);
        novaDataFim = endOfDay(hoje);
        break;
      case '7dias':
        novaDataInicio = startOfDay(subDays(hoje, 7));
        novaDataFim = endOfDay(hoje);
        break;
      case '30dias':
        novaDataInicio = startOfDay(subDays(hoje, 30));
        novaDataFim = endOfDay(hoje);
        break;
      case 'custom':
        // Manter datas atuais para seleção manual
        return;
      default:
        novaDataInicio = undefined;
        novaDataFim = undefined;
    }
    
    onFiltrosChange({
      ...filtros,
      dataInicio: novaDataInicio,
      dataFim: novaDataFim,
    });
  };

  const handleLimpar = () => {
    setPeriodoSelecionado('');
    onFiltrosChange({
      dataInicio: undefined,
      dataFim: undefined,
      origemId: '',
      destinoId: '',
      status: '',
      motivo: '',
    });
  };

  const temFiltrosAtivos = 
    filtros.dataInicio !== undefined ||
    filtros.dataFim !== undefined ||
    filtros.origemId !== '' ||
    filtros.destinoId !== '' ||
    filtros.status !== '' ||
    filtros.motivo !== '';

  const contadorFiltrosAtivos = [
    filtros.dataInicio,
    filtros.origemId,
    filtros.destinoId,
    filtros.status,
    filtros.motivo,
  ].filter(Boolean).length;

  const renderFiltros = () => (
    <div className="space-y-4">
      {/* Período */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Período</Label>
        <Select value={periodoSelecionado} onValueChange={handlePeriodoChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {periodoSelecionado === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filtros.dataInicio 
                    ? format(filtros.dataInicio, 'dd/MM/yy', { locale: ptBR }) 
                    : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filtros.dataInicio}
                  onSelect={(date) => onFiltrosChange({ ...filtros, dataInicio: date ? startOfDay(date) : undefined })}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filtros.dataFim 
                    ? format(filtros.dataFim, 'dd/MM/yy', { locale: ptBR }) 
                    : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filtros.dataFim}
                  onSelect={(date) => onFiltrosChange({ ...filtros, dataFim: date ? endOfDay(date) : undefined })}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Origem / Destino */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Origem</Label>
          <Select 
            value={filtros.origemId} 
            onValueChange={(v) => onFiltrosChange({ ...filtros, origemId: v === 'all' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {locais.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Destino</Label>
          <Select 
            value={filtros.destinoId} 
            onValueChange={(v) => onFiltrosChange({ ...filtros, destinoId: v === 'all' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {locais.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status / Motivo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <Select 
            value={filtros.status} 
            onValueChange={(v) => onFiltrosChange({ ...filtros, status: v === 'all' ? '' : v as StatusTransferencia })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Motivo</Label>
          <Select 
            value={filtros.motivo} 
            onValueChange={(v) => onFiltrosChange({ ...filtros, motivo: v === 'all' ? '' : v as MotivoTransferencia })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(MOTIVOS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botão Limpar */}
      {temFiltrosAtivos && (
        <Button variant="ghost" size="sm" onClick={handleLimpar} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {contadorFiltrosAtivos > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {contadorFiltrosAtivos}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>Filtrar Transferências</SheetTitle>
          </SheetHeader>
          {renderFiltros()}
          <div className="mt-4">
            <Button className="w-full" onClick={() => setSheetOpen(false)}>
              Aplicar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-3")}>
      {renderFiltros()}
    </div>
  );
}
