import * as React from "react";
import { DayPicker } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Holiday } from "@/hooks/useHolidays";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

type HolidayCalendarProps = CalendarProps & {
  holidayMap: Map<string, Holiday[]>;
};

function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function HolidayCalendar({ holidayMap, ...props }: HolidayCalendarProps) {
  const nationalDays: Date[] = [];
  const observanceDays: Date[] = [];

  holidayMap.forEach((holidays, dateStr) => {
    const hasNational = holidays.some((h) => h.type === "national");
    const d = new Date(dateStr + "T12:00:00");
    if (hasNational) {
      nationalDays.push(d);
    } else {
      observanceDays.push(d);
    }
  });

  const modifiers = {
    holiday_national: nationalDays,
    holiday_observance: observanceDays,
  };

  const modifiersStyles = {
    holiday_national: {} as React.CSSProperties,
    holiday_observance: {} as React.CSSProperties,
  };

  const DayWithHoliday = (dayProps: { date: Date; displayMonth: Date }) => {
    const key = formatDateKey(dayProps.date);
    const holidays = holidayMap.get(key);

    if (!holidays || holidays.length === 0) {
      return (
        <div className="relative flex flex-col items-center">
          <span>{dayProps.date.getDate()}</span>
        </div>
      );
    }

    const hasNational = holidays.some((h) => h.type === "national");
    const dotColor = hasNational ? "bg-destructive" : "bg-amber-400";
    const tooltipText = holidays.map((h) => h.title).join(", ");

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative flex flex-col items-center">
              <span>{dayProps.date.getDate()}</span>
              <span
                className={`absolute -bottom-0.5 h-1 w-1 rounded-full ${dotColor}`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Calendar
      {...props}
      modifiers={modifiers}
      modifiersStyles={modifiersStyles}
      components={{
        DayContent: DayWithHoliday,
      }}
    />
  );
}
