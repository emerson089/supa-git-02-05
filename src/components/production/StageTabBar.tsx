import { STAGES } from '@/data/production-data';
import { Scissors, Shirt, Droplets, Tag, CheckCircle2, Layers, Zap, Sparkles, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const iconMap: Record<string, React.ElementType> = {
  Scissors,
  Shirt,
  Droplets,
  Tag,
  CheckCircle2,
  Layers,
  Zap,
  Sparkles,
  ClipboardCheck,
};

interface StageTabBarProps {
  activeStage: string;
  onStageChange: (stageId: string) => void;
  stageCounts: Record<string, number>;
}

export function StageTabBar({ activeStage, onStageChange, stageCounts }: StageTabBarProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 p-2 pb-3">
        {STAGES.map((stage) => {
          const Icon = iconMap[stage.icon];
          const count = stageCounts[stage.id] || 0;
          const isActive = activeStage === stage.id;
          const isBottleneck = count > 5;

          return (
            <button
              key={stage.id}
              onClick={() => onStageChange(stage.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap min-w-fit",
                "border text-sm font-medium",
                isActive
                  ? `${stage.bgColor} ${stage.color} border-current shadow-sm`
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="hidden xs:inline">{stage.label.split(' / ')[0]}</span>
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold",
                  isActive
                    ? "bg-background/80 text-foreground"
                    : isBottleneck
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" className="h-2" />
    </ScrollArea>
  );
}
