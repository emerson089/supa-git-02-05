import { useState, useEffect, useCallback } from 'react';
import { ViewMode } from '@/types/production';
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
import ProducaoForm from '@/components/producao/ProducaoForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

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

      // Quando move para "Concluído" (Estoque/Pronto), integra ao estoque
      if (newStage === 'Concluído' && !lot.integrado_estoque) {
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
              />
            ) : (
              <KanbanBoard 
                lots={filteredLots} 
                onMoveCard={moveCard}
                onDragMove={handleDragMove}
                onEditCard={handleEditCard}
                onDeleteCard={handleDeleteCard}
                onManageCosts={handleManageCosts}
              />
            )
          ) : (
            <ListView lots={filteredLots} onMoveCard={moveCard} />
          )}
        </div>
      </main>

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px]">
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
      
      {/* Bottom Navigation for Mobile */}
      <BottomNavigation />
    </div>
  );
};

export default Index;
