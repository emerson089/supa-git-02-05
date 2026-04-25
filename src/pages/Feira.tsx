import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useDisponivelCentral, useLocais, useEnsureDefaultLocais, useSincronizarEstoqueInicial } from '@/hooks/useEstoqueLocais';
import { useCriarCargaFeira, useRegistrarRetornoFeira, useEditarCargaFeira, TransferenciaComItens } from '@/hooks/useTransferencias';
import { useRecalcularEstoque } from '@/hooks/useRecalcularEstoque';
import { useEstornarCarga } from '@/hooks/useEstornarCarga';
import { useEditarRetornoCarga } from '@/hooks/useEditarRetornoCarga';
import { PeriodoFeira, calcularPeriodo, useResumoFeiraPeriodo, useHistoricoAgrupado, useTodasCargasAtivas, useExcluirCargaFeira, useExcluirHistoricoCarga, TransferenciaComItensHistorico } from '@/hooks/useFeiraHistorico';
import { FiltroPeriodo, salvarFiltroPeriodo, carregarFiltroPeriodo } from '@/components/feira/FiltroPeriodo';
import { HistoricoAgrupado } from '@/components/feira/HistoricoAgrupado';
import { DetalhesCargaModal } from '@/components/feira/DetalhesCargaModal';
import { CargasAtivasAlerta } from '@/components/feira/CargasAtivasAlerta';
import { ExcluirCargaModal } from '@/components/feira/ExcluirCargaModal';
import { ExcluirHistoricoModal } from '@/components/feira/ExcluirHistoricoModal';
import { EstornarCargaModal } from '@/components/feira/EstornarCargaModal';
import { EditarRetornoCargaModal } from '@/components/feira/EditarRetornoCargaModal';
import { NovaCargaFeiraModal } from '@/components/feira/NovaCargaFeiraModal';
import { EditarCargaModal } from '@/components/feira/EditarCargaModal';
import { AddGradeCargaModal } from '@/components/feira/AddGradeCargaModal';
import { RetornoEmMassaModal } from '@/components/feira/RetornoEmMassaModal';
import { OfflineBanner } from '@/components/feira/OfflineBanner';
import { useFeiraOffline } from '@/hooks/useFeiraOffline';
import { RoleGate } from '@/components/RoleGate';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Package, Plus, Package2, Truck, RotateCcw, ShoppingBag, DollarSign, Loader2, Minus, X, Check, Search, Trash2, RefreshCw, AlertTriangle, FileText, TrendingUp } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateCargaPDF } from '@/utils/generateCargaPDF';
import { groupItensByModel } from '@/utils/productNameUtils';
import { loadFeiraDraft, saveFeiraDraft, clearFeiraDraft } from '@/utils/feiraDraft';

/** Distribui o retorno total de um modelo proporcionalmente entre seus tamanhos */
function distribuirRetornoProporcional(
  itens: { itemId: string; enviado: number }[],
  totalRetornado: number
): { itemId: string; quantidadeRetornada: number }[] {
  const totalEnviado = itens.reduce((s, i) => s + i.enviado, 0);
  const limitado = Math.min(totalRetornado, totalEnviado);
  if (totalEnviado === 0) return itens.map(i => ({ itemId: i.itemId, quantidadeRetornada: 0 }));
  let restante = limitado;
  return itens.map((item, idx) => {
    if (idx === itens.length - 1) {
      return { itemId: item.itemId, quantidadeRetornada: Math.min(restante, item.enviado) };
    }
    const prop = Math.min(Math.round(item.enviado / totalEnviado * limitado), item.enviado, restante);
    restante -= prop;
    return { itemId: item.itemId, quantidadeRetornada: prop };
  });
}
interface ItemCarga {
  itemId: string;
  nome: string;
  referencia: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
}
export default function Feira() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const {
    hasPermission,
    isVendedor
  } = useRole();
  const {
    getProdutosAcabados
  } = useEstoque();
  const {
    getDisponivelCentral: _getDisponivelCentral,
    estoquePorLocal,
    isLoading: isLoadingLocais
  } = useDisponivelCentral();
  const {
    data: locais
  } = useLocais();
  const ensureLocais = useEnsureDefaultLocais();
  const sincronizarEstoque = useSincronizarEstoqueInicial();
  const criarCarga = useCriarCargaFeira();
  const registrarRetorno = useRegistrarRetornoFeira();
  const editarCarga = useEditarCargaFeira();
  const excluirCarga = useExcluirCargaFeira();
  const excluirHistorico = useExcluirHistoricoCarga();
  const recalcularEstoque = useRecalcularEstoque();
  const estornarCarga = useEstornarCarga();
  const editarRetornoCarga = useEditarRetornoCarga();

  // Offline mode
  const {
    isOnline,
    isSyncing,
    queue: offlineQueue,
    pendingCount: offlinePendingCount,
    errorCount: offlineErrorCount,
    cacheCargas,
    getCachedCargas,
    saveOfflineRetorno,
    syncAll: syncOfflineRetornos,
  } = useFeiraOffline();

  // Estado do período - carregado do localStorage
  const [periodo, setPeriodo] = useState<PeriodoFeira>(() => carregarFiltroPeriodo());

  // Hooks de histórico baseados no período
  const {
    resumo,
    isLoading: isLoadingResumo
  } = useResumoFeiraPeriodo(periodo.inicio, periodo.fim);
  const {
    historico,
    isLoading: isLoadingHistorico
  } = useHistoricoAgrupado(periodo.inicio, periodo.fim);
  const {
    data: todasCargasAtivas
  } = useTodasCargasAtivas();

  // Modais e estados
  const [showNovaCarga, setShowNovaCarga] = useState(false);
  const [showRetorno, setShowRetorno] = useState(false);
  const [showRecalcularConfirm, setShowRecalcularConfirm] = useState(false);
  const [cargaSelecionada, setCargaSelecionada] = useState<TransferenciaComItens | null>(null);
  const [cargaDetalhes, setCargaDetalhes] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaExcluir, setCargaExcluir] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaExcluirHistorico, setCargaExcluirHistorico] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaEstornar, setCargaEstornar] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaCorrigirRetorno, setCargaCorrigirRetorno] = useState<TransferenciaComItensHistorico | null>(null);
  const [cargaEditar, setCargaEditar] = useState<TransferenciaComItensHistorico | null>(null);
  const [itensCarga, setItensCarga] = useState<ItemCarga[]>(() => {
    const draft = loadFeiraDraft(user?.id);
    return draft?.itensCarga ?? [];
  });
  const [tituloCarga, setTituloCarga] = useState(() => {
    const draft = loadFeiraDraft(user?.id);
    return draft?.tituloCarga ?? '';
  });
  const draftValidatedRef = useRef(false);
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [showRetornoEmMassa, setShowRetornoEmMassa] = useState(false);
  const [retornoEmMassaLoading, setRetornoEmMassaLoading] = useState(false);
  const [itensRetorno, setItensRetorno] = useState<{
    itemId: string;
    quantidadeRetornada: number;
  }[]>([]);

  const [inputRetornoValues, setInputRetornoValues] = useState<Record<string, string>>({});

  // Estados para busca e persistência no modal de retorno
  const [buscaRetorno, setBuscaRetorno] = useState('');
  const [retornosSalvos, setRetornosSalvos] = useState<Record<string, Record<string, string>>>({});
  const produtosAcabados = getProdutosAcabados();

  // Wrapper com fallback: quando não há registro em estoque_por_local (sincronização
  // incompleta), usa a quantidade de estoque_itens diretamente para evitar "Máximo: 0"
  const getDisponivelCentral = useCallback((itemId: string): number => {
    const temRegistro = estoquePorLocal.some(e => e.itemId === itemId);
    if (!temRegistro) {
      const item = produtosAcabados.find(p => p.id === itemId);
      return item?.quantidade ?? 0;
    }
    return _getDisponivelCentral(itemId);
  }, [_getDisponivelCentral, estoquePorLocal, produtosAcabados]);

  const periodoEhHoje = periodo.tipo === 'hoje';

  // Proteção contra loop infinito na criação de locais
  const [locaisCreationFailed, setLocaisCreationFailed] = useState(false);
  const locaisCreationAttempted = useRef(false);

  // Cargas ativas de HOJE (para mostrar na seção principal quando filtro = hoje)
  const cargasAtivasHoje = useMemo(() => (todasCargasAtivas || []).filter(c => isToday(new Date(c.dataSaida))), [todasCargasAtivas]);

  // Fechar modal - manter itens selecionados para persistência
  const handleCloseNovaCarga = () => {
    setShowNovaCarga(false);
  };

  // Abrir modal - mantém itens selecionados e refetch de estoque
  const handleOpenNovaCarga = () => {
    setShowNovaCarga(true);
    // Refetch silencioso para garantir estoque atualizado
    queryClient.refetchQueries({ queryKey: ['estoque-por-local'] });
    queryClient.refetchQueries({ queryKey: ['estoque-locais'] });
  };

  // Salvar período no localStorage quando mudar
  useEffect(() => {
    salvarFiltroPeriodo(periodo);
  }, [periodo]);

  // Persistir rascunho da Nova Carga (itens + título) no localStorage
  useEffect(() => {
    saveFeiraDraft(user?.id, itensCarga, tituloCarga);
  }, [itensCarga, tituloCarga, user?.id]);

  // Validar rascunho carregado contra produtos disponíveis (uma vez, após produtos carregarem)
  useEffect(() => {
    if (draftValidatedRef.current) return;
    if (!produtosAcabados || produtosAcabados.length === 0) return;
    if (itensCarga.length === 0) {
      draftValidatedRef.current = true;
      return;
    }
    const idsValidos = new Set(produtosAcabados.map(p => p.id));
    const validos = itensCarga.filter(i => idsValidos.has(i.itemId));
    const removidos = itensCarga.length - validos.length;
    if (removidos > 0) {
      setItensCarga(validos);
      toast.info(`${removidos} ${removidos === 1 ? 'item do rascunho foi removido' : 'itens do rascunho foram removidos'} (produtos não disponíveis)`);
    }
    draftValidatedRef.current = true;
  }, [produtosAcabados, itensCarga]);

  // Garantir que locais existem - com proteção contra loop infinito
  useEffect(() => {
    // Proteção: só tenta uma vez, e não tenta se já falhou
    if (locaisCreationAttempted.current || locaisCreationFailed) return;

    // Só tenta criar se temos certeza que não há locais (data loaded, array vazio)
    if (locais !== undefined && locais.length === 0 && !ensureLocais.isPending) {
      locaisCreationAttempted.current = true;
      console.log('[Feira] Tentando criar locais padrão...');
      ensureLocais.mutate(undefined, {
        onError: error => {
          console.warn('[Feira] Falha ao criar locais - possível problema de autenticação:', error);
          setLocaisCreationFailed(true);
        },
        onSuccess: () => {
          // Reset para permitir nova tentativa se necessário após logout/login
          locaisCreationAttempted.current = false;
        }
      });
    }
  }, [locais, ensureLocais.isPending, locaisCreationFailed]);

  // Sincronizar estoque inicial - aguardar locais existirem
  useEffect(() => {
    const hasRequiredLocais = locais && locais.length > 0 && locais.some(l => l.tipo === 'central') && locais.some(l => l.tipo === 'banca');
    if (hasRequiredLocais && !sincronizarEstoque.isPending) {
      sincronizarEstoque.mutate();
    }
  }, [locais]);
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const handleAddItemCarga = (produto: {
    id: string;
    nome: string;
    referencia?: string;
    precoUnitario: number | null;
    imagemUrl?: string | null;
  }, quantidade: number = 1): boolean => {
    const disponivel = getDisponivelCentral(produto.id);
    if (disponivel <= 0) {
      toast.error('Produto sem estoque disponível no Central');
      return false;
    }
    const existing = itensCarga.find(i => i.itemId === produto.id);
    if (existing) {
      toast.error('Produto já adicionado');
      return false;
    }

    // Usar quantidade passada, limitada ao disponível
    const qtdFinal = Math.min(quantidade, disponivel);
    setItensCarga(prev => [...prev, {
      itemId: produto.id,
      nome: produto.nome,
      referencia: produto.referencia || produto.nome,
      quantidade: qtdFinal,
      precoUnitario: produto.precoUnitario || 0,
      disponivelCentral: disponivel,
      imagemUrl: produto.imagemUrl ?? null
    }]);
    return true;
  };
  const handleAddGradeItems = (novosItens: ItemCarga[]) => {
    setItensCarga(prev => {
      const atualizados = [...prev];
      novosItens.forEach(novo => {
        const index = atualizados.findIndex(i => i.itemId === novo.itemId);
        if (index >= 0) {
          // Se já existe, soma as quantidades, respeitando o limite do central
          const itemExistente = atualizados[index];
          const novaQtd = Math.min(itemExistente.quantidade + novo.quantidade, itemExistente.disponivelCentral);
          atualizados[index] = {
            ...itemExistente,
            quantidade: novaQtd
          };
        } else {
          // Se não existe, adiciona novo
          atualizados.push(novo);
        }
      });
      return atualizados;
    });
    toast.success(`${novosItens.length} modelos de grade adicionados`);
  };
  const handleUpdateQuantidadeCarga = (itemId: string, delta: number) => {
    setItensCarga(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const novaQtd = item.quantidade + delta;
        // Validar limite máximo
        if (novaQtd > item.disponivelCentral) {
          toast.warning('Quantidade máxima disponível atingida');
          return item;
        }
        return {
          ...item,
          quantidade: Math.max(1, novaQtd)
        };
      }
      return item;
    }));
  };
  const handleSetQuantidadeCarga = (itemId: string, novaQuantidade: number) => {
    setItensCarga(prev => prev.map(item => {
      if (item.itemId === itemId) {
        // Permitir 0 temporariamente para digitação
        if (isNaN(novaQuantidade) || novaQuantidade < 0) {
          return {
            ...item,
            quantidade: 0
          };
        }
        // Validar limite máximo
        if (novaQuantidade > item.disponivelCentral) {
          toast.warning(`Máximo disponível: ${item.disponivelCentral}`);
          return {
            ...item,
            quantidade: item.disponivelCentral
          };
        }
        return {
          ...item,
          quantidade: novaQuantidade
        };
      }
      return item;
    }));
  };
  const handleRemoveItemCarga = (itemId: string) => {
    setItensCarga(prev => prev.filter(i => i.itemId !== itemId));
  };
  const handleCriarCarga = () => {
    // Proteção contra clique duplo e lista vazia
    if (itensCarga.length === 0 || criarCarga.isPending) {
      return;
    }
    const itensParaCriar = itensCarga.map(i => ({
      itemId: i.itemId,
      nome: i.nome,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      imagemUrl: i.imagemUrl,
    }));

    // Fechar modal IMEDIATAMENTE para feedback instantâneo
    handleCloseNovaCarga();

    // Executar criação em background com título como observacoes
    criarCarga.mutate({
      itens: itensParaCriar,
      observacoes: tituloCarga.trim() || undefined
    }, {
      onSuccess: () => {
        toast.success('Carga criada com sucesso!');
        setItensCarga([]); // Limpar apenas após criar com sucesso
        setTituloCarga(''); // Limpar título após sucesso
        clearFeiraDraft(user?.id); // Limpar rascunho persistido
      },
      onError: (error: any) => {
        toast.error(error.message || 'Erro ao criar carga');
      }
    });
  };

  const handleLimparRascunho = () => {
    if (itensCarga.length === 0 && !tituloCarga.trim()) return;
    if (!window.confirm('Descartar todos os itens do rascunho?')) return;
    setItensCarga([]);
    setTituloCarga('');
    clearFeiraDraft(user?.id);
    toast.success('Rascunho descartado');
  };

  // Converter TransferenciaComItensHistorico para TransferenciaComItens para o modal de retorno
  const convertToTransferenciaComItens = (carga: TransferenciaComItensHistorico): TransferenciaComItens => ({
    id: carga.id,
    localOrigemId: carga.localOrigemId,
    localDestinoId: carga.localDestinoId,
    localOrigemNome: carga.localOrigemNome ?? null,
    localDestinoNome: carga.localDestinoNome ?? null,
    userId: user?.id ?? '',
    tipo: carga.tipo as 'transferencia' | 'carga_feira',
    status: carga.status as 'em_andamento' | 'concluida' | 'cancelada',
    dataSaida: carga.dataSaida,
    dataRetorno: carga.dataRetorno,
    observacoes: carga.observacoes,
    motivo: null,
    dataConclusao: null,
    concluidoPor: null,
    createdAt: carga.createdAt,
    itens: carga.itens.map(item => ({
      id: item.id,
      transferenciaId: carga.id,
      itemId: item.itemId,
      quantidadeEnviada: item.quantidadeEnviada,
      quantidadeRetornada: item.quantidadeRetornada,
      precoUnitario: item.precoUnitario ?? item.produtoPreco,
      createdAt: carga.createdAt,
      produtoNome: item.produtoNome,
      produtoImagem: item.produtoImagem
    }))
  });
  const handleOpenRetorno = (carga: TransferenciaComItens) => {
    setCargaSelecionada(carga);
    setBuscaRetorno('');

    // Agrupar por modelo para inicializar state por grupo
    const grupos = groupItensByModel(carga.itens, {
      getItemId: (i) => i.itemId,
      getItemNome: (i) => (i as any).produtoNome || (i as any).item?.nome || '',
      getItemPreco: () => 0,
      getItemQtd: (i) => Number(i.quantidadeEnviada) || 0,
      getItemImagem: (i) => (i as any).produtoImagem || (i as any).item?.imagem_url || null,
      getItemReferencia: (i) => (i as any).produtoNome || (i as any).item?.nome || '',
    });

    const valoresSalvos = retornosSalvos[carga.id];
    if (valoresSalvos) {
      setInputRetornoValues(valoresSalvos);
    } else {
      // Inicializar como VAZIO por grupo — exige preenchimento explícito
      setInputRetornoValues(grupos.reduce((acc, g) => ({ ...acc, [g.refBase]: '' }), {}));
    }
    setItensRetorno(carga.itens.map(i => ({ itemId: i.itemId, quantidadeRetornada: 0 })));
    setShowRetorno(true);
  };
  const handleOpenRetornoFromHistorico = (carga: TransferenciaComItensHistorico) => {
    handleOpenRetorno(convertToTransferenciaComItens(carga));
  };

  // Handler para fechar modal de retorno (salva dados parciais)
  const handleCloseRetorno = () => {
    if (cargaSelecionada) {
      setRetornosSalvos(prev => ({
        ...prev,
        [cargaSelecionada.id]: inputRetornoValues
      }));
    }
    setShowRetorno(false);
  };
  const handleRegistrarRetorno = async () => {
    if (!cargaSelecionada) return;

    // Distribuir o retorno por grupo proporcionalmente entre os tamanhos
    const itensDistribuidos = gruposRetorno.flatMap(g => {
      const totalRet = parseInt(inputRetornoValues[g.refBase] || '0', 10) || 0;
      return distribuirRetornoProporcional(
        g.itens.map((i: any) => ({ itemId: i.itemId, enviado: Number(i.quantidadeEnviada) || 0 })),
        totalRet
      );
    });

    // ── Offline path: save locally and close modal ─────
    if (!isOnline) {
      saveOfflineRetorno(cargaSelecionada, itensDistribuidos);
      toast.success('Retorno salvo! Será sincronizado quando a internet voltar 📶');
      setShowRetorno(false);
      setCargaSelecionada(null);
      setItensRetorno([]);
      setRetornosSalvos(prev => {
        const novo = { ...prev };
        delete novo[cargaSelecionada.id];
        return novo;
      });
      return;
    }

    // ── Online path: normal Supabase mutation ──────────
    try {
      await registrarRetorno.mutateAsync({
        transferenciaId: cargaSelecionada.id,
        itensRetornados: itensDistribuidos
      });

      // Limpar dados salvos desta carga após sucesso
      setRetornosSalvos(prev => {
        const novo = { ...prev };
        delete novo[cargaSelecionada.id];
        return novo;
      });
      toast.success('Retorno registrado com sucesso!');
      
      // Notificar WhatsApp automaticamente
      const totalEnviado = cargaSelecionada.itens.reduce((sum, i) => sum + i.quantidadeEnviada, 0);
      const totalRetornado = itensDistribuidos.reduce((sum, i) => sum + i.quantidadeRetornada, 0);
      const totalVendido = totalEnviado - totalRetornado;
      
      const valorTotalVendido = cargaSelecionada.itens.reduce((sum, i) => {
        const ret = itensDistribuidos.find(id => id.itemId === i.itemId)?.quantidadeRetornada || 0;
        const vend = i.quantidadeEnviada - ret;
        const preco = i.precoUnitario || (i as any).produtoPreco || 0;
        return sum + (vend * preco);
      }, 0);

      await handleSendWhatsAppResumo({
        titulo: (cargaSelecionada as any).observacoes || 'Carga Sem Título',
        enviado: totalEnviado,
        retornado: totalRetornado,
        vendido: totalVendido,
        valorTotal: valorTotalVendido
      });

      setShowRetorno(false);
      setCargaSelecionada(null);
      setItensRetorno([]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar retorno');
    }
  };

  const handleSalvarEdicaoCarga = (transferenciaId: string, itens: any[], observacoes: string) => {
    editarCarga.mutate({
      transferenciaId,
      itens,
      observacoes
    }, {
      onSuccess: () => {
        toast.success('Carga atualizada com sucesso!');
        
        // Notificar WhatsApp sobre a edição com detalhes das mudanças (Opção C)
        if (cargaEditar) {
          const totalEnviadoAntigo = cargaEditar.itens.reduce((sum, i) => sum + (i.quantidadeEnviada || 0), 0);
          const totalEnviadoNovo = itens.reduce((sum, i) => sum + (i.quantidade || i.quantidadeEnviada || 0), 0);
          const deltaEnviado = totalEnviadoNovo - totalEnviadoAntigo;

          const totalRetornado = cargaEditar.itens?.reduce((s, i) => s + (i.quantidadeRetornada || 0), 0) || 0;
          const totalVendido = totalEnviadoNovo - totalRetornado;
          
          const valorTotal = itens.reduce((sum, i) => {
            const ret = cargaEditar.itens?.find(it => it.itemId === i.itemId)?.quantidadeRetornada || 0;
            const vend = (i.quantidade || i.quantidadeEnviada || 0) - ret;
            const preco = i.precoUnitario || i.produtoPreco || 0;
            return sum + (vend * preco);
          }, 0);

          // Calcular o que mudou item por item
          const mudancas: string[] = [];
          const oldItemsMap = new Map(cargaEditar.itens.map(i => [i.itemId, { nome: i.produtoNome, qtd: i.quantidadeEnviada }]));
          const newItemsMap = new Map(itens.map(i => [i.itemId, { nome: i.nome || i.produtoNome, qtd: i.quantidade || i.quantidadeEnviada }]));

          // Itens adicionados ou aumentados
          newItemsMap.forEach((val, id) => {
            const old = oldItemsMap.get(id);
            const diff = val.qtd - (old?.qtd || 0);
            if (diff > 0) {
              mudancas.push(`➕ ${diff}x ${val.nome}`);
            } else if (diff < 0) {
              mudancas.push(`➖ ${Math.abs(diff)}x ${val.nome}`);
            }
          });

          // Itens removidos completamente
          oldItemsMap.forEach((val, id) => {
            if (!newItemsMap.has(id)) {
              mudancas.push(`❌ Removido: ${val.nome} (${val.qtd} un)`);
            }
          });

          handleSendWhatsAppResumo({
            titulo: observacoes || cargaEditar.observacoes || 'Carga Sem Título',
            enviado: totalEnviadoNovo,
            retornado: totalRetornado,
            vendido: totalVendido,
            valorTotal,
            isEdicao: true,
            deltaEnviado,
            detalhesMudanca: mudancas.length > 0 ? mudancas.join('\n') : undefined
          });
        }
        
        setCargaEditar(null);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Erro ao editar carga');
      }
    });
  };

  const handleSendWhatsAppResumo = async (resumo: { 
    titulo: string; 
    enviado: number; 
    retornado: number; 
    vendido: number; 
    valorTotal: number; 
    isCorrecao?: boolean; 
    isEdicao?: boolean;
    deltaEnviado?: number;
    detalhesMudanca?: string;
  }) => {
    const metadata = user?.user_metadata || {};
    const adminNumbers = (metadata.notification_numbers || []) as string[];
    const notifyOnOrderGlobal = metadata.notify_on_order !== false;

    if (notifyOnOrderGlobal && adminNumbers.length > 0) {
      const valorFormatado = resumo.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const dataHora = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
      const porcVenda = resumo.enviado > 0 ? Math.round((resumo.vendido / resumo.enviado) * 100) : 0;
      
      let tituloPrefix = '🚀 RESUMO DE CARGA';
      if (resumo.isCorrecao) tituloPrefix = '📝 CORREÇÃO DE RETORNO';
      if (resumo.isEdicao) tituloPrefix = '✏️ EDIÇÃO DE CARGA';

      let enviadoStr = `${resumo.enviado}`;
      if (resumo.isEdicao && resumo.deltaEnviado !== undefined && resumo.deltaEnviado !== 0) {
        const sinal = resumo.deltaEnviado > 0 ? '+' : '';
        enviadoStr += ` (${sinal}${resumo.deltaEnviado})`;
      }

      let mensagem = `${tituloPrefix}: ${resumo.titulo.toUpperCase()}\n\n📦 Enviado : ${enviadoStr}\n🔄 Retorno : ${resumo.retornado}\n✅ Vendido : ${resumo.vendido}\n📈 % Vendido : ${porcVenda}%\n💰 Valor total : ${valorFormatado}`;

      if (resumo.isEdicao && resumo.detalhesMudanca) {
        mensagem += `\n\n**O QUE MUDOU NESTA EDIÇÃO:**\n${resumo.detalhesMudanca}`;
      }

      mensagem += `\n\n---------------------------\n📅 ${resumo.isCorrecao || resumo.isEdicao ? 'Atualizado em' : 'Finalizado em'}: ${dataHora}`;

      adminNumbers.forEach(async (adminPhone) => {
        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: { phone: adminPhone, message: mensagem },
          });
        } catch (err) {
          console.error('Erro ao notificar administrador:', adminPhone, err);
        }
      });
      
      toast.success('Gerência notificada via WhatsApp!');
    }
  };

  // Agrupar itens da carga selecionada por modelo (para o modal de retorno)
  const gruposRetorno = useMemo(() => {
    if (!cargaSelecionada) return [];
    return groupItensByModel(cargaSelecionada.itens, {
      getItemId: (i) => i.itemId,
      getItemNome: (i) => (i as any).produtoNome || '',
      getItemPreco: () => 0,
      getItemQtd: (i) => Number(i.quantidadeEnviada) || 0,
      getItemImagem: (i) => (i as any).produtoImagem,
      getItemReferencia: (i) => (i as any).produtoNome || '',
    });
  }, [cargaSelecionada]);

  // Filtro de grupos para o modal de retorno
  const itensRetornoFiltrados = useMemo(() => {
    if (!buscaRetorno.trim()) return gruposRetorno;
    const termo = buscaRetorno.toLowerCase().trim();
    return gruposRetorno.filter(g => g.nomeExibicao.toLowerCase().includes(termo));
  }, [gruposRetorno, buscaRetorno]);

  // Validação: todos os grupos devem ter um valor preenchido (incluindo "0" explícito)
  const todosItensPreenchidos = useMemo(() => {
    if (gruposRetorno.length === 0) return false;
    return gruposRetorno.every(g => {
      const val = inputRetornoValues[g.refBase];
      return val !== undefined && val !== '' && /^\d+$/.test(val);
    });
  }, [gruposRetorno, inputRetornoValues]);

  // Contagem de grupos pendentes
  const itensPendentes = useMemo(() => {
    return gruposRetorno.filter(g => {
      const val = inputRetornoValues[g.refBase];
      return val === '' || val === undefined;
    }).length;
  }, [gruposRetorno, inputRetornoValues]);
  const totalCarga = itensCarga.reduce((sum, i) => sum + i.quantidade, 0);
  const valorCarga = itensCarga.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0);

  // Handler para excluir carga (apenas em_andamento)
  const handleExcluirCarga = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'em_andamento') {
      toast.error('Apenas cargas em andamento podem ser excluídas');
      return;
    }
    setCargaExcluir(carga);
  };

  // Handler para estornar carga (apenas concluida)
  const handleEstornarCarga = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'concluida') {
      toast.error('Apenas cargas concluídas podem ser estornadas');
      return;
    }
    setCargaEstornar(carga);
  };

  // Handler para excluir carga do histórico (apenas estornada/cancelada)
  const handleExcluirHistorico = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'estornada' && carga.status !== 'cancelada') {
      toast.error('Apenas cargas estornadas ou canceladas podem ser removidas do histórico');
      return;
    }
    setCargaExcluirHistorico(carga);
  };

  // Handler para editar carga (apenas em_andamento)
  const handleEditarCarga = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'em_andamento') {
      toast.error('Apenas cargas em andamento podem ser editadas');
      return;
    }
    setCargaEditar(carga);
  };

  // Handler para corrigir retorno de carga concluída
  const handleCorrigirRetorno = (carga: TransferenciaComItensHistorico) => {
    if (carga.status !== 'concluida') {
      toast.error('Apenas cargas concluídas podem ter o retorno corrigido');
      return;
    }
    setCargaCorrigirRetorno(carga);
  };

  const handleRecalcularEstoque = async () => {
    try {
      const result = await recalcularEstoque.mutateAsync();
      toast.success(`Estoque recalculado! ${result.itensProcessados} itens, ${result.transferenciasProcessadas} transferências, ${result.movimentacoesCriadas} movimentações criadas.`);
      setShowRecalcularConfirm(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao recalcular estoque');
    }
  };

  // Handler para gerar PDF da carga
  const [generatingPDFId, setGeneratingPDFId] = useState<string | null>(null);
  const [pdfOptionsModal, setPdfOptionsModal] = useState<{
    isOpen: boolean;
    carga: TransferenciaComItensHistorico | null;
  }>({
    isOpen: false,
    carga: null
  });
  const [hideFinancials, setHideFinancials] = useState(false);
  const handleOpenPDFOptions = (carga: TransferenciaComItensHistorico) => {
    setPdfOptionsModal({
      isOpen: true,
      carga
    });
  };
  const handleConfirmGerarPDF = async () => {
    if (!pdfOptionsModal.carga || generatingPDFId) return;
    const carga = pdfOptionsModal.carga;
    setGeneratingPDFId(carga.id);
    setPdfOptionsModal({
      isOpen: false,
      carga: null
    });
    toast.info('Gerando PDF...');
    try {
      await generateCargaPDF(carga, {
        includeImages: true,
        hideFinancials
      });
      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPDFId(null);
    }
  };
  const isLoading = isLoadingLocais || isLoadingResumo;
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }
  return <div className="min-h-screen bg-background flex overflow-hidden">
    {isMobile && <MobileHeader title="Feira" />}
    {!isMobile && <AppSidebar />}

    <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", isMobile && "pt-14 pb-[calc(80px+env(safe-area-inset-bottom,0px))]")}>
      {/* Header - Desktop */}
      {!isMobile && <header className="px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">FEIRA</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(), "EEEE, d 'de' MMMM", {
                locale: ptBR
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RoleGate allowedRoles={['admin']}>
              <Button variant="outline" size="sm" onClick={() => setShowRecalcularConfirm(true)} disabled={recalcularEstoque.isPending} className="gap-2">
                <RefreshCw size={16} className={recalcularEstoque.isPending ? 'animate-spin' : ''} />
                Recalcular Estoque
              </Button>
            </RoleGate>
            <RoleGate requiredPermission="feira.create">
              <Button onClick={handleOpenNovaCarga} className="gap-2 relative">
                <Plus size={18} />
                Nova Carga
                {itensCarga.length > 0 && !showNovaCarga && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">
                    {itensCarga.length}
                  </Badge>
                )}
              </Button>
            </RoleGate>
          </div>
        </div>
      </header>}

      {/* Mobile Action Button - Hidden for vendedor */}
      {isMobile && !isVendedor && <div className="px-4 py-3">
        <Button onClick={handleOpenNovaCarga} className="w-full gap-2 relative">
          <Plus size={18} />
          Nova Carga
          {itensCarga.length > 0 && !showNovaCarga && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">
              {itensCarga.length}
            </Badge>
          )}
        </Button>
      </div>}

      <ScrollArea className="flex-1 overflow-hidden">
        <div className={cn("p-4 space-y-4", !isMobile && "p-6 space-y-6", isMobile && "pb-32")}>
          {/* Filtro de Período */}
          <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />

          {/* Offline Banner */}
          <OfflineBanner
            isOnline={isOnline}
            isSyncing={isSyncing}
            queue={offlineQueue}
            pendingCount={offlinePendingCount}
            errorCount={offlineErrorCount}
            onSyncNow={syncOfflineRetornos}
          />

          {/* Resumo do Período */}
          <div className={cn("grid gap-3 overflow-hidden", isMobile ? "grid-cols-2" : "grid-cols-5")}>
            <Card className="overflow-hidden bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50">
              <CardContent className={cn("p-4", isMobile && "p-3")}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50", isMobile && "p-1.5")}>
                    <Truck className={cn("h-5 w-5 text-blue-600", isMobile && "h-4 w-4")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Carga</p>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <p className={cn("font-bold text-blue-600", isMobile ? "text-lg" : "text-xl")}>{resumo.totalCarga} pç</p>
                      <p className="text-xs font-medium text-blue-600/60">{resumo.totalModelos} mod</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50">
              <CardContent className={cn("p-4", isMobile && "p-3")}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50", isMobile && "p-1.5")}>
                    <RotateCcw className={cn("h-5 w-5 text-amber-600", isMobile && "h-4 w-4")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Retorno</p>
                    <p className={cn("font-bold text-amber-600", isMobile ? "text-lg" : "text-xl")}>{resumo.totalRetorno}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50">
              <CardContent className={cn("p-4", isMobile && "p-3")}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50", isMobile && "p-1.5")}>
                    <ShoppingBag className={cn("h-5 w-5 text-emerald-600", isMobile && "h-4 w-4")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Vendido</p>
                    <p className={cn("font-bold text-emerald-600", isMobile ? "text-lg" : "text-xl")}>{resumo.totalVendido}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden bg-primary/5 border-primary/20">
              <CardContent className={cn("p-4", isMobile && "p-3")}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-primary/10", isMobile && "p-1.5")}>
                    <DollarSign className={cn("h-5 w-5 text-primary", isMobile && "h-4 w-4")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Valor</p>
                    <p className={cn("font-bold text-primary", isMobile ? "text-lg" : "text-xl")}>
                      {isMobile ? `${(resumo.valorVendido / 1000).toFixed(1)}k` : formatCurrency(resumo.valorVendido)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* 5th KPI: taxa de venda */}
            <Card className={cn("overflow-hidden border-violet-200/50", resumo.taxaVenda >= 80 ? "bg-emerald-50/50 dark:bg-emerald-950/20" : resumo.taxaVenda >= 50 ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-red-50/50 dark:bg-red-950/20")}>
              <CardContent className={cn("p-4", isMobile && "p-3")}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", isMobile && "p-1.5", resumo.taxaVenda >= 80 ? "bg-emerald-100 dark:bg-emerald-900/50" : resumo.taxaVenda >= 50 ? "bg-amber-100 dark:bg-amber-900/50" : "bg-red-100 dark:bg-red-900/50")}>
                    <TrendingUp className={cn("h-5 w-5", isMobile && "h-4 w-4", resumo.taxaVenda >= 80 ? "text-emerald-600" : resumo.taxaVenda >= 50 ? "text-amber-600" : "text-red-600")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Taxa Venda</p>
                    <p className={cn("font-bold", isMobile ? "text-lg" : "text-xl", resumo.taxaVenda >= 80 ? "text-emerald-600" : resumo.taxaVenda >= 50 ? "text-amber-600" : "text-red-600")}>
                      {resumo.totalCarga === 0 ? '—' : `${resumo.taxaVenda}%`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerta de Cargas Ativas */}
          <CargasAtivasAlerta
            cargasAtivas={todasCargasAtivas || []}
            onRegistrarRetorno={handleOpenRetornoFromHistorico}
            onRegistrarRetornoEmMassa={todasCargasAtivas && todasCargasAtivas.length >= 2 ? () => setShowRetornoEmMassa(true) : undefined}
            onEditarCarga={hasPermission('feira.edit') && !isVendedor ? handleEditarCarga : undefined}
            onGerarPDF={hasPermission('feira.generate_pdf') ? handleOpenPDFOptions : undefined}
            periodoEhHoje={periodoEhHoje}
            isGeneratingPDF={generatingPDFId !== null}
          />

          {/* Histórico Agrupado - Hidden for vendedor */}
          <RoleGate requiredPermission="feira.view_history">
            <HistoricoAgrupado historico={historico} onVerDetalhes={carga => setCargaDetalhes(carga)} onExcluirCarga={handleExcluirCarga} onEstornarCarga={handleEstornarCarga} onExcluirHistorico={handleExcluirHistorico} onGerarPDF={handleOpenPDFOptions} onEditarRetorno={handleCorrigirRetorno} isLoading={isLoadingHistorico} />
          </RoleGate>
        </div>
      </ScrollArea>
    </main>

    {isMobile && <BottomNavigation />}

    {/* Modal Detalhes da Carga */}
    <DetalhesCargaModal carga={cargaDetalhes} onClose={() => setCargaDetalhes(null)} onExcluirCarga={carga => {
      setCargaDetalhes(null);
      setCargaExcluir(carga);
    }} onEditarCarga={carga => {
      setCargaDetalhes(null);
      handleEditarCarga(carga);
    }} onRegistrarRetorno={carga => {
      setCargaDetalhes(null);
      // Preparar itens para o modal de retorno
      const itensParaRetorno = carga.itens.map(item => ({
        id: item.id,
        itemId: item.itemId,
        nome: item.produtoNome || '',
        quantidadeEnviada: item.quantidadeEnviada,
        quantidadeRetornada: item.quantidadeRetornada ?? item.quantidadeEnviada,
        preco: item.precoUnitario ?? item.produtoPreco ?? 0,
        imagem: item.produtoImagem
      }));
      setItensRetorno(itensParaRetorno);
      setCargaSelecionada({
        id: carga.id,
        itens: carga.itens.map(i => ({
          id: i.id,
          itemId: i.itemId,
          quantidadeEnviada: i.quantidadeEnviada,
          quantidadeRetornada: i.quantidadeRetornada,
          produtoNome: i.produtoNome, // Preservar para agrupamento
          produtoImagem: i.produtoImagem, // Preservar para agrupamento
          item: {
            id: i.itemId,
            nome: i.produtoNome || '',
            imagem_url: i.produtoImagem,
            preco_unitario: i.precoUnitario ?? i.produtoPreco ?? 0
          }
        }))
      } as any);
      setShowRetorno(true);
    }} />

    {/* Modal Excluir Carga (apenas para em_andamento) */}
    <ExcluirCargaModal carga={cargaExcluir} onClose={() => setCargaExcluir(null)} onConfirm={motivo => {
      if (!cargaExcluir) return;
      const transferenciaId = cargaExcluir.id;

      // Fechar modal IMEDIATAMENTE para feedback instantâneo
      setCargaExcluir(null);

      // Executar exclusão em background
      excluirCarga.mutate({
        transferenciaId,
        motivo
      }, {
        onSuccess: () => {
          toast.success('Carga excluída e estoque revertido');
        },
        onError: (error: any) => {
          toast.error(error.message || 'Erro ao excluir carga');
        }
      });
    }} isLoading={excluirCarga.isPending} />

    {/* Modal Estornar Carga (apenas para concluídas) */}
    <EstornarCargaModal carga={cargaEstornar} onClose={() => setCargaEstornar(null)} onConfirm={motivo => {
      if (!cargaEstornar) return;
      const transferenciaId = cargaEstornar.id;

      // Fechar modal IMEDIATAMENTE
      setCargaEstornar(null);

      // Executar estorno em background
      estornarCarga.mutate({
        transferenciaId,
        motivo
      }, {
        onSuccess: () => {
          toast.success('Carga estornada! Produtos devolvidos ao estoque Central.');
        },
        onError: (error: any) => {
          toast.error(error.message || 'Erro ao estornar carga');
        }
      });
    }} isLoading={false} />

    {/* Modal Excluir do Histórico (apenas para estornadas/canceladas) */}
    <ExcluirHistoricoModal carga={cargaExcluirHistorico} onClose={() => setCargaExcluirHistorico(null)} onConfirm={() => {
      if (!cargaExcluirHistorico) return;
      const transferenciaId = cargaExcluirHistorico.id;

      // Fechar modal IMEDIATAMENTE
      setCargaExcluirHistorico(null);

      // Executar exclusão em background
      excluirHistorico.mutate({
        transferenciaId
      }, {
        onSuccess: () => {
          toast.success('Carga removida do histórico');
        },
        onError: (error: any) => {
          toast.error(error.message || 'Erro ao excluir do histórico');
        }
      });
    }} isLoading={false} />

    {/* Modal Corrigir Retorno (apenas para concluídas) */}
    <EditarRetornoCargaModal 
      carga={cargaCorrigirRetorno} 
      produtos={produtosAcabados}
      getDisponivelCentral={getDisponivelCentral}
      onClose={() => setCargaCorrigirRetorno(null)} 
      onConfirm={(transferenciaId, itensCorrigidos, itensAdicionados, motivo, resumo) => {
        editarRetornoCarga.mutate({
          transferenciaId,
          itensCorrigidos,
          itensAdicionados,
          motivo
        }, {
          onSuccess: async () => {
            setCargaCorrigirRetorno(null);
            toast.success('Retorno corrigido com sucesso!');
            await handleSendWhatsAppResumo({
              ...resumo,
              isCorrecao: true
            });
          },
          onError: (error: any) => {
            toast.error(error.message || 'Erro ao corrigir retorno');
          }
        });
    }} isLoading={editarRetornoCarga.isPending} />

    {/* Modal Confirmar Recálculo de Estoque */}
    <Dialog open={showRecalcularConfirm} onOpenChange={setShowRecalcularConfirm}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Recalcular Estoque
          </DialogTitle>
          <DialogDescription>
            Esta ação irá reconstruir todo o histórico de movimentações e recalcular os saldos de estoque do zero.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            O sistema irá:
          </p>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            <li>Limpar movimentações existentes</li>
            <li>Recalcular estoque Central e Banca</li>
            <li>Recriar histórico de auditoria</li>
          </ul>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowRecalcularConfirm(false)}>
            Cancelar
          </Button>
          <Button onClick={handleRecalcularEstoque} disabled={recalcularEstoque.isPending} className="bg-amber-600 hover:bg-amber-700">
            {recalcularEstoque.isPending ? <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recalculando...
            </> : <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Confirmar Recálculo
            </>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal Nova Carga */}
    <NovaCargaFeiraModal
      open={showNovaCarga}
      onClose={handleCloseNovaCarga}
      itensCarga={itensCarga}
      onAddItems={handleAddGradeItems}
      onUpdateQtd={handleSetQuantidadeCarga}
      onRemoveItem={handleRemoveItemCarga}
      onCriarCarga={handleCriarCarga}
      getDisponivelCentral={getDisponivelCentral}
      formatCurrency={formatCurrency}
      titulo={tituloCarga}
      onTituloChange={setTituloCarga}
      totalCarga={totalCarga}
      valorCarga={valorCarga}
      isPending={criarCarga.isPending}
    />

    {/* Modal Retorno */}
    <Dialog open={showRetorno} onOpenChange={open => {
      if (!open) handleCloseRetorno();
    }}>
      <DialogContent className="w-full max-w-md h-[90vh] sm:h-[85vh] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden rounded-t-2xl sm:rounded-lg">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-lg text-center">Registrar Retorno</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground text-center">
            Informe quantas peças voltaram por modelo. Deixe 0 para modelos 100% vendidos.
          </DialogDescription>
        </DialogHeader>

        {/* Barra de busca fixa */}
        <div className="flex items-center justify-between shrink-0 px-4 py-2.5 border-b gap-3">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
            {itensRetornoFiltrados.length} de {gruposRetorno.length} modelo(s)
          </span>

          <div className="relative flex-1 max-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="text" placeholder="Buscar modelo..." value={buscaRetorno} onChange={e => setBuscaRetorno(e.target.value)} className="pl-8 h-8 text-base rounded-full" />
            {buscaRetorno && <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 rounded-full" onClick={() => setBuscaRetorno('')}>
              <X className="h-3 w-3" />
            </Button>}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
          {itensRetornoFiltrados.length === 0 && buscaRetorno ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {itensRetornoFiltrados.map(grupo => {
                const gKey = grupo.refBase;
                const inputValue = inputRetornoValues[gKey];
                const campoVazio = inputValue === '' || inputValue === undefined;
                const retornado = parseInt(inputValue || '0', 10) || 0;
                const vendido = grupo.quantidadeTotal - retornado;
                const tamanhos: string[] = grupo.tamanhos ?? [];

                return (
                  <div key={gKey} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    {/* Linha 1: Imagem + Nome/Tamanhos */}
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                        <LotImage
                          src={grupo.imagemUrl}
                          alt={grupo.nomeBase}
                          className="w-full h-full object-cover"
                          eager={true}
                        />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-medium leading-tight line-clamp-2">
                          {grupo.nomeExibicao}
                        </p>
                        {tamanhos.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {tamanhos.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Linha 2: Enviado + Retorno + Vendido */}
                    <div className="flex items-center justify-between gap-3 mt-3 pl-[76px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Env:</span>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {grupo.quantidadeTotal}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Ret:</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="—"
                          value={inputValue ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              setInputRetornoValues(prev => ({ ...prev, [gKey]: val }));
                            }
                          }}
                          onBlur={() => {
                            if (inputValue !== '' && inputValue !== undefined) {
                              const numVal = parseInt(inputValue, 10);
                              if (!isNaN(numVal)) {
                                const clampedVal = Math.max(0, Math.min(grupo.quantidadeTotal, numVal));
                                setInputRetornoValues(prev => ({ ...prev, [gKey]: String(clampedVal) }));
                              }
                            }
                          }}
                          className={cn(
                            "w-14 h-8 text-center text-base font-medium rounded-full border-2",
                            campoVazio
                              ? "border-amber-400 bg-white dark:bg-background"
                              : "border-input bg-white dark:bg-background"
                          )}
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Vend:</span>
                        <span className={cn(
                          "inline-flex items-center justify-center min-w-[40px] h-8 px-2 text-sm rounded-full font-semibold",
                          campoVazio
                            ? "bg-muted/60 text-muted-foreground"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        )}>
                          {campoVazio ? '—' : vendido}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer fixo com resumo */}
        <div className="border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shrink-0 bg-muted/30">
          {/* Aviso de itens pendentes */}
          {!todosItensPreenchidos && <p className="text-xs text-amber-600 mb-2 text-center font-medium">
            {itensPendentes} item(s) pendente(s) de preenchimento
          </p>}

          <div className="flex items-center justify-center mb-3">
            <div className="flex gap-4 text-xs">
              <span className="text-muted-foreground">
                Enviado: <strong className="text-foreground">{cargaSelecionada?.itens.reduce((sum, i) => sum + i.quantidadeEnviada, 0) || 0}</strong>
              </span>
              <span className="text-muted-foreground">
                Retorno: <strong className="text-amber-600">{itensRetorno.reduce((sum, i) => sum + i.quantidadeRetornada, 0)}</strong>
              </span>
              <span className="text-muted-foreground">
                Vendido: <strong className="text-emerald-600">{(cargaSelecionada?.itens.reduce((sum, i) => sum + i.quantidadeEnviada, 0) || 0) - itensRetorno.reduce((sum, i) => sum + i.quantidadeRetornada, 0)}</strong>
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCloseRetorno} className="flex-1 rounded-xl h-11">
              Cancelar
            </Button>
            <Button onClick={handleRegistrarRetorno} disabled={registrarRetorno.isPending || !todosItensPreenchidos} className="flex-1 rounded-xl h-11">
              {registrarRetorno.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Editar Carga */}
    <EditarCargaModal carga={cargaEditar} produtos={produtosAcabados} getDisponivelCentral={getDisponivelCentral} onClose={() => setCargaEditar(null)} onSalvar={handleSalvarEdicaoCarga} isPending={editarCarga.isPending} formatCurrency={formatCurrency} />

    {/* Modal Retorno em Massa */}
    <RetornoEmMassaModal
      open={showRetornoEmMassa}
      cargas={(todasCargasAtivas || []).map(c => ({
        transferenciaId: c.id,
        titulo: c.observacoes || '',
        horario: format(new Date(c.dataSaida), 'HH:mm'),
        itens: c.itens.map(i => ({
          itemId: i.itemId,
          produtoNome: i.produtoNome || '',
          produtoImagem: i.produtoImagem,
          quantidadeEnviada: i.quantidadeEnviada,
        })),
      }))}
      onClose={() => setShowRetornoEmMassa(false)}
      onConfirmar={async (retornos) => {
        setRetornoEmMassaLoading(true);
        try {
          for (const r of retornos) {
            await registrarRetorno.mutateAsync({
              transferenciaId: r.transferenciaId,
              itensRetornados: r.itens,
            });
            
            // Notificar WhatsApp para cada carga individualmente
            const cargaOriginal = todasCargasAtivas?.find(c => c.id === r.transferenciaId);
            if (cargaOriginal) {
              const totalEnviado = cargaOriginal.itens.reduce((sum, i) => sum + i.quantidadeEnviada, 0);
              const totalRetornado = r.itens.reduce((sum, i) => sum + i.quantidadeRetornada, 0);
              const totalVendido = totalEnviado - totalRetornado;
              const valorTotalVendido = cargaOriginal.itens.reduce((sum, i) => {
                const ret = r.itens.find(it => it.itemId === i.itemId)?.quantidadeRetornada || 0;
                const vend = i.quantidadeEnviada - ret;
                const preco = i.precoUnitario || (i as any).produtoPreco || 0;
                return sum + (vend * preco);
              }, 0);

              handleSendWhatsAppResumo({
                titulo: cargaOriginal.observacoes || 'Carga Sem Título',
                enviado: totalEnviado,
                retornado: totalRetornado,
                vendido: totalVendido,
                valorTotal: valorTotalVendido
              });
            }
          }
          toast.success(`Retorno registrado para ${retornos.length} carga(s)!`);
          setShowRetornoEmMassa(false);
        } catch (error: any) {
          toast.error(error.message || 'Erro ao registrar retorno em massa');
        } finally {
          setRetornoEmMassaLoading(false);
        }
      }}
      isLoading={retornoEmMassaLoading}
    />

    {/* Modal Opções do PDF */}
    <Dialog open={pdfOptionsModal.isOpen} onOpenChange={open => !open && setPdfOptionsModal({
      isOpen: false,
      carga: null
    })}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar PDF da Carga
          </DialogTitle>
          <DialogDescription>
            Configure as opções antes de gerar o PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={hideFinancials ? "simples" : "completo"}
            onValueChange={(val) => setHideFinancials(val === "simples")}
            className="grid gap-3"
          >
            {/* Template Completo */}
            <Label
              htmlFor="pdf-completo"
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all",
                !hideFinancials ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <RadioGroupItem value="completo" id="pdf-completo" />
                <span className="font-semibold text-sm ml-1">PDF Completo</span>
                {!hideFinancials && <Badge variant="secondary" className="ml-auto text-[10px] bg-primary/10 text-primary">Recomendado</Badge>}
              </div>
              <p className="text-xs text-muted-foreground ml-7 leading-relaxed">
                Inclui valores financeiros totais e unitários. Ideal para o caixa ou conferência interna da empresa.
              </p>
            </Label>

            {/* Template Simples */}
            <Label
              htmlFor="pdf-simples"
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all",
                hideFinancials ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <RadioGroupItem value="simples" id="pdf-simples" />
                <span className="font-semibold text-sm ml-1">PDF Simples (Sem Valores)</span>
              </div>
              <p className="text-xs text-muted-foreground ml-7 leading-relaxed">
                Mostra apenas produto, código e quantidade. Ideal para o motorista entregar na banca para conferência de estoque.
              </p>
            </Label>
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setPdfOptionsModal({
            isOpen: false,
            carga: null
          })}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmGerarPDF} disabled={generatingPDFId !== null} className="gap-2">
            {generatingPDFId ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* Modal Grade para Carga */}
    <AddGradeCargaModal
      open={showAddGrade}
      onClose={() => setShowAddGrade(false)}
      onAdd={handleAddGradeItems}
      getDisponivelCentral={getDisponivelCentral}
    />
  </div>;
}