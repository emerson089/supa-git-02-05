import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ExcursaoCSVRowSchema, sanitizeString, safeParseNumber } from '@/lib/csv-validation-schemas';

export interface ExcursaoParseResult {
  nome: string;
  taxa: number;
  occurrences: number;
}

/**
 * Normaliza o nome da excursão para comparação (lowercase, remove acentos e espaços extras)
 */
function normalizeForComparison(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Capitaliza a primeira letra de cada palavra
 */
function capitalizeWords(nome: string): string {
  return nome
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parser robusto de linha CSV que trata campos entre aspas
 */
function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  
  return result;
}

/**
 * Detecta o separador do CSV (vírgula ou ponto-e-vírgula)
 */
function detectSeparator(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Converte valor no formato "10,00" ou "R$ 10,00" para número
 */
function parseValorBRL(valor: string): number {
  if (!valor) return 0;
  
  // Remove "R$", espaços, aspas e converte vírgula para ponto
  const cleaned = valor
    .replace(/R\$\s*/gi, '')
    .replace(/"/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Remove separador de milhar
    .replace(',', '.'); // Converte decimal
  
  return safeParseNumber(cleaned);
}

/**
 * Parseia o CSV e agrupa excursões duplicadas
 */
export function parseExcursoesCSV(csvContent: string): {
  excursoes: ExcursaoParseResult[];
  errors: string[];
} {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const errors: string[] = [];
  
  if (lines.length < 2) {
    return { excursoes: [], errors: ['Arquivo vazio ou sem dados'] };
  }
  
  // Detecta separador automaticamente
  const separator = detectSeparator(lines[0]);
  
  // Detecta cabeçalho
  const headerCols = parseCSVLine(lines[0], separator);
  const header = headerCols.map(h => sanitizeString(h).toUpperCase());
  
  // Procura por colunas de excursão e valor
  const excursaoIdx = header.findIndex(h => h.includes('EXCURSAO') || h.includes('EXCURSÃO'));
  const valorIdx = header.findIndex(h => 
    (h.includes('VALOR') && (h.includes('EXCURSAO') || h.includes('EXCURSÃO'))) ||
    h.includes('TAXA') ||
    h === 'VALOR'
  );
  
  if (excursaoIdx === -1) {
    return { excursoes: [], errors: ['Coluna EXCURSAO não encontrada'] };
  }
  
  // Mapa para agrupar por nome normalizado
  const grouped = new Map<string, { 
    nomeOriginal: string; 
    taxas: number[]; 
    count: number;
  }>();
  
  // Processa linhas (pula cabeçalho)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], separator);
    const nomeRaw = sanitizeString(cols[excursaoIdx] || '');
    
    if (!nomeRaw) continue;
    
    const nomeNormalizado = normalizeForComparison(nomeRaw);
    const taxa = valorIdx !== -1 ? parseValorBRL(cols[valorIdx] || '') : 0;
    
    if (grouped.has(nomeNormalizado)) {
      const existing = grouped.get(nomeNormalizado)!;
      existing.taxas.push(taxa);
      existing.count++;
    } else {
      grouped.set(nomeNormalizado, {
        nomeOriginal: capitalizeWords(nomeRaw),
        taxas: [taxa],
        count: 1,
      });
    }
  }
  
  // Converte para array e calcula taxa mais comum
  const excursoes: ExcursaoParseResult[] = [];
  
  grouped.forEach((data) => {
    // Usa a taxa mais frequente (moda)
    const taxaCount = new Map<number, number>();
    data.taxas.forEach(t => taxaCount.set(t, (taxaCount.get(t) || 0) + 1));
    
    let taxaMaisComum = 0;
    let maxCount = 0;
    taxaCount.forEach((count, taxa) => {
      if (count > maxCount) {
        maxCount = count;
        taxaMaisComum = taxa;
      }
    });
    
    // Valida com Zod
    const validation = ExcursaoCSVRowSchema.safeParse({
      nome: data.nomeOriginal,
      taxa: taxaMaisComum,
    });
    
    if (validation.success) {
      excursoes.push({
        nome: validation.data.nome,
        taxa: validation.data.taxa,
        occurrences: data.count,
      });
    } else {
      errors.push(`"${data.nomeOriginal}": ${validation.error.errors.map(e => e.message).join(', ')}`);
    }
  });
  
  // Ordena por nome
  excursoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  
  return { excursoes, errors };
}

export function useExcursoesBatchImport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (excursoes: ExcursaoParseResult[]) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      // Busca excursões existentes para evitar duplicatas
      const { data: existentes } = await supabase
        .from('excursoes')
        .select('nome');
      
      const nomesExistentes = new Set(
        (existentes || []).map(e => normalizeForComparison(e.nome))
      );
      
      // Filtra apenas novas
      const novas = excursoes.filter(
        e => !nomesExistentes.has(normalizeForComparison(e.nome))
      );
      
      if (novas.length === 0) {
        return { inserted: 0, skipped: excursoes.length };
      }
      
      // Insere em lote
      const { error } = await supabase
        .from('excursoes')
        .insert(
          novas.map(e => ({
            nome: e.nome,
            taxa: e.taxa,
            user_id: user.id,
            ativo: true,
          }))
        );
      
      if (error) throw error;
      
      return { inserted: novas.length, skipped: excursoes.length - novas.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excursoes'] });
      queryClient.invalidateQueries({ queryKey: ['excursoes-ativas'] });
    },
  });
}
