import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface StatusOption {
  value: string;
  label: string;
}

interface StatusMultiSelectProps {
  label: string;
  options: StatusOption[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function StatusMultiSelect({
  label,
  options,
  selected,
  onSelectionChange,
  placeholder,
  className
}: StatusMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter(v => v !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      // Deselect all
      onSelectionChange([]);
    } else {
      // Select all
      onSelectionChange(options.map(o => o.value));
    }
  };

  const getDisplayText = () => {
    if (selected.length === 0) {
      return placeholder || `Todos ${label}`;
    }
    if (selected.length === 1) {
      const option = options.find(o => o.value === selected[0]);
      return option?.label || selected[0];
    }
    if (selected.length === options.length) {
      return placeholder || `Todos ${label}`;
    }
    return `${selected.length} selecionados`;
  };

  const allSelected = selected.length === options.length;
  const someSelected = selected.length > 0 && selected.length < options.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-11 w-[140px] justify-between rounded-xl neu-input border-0 bg-background font-normal",
            selected.length > 0 && selected.length < options.length && "ring-1 ring-primary/50",
            className
          )}
        >
          <span className="truncate text-left flex-1">{getDisplayText()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[200px] p-0" 
        align="start"
      >
        <div 
          className="max-h-[280px] overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Select All Option */}
          <div 
            className="flex items-center gap-2 px-3 py-2 border-b border-border/50 cursor-pointer hover:bg-muted/50"
            onClick={handleSelectAll}
          >
            <Checkbox 
              checked={allSelected}
              className={cn(someSelected && "data-[state=unchecked]:bg-primary/20")}
            />
            <span className="text-sm font-medium">
              {allSelected ? 'Desselecionar todos' : 'Selecionar todos'}
            </span>
          </div>

          {/* Options */}
          <div className="py-1">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
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
      </PopoverContent>
    </Popover>
  );
}
