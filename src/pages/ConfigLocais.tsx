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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  useLocais,
  useCriarLocal,
  useEditarLocal,
  useAlternarAtivoLocal,
  useExcluirLocal,
  type EstoqueLocal
} from '@/hooks/useEstoqueLocais';

export default function ConfigLocais() {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocal, setEditingLocal] = useState<EstoqueLocal | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoTipo, setNovoTipo] = useState<'central' | 'loja' | 'banca'>('loja');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLocal, setDeletingLocal] = useState<EstoqueLocal | null>(null);
  const [validationError, setValidationError] = useState('');

  const { data: locais = [], isLoading } = useLocais(false); // Pegar todos, inclusive inativos
  const criarMutation = useCriarLocal();
  const editarMutation = useEditarLocal();
  const alternarAtivoMutation = useAlternarAtivoLocal();
  const excluirMutation = useExcluirLocal();

  // Filtrar locais pela busca
  const locaisFiltrados = locais.filter(local =>
    local.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingLocal(null);
    setNovoNome('');
    setNovoTipo('loja');
    setValidationError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (local: EstoqueLocal) => {
    setEditingLocal(local);
    setNovoNome(local.nome);
    setNovoTipo(local.tipo);
    setValidationError('');
    setModalOpen(true);
  };

  const handleOpenDelete = (local: EstoqueLocal) => {
    setDeletingLocal(local);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    const nomeTrimmed = novoNome.trim();

    if (!nomeTrimmed) {
      setValidationError('O nome não pode estar vazio');
      return;
    }

    // Verificar duplicidade local
    const nomeExiste = locais.some(
      l => l.nome.toLowerCase() === nomeTrimmed.toLowerCase() && l.id !== editingLocal?.id
    );

    if (nomeExiste) {
      setValidationError('Este nome já existe');
      return;
    }

    try {
      if (editingLocal) {
        await editarMutation.mutateAsync({ id: editingLocal.id, nome: nomeTrimmed, tipo: novoTipo });
      } else {
        await criarMutation.mutateAsync({ nome: nomeTrimmed, tipo: novoTipo });
      }
      setModalOpen(false);
      setNovoNome('');
      setEditingLocal(null);
    } catch {
      // Erro já tratado pelo hook
    }
  };

  const handleAlternarAtivo = async (id: string, ativo: boolean) => {
    await alternarAtivoMutation.mutateAsync({ id, ativo: !ativo });
  };

  const handleExcluir = async () => {
    if (!deletingLocal) return;

    try {
      await excluirMutation.mutateAsync(deletingLocal.id);
      setDeleteDialogOpen(false);
      setDeletingLocal(null);
    } catch (error: any) {
      // Se não puder excluir, o hook joga o erro e a UI pode tratar ou o toast nativo
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'central': return 'Estoque Central';
      case 'loja': return 'Loja';
      case 'banca': return 'Banca da Feira';
      default: return tipo;
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-auto">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center gap-3 mb-6 pt-12">
            <MobileDrawer />
            <h1 className="text-lg font-semibold">Locais de Estoque</h1>
          </div>
        )}

        {/* Desktop Header */}
        {!isMobile && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <MapPin size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Locais de Estoque</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie os locais físicos onde seus produtos são armazenados
                </p>
              </div>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Local
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar local..."
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))
          ) : locaisFiltrados.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {searchTerm ? 'Nenhum local encontrado' : 'Nenhum local cadastrado'}
            </div>
          ) : (
            locaisFiltrados.map((local) => (
              <Card key={local.id} className={cn(
                "p-5 flex flex-col justify-between gap-4 transition-all duration-200 border-slate-200/60 shadow-sm hover:shadow-md",
                !local.ativo && "opacity-60 bg-slate-50"
              )}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{local.nome}</h3>
                      {!local.ativo && (
                        <Badge variant="outline" className="text-[10px] h-4 uppercase tracking-wider">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{getTipoLabel(local.tipo)}</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(local)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAlternarAtivo(local.id, local.ativo)}>
                        {local.ativo ? (
                          <>
                            <PowerOff className="mr-2 h-4 w-4" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <Power className="mr-2 h-4 w-4" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenDelete(local)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono">ID: {local.id.slice(0, 8)}</span>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    local.ativo ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-300"
                  )} />
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
              {editingLocal ? 'Editar Local' : 'Novo Local de Estoque'}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do local de armazenamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Local *</Label>
              <Input
                id="nome"
                placeholder="Ex: Stand 45, Loja 02, Almoxarifado..."
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

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Local *</Label>
              <Select value={novoTipo} onValueChange={(v: any) => setNovoTipo(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="central">Estoque Central</SelectItem>
                  <SelectItem value="loja">Loja</SelectItem>
                  <SelectItem value="banca">Banca da Feira</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1 px-1">
                O tipo ajuda na organização e em filtros automáticos do sistema.
              </p>
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
            <AlertDialogTitle>Excluir Local de Estoque</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir permanentemente o local "{deletingLocal?.nome}"?
              Esta ação não pode ser desfeita e só é permitida se o local não possuir histórico de estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
