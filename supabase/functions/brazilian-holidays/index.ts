const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Holiday {
  date: string;
  title: string;
  type: 'national' | 'observance';
}

/** Gauss algorithm for Easter date */
function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getHolidays(year: number, includeObservances: boolean): Holiday[] {
  const holidays: Holiday[] = [
    { date: `${year}-01-01`, title: 'Confraternização Universal', type: 'national' },
    { date: `${year}-04-21`, title: 'Tiradentes', type: 'national' },
    { date: `${year}-05-01`, title: 'Dia do Trabalho', type: 'national' },
    { date: `${year}-09-07`, title: 'Independência do Brasil', type: 'national' },
    { date: `${year}-10-12`, title: 'Nossa Senhora Aparecida', type: 'national' },
    { date: `${year}-11-02`, title: 'Finados', type: 'national' },
    { date: `${year}-11-15`, title: 'Proclamação da República', type: 'national' },
    { date: `${year}-12-25`, title: 'Natal', type: 'national' },
  ];

  const easter = computeEaster(year);

  // Sexta-feira Santa (Easter - 2)
  holidays.push({
    date: formatDate(addDays(easter, -2)),
    title: 'Sexta-feira Santa',
    type: 'national',
  });

  // Corpus Christi (Easter + 60)
  holidays.push({
    date: formatDate(addDays(easter, 60)),
    title: 'Corpus Christi',
    type: 'national',
  });

  if (includeObservances) {
    // Carnaval - Monday (Easter - 48) and Tuesday (Easter - 47)
    holidays.push({
      date: formatDate(addDays(easter, -48)),
      title: 'Carnaval (Segunda)',
      type: 'observance',
    });
    holidays.push({
      date: formatDate(addDays(easter, -47)),
      title: 'Carnaval (Terça)',
      type: 'observance',
    });
    // Quarta-feira de Cinzas
    holidays.push({
      date: formatDate(addDays(easter, -46)),
      title: 'Quarta-feira de Cinzas',
      type: 'observance',
    });
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year');
    const includeObservances = url.searchParams.get('include_observances') !== 'false';

    const years: number[] = [];
    if (yearParam) {
      // Support comma-separated years: ?year=2025,2026
      for (const y of yearParam.split(',')) {
        const parsed = parseInt(y.trim(), 10);
        if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2100) {
          years.push(parsed);
        }
      }
    }

    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    const allHolidays: Holiday[] = [];
    for (const y of years) {
      allHolidays.push(...getHolidays(y, includeObservances));
    }

    return new Response(JSON.stringify(allHolidays), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=604800', // 7 days
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
