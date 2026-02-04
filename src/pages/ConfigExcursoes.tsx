import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Bus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useExcursoes, useAddExcursao, useUpdateExcursao, useDeleteExcursao, Excursao } from '@/hooks/useExcursoes';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportExcursoesCSVModal } from '@/components/excursoes/ImportExcursoesCSVModal';

const ConfigExcursoes = () => {
  const isMobile = useIsMobile();
  const { data: excursoes, isLoading } = useExcursoes();
  const addExcursao = useAddExcursao();
  const updateExcursao = useUpdateExcursao();
  const deleteExcursao = useDeleteExcursao();

  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingExcursao, setEditingExcursao] = useState<Excursao | null>(null);
  const [formData, setFormData] = useState({ nome: '', taxa: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleOpenNew = () => {
    setEditingExcursao(null);
    setFormData({ nome: '', taxa: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (excursao: Excursao) => {
    setEditingExcursao(excursao);
    setFormData({ nome: excursao.nome, taxa: excursao.taxa.toString() });
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
          data: { nome: formData.nome.trim(), taxa },
        });
        toast.success('Excursão atualizada com sucesso!');
      } else {
        await addExcursao.mutateAsync({ nome: formData.nome.trim(), taxa });
        toast.success('Excursão cadastrada com sucesso!');
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
            {/* Botões de ação */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImportModal(true)} className="gap-2">
                <Upload size={18} />
                Importar CSV
              </Button>
              <Button onClick={handleOpenNew} className="gap-2">
                <Plus size={18} />
                Nova Excursão
              </Button>
            </div>

            {/* Lista de Excursões */}
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))
              ) : excursoes?.length === 0 ? (
                <div className="neu-card p-8 text-center">
                  <Bus size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma excursão cadastrada</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Clique em "Nova Excursão" para adicionar
                  </p>
                </div>
              ) : (
                excursoes?.map((excursao) => (
                  <div
                    key={excursao.id}
                    className={cn(
                      "neu-card p-5 flex items-center justify-between gap-4",
                      !excursao.ativo && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bus size={20} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{excursao.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Taxa: <span className="font-semibold text-emerald-600">{formatCurrency(excursao.taxa)}</span>
                        </p>
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

      <BottomNavigation />
    </div>
  );
};

export default ConfigExcursoes;
