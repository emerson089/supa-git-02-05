import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KpiCardSkeleton() {
  return (
    <div className="neu-card p-4 sm:p-5">
      <div className="space-y-3">
        <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl" />
        <Skeleton className="h-7 sm:h-8 w-20 sm:w-24" />
        <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end justify-between gap-2 h-[180px] sm:h-[200px] px-4">
        {[40, 65, 45, 80, 55, 70, 50, 75, 60, 85, 55, 70].map((height, i) => (
          <Skeleton 
            key={i} 
            className="flex-1 rounded-t-md"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 px-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

export function DonutChartSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="w-[120px] h-[120px] sm:w-[130px] sm:h-[130px] rounded-full" />
      <div className="w-full space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg">
      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-14" />
    </div>
  );
}

export function TopModelosSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ProducaoKanbanSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 sm:h-20 rounded-lg" />
      ))}
    </div>
  );
}
