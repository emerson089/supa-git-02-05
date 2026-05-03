import { useState } from 'react';
import { usePrestadoresServico } from '@/hooks/usePrestadoresServico';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2 } from 'lucide-react';
import { GerenciarResponsaveisModal } from '@/components/production/GerenciarResponsaveisModal';

interface ResponsavelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  etapaAtual: string;
  disabled?: boolean;
}

export function ResponsavelSelector({ value, onChange, etapaAtual, disabled }: ResponsavelSelectorProps) {
  const { responsaveisEtapa, outrosResponsaveis, todosResponsaveis, loading } = usePrestadoresServico(etapaAtual);
  const [showManagerModal, setShowManagerModal] = useState(false);

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
            {responsaveisEtapa.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1.5">
                  Nesta etapa ({etapaAtual})
                </SelectLabel>
                {responsaveisEtapa.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {outrosResponsaveis.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1.5 border-t mt-1">
                  Outros prestadores
                </SelectLabel>
                {outrosResponsaveis.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {todosResponsaveis.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhum responsável cadastrado
              </div>
            )}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowManagerModal(true)}
          disabled={disabled}
          title="Gerenciar responsáveis"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      <GerenciarResponsaveisModal
        open={showManagerModal}
        onOpenChange={setShowManagerModal}
        etapaAtual={etapaAtual}
      />
    </>
  );
}
