import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PeriodoFeira, PeriodoTipo, calcularPeriodo } from '@/hooks/useFeiraHistorico';

const STORAGE_KEY = 'feira-periodo-filtro';

interface FiltroPeriodoProps {
  periodo: PeriodoFeira;
  onChange: (periodo: PeriodoFeira) => void;
}

const opcoes: { value: PeriodoTipo; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function FiltroPeriodo({ periodo, onChange }: FiltroPeriodoProps) {
  const [customInicio, setCustomInicio] = useState<Date | undefined>(periodo.inicio);
  const [customFim, setCustomFim] = useState<Date | undefined>(periodo.fim);
  const [showCustomPicker, setShowCustomPicker] = useState(periodo.tipo === 'custom');

  useEffect(() => {
    if (periodo.tipo === 'custom') {
      setCustomInicio(periodo.inicio);
      setCustomFim(periodo.fim);
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
    }
  }, [periodo.tipo]);

  const handleTipoChange = (tipo: PeriodoTipo) => {
    if (tipo === 'custom') {
      setShowCustomPicker(true);
      // Manter datas customizadas se existirem, senão usar hoje
      const datas = calcularPeriodo('hoje');
      setCustomInicio(customInicio || datas.inicio);
      setCustomFim(customFim || datas.fim);
    } else {
      setShowCustomPicker(false);
      const datas = calcularPeriodo(tipo);
      onChange({ tipo, ...datas });
    }
  };

  const handleAplicarCustom = () => {
    if (customInicio && customFim) {
      const datas = calcularPeriodo('custom', customInicio, customFim);
      onChange({ tipo: 'custom', ...datas });
    }
  };

  const formatarPeriodoExibicao = () => {
    if (periodo.tipo === 'hoje') {
      return format(periodo.inicio, 'dd/MM/yyyy');
    }
    if (periodo.tipo === 'ontem') {
      return format(periodo.inicio, 'dd/MM/yyyy');
    }
    return `${format(periodo.inicio, 'dd/MM')} a ${format(periodo.fim, 'dd/MM/yyyy')}`;
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-card rounded-lg border overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-muted-foreground">Período:</span>
        </div>

        <Select value={periodo.tipo} onValueChange={(v) => handleTipoChange(v as PeriodoTipo)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((opcao) => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCustomPicker && (
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('w-[120px] sm:w-[130px] justify-start text-left font-normal', !customInicio && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
                {customInicio ? format(customInicio, 'dd/MM/yy') : 'De'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customInicio}
                onSelect={setCustomInicio}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-sm">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('w-[120px] sm:w-[130px] justify-start text-left font-normal', !customFim && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
                {customFim ? format(customFim, 'dd/MM/yy') : 'Até'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFim}
                onSelect={setCustomFim}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button size="sm" onClick={handleAplicarCustom} disabled={!customInicio || !customFim}>
            <Check className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Aplicar</span>
          </Button>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Exibindo: <span className="font-medium text-foreground">{formatarPeriodoExibicao()}</span>
      </div>
    </div>
  );
}

// Funções auxiliares para persistência
export function salvarFiltroPeriodo(periodo: PeriodoFeira): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tipo: periodo.tipo,
      inicio: periodo.inicio.toISOString(),
      fim: periodo.fim.toISOString(),
    })
  );
}

export function carregarFiltroPeriodo(): PeriodoFeira {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Recalcular datas relativas (hoje, ontem, etc)
      if (parsed.tipo === 'custom') {
        return {
          tipo: 'custom',
          inicio: new Date(parsed.inicio),
          fim: new Date(parsed.fim),
        };
      }
      return { tipo: parsed.tipo, ...calcularPeriodo(parsed.tipo) };
    }
  } catch (e) {
    console.error('Erro ao carregar filtro de período:', e);
  }
  return { tipo: 'hoje', ...calcularPeriodo('hoje') };
}
