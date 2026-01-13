import { useState } from 'react';
import { usePrestadoresServico } from '@/hooks/usePrestadoresServico';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { UserPlus, Loader2 } from 'lucide-react';

interface ResponsavelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  etapaAtual: string;
  disabled?: boolean;
}

export function ResponsavelSelector({ value, onChange, etapaAtual, disabled }: ResponsavelSelectorProps) {
  const { todosResponsaveis, loading, addPrestador } = usePrestadoresServico(etapaAtual);
  const [showAddModal, setShowAddModal] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddPrestador = async () => {
    if (!novoNome.trim()) return;
    
    setAdding(true);
    try {
      await addPrestador(novoNome.trim(), [etapaAtual]);
      onChange(novoNome.trim());
      setNovoNome('');
      setShowAddModal(false);
    } catch {
      // Error already handled in hook
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione o responsável" />
          </SelectTrigger>
          <SelectContent>
            {todosResponsaveis.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhum responsável cadastrado para esta etapa
              </div>
            ) : (
              todosResponsaveis.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowAddModal(true)}
          disabled={disabled}
          title="Adicionar novo responsável"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adicionar Responsável</DialogTitle>
            <DialogDescription>
              Adicione um novo prestador de serviço para a etapa "{etapaAtual}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Input
              placeholder="Nome do responsável"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPrestador()}
              disabled={adding}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={adding}>
              Cancelar
            </Button>
            <Button onClick={handleAddPrestador} disabled={adding || !novoNome.trim()}>
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
