import { useQuery } from "@tanstack/react-query";

export interface Holiday {
  date: string;
  title: string;
  type: "national" | "observance";
}

async function fetchHolidays(years: number[]): Promise<Holiday[]> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brazilian-holidays?year=${years.join(",")}&include_observances=true`;
  const response = await fetch(url, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch holidays");
  }

  return response.json();
}

export function useHolidays(years: number[]) {
  const sortedYears = [...new Set(years)].sort();

  const query = useQuery({
    queryKey: ["brazilian-holidays", sortedYears],
    queryFn: () => fetchHolidays(sortedYears),
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    enabled: sortedYears.length > 0,
  });

  // Build a Map indexed by ISO date for quick lookup
  const holidayMap = new Map<string, Holiday[]>();
  if (query.data) {
    for (const h of query.data) {
      const existing = holidayMap.get(h.date);
      if (existing) {
        existing.push(h);
      } else {
        holidayMap.set(h.date, [h]);
      }
    }
  }

  return {
    holidays: query.data ?? [],
    holidayMap,
    isLoading: query.isLoading,
  };
}
