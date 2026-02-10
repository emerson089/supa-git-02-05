import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Pencil, 
  Power, 
  PowerOff, 
  Trash2,
  Tag,
  AlertTriangle,
  Check
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  useTodosOsTiposAjuste,
  useCriarTipoAjuste,
  useEditarTipoAjuste,
  useAlternarAtivoTipoAjuste,
  useAlternarContaComoVenda,
  useExcluirTipoAjuste,
  useVerificarTipoEmUso,
} from '@/hooks/useTiposAjuste';
import { Switch } from '@/components/ui/switch';

export default function ConfigTiposAjuste() {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<{ id: string; nome: string } | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTipo, setDeletingTipo] = useState<{ id: string; nome: string } | null>(null);
  const [validationError, setValidationError] = useState('');

  const { data: tipos = [], isLoading } = useTodosOsTiposAjuste();
  const criarMutation = useCriarTipoAjuste();
  const editarMutation = useEditarTipoAjuste();
  const alternarAtivoMutation = useAlternarAtivoTipoAjuste();
  const alternarVendaMutation = useAlternarContaComoVenda();
  const excluirMutation = useExcluirTipoAjuste();
  const { data: tipoEmUsoInfo } = useVerificarTipoEmUso(deletingTipo?.id || null);

  // Filtrar tipos pela busca
  const tiposFiltrados = tipos.filter(tipo =>
    tipo.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingTipo(null);
    setNovoNome('');
    setValidationError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (tipo: { id: string; nome: string }) => {
    setEditingTipo(tipo);
    setNovoNome(tipo.nome);
    setValidationError('');
    setModalOpen(true);
  };

  const handleOpenDelete = (tipo: { id: string; nome: string }) => {
    setDeletingTipo(tipo);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    const nomeTrimmed = novoNome.trim();
    
    if (!nomeTrimmed) {
      setValidationError('O nome não pode estar vazio');
      return;
    }

    // Verificar duplicidade local
    const nomeExiste = tipos.some(
      t => t.nome.toLowerCase() === nomeTrimmed.toLowerCase() && t.id !== editingTipo?.id
    );
    
    if (nomeExiste) {
      setValidationError('Este nome já existe');
      return;
    }

    try {
      if (editingTipo) {
        await editarMutation.mutateAsync({ id: editingTipo.id, nome: nomeTrimmed });
      } else {
        await criarMutation.mutateAsync(nomeTrimmed);
      }
      setModalOpen(false);
      setNovoNome('');
      setEditingTipo(null);
    } catch {
      // Erro já tratado pelo hook
    }
  };

  const handleAlternarAtivo = async (id: string, ativo: boolean) => {
    await alternarAtivoMutation.mutateAsync({ id, ativo: !ativo });
  };

  const handleExcluir = async () => {
    if (!deletingTipo) return;
    
    if (tipoEmUsoInfo?.emUso) {
      // Se está em uso, apenas desativar
      await alternarAtivoMutation.mutateAsync({ id: deletingTipo.id, ativo: false });
    } else {
      // Se não está em uso, pode excluir
      await excluirMutation.mutateAsync(deletingTipo.id);
    }
    
    setDeleteDialogOpen(false);
    setDeletingTipo(null);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-auto">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center gap-3 mb-6">
            <MobileDrawer />
            <h1 className="text-lg font-semibold">Tipos de Ajuste</h1>
          </div>
        )}

        {/* Desktop Header */}
        {!isMobile && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Tag size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Tipos de Ajuste</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie os tipos de ajuste de estoque
                </p>
              </div>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Tipo
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {isMobile && (
            <Button size="icon" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Lista */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          ) : tiposFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? 'Nenhum tipo encontrado' : 'Nenhum tipo cadastrado'}
            </div>
          ) : (
            tiposFiltrados.map((tipo) => (
              <Card key={tipo.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    tipo.ativo ? "bg-green-500" : "bg-muted-foreground/30"
                  )} />
                  <span className={cn(
                    "font-medium truncate",
                    !tipo.ativo && "text-muted-foreground"
                  )}>
                    {tipo.nome}
                  </span>
                  {!tipo.ativo && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Inativo
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`venda-${tipo.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                      Venda
                    </Label>
                    <Switch
                      id={`venda-${tipo.id}`}
                      checked={tipo.contaComoVenda}
                      onCheckedChange={(checked) => alternarVendaMutation.mutate({ id: tipo.id, contaComoVenda: checked })}
                      disabled={!tipo.ativo}
                    />
                  </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEdit(tipo)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar nome
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAlternarAtivo(tipo.id, tipo.ativo)}>
                      {tipo.ativo ? (
                        <>
                          <PowerOff className="mr-2 h-4 w-4" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <Power className="mr-2 h-4 w-4" />
                          Reativar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleOpenDelete(tipo)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      <BottomNavigation />

      {/* Modal Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTipo ? 'Editar Tipo de Ajuste' : 'Novo Tipo de Ajuste'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Tipo *</Label>
              <Input
                id="nome"
                placeholder="Ex: Devolução ao fornecedor"
                value={novoNome}
                onChange={(e) => {
                  setNovoNome(e.target.value);
                  setValidationError('');
                }}
              />
              {validationError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {validationError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={criarMutation.isPending || editarMutation.isPending}
            >
              {(criarMutation.isPending || editarMutation.isPending) ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tipo de Ajuste</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-4">
                  Deseja excluir permanentemente o tipo "{deletingTipo?.nome}"?
                </p>
                
                {tipoEmUsoInfo?.emUso ? (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Este tipo está em uso</p>
                        <p className="mt-1">
                          Existem {tipoEmUsoInfo.quantidade} movimentação(ões) usando este tipo.
                          Ele não pode ser excluído, mas pode ser desativado.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 text-sm">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Este tipo não está em uso</p>
                        <p className="mt-1">
                          Pode ser excluído com segurança.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className={tipoEmUsoInfo?.emUso ? '' : 'bg-destructive hover:bg-destructive/90'}
            >
              {tipoEmUsoInfo?.emUso ? 'Desativar' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
