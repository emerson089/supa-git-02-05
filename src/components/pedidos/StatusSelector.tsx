import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface StatusOption {
  value: string;
  label: string;
  color: 'green' | 'yellow' | 'red' | 'purple' | 'blue' | 'black';
}

interface StatusSelectorProps {
  label: string;
  options: StatusOption[];
  value: string;
  onChange: (value: string) => void;
}

const colorClasses = {
  green: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  yellow: 'bg-amber-100 text-amber-700 border-amber-300',
  red: 'bg-red-100 text-red-700 border-red-300',
  purple: 'bg-purple-100 text-purple-700 border-purple-300',
  blue: 'bg-blue-100 text-blue-700 border-blue-300',
  black: 'bg-zinc-900 text-white border-zinc-900',
};

export function StatusSelector({ label, options, value, onChange }: StatusSelectorProps) {
  const selectedOption = options.find(opt => opt.value === value);
  const selectedColor = selectedOption?.color || 'yellow';

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger 
          className={cn(
            "h-11 rounded-xl neu-input border bg-background w-full font-medium",
            colorClasses[selectedColor]
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border shadow-lg z-50">
          {options.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className={cn(
                "font-medium rounded-lg my-0.5",
                colorClasses[option.color]
              )}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Predefined status options with colors
export const statusPagamentoOptions: StatusOption[] = [
  { value: 'PENDENTE', label: 'PENDENTE', color: 'yellow' },
  { value: 'PAGO', label: 'PAGO', color: 'green' },
  { value: 'CANCELADO', label: 'CANCELADO', color: 'red' },
  { value: 'INCOMPLETO', label: 'INCOMPLETO', color: 'purple' },
  { value: 'PEND. ENTREGA', label: 'PEND. ENTREGA', color: 'blue' },
  { value: 'GOLPE CANCELADO', label: 'GOLPE CANCELADO', color: 'black' },
];

export const statusPedidoOptions: StatusOption[] = [
  { value: 'INCOMPLETO', label: 'INCOMPLETO', color: 'purple' },
  { value: 'SEPARADO', label: 'SEPARADO', color: 'green' },
  { value: 'CANCELADO', label: 'CANCELADO', color: 'red' },
  { value: 'GOLPE CANCELADO', label: 'GOLPE CANCELADO', color: 'black' },
  { value: 'AMANHÃ', label: 'AMANHÃ', color: 'blue' },
  { value: 'NÃO SEPARADO', label: 'NÃO SEPARADO', color: 'yellow' },
];

export const statusEntregaOptions: StatusOption[] = [
  { value: 'NÃO ENTREGUE', label: 'NÃO ENTREGUE', color: 'yellow' },
  { value: 'NO CARRO', label: 'NO CARRO', color: 'purple' },
  { value: 'ENTREGUE', label: 'ENTREGUE', color: 'green' },
  { value: 'RETIRADA', label: 'RETIRADA', color: 'blue' },
  { value: 'PRÓX. SEMANA', label: 'PRÓX. SEMANA', color: 'blue' },
  { value: 'ENTREGOU ERRADO', label: 'ENTREGOU ERRADO', color: 'red' },
  { value: 'CANCELADO', label: 'CANCELADO', color: 'red' },
];

// Helper to get label from value
export const getStatusLabel = (value: string, options: StatusOption[]) => {
  return options.find(opt => opt.value === value)?.label || value;
};

// Helper to get color from value
export const getStatusColor = (value: string, options: StatusOption[]) => {
  return options.find(opt => opt.value === value)?.color || 'yellow';
};
