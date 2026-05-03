import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay, subDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sincronizarEstoqueTotal } from './useTransferencias';
import { parseProductName } from '@/utils/productNameUtils';
export type PeriodoTipo = 'hoje' | 'ontem' | '7dias' | '30dias' | 'custom';

export interface PeriodoFeira {
  tipo: PeriodoTipo;
  inicio: Date;
  fim: Date;
}

export interface ResumoFeiraPeriodo {
  totalCarga: number;
  totalRetorno: number;
  totalVendido: number;
  valorVendido: number;
  quantidadeCargas: number;
  cargasAtivas: number;
  cargasConcluidas: number;
  taxaVenda: number; // % de peças vendidas (0-100)
  totalModelos: number; // Quantidade de modelos únicos no período
}

export interface TransferenciaItemComProduto {
  id: string;
  itemId: string;
  quantidadeEnviada: number;
  quantidadeRetornada: number | null;
  precoUnitario: number | null;
  produtoNome: string | null;
  produtoPreco: number | null;
  produtoImagem: string | null;
  modeloId: string | null;
}

export interface TransferenciaComItensHistorico {
  id: string;
  localOrigemId: string;
  localDestinoId: string;
  localOrigemNome: string | null;
  localDestinoNome: string | null;
  tipo: string;
  status: string;
  dataSaida: string;
  dataRetorno: string | null;
  observacoes: string | null;
  createdAt: string;
  itens: TransferenciaItemComProduto[];
}

export interface CargaDiaAgrupada {
  data: string;
  dataFormatada: string;
  diaSemana: string;
  totalCargas: number;
  totalEnviado: number;
  totalRetornado: number;
  totalVendido: number;
  valorVendido: number;
  cargas: TransferenciaComItensHistorico[];
}

// Helper: calcula datas baseado no tipo de período
export function calcularPeriodo(tipo: PeriodoTipo, customInicio?: Date, customFim?: Date): { inicio: Date; fim: Date } {
  const hoje = startOfDay(new Date());
  switch (tipo) {
    case 'hoje':
      return { inicio: hoje, fim: endOfDay(hoje) };
    case 'ontem':
      return { inicio: startOfDay(subDays(hoje, 1)), fim: endOfDay(subDays(hoje, 1)) };
    case '7dias':
      return { inicio: startOfDay(subDays(hoje, 6)), fim: endOfDay(hoje) };
    case '30dias':
      return { inicio: startOfDay(subDays(hoje, 29)), fim: endOfDay(hoje) };
    case 'custom':
      return {
        inicio: customInicio ? startOfDay(customInicio) : hoje,
        fim: customFim ? endOfDay(customFim) : endOfDay(hoje),
      };
    default:
      return { inicio: hoje, fim: endOfDay(hoje) };
  }
}

// Helper: calcular totais de uma carga de forma robusta (anti-NaN)
function calcularTotaisCarga(itens: TransferenciaItemComProduto[]): {
  enviado: number;
  retornado: number;
  vendido: number;
  valor: number;
} {
  let enviado = 0;
  let retornado = 0;
  let vendido = 0;
  let valor = 0;

  for (const item of itens) {
    const qtdEnviada = Number(item.quantidadeEnviada) || 0;
    const qtdRetornada = Number(item.quantidadeRetornada) || 0;
    const qtdVendida = Math.max(0, qtdEnviada - qtdRetornada);
    const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;

    enviado += qtdEnviada;
    retornado += qtdRetornada;
    vendido += qtdVendida;
    valor += qtdVendida * preco;
  }

  return { enviado, retornado, vendido, valor };
}

// Helper: obter data de referência da carga
function getDataReferencia(carga: TransferenciaComItensHistorico): Date {
  // Para concluídas: usar data_retorno, fallback para data_saida
  // Para em andamento: usar data_saida
  if (carga.status === 'concluida' && carga.dataRetorno) {
    return new Date(carga.dataRetorno);
  }
  return new Date(carga.dataSaida);
}

// Helper: mapear dados do banco para interface
function mapDbToTransferenciaHistorico(db: any): TransferenciaComItensHistorico {
  return {
    id: db.id,
    localOrigemId: db.local_origem_id,
    localDestinoId: db.local_destino_id,
    localOrigemNome: db.local_origem?.nome || null,
    localDestinoNome: db.local_destino?.nome || null,
    tipo: db.tipo,
    status: db.status,
    dataSaida: db.data_saida,
    dataRetorno: db.data_retorno,
    observacoes: db.observacoes,
    createdAt: db.created_at,
    itens: (db.transferencia_itens || []).map((item: any) => ({
      id: item.id,
      itemId: item.item_id,
      quantidadeEnviada: Number(item.quantidade_enviada) || 0,
      quantidadeRetornada: item.quantidade_retornada !== null ? Number(item.quantidade_retornada) : null,
      precoUnitario: item.preco_unitario !== null ? Number(item.preco_unitario) : null,
      produtoNome: item.estoque_itens?.nome || item.nome_produto || null,
      produtoPreco: item.estoque_itens?.preco_unitario != null ? Number(item.estoque_itens?.preco_unitario) : null,
      produtoImagem: item.estoque_itens?.imagem_url || item.imagem_url_produto || null,
      modeloId: (() => {
        try {
          const loc = JSON.parse(item.estoque_itens?.localizacao || '{}');
          return loc.modeloId || null;
        } catch (e) {
          return null;
        }
      })(),
    })),
  };
}

// Hook: buscar cargas por período
export function useCargasPorPeriodo(inicio: Date, fim: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cargas-periodo', user?.id, inicio.toISOString(), fim.toISOString()],
    queryFn: async () => {
      if (!user) return [];

      const inicioISO = inicio.toISOString();
      const fimISO = fim.toISOString();

      // Filtro no servidor: inclui cargas onde data_saida OU data_retorno cai no período.
      // Usa um range levemente expandido (data_saida <= fim) para capturar cargas em_andamento
      // que ainda não têm data_retorno. O filtro no cliente garante precisão final.
      const { data, error } = await supabase
        .from('transferencias')
        .select(`
          *,
          local_origem:estoque_locais!local_origem_id(nome),
          local_destino:estoque_locais!local_destino_id(nome),
          transferencia_itens (
            *,
            estoque_itens (nome, preco_unitario, imagem_url, localizacao)
          )
        `)
        .eq('tipo', 'carga_feira')
        .is('deleted_at', null)
        .or(`and(data_saida.gte.${inicioISO},data_saida.lte.${fimISO}),and(data_retorno.gte.${inicioISO},data_retorno.lte.${fimISO})`)
        .order('data_saida', { ascending: false });

      if (error) throw error;

      // Filtro no cliente para precisão de fuso horário e edge cases
      const cargas = (data || [])
        .map(mapDbToTransferenciaHistorico)
        .filter(carga => {
          const dataRef = getDataReferencia(carga);
          return dataRef >= inicio && dataRef <= fim;
        });

      return cargas;
    },
    enabled: !!user,
    staleTime: 30000, // 30 segundos - histórico pode ter cache maior
  });
}

// Hook: buscar TODAS as cargas ativas (independente do período)
export function useTodasCargasAtivas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['todas-cargas-ativas', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Buscar todas as cargas ativas (sem filtrar user_id - vendedores precisam ver cargas de todos)
      const { data, error } = await supabase
        .from('transferencias')
        .select(`
          *,
          local_origem:estoque_locais!local_origem_id(nome),
          local_destino:estoque_locais!local_destino_id(nome),
          transferencia_itens (
            *,
            estoque_itens (nome, preco_unitario, imagem_url, localizacao)
          )
        `)
        .eq('tipo', 'carga_feira')
        .eq('status', 'em_andamento')
        .is('deleted_at', null)
        .order('data_saida', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapDbToTransferenciaHistorico);
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

// Hook: calcular resumo do período
export function useResumoFeiraPeriodo(inicio: Date, fim: Date) {
  const { data: cargas, isLoading } = useCargasPorPeriodo(inicio, fim);

  const resumo = useMemo((): ResumoFeiraPeriodo => {
    if (!cargas || cargas.length === 0) {
      return {
        totalCarga: 0,
        totalRetorno: 0,
        totalVendido: 0,
        valorVendido: 0,
        quantidadeCargas: 0,
        cargasAtivas: 0,
        cargasConcluidas: 0,
        taxaVenda: 0,
        totalModelos: 0,
      };
    }

    let totalCarga = 0;
    let totalRetorno = 0;
    let valorVendido = 0;
    let cargasAtivas = 0;
    let cargasConcluidas = 0;

    cargas.forEach(carga => {
      if (carga.status === 'em_andamento') cargasAtivas++;
      if (carga.status === 'concluida') cargasConcluidas++;

      const totais = calcularTotaisCarga(carga.itens);
      totalCarga += totais.enviado;
      totalRetorno += totais.retornado;
      valorVendido += totais.valor;
    });

    const todosItens = cargas.flatMap(c => c.itens);
    const modelosUnicos = new Set(todosItens.map(i => {
      if (i.modeloId) return i.modeloId;
      const info = parseProductName(i.produtoNome || '', '');
      return info.refBase || i.id;
    }));

    return {
      totalCarga,
      totalRetorno,
      totalVendido: Math.max(0, totalCarga - totalRetorno),
      valorVendido,
      quantidadeCargas: cargas.length,
      cargasAtivas,
      cargasConcluidas,
      taxaVenda: totalCarga > 0 ? Math.round((Math.max(0, totalCarga - totalRetorno) / totalCarga) * 100) : 0,
      totalModelos: modelosUnicos.size,
    };
  }, [cargas]);

  return {
    resumo,
    cargas: cargas || [],
    isLoading,
  };
}

// Helper: calcula o período anterior equivalente em duração
export function calcularPeriodoAnterior(inicio: Date, fim: Date): { inicio: Date; fim: Date } {
  const duracaoMs = fim.getTime() - inicio.getTime();
  return {
    inicio: new Date(inicio.getTime() - duracaoMs - 1),
    fim: new Date(inicio.getTime() - 1),
  };
}

export interface ComparacaoKPI {
  atual: number;
  anterior: number;
  delta: number;       // diferença absoluta
  variacao: number;    // % de variação (-100 a +∞), null se anterior=0
  semDados: boolean;   // true quando não há dados no período anterior
}

export interface ResumoComComparacao {
  atual: ResumoFeiraPeriodo;
  anterior: ResumoFeiraPeriodo;
  carga: ComparacaoKPI;
  retorno: ComparacaoKPI;
  vendido: ComparacaoKPI;
  valor: ComparacaoKPI;
  taxa: ComparacaoKPI;
}

function calcularComparacao(atual: number, anterior: number): ComparacaoKPI {
  const delta = atual - anterior;
  const semDados = anterior === 0;
  const variacao = semDados ? 0 : (delta / anterior) * 100;
  return { atual, anterior, delta, variacao, semDados };
}

// Hook: resumo do período atual + período anterior equivalente para comparação
export function useResumoComComparacao(inicio: Date, fim: Date) {
  const periodoAnt = calcularPeriodoAnterior(inicio, fim);

  const { resumo: atual, isLoading: loadingAtual } = useResumoFeiraPeriodo(inicio, fim);
  const { resumo: anterior, isLoading: loadingAnterior } = useResumoFeiraPeriodo(
    periodoAnt.inicio,
    periodoAnt.fim
  );

  const comparacao = useMemo((): ResumoComComparacao => ({
    atual,
    anterior,
    carga:   calcularComparacao(atual.totalCarga,   anterior.totalCarga),
    retorno: calcularComparacao(atual.totalRetorno, anterior.totalRetorno),
    vendido: calcularComparacao(atual.totalVendido, anterior.totalVendido),
    valor:   calcularComparacao(atual.valorVendido, anterior.valorVendido),
    taxa:    calcularComparacao(atual.taxaVenda,    anterior.taxaVenda),
  }), [atual, anterior]);

  return { comparacao, isLoading: loadingAtual || loadingAnterior };
}

export interface ModeloRankingFeira {
  id: string;
  nome: string;
  imagemUrl: string | null;
  enviado: number;
  retornado: number;
  vendido: number;
  valor: number;
  taxaRetorno: number;  // 0-100
  taxaVenda: number;    // 0-100
}

export function useRankingModelosFeira(inicio: Date, fim: Date) {
  const { data: cargas, isLoading } = useCargasPorPeriodo(inicio, fim);

  const ranking = useMemo((): { topVendidos: ModeloRankingFeira[]; topRetorno: ModeloRankingFeira[] } => {
    if (!cargas || cargas.length === 0) return { topVendidos: [], topRetorno: [] };

    const grupos = new Map<string, ModeloRankingFeira>();

    for (const carga of cargas) {
      for (const item of carga.itens) {
        const info = parseProductName(item.produtoNome || '', '');
        const chave = item.modeloId || info.refBase || item.itemId;
        const nome = info.nomeExibicao || item.produtoNome || 'Sem nome';

        const enviado = Number(item.quantidadeEnviada) || 0;
        const retornado = Number(item.quantidadeRetornada) || 0;
        const vendido = Math.max(0, enviado - retornado);
        const preco = Number(item.precoUnitario) || Number(item.produtoPreco) || 0;

        if (!grupos.has(chave)) {
          grupos.set(chave, {
            id: chave,
            nome,
            imagemUrl: item.produtoImagem,
            enviado: 0,
            retornado: 0,
            vendido: 0,
            valor: 0,
            taxaRetorno: 0,
            taxaVenda: 0,
          });
        }

        const g = grupos.get(chave)!;
        g.enviado += enviado;
        g.retornado += retornado;
        g.vendido += vendido;
        g.valor += vendido * preco;
        if (!g.imagemUrl && item.produtoImagem) g.imagemUrl = item.produtoImagem;
      }
    }

    const lista = Array.from(grupos.values()).map(g => ({
      ...g,
      taxaRetorno: g.enviado > 0 ? Math.round((g.retornado / g.enviado) * 100) : 0,
      taxaVenda:   g.enviado > 0 ? Math.round((g.vendido   / g.enviado) * 100) : 0,
    })).filter(g => g.enviado > 0);

    return {
      topVendidos: [...lista].sort((a, b) => b.vendido - a.vendido).slice(0, 10),
      topRetorno:  [...lista]
        .filter(g => g.retornado > 0)
        .sort((a, b) => b.taxaRetorno - a.taxaRetorno)
        .slice(0, 10),
    };
  }, [cargas]);

  return { ranking, isLoading };
}

export interface DiaSemanaStats {
  diaSemanaIndex: number;  // 1=Seg ... 6=Sáb (0=Dom excluído)
  diaSemana: string;       // "Segunda-feira"
  diaCurto: string;        // "Seg"
  quantidadeFeiras: number;
  totalEnviado: number;
  totalRetornado: number;
  totalVendido: number;
  valorTotal: number;
  mediaPorFeira: number;   // totalVendido / quantidadeFeiras
  mediaValorPorFeira: number;
  taxaVendaMedia: number;  // 0-100
  isMelhorDia: boolean;
}

const DIA_CURTO: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};
const DIA_LONGO: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira',
  4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado',
};

export function useAnaliseDiaSemana(inicio: Date, fim: Date) {
  const { data: cargas, isLoading } = useCargasPorPeriodo(inicio, fim);

  const analise = useMemo((): DiaSemanaStats[] => {
    if (!cargas || cargas.length === 0) return [];

    // Acumular por dia da semana
    const map = new Map<number, {
      enviado: number; retornado: number; vendido: number;
      valor: number; taxas: number[]; feiras: number;
    }>();

    for (const carga of cargas) {
      const dataRef = getDataReferencia(carga);
      const idx = dataRef.getDay(); // 0=Dom
      const totais = calcularTotaisCarga(carga.itens);
      const taxa = totais.enviado > 0 ? (totais.vendido / totais.enviado) * 100 : 0;

      if (!map.has(idx)) {
        map.set(idx, { enviado: 0, retornado: 0, vendido: 0, valor: 0, taxas: [], feiras: 0 });
      }
      const d = map.get(idx)!;
      d.feiras++;
      d.enviado += totais.enviado;
      d.retornado += totais.retornado;
      d.vendido += totais.vendido;
      d.valor += totais.valor;
      d.taxas.push(taxa);
    }

    // Montar array ordenado Seg → Sáb (exclui Domingo se não houver dados)
    const dias: DiaSemanaStats[] = [];
    for (let i = 1; i <= 6; i++) {
      const d = map.get(i);
      if (!d) continue;
      dias.push({
        diaSemanaIndex: i,
        diaSemana: DIA_LONGO[i],
        diaCurto: DIA_CURTO[i],
        quantidadeFeiras: d.feiras,
        totalEnviado: d.enviado,
        totalRetornado: d.retornado,
        totalVendido: d.vendido,
        valorTotal: d.valor,
        mediaPorFeira: d.feiras > 0 ? Math.round(d.vendido / d.feiras) : 0,
        mediaValorPorFeira: d.feiras > 0 ? d.valor / d.feiras : 0,
        taxaVendaMedia: d.taxas.length > 0
          ? Math.round(d.taxas.reduce((s, t) => s + t, 0) / d.taxas.length)
          : 0,
        isMelhorDia: false,
      });
    }
    // Também adiciona Domingo se houver dados
    if (map.has(0)) {
      const d = map.get(0)!;
      dias.unshift({
        diaSemanaIndex: 0,
        diaSemana: DIA_LONGO[0],
        diaCurto: DIA_CURTO[0],
        quantidadeFeiras: d.feiras,
        totalEnviado: d.enviado,
        totalRetornado: d.retornado,
        totalVendido: d.vendido,
        valorTotal: d.valor,
        mediaPorFeira: d.feiras > 0 ? Math.round(d.vendido / d.feiras) : 0,
        mediaValorPorFeira: d.feiras > 0 ? d.valor / d.feiras : 0,
        taxaVendaMedia: d.taxas.length > 0
          ? Math.round(d.taxas.reduce((s, t) => s + t, 0) / d.taxas.length)
          : 0,
        isMelhorDia: false,
      });
    }

    if (dias.length === 0) return [];

    // Marca o melhor dia pela média de vendas por feira
    const maxMedia = Math.max(...dias.map(d => d.mediaPorFeira));
    return dias.map(d => ({ ...d, isMelhorDia: d.mediaPorFeira === maxMedia && maxMedia > 0 }));
  }, [cargas]);

  return { analise, isLoading };
}

// Hook: histórico agrupado por data
export function useHistoricoAgrupado(inicio: Date, fim: Date) {
  const { data: cargas, isLoading } = useCargasPorPeriodo(inicio, fim);

  const historico = useMemo((): CargaDiaAgrupada[] => {
    if (!cargas || cargas.length === 0) return [];

    const grupos = new Map<string, CargaDiaAgrupada>();

    for (const carga of cargas) {
      const dataRef = getDataReferencia(carga);
      const dataKey = format(dataRef, 'yyyy-MM-dd');

      if (!grupos.has(dataKey)) {
        grupos.set(dataKey, {
          data: dataKey,
          dataFormatada: format(dataRef, 'dd/MM/yyyy'),
          diaSemana: format(dataRef, 'EEEE', { locale: ptBR }),
          totalCargas: 0,
          totalEnviado: 0,
          totalRetornado: 0,
          totalVendido: 0,
          valorVendido: 0,
          cargas: [],
        });
      }

      const grupo = grupos.get(dataKey)!;
      grupo.totalCargas++;
      grupo.cargas.push(carga);

      const totais = calcularTotaisCarga(carga.itens);
      grupo.totalEnviado += totais.enviado;
      grupo.totalRetornado += totais.retornado;
      grupo.totalVendido += totais.vendido;
      grupo.valorVendido += totais.valor;
    }

    return Array.from(grupos.values()).sort((a, b) => b.data.localeCompare(a.data));
  }, [cargas]);

  return {
    historico,
    isLoading,
  };
}

// Helper: calcular totais de uma carga específica
export function calcularTotaisCargaPublic(itens: TransferenciaItemComProduto[]) {
  return calcularTotaisCarga(itens);
}

// Helper: verificar se data é hoje
export function isDataHoje(dataStr: string): boolean {
  return isToday(new Date(dataStr));
}

// REMOVIDO: sincronizarTotalGeral foi substituído por sincronizarEstoqueTotal exportado de useTransferencias
// Regra unificada: estoque_itens.quantidade = SOMENTE Central

// Hook: excluir carga da feira (soft delete) com reversão de estoque
// REGRA: Apenas cargas em_andamento podem ser excluídas. Cargas concluídas devem ser ESTORNADAS.
export function useExcluirCargaFeira() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
      motivo,
    }: {
      transferenciaId: string;
      motivo?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Buscar a carga com itens
      const { data: carga, error: cargaError } = await supabase
        .from('transferencias')
        .select(`
          *,
          transferencia_itens (*)
        `)
        .eq('id', transferenciaId)
        .single();

      if (cargaError || !carga) throw new Error('Carga não encontrada');
      if (carga.deleted_at) throw new Error('Esta carga já foi excluída');

      // VALIDAÇÃO DE STATUS: Apenas cargas em_andamento podem ser excluídas
      if (carga.status === 'concluida') {
        throw new Error('Cargas concluídas não podem ser excluídas. Use a opção "Estornar" para reverter a venda.');
      }
      if (carga.status === 'estornada') {
        throw new Error('Esta carga já foi estornada anteriormente.');
      }
      if (carga.status === 'cancelada') {
        throw new Error('Esta carga já foi cancelada anteriormente.');
      }
      if (carga.status !== 'em_andamento') {
        throw new Error(`Não é possível excluir carga com status "${carga.status}".`);
      }

      // 2. Buscar locais Central e Banca (sem filtrar user_id - vendedores precisam acessar)
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('*')
        .in('tipo', ['central', 'banca']);

      const central = locais?.find(l => l.tipo === 'central');
      const banca = locais?.find(l => l.tipo === 'banca');

      if (!central || !banca) throw new Error('Locais Central/Banca não configurados');

      // 3. VALIDAR: Para cada item, verificar se Banca tem saldo suficiente
      for (const item of carga.transferencia_itens) {
        const enviado = Number(item.quantidade_enviada) || 0;
        const retornado = Number(item.quantidade_retornada) || 0;
        const delta = enviado - retornado; // Quantidade que precisa "voltar" da Banca

        if (delta > 0) {
          // Verificar se Banca tem saldo suficiente
          const { data: estoqueBanca } = await supabase
            .from('estoque_por_local')
            .select('quantidade')
            .eq('item_id', item.item_id)
            .eq('local_id', banca.id)
            .single();

          const qtdBanca = Number(estoqueBanca?.quantidade) || 0;

          if (qtdBanca < delta) {
            // Buscar nome do item para mensagem de erro
            const { data: itemInfo } = await supabase
              .from('estoque_itens')
              .select('nome')
              .eq('id', item.item_id)
              .single();

            throw new Error(
              `Não é possível excluir: "${itemInfo?.nome || 'Item'}" tem apenas ${qtdBanca} na Banca, mas precisa de ${delta} para reverter.`
            );
          }
        }
      }

      // 4. REVERTER estoque de cada item
      for (const item of carga.transferencia_itens) {
        const enviado = Number(item.quantidade_enviada) || 0;
        const retornado = Number(item.quantidade_retornada) || 0;
        const delta = enviado - retornado;

        // Central += delta (devolve o que saiu)
        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', item.item_id)
          .eq('local_id', central.id)
          .single();

        if (estoqueCentral) {
          await supabase
            .from('estoque_por_local')
            .update({
              quantidade: Number(estoqueCentral.quantidade) + delta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueCentral.id);
        }

        // Banca -= delta (remove o que ficou)
        const { data: estoqueBanca } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', item.item_id)
          .eq('local_id', banca.id)
          .single();

        if (estoqueBanca) {
          await supabase
            .from('estoque_por_local')
            .update({
              quantidade: Math.max(0, Number(estoqueBanca.quantidade) - delta),
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueBanca.id);
        }

        // Sincronizar estoque_itens.quantidade (usando função unificada)
        await sincronizarEstoqueTotal(item.item_id, user.id);
      }

      // 5. Marcar transferência como deletada (soft delete)
      const { error: updateError } = await supabase
        .from('transferencias')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          deleted_reason: motivo || null,
        })
        .eq('id', transferenciaId);

      if (updateError) throw updateError;

      // 6. Deletar transferencia_itens para liberar FK do estoque_itens
      const { error: deleteItensError } = await supabase
        .from('transferencia_itens')
        .delete()
        .eq('transferencia_id', transferenciaId);

      if (deleteItensError) {
        console.error('[useExcluirCargaFeira] Erro ao deletar transferencia_itens:', deleteItensError);
        // Não lançar erro aqui, pois a carga já foi soft-deleted com sucesso
      }
    },
    onSuccess: () => {
      // Invalidar todas as queries relevantes para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}

// Hook: excluir carga DEFINITIVAMENTE do histórico (hard delete)
// REGRA: Apenas cargas estornadas ou canceladas podem ser excluídas do histórico
// (não afeta estoque, pois já foi tratado)
export function useExcluirHistoricoCarga() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
    }: {
      transferenciaId: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Buscar a carga
      const { data: carga, error: cargaError } = await supabase
        .from('transferencias')
        .select('*')
        .eq('id', transferenciaId)
        .single();

      if (cargaError || !carga) throw new Error('Carga não encontrada');

      // VALIDAÇÃO DE STATUS: Apenas cargas finalizadas podem ser excluídas do histórico
      const statusPermitidos = ['estornada', 'cancelada'];
      if (!statusPermitidos.includes(carga.status)) {
        throw new Error(
          `Apenas cargas estornadas ou canceladas podem ser excluídas do histórico. ` +
          `Status atual: "${carga.status}".`
        );
      }

      // 2. Deletar estoque_movimentacoes primeiro (FK para transferencias)
      const { error: deleteMovError } = await supabase
        .from('estoque_movimentacoes')
        .delete()
        .eq('transferencia_id', transferenciaId);

      if (deleteMovError) {
        console.error('[useExcluirHistoricoCarga] Erro ao deletar movimentações:', deleteMovError);
        throw new Error('Erro ao excluir movimentações de estoque');
      }

      // 3. Deletar transferencia_itens (FK para transferencias)
      const { error: deleteItensError } = await supabase
        .from('transferencia_itens')
        .delete()
        .eq('transferencia_id', transferenciaId);

      if (deleteItensError) {
        console.error('[useExcluirHistoricoCarga] Erro ao deletar itens:', deleteItensError);
        throw new Error('Erro ao excluir itens da carga');
      }

      // 4. Deletar a transferência (hard delete)
      const { error: deleteError } = await supabase
        .from('transferencias')
        .delete()
        .eq('id', transferenciaId);

      if (deleteError) {
        console.error('[useExcluirHistoricoCarga] Erro ao deletar transferência:', deleteError);
        throw new Error('Erro ao excluir carga do histórico');
      }

      return { transferenciaId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}
