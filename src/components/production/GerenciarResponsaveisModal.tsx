import { useState, useEffect } from 'react';
import { usePrestadoresServico } from '@/hooks/usePrestadoresServico';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface GerenciarResponsaveisModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    etapaAtual?: string;
}

export function GerenciarResponsaveisModal({ open, onOpenChange, etapaAtual }: GerenciarResponsaveisModalProps) {
    const { prestadores, loading, updatePrestador, deletePrestador, addPrestador, refetch } = usePrestadoresServico();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [novoNome, setNovoNome] = useState('');

    useEffect(() => {
        if (open) {
            refetch();
        } else {
            setEditingId(null);
            setDeleteConfirmId(null);
        }
    }, [open, refetch]);

    const handleEditClick = (id: string, currentName: string) => {
        setEditingId(id);
        setEditName(currentName);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) {
            toast.error('O nome não pode estar vazio.');
            return;
        }

        try {
            setActionLoading(true);
            await updatePrestador(id, editName.trim());
            setEditingId(null);
        } catch (error) {
            // erro lidado no hook
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmId) return;

        try {
            setActionLoading(true);
            await deletePrestador(deleteConfirmId);
            setDeleteConfirmId(null);
        } catch (error) {
            // erro lidado no hook
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddPrestador = async () => {
        if (!novoNome.trim()) return;

        try {
            setActionLoading(true);
            await addPrestador(novoNome.trim(), etapaAtual ? [etapaAtual] : []);
            setNovoNome('');
            toast.success('Responsável adicionado com sucesso!');
        } catch {
            // erro lidado no hook
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Gerenciar Responsáveis</DialogTitle>
                        <DialogDescription>
                            Adicione, edite ou remova os responsáveis cadastrados no sistema.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center gap-2 pt-2 pb-4">
                        <Input
                            placeholder="Adicionar novo responsável..."
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddPrestador();
                            }}
                            disabled={actionLoading}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleAddPrestador}
                            disabled={actionLoading || !novoNome.trim()}
                            className="shrink-0"
                        >
                            {actionLoading && !editingId && !deleteConfirmId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Adicionar'
                            )}
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="mt-2 text-sm text-muted-foreground">Carregando lista...</p>
                        </div>
                    ) : prestadores.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <p>Nenhum responsável cadastrado.</p>
                            <p className="text-sm">Os responsáveis podem ser adicionados ao criar um novo lote.</p>
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[60vh] -mx-4 px-4">
                            <div className="space-y-3 pb-2 pt-1">
                                {prestadores.map((prestador) => (
                                    <div
                                        key={prestador.id}
                                        className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm hover:shadow transition-shadow"
                                    >
                                        {editingId === prestador.id ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <Input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="h-9 flex-1"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(prestador.id);
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                    disabled={actionLoading}
                                                    autoFocus
                                                />
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                        onClick={() => handleSaveEdit(prestador.id)}
                                                        disabled={actionLoading}
                                                        title="Salvar"
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:bg-muted"
                                                        onClick={handleCancelEdit}
                                                        disabled={actionLoading}
                                                        title="Cancelar"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">{prestador.nome}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Atua em {prestador.etapas.length} etapa(s)
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                        onClick={() => handleEditClick(prestador.id, prestador.nome)}
                                                        disabled={actionLoading}
                                                        title="Renomear"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setDeleteConfirmId(prestador.id)}
                                                        disabled={actionLoading}
                                                        title="Remover"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    <div className="flex justify-end pt-4 border-t">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={actionLoading}>
                            Fechar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && !actionLoading && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover Responsável?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação removerá o responsável da lista de opções permanentemente. Lotes antigos continuarão com o nome registrado. Deseja continuar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={actionLoading}
                        >
                            {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Sim, Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
