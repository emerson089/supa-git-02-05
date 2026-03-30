import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StatusOption {
  value: string;
  label: string;
  color: 'green' | 'yellow' | 'red' | 'purple' | 'blue' | 'black';
}

interface InlineStatusSelectProps {
  options: StatusOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const colorClasses = {
  green: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200',
  yellow: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200',
  red: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
  black: 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800',
};

export function InlineStatusSelect({ options, value, onChange, className }: InlineStatusSelectProps) {
  // Find color by matching label (case insensitive) or value
  const getColorForValue = (val: string) => {
    const upperVal = val?.toUpperCase() || '';
    const option = options.find(opt => 
      opt.label.toUpperCase() === upperVal || 
      opt.value === val
    );
    return option?.color || 'yellow';
  };

  const selectedColor = getColorForValue(value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger 
        className={cn(
          "h-7 w-auto min-w-[100px] text-[10px] font-semibold rounded-lg border px-2 py-1",
          "shadow-[2px_2px_4px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.7)]",
          colorClasses[selectedColor],
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-card border-border shadow-lg z-[100] min-w-[140px]">
        {options.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={cn(
              "font-semibold rounded-lg my-0.5 text-[11px] cursor-pointer",
              colorClasses[option.color]
            )}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
