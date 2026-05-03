import * as React from "react";
import { cn } from "@/lib/utils";

interface ScrollableListProps {
  children: React.ReactNode;
  maxHeight?: number;
  className?: string;
}

export function ScrollableList({
  children,
  maxHeight = 280,
  className,
}: ScrollableListProps) {
  return (
    <div
      className={cn("overflow-y-auto overscroll-contain", className)}
      style={{ maxHeight }}
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
