import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type StatusTransferencia = 'em_andamento' | 'concluida' | 'cancelada';

export interface Transferencia {
  id: string;
  localOrigemId: string;
  localDestinoId: string;
  tipo: 'transferencia' | 'carga_feira';
  status: StatusTransferencia;
  dataSaida: string;
  dataRetorno: string | null;
  observacoes: string | null;
  motivo: string | null;
  dataConclusao: string | null;
  concluidoPor: string | null;
  createdAt: string;
}

export interface TransferenciaItem {
  id: string;
  transferenciaId: string;
  itemId: string;
  quantidadeEnviada: number;
  quantidadeRetornada: number | null;
  precoUnitario: number | null;
  createdAt: string;
}

export interface TransferenciaComItens extends Transferencia {
  itens: TransferenciaItem[];
}

interface DbTransferencia {
  id: string;
  user_id: string;
  local_origem_id: string;
  local_destino_id: string;
  tipo: string;
  status: string;
  data_saida: string;
  data_retorno: string | null;
  observacoes: string | null;
  motivo: string | null;
  data_conclusao: string | null;
  concluido_por: string | null;
  created_at: string;
}

interface DbTransferenciaItem {
  id: string;
  user_id: string;
  transferencia_id: string;
  item_id: string;
  quantidade_enviada: number;
  quantidade_retornada: number | null;
  preco_unitario: number | null;
  created_at: string;
}

const mapDbToTransferencia = (db: DbTransferencia): Transferencia => ({
  id: db.id,
  localOrigemId: db.local_origem_id,
  localDestinoId: db.local_destino_id,
  tipo: db.tipo as 'transferencia' | 'carga_feira',
  status: db.status as StatusTransferencia,
  dataSaida: db.data_saida,
  dataRetorno: db.data_retorno,
  observacoes: db.observacoes,
  motivo: db.motivo,
  dataConclusao: db.data_conclusao,
  concluidoPor: db.concluido_por,
  createdAt: db.created_at,
});

const mapDbToItem = (db: DbTransferenciaItem): TransferenciaItem => ({
  id: db.id,
  transferenciaId: db.transferencia_id,
  itemId: db.item_id,
  quantidadeEnviada: Number(db.quantidade_enviada),
  quantidadeRetornada: db.quantidade_retornada ? Number(db.quantidade_retornada) : null,
  precoUnitario: db.preco_unitario ? Number(db.preco_unitario) : null,
  createdAt: db.created_at,
});

// Hook para buscar transferências
export function useTransferencias(tipo?: 'transferencia' | 'carga_feira') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transferencias', user?.id, tipo],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('transferencias')
        .select('*')
        .order('created_at', { ascending: false });

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as DbTransferencia[]).map(mapDbToTransferencia);
    },
    enabled: !!user,
  });
}

// Hook para buscar itens de uma transferência
export function useTransferenciaItens(transferenciaId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transferencia-itens', transferenciaId],
    queryFn: async () => {
      if (!user || !transferenciaId) return [];

      const { data, error } = await supabase
        .from('transferencia_itens')
        .select('*')
        .eq('transferencia_id', transferenciaId);

      if (error) throw error;

      return (data as DbTransferenciaItem[]).map(mapDbToItem);
    },
    enabled: !!user && !!transferenciaId,
  });
}

// Hook para buscar cargas da feira de hoje
export function useCargasHoje() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cargas-hoje', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const { data: transferencias, error } = await supabase
        .from('transferencias')
        .select('*')
        .eq('tipo', 'carga_feira')
        .is('deleted_at', null)
        .gte('data_saida', hoje.toISOString())
        .lt('data_saida', amanha.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar itens de cada transferência
      const result: TransferenciaComItens[] = [];
      for (const t of transferencias as DbTransferencia[]) {
        const { data: itens } = await supabase
          .from('transferencia_itens')
          .select('*')
          .eq('transferencia_id', t.id);

        result.push({
          ...mapDbToTransferencia(t),
          itens: (itens as DbTransferenciaItem[] || []).map(mapDbToItem),
        });
      }

      return result;
    },
    enabled: !!user,
  });
}

// Função auxiliar para sincronizar estoque_itens.quantidade com o estoque do Central
// REGRA UNIFICADA: estoque_itens.quantidade = SOMENTE quantidade do Central
export async function sincronizarEstoqueTotal(itemId: string, userId: string) {
  // Buscar o local Central do usuário
  const { data: central, error: centralError } = await supabase
    .from('estoque_locais')
    .select('id')
    .eq('user_id', userId)
    .eq('tipo', 'central')
    .single();

  if (centralError || !central) {
    console.error('[sincronizarEstoqueTotal] Local Central não encontrado:', centralError);
    throw new Error('Local Central não encontrado para sincronização de estoque');
  }

  // Buscar quantidade apenas do Central (estoque disponível para venda)
  const { data: estoqueCentral } = await supabase
    .from('estoque_por_local')
    .select('quantidade')
    .eq('item_id', itemId)
    .eq('local_id', central.id)
    .single();

  const quantidadeCentral = estoqueCentral ? Number(estoqueCentral.quantidade) : 0;

  // Atualizar estoque_itens com quantidade do Central apenas
  const { error: updateError } = await supabase
    .from('estoque_itens')
    .update({ quantidade: quantidadeCentral, updated_at: new Date().toISOString() })
    .eq('id', itemId);

  if (updateError) {
    console.error('[sincronizarEstoqueTotal] Erro ao atualizar estoque_itens:', updateError);
    throw new Error(`Falha ao sincronizar estoque: ${updateError.message}`);
  }
}

// Hook para criar carga da feira
export function useCriarCargaFeira() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itens,
      observacoes,
    }: {
      itens: { itemId: string; quantidade: number; precoUnitario?: number }[];
      observacoes?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Verificar sessão ativa antes de qualquer operação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Por favor, recarregue a página e faça login novamente.');
      }

      // Buscar locais Central e Banca (sem filtrar user_id para permitir colaboração)
      const { data: locais, error: locaisError } = await supabase
        .from('estoque_locais')
        .select('*')
        .in('tipo', ['central', 'banca']);

      if (locaisError) {
        console.error('[useCriarCargaFeira] Erro ao buscar locais:', locaisError);
        throw new Error('Erro ao buscar configuração de locais. Tente novamente.');
      }

      console.log('[useCriarCargaFeira] Locais encontrados:', locais);

      const central = locais?.find(l => l.tipo === 'central');
      const banca = locais?.find(l => l.tipo === 'banca');

      if (!central || !banca) {
        console.error('[useCriarCargaFeira] Locais não configurados:', { 
          central: !!central, 
          banca: !!banca,
          userId: user.id,
          locaisRetornados: locais 
        });
        throw new Error('Locais não configurados. Recarregue a página para sincronizar a configuração inicial.');
      }

      // OTIMIZADO: Buscar todos os estoques de uma vez
      const itemIds = itens.map(i => i.itemId);
      
      const { data: estoquesOriginais } = await supabase
        .from('estoque_por_local')
        .select('*')
        .in('item_id', itemIds)
        .in('local_id', [central.id, banca.id]);

      // Mapear estoques por item e local
      const mapEstoquesCentral = new Map<string, { id: string; quantidade: number; quantidade_reservada: number }>();
      const mapEstoquesBanca = new Map<string, { id: string; quantidade: number }>();
      
      estoquesOriginais?.forEach(e => {
        if (e.local_id === central.id) {
          mapEstoquesCentral.set(e.item_id, { 
            id: e.id, 
            quantidade: Number(e.quantidade), 
            quantidade_reservada: Number(e.quantidade_reservada) 
          });
        } else if (e.local_id === banca.id) {
          mapEstoquesBanca.set(e.item_id, { id: e.id, quantidade: Number(e.quantidade) });
        }
      });

      // Validar disponibilidade de todos os itens
      const itensComProblema: string[] = [];
      for (const item of itens) {
        const estoque = mapEstoquesCentral.get(item.itemId);
        const disponivel = estoque
          ? estoque.quantidade - estoque.quantidade_reservada
          : 0;

        if (disponivel < item.quantidade) {
          itensComProblema.push(item.itemId);
        }
      }

      // Se há itens com problema, buscar nomes e lançar erro
      if (itensComProblema.length > 0) {
        const { data: itensNomes } = await supabase
          .from('estoque_itens')
          .select('id, nome')
          .in('id', itensComProblema);
        
        const primeiroProblema = itensComProblema[0];
        const estoque = mapEstoquesCentral.get(primeiroProblema);
        const disponivel = estoque ? estoque.quantidade - estoque.quantidade_reservada : 0;
        const nomeItem = itensNomes?.find(i => i.id === primeiroProblema)?.nome || 'Item';
        
        throw new Error(`${nomeItem}: apenas ${disponivel} disponível no Central. Estoque insuficiente.`);
      }

      // Criar transferência
      const { data: transferencia, error: tErr } = await supabase
        .from('transferencias')
        .insert({
          user_id: user.id,
          local_origem_id: central.id,
          local_destino_id: banca.id,
          tipo: 'carga_feira',
          status: 'em_andamento',
          observacoes,
        })
        .select()
        .single();

      if (tErr) throw tErr;

      // OTIMIZADO: Inserir todos os itens da transferência em lote
      const itensParaInserir = itens.map(item => ({
        user_id: user.id,
        transferencia_id: transferencia.id,
        item_id: item.itemId,
        quantidade_enviada: item.quantidade,
        preco_unitario: item.precoUnitario || null,
      }));
      
      const { error: itensError } = await supabase
        .from('transferencia_itens')
        .insert(itensParaInserir);
      
      if (itensError) throw itensError;

      // OTIMIZADO: Registrar todas as movimentações em lote
      const movimentacoes = itens.map(item => {
        const estoqueCentral = mapEstoquesCentral.get(item.itemId);
        const quantidadeAntes = estoqueCentral?.quantidade || 0;
        return {
          user_id: user.id,
          item_id: item.itemId,
          tipo: 'ENVIO_FEIRA',
          quantidade: item.quantidade,
          motivo: `Envio para feira - Carga #${transferencia.id.slice(0, 8)}`,
          transferencia_id: transferencia.id,
          local_id: central.id,
          estoque_antes: quantidadeAntes,
          estoque_depois: quantidadeAntes - item.quantidade,
        };
      });

      const { error: movError } = await supabase
        .from('estoque_movimentacoes')
        .insert(movimentacoes);

      if (movError) {
        console.error('[useCriarCargaFeira] ERRO ao registrar ENVIO_FEIRA:', movError);
        if (movError.message.includes('row-level security policy')) {
          throw new Error('Sessão expirada ou sem permissão. Por favor, recarregue a página e tente novamente.');
        }
        throw new Error(`Falha ao registrar movimentação de estoque: ${movError.message}`);
      }

      // OTIMIZADO: Atualizar estoques em paralelo
      const updatePromises = itens.map(async (item) => {
        const estoqueCentral = mapEstoquesCentral.get(item.itemId);
        const estoqueBanca = mapEstoquesBanca.get(item.itemId);
        
        // Reduzir no Central
        if (estoqueCentral) {
          const { error: updateCentralError } = await supabase
            .from('estoque_por_local')
            .update({
              quantidade: estoqueCentral.quantidade - item.quantidade,
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueCentral.id);

          if (updateCentralError) {
            console.error('[useCriarCargaFeira] ERRO ao reduzir Central:', updateCentralError);
            throw new Error(`Falha ao atualizar estoque Central: ${updateCentralError.message}`);
          }
        }

        // Adicionar na Banca
        if (estoqueBanca) {
          const { error: updateBancaError } = await supabase
            .from('estoque_por_local')
            .update({
              quantidade: estoqueBanca.quantidade + item.quantidade,
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueBanca.id);

          if (updateBancaError) {
            console.error('[useCriarCargaFeira] ERRO ao aumentar Banca:', updateBancaError);
            throw new Error(`Falha ao atualizar estoque Banca: ${updateBancaError.message}`);
          }
        } else {
          const { error: insertBancaError } = await supabase.from('estoque_por_local').insert({
            user_id: user.id,
            item_id: item.itemId,
            local_id: banca.id,
            quantidade: item.quantidade,
            quantidade_reservada: 0,
          });

          if (insertBancaError) {
            console.error('[useCriarCargaFeira] ERRO ao inserir na Banca:', insertBancaError);
            throw new Error(`Falha ao criar registro na Banca: ${insertBancaError.message}`);
          }
        }
      });

      await Promise.all(updatePromises);

      // OTIMIZADO: Sincronizar todos os estoques em paralelo
      await Promise.all(itens.map(item => sincronizarEstoqueTotal(item.itemId, user.id)));

      return mapDbToTransferencia(transferencia as DbTransferencia);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-feira'] });
      // Invalidar TODAS as queries de estoque com predicate para garantir atualização
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-disponiveis-adicionar'] });
    },
  });
}

// Hook para registrar retorno da feira
export function useRegistrarRetornoFeira() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
      itensRetornados,
    }: {
      transferenciaId: string;
      itensRetornados: { itemId: string; quantidadeRetornada: number }[];
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Verificar sessão ativa antes de qualquer operação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Por favor, recarregue a página e faça login novamente.');
      }

      // Buscar locais (sem filtrar por user_id - vendedores precisam ver locais de todos)
      const { data: locais, error: locaisError } = await supabase
        .from('estoque_locais')
        .select('*')
        .in('tipo', ['central', 'banca']);

      if (locaisError) {
        console.error('[useRegistrarRetornoFeira] Erro ao buscar locais:', locaisError);
        throw new Error('Erro ao buscar configuração de locais. Tente novamente.');
      }

      console.log('[useRegistrarRetornoFeira] Locais encontrados:', locais);

      const central = locais?.find(l => l.tipo === 'central');
      const banca = locais?.find(l => l.tipo === 'banca');

      if (!central || !banca) {
        console.error('[useRegistrarRetornoFeira] Locais não configurados:', { 
          central: !!central, 
          banca: !!banca,
          userId: user.id,
          locaisRetornados: locais 
        });
        throw new Error('Locais não configurados. Recarregue a página para sincronizar a configuração inicial.');
      }

      // Buscar itens originais da carga para validação
      const { data: itensOriginais } = await supabase
        .from('transferencia_itens')
        .select('*')
        .eq('transferencia_id', transferenciaId);

      if (!itensOriginais) throw new Error('Itens da carga não encontrados');

      // Validar cada item e processar
      for (const item of itensRetornados) {
        // Encontrar item original
        const itemOriginal = itensOriginais.find(io => io.item_id === item.itemId);
        if (!itemOriginal) {
          throw new Error(`Item não encontrado na carga original`);
        }

        const enviado = Number(itemOriginal.quantidade_enviada);
        const retornado = item.quantidadeRetornada;
        const vendido = enviado - retornado;

        // Validação: Retornado não pode exceder Enviado
        if (retornado > enviado) {
          const { data: itemData } = await supabase
            .from('estoque_itens')
            .select('nome')
            .eq('id', item.itemId)
            .single();
          throw new Error(
            `${itemData?.nome || 'Item'}: quantidade retornada (${retornado}) não pode exceder a quantidade enviada (${enviado})`
          );
        }

        // Validação: Retornado não pode ser negativo
        if (retornado < 0) {
          throw new Error('Quantidade retornada não pode ser negativa');
        }

        // Atualizar quantidade_retornada na transferencia_itens
        await supabase
          .from('transferencia_itens')
          .update({ quantidade_retornada: retornado })
          .eq('transferencia_id', transferenciaId)
          .eq('item_id', item.itemId);

        // Buscar estoque atual da Banca
        const { data: estoqueBanca } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', item.itemId)
          .eq('local_id', banca.id)
          .single();

        const quantidadeAntesBanca = estoqueBanca ? Number(estoqueBanca.quantidade) : 0;

        // Buscar estoque atual do Central
        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', item.itemId)
          .eq('local_id', central.id)
          .single();

        const quantidadeAntesCentral = estoqueCentral ? Number(estoqueCentral.quantidade) : 0;

        // Registrar movimentação RETORNO_FEIRA se retornado > 0 (COM TRATAMENTO DE ERRO)
        if (retornado > 0) {
          const { error: movRetornoError } = await supabase.from('estoque_movimentacoes').insert({
            user_id: user.id,
            item_id: item.itemId,
            tipo: 'RETORNO_FEIRA',
            quantidade: retornado,
            motivo: `Retorno da feira - Carga #${transferenciaId.slice(0, 8)}`,
            transferencia_id: transferenciaId,
            local_id: central.id,
            estoque_antes: quantidadeAntesCentral,
            estoque_depois: quantidadeAntesCentral + retornado,
          });

          if (movRetornoError) {
            console.error('[useRegistrarRetornoFeira] ERRO ao registrar RETORNO_FEIRA:', movRetornoError);
            // Detectar erro de RLS específico
            if (movRetornoError.message.includes('row-level security policy')) {
              throw new Error('Sessão expirada ou sem permissão. Por favor, recarregue a página e tente novamente.');
            }
            throw new Error(`Falha ao registrar movimentação de retorno: ${movRetornoError.message}`);
          }
        }

        // Registrar movimentação VENDA_FEIRA se vendido > 0 (COM TRATAMENTO DE ERRO)
        if (vendido > 0) {
          const { error: movVendaError } = await supabase.from('estoque_movimentacoes').insert({
            user_id: user.id,
            item_id: item.itemId,
            tipo: 'VENDA_FEIRA',
            quantidade: vendido,
            motivo: `Venda na feira - Carga #${transferenciaId.slice(0, 8)}`,
            transferencia_id: transferenciaId,
            local_id: banca.id,
            estoque_antes: quantidadeAntesBanca,
            estoque_depois: 0, // Banca fica zerada após fechamento
          });

          if (movVendaError) {
            console.error('[useRegistrarRetornoFeira] ERRO ao registrar VENDA_FEIRA:', movVendaError);
            // Detectar erro de RLS específico
            if (movVendaError.message.includes('row-level security policy')) {
              throw new Error('Sessão expirada ou sem permissão. Por favor, recarregue a página e tente novamente.');
            }
            throw new Error(`Falha ao registrar movimentação de venda: ${movVendaError.message}`);
          }
        }

        // Mover estoque: Banca -> Central (apenas o retornado)
        // Zerar estoque da Banca para este item (Retornado + Vendido saem)
        if (estoqueBanca) {
          await supabase
            .from('estoque_por_local')
            .update({
              quantidade: Math.max(0, quantidadeAntesBanca - enviado), // Zera ou reduz pelo total enviado
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueBanca.id);
        }

        // Adicionar no Central apenas o que retornou
        if (estoqueCentral && retornado > 0) {
          await supabase
            .from('estoque_por_local')
            .update({
              quantidade: quantidadeAntesCentral + retornado,
              updated_at: new Date().toISOString(),
            })
            .eq('id', estoqueCentral.id);
        }

        // Sincronizar estoque_itens.quantidade
        await sincronizarEstoqueTotal(item.itemId, user.id);
      }

      // Marcar transferência como concluída
      await supabase
        .from('transferencias')
        .update({
          status: 'concluida',
          data_retorno: new Date().toISOString(),
        })
        .eq('id', transferenciaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
    },
  });
}

// Interface para itens de edição
interface ItemEdicao {
  itemId: string;
  nome: string;
  quantidade: number;
  quantidadeOriginal: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
  isNovo: boolean;
}

// Hook para editar carga da feira (adicionar/remover/alterar itens)
export function useEditarCargaFeira() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
      itens,
    }: {
      transferenciaId: string;
      itens: ItemEdicao[];
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Verificar sessão ativa
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Por favor, recarregue a página e faça login novamente.');
      }

      // Buscar locais Central e Banca
      const { data: locais, error: locaisError } = await supabase
        .from('estoque_locais')
        .select('*')
        .in('tipo', ['central', 'banca']);

      if (locaisError) throw new Error('Erro ao buscar configuração de locais.');

      const central = locais?.find(l => l.tipo === 'central');
      const banca = locais?.find(l => l.tipo === 'banca');

      if (!central || !banca) {
        throw new Error('Locais não configurados. Recarregue a página.');
      }

      // Buscar itens originais da carga
      const { data: itensOriginais, error: itensError } = await supabase
        .from('transferencia_itens')
        .select('*')
        .eq('transferencia_id', transferenciaId);

      if (itensError) throw new Error('Erro ao buscar itens da carga.');

      const mapItensOriginais = new Map(
        (itensOriginais || []).map(i => [i.item_id, i])
      );

      // Buscar todos os estoques necessários
      const todosItemIds = [...new Set([
        ...itens.map(i => i.itemId),
        ...(itensOriginais || []).map(i => i.item_id)
      ])];

      const { data: estoques } = await supabase
        .from('estoque_por_local')
        .select('*')
        .in('item_id', todosItemIds)
        .in('local_id', [central.id, banca.id]);

      const mapEstoquesCentral = new Map<string, { id: string; quantidade: number }>();
      const mapEstoquesBanca = new Map<string, { id: string; quantidade: number }>();

      estoques?.forEach(e => {
        if (e.local_id === central.id) {
          mapEstoquesCentral.set(e.item_id, { id: e.id, quantidade: Number(e.quantidade) });
        } else if (e.local_id === banca.id) {
          mapEstoquesBanca.set(e.item_id, { id: e.id, quantidade: Number(e.quantidade) });
        }
      });

      // Processar cada item
      for (const item of itens) {
        const original = mapItensOriginais.get(item.itemId);
        const estoqueCentral = mapEstoquesCentral.get(item.itemId);
        const estoqueBanca = mapEstoquesBanca.get(item.itemId);

        if (item.isNovo) {
          // NOVO ITEM: Adicionar à carga
          const disponivel = estoqueCentral?.quantidade || 0;
          if (disponivel < item.quantidade) {
            throw new Error(`${item.nome}: apenas ${disponivel} disponível no Central.`);
          }

          // Inserir em transferencia_itens
          await supabase.from('transferencia_itens').insert({
            user_id: user.id,
            transferencia_id: transferenciaId,
            item_id: item.itemId,
            quantidade_enviada: item.quantidade,
            preco_unitario: item.precoUnitario,
          });

          // Registrar movimentação ENVIO_FEIRA
          await supabase.from('estoque_movimentacoes').insert({
            user_id: user.id,
            item_id: item.itemId,
            tipo: 'ENVIO_FEIRA',
            quantidade: item.quantidade,
            motivo: `Adição à carga - #${transferenciaId.slice(0, 8)}`,
            transferencia_id: transferenciaId,
            local_id: central.id,
            estoque_antes: estoqueCentral?.quantidade || 0,
            estoque_depois: (estoqueCentral?.quantidade || 0) - item.quantidade,
          });

          // Atualizar estoque Central
          if (estoqueCentral) {
            await supabase
              .from('estoque_por_local')
              .update({ quantidade: estoqueCentral.quantidade - item.quantidade, updated_at: new Date().toISOString() })
              .eq('id', estoqueCentral.id);
          }

          // Atualizar/criar estoque Banca
          if (estoqueBanca) {
            await supabase
              .from('estoque_por_local')
              .update({ quantidade: estoqueBanca.quantidade + item.quantidade, updated_at: new Date().toISOString() })
              .eq('id', estoqueBanca.id);
          } else {
            await supabase.from('estoque_por_local').insert({
              user_id: user.id,
              item_id: item.itemId,
              local_id: banca.id,
              quantidade: item.quantidade,
              quantidade_reservada: 0,
            });
          }

        } else if (original) {
          // ITEM EXISTENTE: Verificar se quantidade mudou
          const qtdOriginal = Number(original.quantidade_enviada);
          const diferenca = item.quantidade - qtdOriginal;

          if (diferenca !== 0) {
            // Validar disponibilidade se aumentando
            if (diferenca > 0) {
              const disponivel = estoqueCentral?.quantidade || 0;
              if (disponivel < diferenca) {
                throw new Error(`${item.nome}: apenas ${disponivel} disponível no Central para adicionar.`);
              }
            }

            // Atualizar transferencia_itens
            await supabase
              .from('transferencia_itens')
              .update({ quantidade_enviada: item.quantidade })
              .eq('id', original.id);

            // Registrar movimentação
            const tipo = diferenca > 0 ? 'ENVIO_FEIRA' : 'ESTORNO_ENVIO';
            const motivo = diferenca > 0 
              ? `Aumento qtd carga - #${transferenciaId.slice(0, 8)}`
              : `Redução qtd carga - #${transferenciaId.slice(0, 8)}`;

            await supabase.from('estoque_movimentacoes').insert({
              user_id: user.id,
              item_id: item.itemId,
              tipo,
              quantidade: Math.abs(diferenca),
              motivo,
              transferencia_id: transferenciaId,
              local_id: central.id,
              estoque_antes: estoqueCentral?.quantidade || 0,
              estoque_depois: (estoqueCentral?.quantidade || 0) - diferenca,
            });

            // Atualizar estoques
            if (estoqueCentral) {
              await supabase
                .from('estoque_por_local')
                .update({ quantidade: estoqueCentral.quantidade - diferenca, updated_at: new Date().toISOString() })
                .eq('id', estoqueCentral.id);
            }

            if (estoqueBanca) {
              await supabase
                .from('estoque_por_local')
                .update({ quantidade: estoqueBanca.quantidade + diferenca, updated_at: new Date().toISOString() })
                .eq('id', estoqueBanca.id);
            }
          }
        }

        // Remover da lista de originais para detectar remoções
        mapItensOriginais.delete(item.itemId);
      }

      // Processar itens REMOVIDOS (estavam na carga original mas não estão mais)
      for (const [itemId, original] of mapItensOriginais) {
        const qtdOriginal = Number(original.quantidade_enviada);
        const estoqueCentral = mapEstoquesCentral.get(itemId);
        const estoqueBanca = mapEstoquesBanca.get(itemId);

        // Deletar de transferencia_itens
        await supabase
          .from('transferencia_itens')
          .delete()
          .eq('id', original.id);

        // Registrar movimentação de estorno
        await supabase.from('estoque_movimentacoes').insert({
          user_id: user.id,
          item_id: itemId,
          tipo: 'ESTORNO_ENVIO',
          quantidade: qtdOriginal,
          motivo: `Item removido da carga - #${transferenciaId.slice(0, 8)}`,
          transferencia_id: transferenciaId,
          local_id: central.id,
          estoque_antes: estoqueCentral?.quantidade || 0,
          estoque_depois: (estoqueCentral?.quantidade || 0) + qtdOriginal,
        });

        // Devolver ao Central
        if (estoqueCentral) {
          await supabase
            .from('estoque_por_local')
            .update({ quantidade: estoqueCentral.quantidade + qtdOriginal, updated_at: new Date().toISOString() })
            .eq('id', estoqueCentral.id);
        }

        // Remover da Banca
        if (estoqueBanca) {
          await supabase
            .from('estoque_por_local')
            .update({ quantidade: Math.max(0, estoqueBanca.quantidade - qtdOriginal), updated_at: new Date().toISOString() })
            .eq('id', estoqueBanca.id);
        }
      }

      // Sincronizar estoque_itens para todos os itens afetados
      await Promise.all(todosItemIds.map(id => sincronizarEstoqueTotal(id, user.id)));

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-feira'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
    },
  });
}

// Hook para criar transferência comum (Central <-> Loja) - USANDO RPC ATÔMICA
export function useCriarTransferencia() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      origemId,
      destinoId,
      itens,
      motivo,
      observacoes,
    }: {
      origemId: string;
      destinoId: string;
      itens: { itemId: string; quantidade: number }[];
      motivo: string;
      observacoes?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Preparar itens no formato esperado pela RPC
      const itensJson = itens.map(i => ({
        item_id: i.itemId,
        quantidade: i.quantidade
      }));

      // Chamar RPC atômica - tudo ou nada
      const { data, error } = await supabase.rpc('rpc_criar_transferencia', {
        p_origem_local_id: origemId,
        p_destino_local_id: destinoId,
        p_itens: itensJson,
        p_user_id: user.id,
        p_motivo: motivo,
        p_observacoes: observacoes || null
      });

      if (error) {
        console.error('[useCriarTransferencia] Erro RPC:', error);
        // Extrair mensagem amigável do erro
        const errorMsg = error.message || 'Erro ao criar transferência';
        throw new Error(errorMsg);
      }

      // Retornar o ID da transferência criada
      return { id: data as string };
    },
    onSuccess: () => {
      // Invalidar TODAS as queries de estoque com predicate para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-disponiveis-adicionar'] });
    },
  });
}

// Hook para calcular resumo da feira
export function useResumoFeira(data?: Date) {
  const { data: cargas, isLoading } = useCargasHoje();

  const calcularResumo = () => {
    if (!cargas || cargas.length === 0) {
      return {
        totalCarga: 0,
        totalRetorno: 0,
        totalVendido: 0,
        valorVendido: 0,
        cargasAtivas: 0,
        cargasConcluidas: 0,
      };
    }

    let totalCarga = 0;
    let totalRetorno = 0;
    let valorVendido = 0;

    cargas.forEach(carga => {
      carga.itens.forEach(item => {
        totalCarga += item.quantidadeEnviada;
        const retorno = item.quantidadeRetornada || 0;
        totalRetorno += retorno;
        const vendido = item.quantidadeEnviada - retorno;
        valorVendido += vendido * (item.precoUnitario || 0);
      });
    });

    return {
      totalCarga,
      totalRetorno,
      totalVendido: totalCarga - totalRetorno,
      valorVendido,
      cargasAtivas: cargas.filter(c => c.status === 'em_andamento').length,
      cargasConcluidas: cargas.filter(c => c.status === 'concluida').length,
    };
  };

  return {
    resumo: calcularResumo(),
    cargas: cargas || [],
    isLoading,
  };
}

// Hook para concluir transferência (chama RPC atômica)
export function useConcluirTransferencia() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transferenciaId }: { transferenciaId: string }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.rpc('rpc_concluir_transferencia', {
        p_transferencia_id: transferenciaId,
        p_user_id: user.id,
      });

      if (error) {
        console.error('[useConcluirTransferencia] Erro RPC:', error);
        throw new Error(error.message || 'Erro ao concluir transferência');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
    },
  });
}

// Hook para cancelar transferência (chama RPC)
export function useCancelarTransferencia() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transferenciaId }: { transferenciaId: string }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.rpc('rpc_cancelar_transferencia', {
        p_transferencia_id: transferenciaId,
        p_user_id: user.id,
      });

      if (error) {
        console.error('[useCancelarTransferencia] Erro RPC:', error);
        throw new Error(error.message || 'Erro ao cancelar transferência');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}

// Hook para atualizar motivo/observação de transferência pendente
export function useAtualizarTransferencia() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      transferenciaId, 
      motivo, 
      observacoes 
    }: { 
      transferenciaId: string; 
      motivo?: string | null;
      observacoes?: string | null;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const updateData: Record<string, unknown> = {};
      if (motivo !== undefined) updateData.motivo = motivo;
      if (observacoes !== undefined) updateData.observacoes = observacoes;

      const { error } = await supabase
        .from('transferencias')
        .update(updateData)
        .eq('id', transferenciaId)
        .eq('status', 'em_andamento'); // Só permite atualizar se em_andamento

      if (error) {
        console.error('[useAtualizarTransferencia] Erro:', error);
        throw new Error(error.message || 'Erro ao atualizar transferência');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}

// Filtros para busca de transferências
export interface FiltrosTransferencias {
  dataInicio?: Date;
  dataFim?: Date;
  origemId?: string;
  destinoId?: string;
  status?: string;
  motivo?: string;
}

// Hook para buscar transferências com filtros
export function useTransferenciasFiltradas(tipo: 'transferencia' | 'carga_feira' = 'transferencia', filtros?: FiltrosTransferencias) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transferencias', user?.id, tipo, filtros],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('transferencias')
        .select('*')
        .eq('tipo', tipo)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filtros?.dataInicio) {
        query = query.gte('created_at', filtros.dataInicio.toISOString());
      }
      if (filtros?.dataFim) {
        query = query.lte('created_at', filtros.dataFim.toISOString());
      }
      if (filtros?.origemId) {
        query = query.eq('local_origem_id', filtros.origemId);
      }
      if (filtros?.destinoId) {
        query = query.eq('local_destino_id', filtros.destinoId);
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros?.motivo) {
        query = query.eq('motivo', filtros.motivo);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as DbTransferencia[]).map(mapDbToTransferencia);
    },
    enabled: !!user,
  });
}
