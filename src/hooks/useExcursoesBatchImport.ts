import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ExcursaoParseResult {
  nome: string;
  contato: string;
  localizacao: string;
  origem: string;
  taxa: number;
  occurrences: number;
}

function normalizeForComparison(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === separator && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else { current += char; }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function detectSeparator(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseValorBRL(valor: string): number {
  if (!valor) return 0;
  const cleaned = valor
    .replace(/R\$\s*/gi, '')
    .replace(/"/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Parser que suporta dois formatos:
 * Formato antigo: Nome;Contato;Localização;Taxa
 * Formato novo (Moda Center): Nome,Origem,Destino,Telefone
 */
export function parseExcursoesCSV(csvContent: string): {
  excursoes: ExcursaoParseResult[];
  errors: string[];
} {
  const lines = csvContent.split('\n').filter(l => l.trim());
  const errors: string[] = [];

  if (lines.length < 2) return { excursoes: [], errors: ['Arquivo vazio ou sem dados'] };

  const separator = detectSeparator(lines[0]);
  const headerCols = parseCSVLine(lines[0], separator);
  const header = headerCols.map(h => h.trim().replace(/^"|"$/g, '').toUpperCase());

  const nomeIdx = header.findIndex(h => h === 'NOME' || h.includes('EXCURSAO') || h.includes('EXCURSÃO'));
  const contatoIdx = header.findIndex(h => h === 'TELEFONE' || h === 'CONTATO' || h === 'WHATSAPP');
  const destinoIdx = header.findIndex(h => h === 'DESTINO' || h.includes('LOCALIZA'));
  const origemIdx = header.findIndex(h => h === 'ORIGEM');
  const taxaIdx = header.findIndex(h => h === 'TAXA' || h === 'VALOR');

  if (nomeIdx === -1) return { excursoes: [], errors: ['Coluna NOME não encontrada no cabeçalho'] };

  const grouped = new Map<string, {
    nomeOriginal: string;
    contato: string;
    localizacao: string;
    origem: string;
    taxas: number[];
    count: number;
  }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], separator);
    const nomeRaw = (cols[nomeIdx] || '').trim();
    if (!nomeRaw) continue;

    const nomeNorm = normalizeForComparison(nomeRaw);
    const contato = contatoIdx !== -1 ? (cols[contatoIdx] || '').trim() : '';
    const localizacao = destinoIdx !== -1 ? (cols[destinoIdx] || '').trim() : '';
    const origem = origemIdx !== -1 ? (cols[origemIdx] || '').trim() : '';
    const taxa = taxaIdx !== -1 ? parseValorBRL(cols[taxaIdx] || '') : 0;

    if (grouped.has(nomeNorm)) {
      const ex = grouped.get(nomeNorm)!;
      ex.taxas.push(taxa);
      if (!ex.contato && contato) ex.contato = contato;
      if (!ex.localizacao && localizacao) ex.localizacao = localizacao;
      if (!ex.origem && origem) ex.origem = origem;
      ex.count++;
    } else {
      grouped.set(nomeNorm, { nomeOriginal: nomeRaw, contato, localizacao, origem, taxas: [taxa], count: 1 });
    }
  }

  const excursoes: ExcursaoParseResult[] = [];
  grouped.forEach((data) => {
    const taxaCount = new Map<number, number>();
    data.taxas.forEach(t => taxaCount.set(t, (taxaCount.get(t) || 0) + 1));
    let taxaMaisComum = 0; let maxCount = 0;
    taxaCount.forEach((count, taxa) => { if (count > maxCount) { maxCount = count; taxaMaisComum = taxa; } });

    if (data.nomeOriginal.trim()) {
      excursoes.push({
        nome: data.nomeOriginal,
        contato: data.contato,
        localizacao: data.localizacao,
        origem: data.origem,
        taxa: taxaMaisComum,
        occurrences: data.count,
      });
    } else {
      errors.push(`Linha ignorada: nome vazio`);
    }
  });

  excursoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { excursoes, errors };
}

export function useExcursoesBatchImport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (excursoes: ExcursaoParseResult[]) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: existentes } = await supabase
        .from('excursoes')
        .select('id, nome, taxa')
        .eq('user_id', user.id);

      const mapaExistentes = new Map(
        (existentes || []).map(e => [normalizeForComparison(e.nome), e])
      );

      const paraInserir: ExcursaoParseResult[] = [];
      const paraAtualizar: { id: string; nome: string; contato: string; localizacao: string; origem: string }[] = [];

      for (const exc of excursoes) {
        const norm = normalizeForComparison(exc.nome);
        const existente = mapaExistentes.get(norm);
        if (existente) {
          // Atualiza nome (casing do CSV), contato, localizacao, origem — mantém taxa
          paraAtualizar.push({
            id: existente.id,
            nome: exc.nome,
            contato: exc.contato,
            localizacao: exc.localizacao,
            origem: exc.origem,
          });
        } else {
          paraInserir.push(exc);
        }
      }

      if (paraInserir.length > 0) {
        const { error } = await supabase.from('excursoes').insert(
          paraInserir.map(e => ({
            nome: e.nome,
            contato: e.contato,
            localizacao: e.localizacao,
            origem: e.origem,
            taxa: e.taxa, // 0 para o novo CSV sem taxa
            user_id: user.id,
            ativo: true,
          }))
        );
        if (error) throw error;
      }

      for (const item of paraAtualizar) {
        const { error } = await supabase
          .from('excursoes')
          .update({ nome: item.nome, contato: item.contato, localizacao: item.localizacao, origem: item.origem })
          .eq('id', item.id);
        if (error) throw error;
      }

      return { inserted: paraInserir.length, updated: paraAtualizar.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excursoes'] });
      queryClient.invalidateQueries({ queryKey: ['excursoes-ativas'] });
    },
  });
}
