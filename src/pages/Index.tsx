import { useState, useEffect, useCallback } from 'react';
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
import ProducaoForm from '@/components/producao/ProducaoForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Download, Upload } from 'lucide-react';

const Index = () => {
  const { integrarProducao } = useEstoque();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [lots, setLots] = useState<ProducaoData[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
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
        await callWithRetry(() => Producao.create(dadosDoForm as ProducaoInsert));
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

  // Shared logic for stage changes
  const handleStageChange = async (lot: ProducaoData, newStage: string) => {
    const currentStage = lot.processo_atual;

    // Validação: Se movendo de Aprontamento para Vendas, verifica checklist
    if (currentStage === 'Aprontamento' && newStage === 'Vendas') {
      const checklist = lot.checklist_aprontamento;
      if (!isChecklistComplete(checklist)) {
        toast.error('Complete o checklist de Aprontamento antes de mover para Vendas!');
        setSelectedLoteForChecklist(lot);
        setShowChecklistModal(true);
        return;
      }
    }

    // Optimistic update
    const originalLots = [...lots];
    setLots(prev => prev.map(l => 
      l.id === lot.id ? { ...l, processo_atual: newStage } : l
    ));

    try {
      // Update database
      await callWithRetry(() => Producao.update(lot.id, { 
        processo_atual: newStage 
      }));

      // Log the movement
      await callWithRetry(() => ProducaoLog.create({
        producao_id: lot.id,
        processo_anterior: currentStage,
        processo_novo: newStage,
        responsavel: lot.responsavel
      }));

      // Quando move para "Vendas" (Estoque/Pronto), integra ao estoque
      if (newStage === 'Vendas' && !lot.integrado_estoque) {
        // Buscar preço de venda do lote
        let precoVenda = 0;
        try {
          const { data: custosConfig } = await supabase
            .from('lote_custos_config')
            .select('preco_venda')
            .eq('producao_id', lot.id)
            .maybeSingle();
          
          if (custosConfig) {
            precoVenda = Number(custosConfig.preco_venda) || 0;
          }
        } catch (e) {
          console.error('Erro ao buscar preço de venda:', e);
        }

        integrarProducao(
          lot.modelo_nome_cache || `Lote ${lot.id_producao}`,
          lot.quantidade,
          lot.id_producao,
          lot.imagem_url,
          precoVenda
        );
        
        // Marcar lote como integrado ao estoque
        await callWithRetry(() => Producao.update(lot.id, { 
          integrado_estoque: true 
        }));
        
        // Atualizar estado local
        setLots(prev => prev.map(l => 
          l.id === lot.id ? { ...l, processo_atual: newStage, integrado_estoque: true } : l
        ));
        
        toast.success('Lote enviado para o Estoque com sucesso!');
      } else {
        toast.success(`Movido para ${STAGES.find(s => s.id === newStage)?.label}`);
      }
    } catch (error) {
      console.error("Erro ao mover card:", error);
      toast.error("Erro ao mover lote");
      setLots(originalLots); // Revert on error
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

  // Filter lots
  const filteredLots = lots.filter(l =>
    (l.modelo_nome_cache || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.id_producao || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.responsavel || '').toLowerCase().includes(search.toLowerCase())
  );

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
          onSearchChange={setSearch}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNewLot={handleNewLot}
          onRefresh={fetchData}
          onExport={handleExportProducao}
          onImport={() => setShowImportModal(true)}
          onExportCustos={handleExportCustos}
          onImportCustos={() => setShowImportCustosModal(true)}
          loading={loading}
          totalLots={lots.length}
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
      
      {/* Bottom Navigation for Mobile */}
      <BottomNavigation />
    </div>
  );
};

export default Index;
