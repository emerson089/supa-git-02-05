import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ViewMode, ChecklistAprontamento } from '@/types/production';
import { Producao, ProducaoData, ProducaoInsert, ProducaoUpdate } from '@/entities/Producao';
import { ProducaoLog } from '@/entities/ProducaoLog';
import { STAGES, getNextStage, getPrevStage } from '@/data/production-data';
import { callWithRetry } from '@/utils/retry';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { ProductionHeader } from '@/components/production/ProductionHeader';
import { KanbanBoard } from '@/components/production/KanbanBoard';
import { MobileKanban } from '@/components/production/MobileKanban';
import { ListView } from '@/components/production/ListView';
import { CustosLoteModal } from '@/components/production/CustosLoteModal';
import { AprontamentoChecklist, isChecklistComplete } from '@/components/production/AprontamentoChecklist';
import { ImportProducaoCSVModal } from '@/components/production/ImportProducaoCSVModal';
import { ImportCustosCSVModal } from '@/components/production/ImportCustosCSVModal';
import { HistoricoProducaoModal } from '@/components/production/HistoricoProducaoModal';
import { StageTransitionModal, StageTransitionData } from '@/components/production/StageTransitionModal';
import { QualidadeModal, QualidadeData } from '@/components/production/QualidadeModal';
import ProducaoForm from '@/components/producao/ProducaoForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useResponsaveisUnicos, FiltrosProducao } from '@/hooks/useProducaoPorEtapa';
import { useRealtimeProducao } from '@/hooks/useRealtimeProducao';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { getSignedUrl, getImageAsBase64 } from '@/utils/imageUtils';

const Index = () => {
  // Iniciar escuta realtime para produção
  useRealtimeProducao();
  const { integrarProducao } = useEstoque();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [lots, setLots] = useState<ProducaoData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // URL-based state for search and filters (persists across navigation)
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const filtros: FiltrosProducao = {
    prioridade: (searchParams.get('prioridade') as FiltrosProducao['prioridade']) || 'todos',
    responsavel: searchParams.get('responsavel') || undefined
  };

  // Helper to update URL params
  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === 'todos') {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Handlers for search and filters
  const handleSearchChange = useCallback((value: string) => {
    updateParams({ q: value || undefined });
  }, [updateParams]);

  const handleFiltrosChange = useCallback((newFiltros: FiltrosProducao) => {
    updateParams({
      prioridade: newFiltros.prioridade === 'todos' ? undefined : newFiltros.prioridade,
      responsavel: newFiltros.responsavel
    });
  }, [updateParams]);
  
  // Debounce search for performance
  const debouncedSearch = useDebouncedValue(search, 300);
  
  // Buscar responsáveis únicos para o filtro
  const { data: responsaveisDisponiveis = [] } = useResponsaveisUnicos();
  
  // Modal control
  const [showForm, setShowForm] = useState(false);
  const [editingLote, setEditingLote] = useState<ProducaoData | null>(null);
  
  // Costs modal
  const [showCustosModal, setShowCustosModal] = useState(false);
  const [selectedLoteForCustos, setSelectedLoteForCustos] = useState<ProducaoData | null>(null);
  
  // Checklist modal
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedLoteForChecklist, setSelectedLoteForChecklist] = useState<ProducaoData | null>(null);
  
  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Import custos modal
  const [showImportCustosModal, setShowImportCustosModal] = useState(false);
  
  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedLoteForHistory, setSelectedLoteForHistory] = useState<ProducaoData | null>(null);

  // Stage transition modal
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionLot, setTransitionLot] = useState<ProducaoData | null>(null);
  const [transitionTarget, setTransitionTarget] = useState('');
  const [transitionLoading, setTransitionLoading] = useState(false);

  // Qualidade modal (Aprontamento → Vendas)
  const [showQualidadeModal, setShowQualidadeModal] = useState(false);
  const [qualidadeLot, setQualidadeLot] = useState<ProducaoData | null>(null);
  const [qualidadeLoading, setQualidadeLoading] = useState(false);

  // Fetch data from database
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await callWithRetry(() => Producao.list("-created_date", 100));
      setLots(data || []);
    } catch (error) {
      console.error("Erro ao carregar:", error);
      toast.error("Erro ao carregar lotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save lot (create or update)
  const handleSave = async (dadosDoForm: ProducaoInsert | ProducaoUpdate) => {
    try {
      if (editingLote) {
        await callWithRetry(() => Producao.update(editingLote.id, dadosDoForm));
        toast.success("Lote atualizado com sucesso!");
      } else {
        const newLot = await callWithRetry(() => Producao.create(dadosDoForm as ProducaoInsert));
        // Criar log inicial para registrar o cortador
        if (newLot) {
          try {
            await ProducaoLog.create({
              producao_id: newLot.id,
              processo_anterior: undefined,
              processo_novo: 'Corte',
              responsavel: (dadosDoForm as ProducaoInsert).responsavel || undefined,
            });
          } catch (logErr) {
            console.error('Erro ao criar log inicial:', logErr);
          }
        }
        toast.success("Lote criado com sucesso!");
      }
      setShowForm(false);
      setEditingLote(null);
      fetchData();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      const message = err?.message || "Erro ao salvar lote";
      toast.error(message);
    }
  };

  // Delete lot
  const handleDeleteCard = async (lot: ProducaoData) => {
    try {
      // Optimistic update
      setLots(prev => prev.filter(l => l.id !== lot.id));
      
      await callWithRetry(() => Producao.delete(lot.id));
      toast.success(`Lote ${lot.id_producao} excluído`);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir lote");
      fetchData(); // Revert on error
    }
  };

  // Move card between stages (updates real database)
  const moveCard = async (lot: ProducaoData, direction: 'next' | 'prev') => {
    const currentStage = lot.processo_atual;
    const newStage = direction === 'next' 
      ? getNextStage(currentStage) 
      : getPrevStage(currentStage);

    if (!newStage) return;

    await handleStageChange(lot, newStage);
  };

  // Move card via drag-and-drop to specific stage
  const handleDragMove = async (lot: ProducaoData, targetStage: string) => {
    if (lot.processo_atual === targetStage) return;
    await handleStageChange(lot, targetStage);
  };

  // Shared logic for stage changes — now opens transition modal
  const handleStageChange = async (lot: ProducaoData, newStage: string) => {
    const currentStage = lot.processo_atual;

    // Aprontamento → Vendas: abre modal de qualidade especializado
    if (currentStage === 'Aprontamento' && newStage === 'Vendas') {
      const checklist = lot.checklist_aprontamento;
      if (!isChecklistComplete(checklist)) {
        toast.error('Complete o checklist de Aprontamento antes de mover para Vendas!');
        setSelectedLoteForChecklist(lot);
        setShowChecklistModal(true);
        return;
      }
      // Open quality modal instead of standard transition modal
      setQualidadeLot(lot);
      setShowQualidadeModal(true);
      return;
    }

    // Open transition modal instead of moving directly
    setTransitionLot(lot);
    setTransitionTarget(newStage);
    setShowTransitionModal(true);
  };

  // Execute the actual stage move after modal confirmation
  const executeStageMove = async (data: StageTransitionData) => {
    if (!transitionLot || !transitionTarget) return;

    const lot = transitionLot;
    const newStage = transitionTarget;
    const currentStage = lot.processo_atual;

    setTransitionLoading(true);

    // Extrair quantidade se informada (suporta chaves 'pecas' ou 'qtd_pecas')
    const informouQuantidade = data.extras?.pecas || data.extras?.qtd_pecas;
    const novaQuantidade = informouQuantidade ? parseInt(informouQuantidade) : null;
    const quantidadeValida = novaQuantidade !== null && !isNaN(novaQuantidade) && novaQuantidade > 0 ? novaQuantidade : null;

    // Optimistic update
    const originalLots = [...lots];
    setLots(prev => prev.map(l => 
      l.id === lot.id ? { 
        ...l, 
        processo_atual: newStage,
        responsavel: data.responsavel || l.responsavel,
        quantidade: quantidadeValida !== null ? quantidadeValida : l.quantidade
      } : l
    ));

    try {
      // Update database with new stage + responsavel + quantidade
      const updateData: Record<string, any> = { processo_atual: newStage };
      if (data.responsavel) {
        updateData.responsavel = data.responsavel;
      }
      
      if (quantidadeValida !== null) {
        updateData.quantidade = quantidadeValida;
      }

      // Sincronizar checklist ao entrar em Aprontamento
      if (newStage === 'Aprontamento' && data.extras) {
        updateData.checklist_aprontamento = {
          botao: !!data.extras.botao && parseInt(data.extras.botao) > 0,
          bolsa: data.extras.bolsa_transparente === 'Sim',
          cordao: data.extras.cordao === 'Sim',
          tag: data.extras.tag === 'Sim',
          placa_marca: data.extras.placa_marca === 'Sim',
        };
      }

      await callWithRetry(() => Producao.update(lot.id, updateData));

      // Build observacao with extras
      const obsParts: string[] = [];

      // When leaving Corte, preserve the cortador's name before lot.responsavel is overwritten
      if (currentStage === 'Corte' && lot.responsavel && lot.responsavel !== data.responsavel) {
        obsParts.push(`Cortador: ${lot.responsavel}`);
      }

      if (data.extras) {
        const labelMap: Record<string, string> = {
          rolos:      'Rolos',
          pecas:      'Peças cortadas',
          numeracao:  'Numeração',
          cor_linha:  'Cor da linha',
          qtd_ziper:  'Zíper (qtd)',
          tipo_ziper: 'Zíper (tipo/tamanho)',
          abanhado:   'Abanhado',
          etiquetas:  'Etiquetas',
          forro:      'Forro',
          tipo_lavado:       'Tipo de lavado',
          cor_resultado:     'Cor do resultado',
          qtd_pecas:         'Peças',
          processo_especial: 'Processo especial',
          botao:              'Botão',
          bolsa_transparente: 'Bolsa transparente',
          cordao:             'Cordão',
          placa_marca:        'Placa da marca',
          tag:                'Tag',
        };
        Object.entries(data.extras).forEach(([key, value]) => {
          // Skip boolean fields when "Não" — no need to record the negative default
          if (value && value !== 'Não') {
            obsParts.push(`${labelMap[key] || key}: ${value}`);
          }
        });
      }
      if (data.observacao) {
        obsParts.push(data.observacao);
      }

      // Log the movement
      await callWithRetry(() => ProducaoLog.create({
        producao_id: lot.id,
        processo_anterior: currentStage,
        processo_novo: newStage,
        responsavel: data.responsavel || lot.responsavel,
        observacao: obsParts.length > 0 ? obsParts.join(' | ') : undefined
      }));

      // Close modal
      setShowTransitionModal(false);
      setTransitionLot(null);
      setTransitionTarget('');

      if (newStage === 'Vendas') {
        toast.success('Lote movido para Vendas. Abra os Custos para enviar ao estoque com custo médio.');
      } else {
        toast.success(`Movido para ${STAGES.find(s => s.id === newStage)?.label}`);
      }

      // Abrir checklist automaticamente ao entrar em Aprontamento (apenas se não foi preenchido na transição)
      if (newStage === 'Aprontamento') {
        const checklist = updateData.checklist_aprontamento;
        const isComplete = checklist && checklist.botao && checklist.bolsa && checklist.cordao && checklist.tag && checklist.placa_marca;
        
        if (!isComplete) {
          const updatedLot = { 
            ...lot, 
            processo_atual: newStage, 
            responsavel: data.responsavel || lot.responsavel,
            checklist_aprontamento: checklist
          };
          setSelectedLoteForChecklist(updatedLot);
          setShowChecklistModal(true);
        }
      }
    } catch (error) {
      console.error("Erro ao mover card:", error);
      toast.error("Erro ao mover lote");
      setLots(originalLots);
    } finally {
      setTransitionLoading(false);
    }
  };

  // Execute quality check move (Aprontamento → Vendas)
  const executeQualidadeMove = async (data: QualidadeData) => {
    if (!qualidadeLot) return;
    const lot = qualidadeLot;
    setQualidadeLoading(true);

    const originalLots = lots;
    // Optimistic update
    setLots(prev => prev.map(l => l.id === lot.id ? {
      ...l,
      processo_atual: 'Vendas',
      quantidade: data.quantidade_aprovada,
      quantidade_final: data.quantidade_final,
      pecas_com_defeito: data.pecas_com_defeito,
      quantidade_aprovada: data.quantidade_aprovada,
      status_defeitos: data.pecas_com_defeito > 0 ? 'pendente_conserto' : null,
    } : l));

    try {
      await callWithRetry(() => Producao.updateQualidade(lot.id, {
        quantidade_final: data.quantidade_final,
        pecas_com_defeito: data.pecas_com_defeito,
        quantidade_aprovada: data.quantidade_aprovada,
        status_defeitos: data.pecas_com_defeito > 0 ? 'pendente_conserto' : null,
      }));

      // Update stage
      await callWithRetry(() => Producao.update(lot.id, { processo_atual: 'Vendas' }));

      // Log
      const obsParts = [
        `Qtd final: ${data.quantidade_final}`,
        `Defeitos: ${data.pecas_com_defeito}`,
        `Aprovadas: ${data.quantidade_aprovada}`,
      ];
      if (data.observacao) obsParts.push(data.observacao);

      await callWithRetry(() => ProducaoLog.create({
        producao_id: lot.id,
        processo_anterior: 'Aprontamento',
        processo_novo: 'Vendas',
        responsavel: lot.responsavel,
        observacao: obsParts.join(' | '),
      }));

      setShowQualidadeModal(false);
      setQualidadeLot(null);

      if (data.pecas_com_defeito > 0) {
        toast.success(
          `Lote enviado para Vendas! ${data.pecas_com_defeito} peça(s) registrada(s) para conserto.`,
          { duration: 5000 }
        );
      } else {
        toast.success('Lote movido para Vendas. Abra os Custos para enviar ao estoque.');
      }
    } catch (error: any) {
      console.error('Erro ao mover para Vendas:', error);
      const errorMessage = error?.message || error?.details || 'Erro interno desconhecido';
      toast.error(`Falha no DB: ${errorMessage}`);
      setLots(originalLots);
    } finally {
      setQualidadeLoading(false);
    }
  };

  // Handle checklist update
  const handleChecklistUpdate = (checklist: ChecklistAprontamento) => {
    if (selectedLoteForChecklist) {
      setLots(prev => prev.map(l => 
        l.id === selectedLoteForChecklist.id 
          ? { ...l, checklist_aprontamento: checklist } 
          : l
      ));
    }
  };

  // Handle progress update
  const handleUpdateProgress = (lotId: string, pecasConcluidas: number) => {
    setLots(prev => prev.map(l => 
      l.id === lotId ? { ...l, pecas_concluidas: pecasConcluidas } : l
    ));
  };

  // Handle open checklist
  const handleOpenChecklist = (lot: ProducaoData) => {
    setSelectedLoteForChecklist(lot);
    setShowChecklistModal(true);
  };

  // Handle edit card
  const handleEditCard = (lot: ProducaoData) => {
    setEditingLote(lot);
    setShowForm(true);
  };

  // Handle manage costs
  const handleManageCosts = (lot: ProducaoData) => {
    setSelectedLoteForCustos(lot);
    setShowCustosModal(true);
  };

  // Handle open history
  const handleOpenHistory = (lot: ProducaoData) => {
    setSelectedLoteForHistory(lot);
    setShowHistoryModal(true);
  };

  // Handle new lot
  const handleNewLot = () => {
    setEditingLote(null);
    setShowForm(true);
  };

  // Export production to CSV
  const handleExportProducao = () => {
    if (lots.length === 0) {
      toast.error('Não há lotes para exportar.');
      return;
    }

    const headers = ['Referência', 'Modelo', 'Quantidade', 'Etapa Atual', 'Responsável', 'Prioridade', 'Peças Concluídas', 'Observações', 'Data Criação'];
    
    const rows = lots.map(lot => [
      lot.id_producao,
      lot.modelo_nome_cache || '',
      lot.quantidade.toString(),
      lot.processo_atual,
      lot.responsavel || '',
      lot.prioridade || 'normal',
      (lot.pecas_concluidas || 0).toString(),
      lot.observacoes || '',
      format(new Date(lot.created_date), 'dd/MM/yyyy HH:mm')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `producao_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${lots.length} lotes exportados com sucesso!`);
  };

  // Export production to PDF with images
  const handleExportProducaoPDF = async () => {
    if (lots.length === 0) {
      toast.error('Não há lotes para exportar.');
      return;
    }

    toast.info('Gerando PDF com imagens... Isso pode levar alguns segundos.');
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Title
      doc.setFontSize(18);
      doc.text('Lotes de Produção', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Exportado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${lots.length} lotes`, pageWidth / 2, 28, { align: 'center' });
      
      let yPosition = 45;
      const itemsPerRow = 3;
      const cardWidth = 55;
      const cardHeight = 72;
      const imageHeight = 38;
      const margin = 15;
      const spacing = 5;
      
      // Stage colors
      const stageColors: Record<string, [number, number, number]> = {
        'Corte': [59, 130, 246],
        'Preparação': [168, 85, 247],
        'Costura': [34, 197, 94],
        'Acabamento': [249, 115, 22],
        'Aprontamento': [236, 72, 153],
        'Vendas': [20, 184, 166],
      };
      
      for (let i = 0; i < lots.length; i++) {
        const lot = lots[i];
        const col = i % itemsPerRow;
        const xPosition = margin + (col * (cardWidth + spacing));
        
        // New page if needed
        if (i > 0 && col === 0 && yPosition + cardHeight > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Draw card background
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(xPosition, yPosition, cardWidth, cardHeight, 3, 3, 'F');
        
        // Stage badge
        const stageColor = stageColors[lot.processo_atual] || [100, 100, 100];
        doc.setFillColor(stageColor[0], stageColor[1], stageColor[2]);
        doc.roundedRect(xPosition + 2, yPosition + 2, cardWidth - 4, 6, 1, 1, 'F');
        doc.setFontSize(5);
        doc.setTextColor(255, 255, 255);
        doc.text(lot.processo_atual, xPosition + cardWidth / 2, yPosition + 6, { align: 'center' });
        
        // Fetch and add image
        if (lot.imagem_url) {
          try {
            const signedUrl = await getSignedUrl(lot.imagem_url);
            if (signedUrl) {
              const base64 = await getImageAsBase64(signedUrl);
              if (base64) {
                doc.addImage(base64, 'JPEG', xPosition + 2, yPosition + 10, cardWidth - 4, imageHeight - 4, undefined, 'MEDIUM');
              }
            }
          } catch (e) {
            console.error('Erro ao carregar imagem:', e);
          }
        } else {
          // Placeholder for no image
          doc.setFillColor(220, 220, 220);
          doc.rect(xPosition + 2, yPosition + 10, cardWidth - 4, imageHeight - 4, 'F');
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Sem imagem', xPosition + cardWidth / 2, yPosition + imageHeight / 2 + 6, { align: 'center' });
        }
        
        // Lot data
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        doc.setFont(undefined, 'bold');
        doc.text(lot.id_producao, xPosition + 2, yPosition + imageHeight + 12);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(6);
        const modelo = (lot.modelo_nome_cache || 'Sem modelo').substring(0, 25);
        doc.text(modelo, xPosition + 2, yPosition + imageHeight + 18);
        
        doc.setTextColor(100, 100, 100);
        doc.text(`Qtd: ${lot.quantidade} pçs`, xPosition + 2, yPosition + imageHeight + 24);
        
        if (lot.responsavel) {
          doc.text(`Resp: ${lot.responsavel.substring(0, 15)}`, xPosition + 2, yPosition + imageHeight + 30);
        }
        
        // Next row
        if (col === itemsPerRow - 1) {
          yPosition += cardHeight + spacing;
        }
      }
      
      doc.save(`producao_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
      toast.success(`${lots.length} lotes exportados em PDF!`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  // Export costs to CSV
  const handleExportCustos = async () => {
    try {
      // Fetch all lots
      const { data: lotesData, error: lotesError } = await supabase
        .from('producao')
        .select('id, id_producao, modelo_nome_cache, quantidade');

      if (lotesError) throw lotesError;
      if (!lotesData || lotesData.length === 0) {
        toast.error('Não há lotes para exportar custos.');
        return;
      }

      // Fetch all cost configs
      const { data: configs, error: configError } = await supabase
        .from('lote_custos_config')
        .select('*');

      if (configError) throw configError;

      // Fetch all cost items
      const { data: itens, error: itensError } = await supabase
        .from('lote_custos_itens')
        .select('*');

      if (itensError) throw itensError;

      // Create lookup maps
      const configMap = new Map(configs?.map(c => [c.producao_id, c]) || []);
      const itensMap = new Map<string, typeof itens>();
      itens?.forEach(item => {
        const existing = itensMap.get(item.producao_id) || [];
        itensMap.set(item.producao_id, [...existing, item]);
      });

      // Build CSV rows
      const headers = [
        'Referência', 'Modelo', 'Quantidade', 'Metros Tecido', 'Valor/Metro', 
        'Preço Venda', 'Tipo Custo', 'Descrição Custo', 'Valor Unitário', 
        'Pago', 'Data Pagamento'
      ];

      const rows: string[][] = [];

      for (const lote of lotesData) {
        const config = configMap.get(lote.id);
        const custoItens = itensMap.get(lote.id) || [];

        if (custoItens.length > 0) {
          // One row per cost item
          for (const item of custoItens) {
            rows.push([
              lote.id_producao,
              lote.modelo_nome_cache || '',
              lote.quantidade?.toString() || '0',
              config?.metros_corte?.toString() || '0',
              config?.valor_metro?.toString() || '0',
              config?.preco_venda?.toString() || '0',
              item.tipo || '',
              item.descricao || '',
              item.valor_unitario?.toString() || '0',
              item.is_paid ? 'Sim' : 'Não',
              item.data_pagamento ? format(new Date(item.data_pagamento), 'dd/MM/yyyy') : ''
            ]);
          }
        } else if (config) {
          // Only config, no cost items
          rows.push([
            lote.id_producao,
            lote.modelo_nome_cache || '',
            lote.quantidade?.toString() || '0',
            config.metros_corte?.toString() || '0',
            config.valor_metro?.toString() || '0',
            config.preco_venda?.toString() || '0',
            '', '', '0', 'Não', ''
          ]);
        }
      }

      if (rows.length === 0) {
        toast.error('Não há custos configurados para exportar.');
        return;
      }

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `custos_producao_${format(new Date(), 'dd-MM-yyyy')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${rows.length} registros de custos exportados com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar custos:', error);
      toast.error('Erro ao exportar custos');
    }
  };

  // Filter lots (memoizado para evitar re-cálculos)
  const filteredLots = useMemo(() => {
    return lots.filter(l => {
      // Filtro de busca por texto
      const searchMatch = !debouncedSearch || 
        (l.modelo_nome_cache || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (l.id_producao || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (l.responsavel || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      
      if (!searchMatch) return false;
      
      // Filtro de prioridade
      if (filtros.prioridade && filtros.prioridade !== 'todos' && l.prioridade !== filtros.prioridade) {
        return false;
      }
      
      // Filtro de responsável
      if (filtros.responsavel && l.responsavel !== filtros.responsavel) {
        return false;
      }
      
      return true;
    });
  }, [lots, debouncedSearch, filtros]);

  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Sidebar */}
      <AppSidebar />
      
      {/* Mobile Header */}
      {isMobile && <MobileHeader title="Produção" />}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden ${isMobile ? 'pt-14 pb-16' : ''}`}>
        {/* Header */}
        <ProductionHeader
          search={search}
          onSearchChange={handleSearchChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNewLot={handleNewLot}
          onRefresh={fetchData}
          onExport={handleExportProducao}
          onExportPDF={handleExportProducaoPDF}
          onImport={() => setShowImportModal(true)}
          onExportCustos={handleExportCustos}
          onImportCustos={() => setShowImportCustosModal(true)}
          loading={loading}
          totalLots={filteredLots.length}
          filtros={filtros}
          onFiltrosChange={handleFiltrosChange}
          responsaveisDisponiveis={responsaveisDisponiveis}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6 pt-2">
          {viewMode === 'kanban' ? (
            isMobile ? (
              <MobileKanban
                lots={filteredLots}
                onMoveCard={moveCard}
                onEditCard={handleEditCard}
                onDeleteCard={handleDeleteCard}
                onManageCosts={handleManageCosts}
                onOpenChecklist={handleOpenChecklist}
                onOpenHistory={handleOpenHistory}
                onUpdateProgress={handleUpdateProgress}
              />
            ) : (
              <KanbanBoard 
                lots={filteredLots} 
                onMoveCard={moveCard}
                onDragMove={handleDragMove}
                onEditCard={handleEditCard}
                onDeleteCard={handleDeleteCard}
                onManageCosts={handleManageCosts}
                onOpenChecklist={handleOpenChecklist}
                onOpenHistory={handleOpenHistory}
                onUpdateProgress={handleUpdateProgress}
                filtros={filtros}
              />
            )
          ) : (
            <ListView lots={filteredLots} onMoveCard={moveCard} />
          )}
        </div>
      </main>

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLote ? 'Editar Lote' : 'Novo Lote de Produção'}
            </DialogTitle>
            <DialogDescription>
              {editingLote ? 'Atualize as informações do lote' : 'Preencha os dados para criar um novo lote'}
            </DialogDescription>
          </DialogHeader>
          <ProducaoForm
            lote={editingLote}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Costs Modal */}
      <CustosLoteModal
        lot={selectedLoteForCustos}
        open={showCustosModal}
        onClose={() => {
          setShowCustosModal(false);
          setSelectedLoteForCustos(null);
        }}
      />

      {/* Checklist Modal */}
      {selectedLoteForChecklist && (
        <AprontamentoChecklist
          lot={selectedLoteForChecklist}
          open={showChecklistModal}
          onClose={() => {
            setShowChecklistModal(false);
            setSelectedLoteForChecklist(null);
          }}
          onUpdate={handleChecklistUpdate}
        />
      )}

      {/* Import Modal */}
      <ImportProducaoCSVModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onSuccess={fetchData}
      />

      {/* Import Custos Modal */}
      <ImportCustosCSVModal
        open={showImportCustosModal}
        onOpenChange={setShowImportCustosModal}
        onSuccess={fetchData}
      />

      {/* Stage Transition Modal */}
      <StageTransitionModal
        open={showTransitionModal}
        onOpenChange={(open) => {
          setShowTransitionModal(open);
          if (!open) {
            setTransitionLot(null);
            setTransitionTarget('');
          }
        }}
        lot={transitionLot}
        fromStage={transitionLot?.processo_atual || ''}
        toStage={transitionTarget}
        onConfirm={executeStageMove}
        loading={transitionLoading}
      />

      {/* Qualidade Modal (Aprontamento → Vendas) */}
      <QualidadeModal
        open={showQualidadeModal}
        onOpenChange={(open) => {
          setShowQualidadeModal(open);
          if (!open) setQualidadeLot(null);
        }}
        lot={qualidadeLot}
        onConfirm={executeQualidadeMove}
        loading={qualidadeLoading}
      />

      {/* History Modal */}
      <HistoricoProducaoModal
        open={showHistoryModal}
        onOpenChange={(open) => {
          setShowHistoryModal(open);
          if (!open) setSelectedLoteForHistory(null);
        }}
        lot={selectedLoteForHistory}
      />
      
      {/* Bottom Navigation for Mobile */}
      <BottomNavigation />
    </div>
  );
};

export default Index;
