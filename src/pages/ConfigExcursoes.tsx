import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Bus, Upload, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import { useExcursoes, useAddExcursao, useUpdateExcursao, useDeleteExcursao, useDeleteMultipleExcursoes, Excursao } from '@/hooks/useExcursoes';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportExcursoesCSVModal } from '@/components/excursoes/ImportExcursoesCSVModal';

const DRAFT_KEY = 'df_excursao_draft';

const ConfigExcursoes = () => {
  const isMobile = useIsMobile();
  const { data: excursoes, isLoading } = useExcursoes();
  const addExcursao = useAddExcursao();
  const updateExcursao = useUpdateExcursao();
  const deleteExcursao = useDeleteExcursao();
  const deleteMultiple = useDeleteMultipleExcursoes();

  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingExcursao, setEditingExcursao] = useState<Excursao | null>(null);
  const [formData, setFormData] = useState({ nome: '', taxa: '', contato: '', localizacao: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  // Carregar rascunho ao montar
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft && !editingExcursao) {
        setFormData(JSON.parse(draft));
      }
    } catch (e) {
      console.error('Erro ao carregar rascunho de excursão:', e);
    }
  }, []);

  // Salvar rascunho ao alterar
  useEffect(() => {
    if (!editingExcursao && (formData.nome || formData.taxa || formData.contato || formData.localizacao)) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }
  }, [formData, editingExcursao]);

  const filteredExcursoes = excursoes?.filter((e) =>
    e.nome.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  const handleOpenNew = () => {
    setEditingExcursao(null);
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        setFormData(JSON.parse(draft));
      } else {
        setFormData({ nome: '', taxa: '', contato: '', localizacao: '' });
      }
    } catch (e) {
      setFormData({ nome: '', taxa: '', contato: '', localizacao: '' });
    }
    setShowModal(true);
  };

  const handleOpenEdit = (excursao: Excursao) => {
    setEditingExcursao(excursao);
    setFormData({ 
      nome: excursao.nome, 
      taxa: excursao.taxa.toString(),
      contato: excursao.contato || '',
      localizacao: excursao.localizacao || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const taxa = parseFloat(formData.taxa) || 0;
    if (taxa < 0) {
      toast.error('Taxa não pode ser negativa');
      return;
    }

    try {
      if (editingExcursao) {
        await updateExcursao.mutateAsync({
          id: editingExcursao.id,
          data: { 
            nome: formData.nome.trim(), 
            taxa,
            contato: formData.contato.trim(),
            localizacao: formData.localizacao.trim()
          },
        });
        toast.success('Excursão atualizada com sucesso!');
      } else {
        await addExcursao.mutateAsync({ 
          nome: formData.nome.trim(), 
          taxa,
          contato: formData.contato.trim(),
          localizacao: formData.localizacao.trim()
        });
        toast.success('Excursão cadastrada com sucesso!');
        localStorage.removeItem(DRAFT_KEY);
      }
      setShowModal(false);
    } catch (error) {
      toast.error('Erro ao salvar excursão');
    }
  };

  const handleToggleAtivo = async (excursao: Excursao) => {
    try {
      await updateExcursao.mutateAsync({
        id: excursao.id,
        data: { ativo: !excursao.ativo },
      });
      toast.success(excursao.ativo ? 'Excursão desativada' : 'Excursão ativada');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExcursao.mutateAsync(id);
      toast.success('Excursão excluída com sucesso!');
      setDeleteConfirm(null);
    } catch (error: any) {
      if (error.message?.includes('violates foreign key')) {
        toast.error('Não é possível excluir: existem pedidos vinculados a esta excursão');
      } else {
        toast.error('Erro ao excluir excursão');
      }
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (!filteredExcursoes) return;
    if (selectedIds.size === filteredExcursoes.length && filteredExcursoes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExcursoes.map((e) => e.id)));
    }
  };

  const handleExportCSV = () => {
    if (!filteredExcursoes || filteredExcursoes.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    // Estrutura solicitada: Nome;Contato;Localização;Taxa
    const header = ['Nome', 'Contato', 'Localizacao', 'Taxa'];
    const rows = filteredExcursoes.map(e => [
      e.nome,
      e.contato || '',
      e.localizacao || '',
      e.taxa.toFixed(2)
    ]);

    const csvContent = [
      header.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `excursoes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Arquivo exportado com sucesso!');
  };

  const handleDeleteMultiple = async () => {
    try {
      await deleteMultiple.mutateAsync(Array.from(selectedIds));
      toast.success(`${selectedIds.size} excursões excluídas com sucesso!`);
      setSelectedIds(new Set());
      setShowDeleteMultipleConfirm(false);
    } catch (error: any) {
      if (error.message?.includes('violates foreign key')) {
        toast.error('Algumas excursões não podem ser excluídas pois possuem pedidos vinculados');
      } else {
        toast.error('Erro ao excluir excursões');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {isMobile && <MobileHeader title="Excursões" />}
      {!isMobile && <AppSidebar />}

      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", isMobile && "pt-14 pb-20")}>
        {!isMobile && (
          <header className="px-8 py-6 flex-shrink-0">
            <h1 className="text-2xl font-bold text-foreground">EXCURSÕES</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie as excursões e suas taxas de envio
            </p>
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
          <div className="max-w-3xl space-y-6">
            {/* Campo de busca */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar excursão..."
                className="pl-10 h-11 rounded-xl"
              />
            </div>

            {/* Botões de ação */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {filteredExcursoes && filteredExcursoes.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedIds.size === filteredExcursoes.length && filteredExcursoes.length > 0}
                        onCheckedChange={handleToggleSelectAll}
                      />
                      <Label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                        Selecionar Tudo ({filteredExcursoes.length})
                      </Label>
                    </div>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteMultipleConfirm(true)}
                        className="gap-2"
                      >
                        <Trash2 size={16} />
                        Excluir ({selectedIds.size})
                      </Button>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCSV} className="gap-2">
                  <Download size={18} />
                  Exportar CSV
                </Button>
                <Button variant="outline" onClick={() => setShowImportModal(true)} className="gap-2">
                  <Upload size={18} />
                  Importar CSV
                </Button>
                <Button onClick={handleOpenNew} className="gap-2">
                  <Plus size={18} />
                  Nova
                </Button>
              </div>
            </div>

            {/* Lista de Excursões */}
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))
              ) : filteredExcursoes?.length === 0 ? (
                <div className="neu-card p-8 text-center">
                  <Bus size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    {debouncedSearch ? 'Nenhuma excursão encontrada' : 'Nenhuma excursão cadastrada'}
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {debouncedSearch ? 'Tente outro termo de busca' : 'Clique em "Nova Excursão" para adicionar'}
                  </p>
                </div>
              ) : (
                filteredExcursoes?.map((excursao) => (
                  <div
                    key={excursao.id}
                    className={cn(
                      "neu-card p-5 flex items-center justify-between gap-4",
                      !excursao.ativo && "opacity-60",
                      selectedIds.has(excursao.id) && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedIds.has(excursao.id)}
                        onCheckedChange={() => handleToggleSelect(excursao.id)}
                      />
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bus size={20} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{excursao.nome}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          <p className="text-sm text-muted-foreground">
                            Taxa: <span className="font-semibold text-emerald-600">{formatCurrency(excursao.taxa)}</span>
                          </p>
                          {excursao.contato && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <span className="opacity-70">Contato:</span> {excursao.contato}
                            </p>
                          )}
                          {excursao.localizacao && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <span className="opacity-70">Local:</span> {excursao.localizacao}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Switch
                        checked={excursao.ativo}
                        onCheckedChange={() => handleToggleAtivo(excursao)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(excursao)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(excursao.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal Criar/Editar */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingExcursao ? 'Editar Excursão' : 'Nova Excursão'}</DialogTitle>
            <DialogDescription>
              {editingExcursao ? 'Altere os dados da excursão' : 'Cadastre uma nova excursão com sua taxa'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Excursão</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Regis Tur"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxa">Taxa (R$)</Label>
              <Input
                id="taxa"
                type="number"
                step="0.01"
                min="0"
                value={formData.taxa}
                onChange={(e) => setFormData((prev) => ({ ...prev, taxa: e.target.value }))}
                placeholder="15.00"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contato">Contato/WhatsApp</Label>
              <Input
                id="contato"
                value={formData.contato}
                onChange={(e) => setFormData((prev) => ({ ...prev, contato: e.target.value }))}
                placeholder="(88) 99999-8888"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização/Ponto</Label>
              <Input
                id="localizacao"
                value={formData.localizacao}
                onChange={(e) => setFormData((prev) => ({ ...prev, localizacao: e.target.value }))}
                placeholder="Ex: Setor Verde - Vaga 79"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1 h-11 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={addExcursao.isPending || updateExcursao.isPending}
              className="flex-1 h-11 rounded-xl"
            >
              {addExcursao.isPending || updateExcursao.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta excursão? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1 h-11 rounded-xl">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteExcursao.isPending}
              className="flex-1 h-11 rounded-xl"
            >
              {deleteExcursao.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Importar CSV */}
      <ImportExcursoesCSVModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal} 
      />

      {/* Modal Confirmar Exclusão em Massa */}
      <Dialog open={showDeleteMultipleConfirm} onOpenChange={setShowDeleteMultipleConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir {selectedIds.size} Excursões</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {selectedIds.size} excursões selecionadas? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteMultipleConfirm(false)} className="flex-1 h-11 rounded-xl">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMultiple}
              disabled={deleteMultiple.isPending}
              className="flex-1 h-11 rounded-xl"
            >
              {deleteMultiple.isPending ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default ConfigExcursoes;
