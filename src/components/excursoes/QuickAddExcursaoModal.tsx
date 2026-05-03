import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAddExcursao, type Excursao } from '@/hooks/useExcursoes';
import { toast } from 'sonner';

interface QuickAddExcursaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultNome: string;
  onCreated: (excursao: Excursao) => void;
}

function parseCurrencyBR(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatCurrencyBR(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function QuickAddExcursaoModal({ open, onOpenChange, defaultNome, onCreated }: QuickAddExcursaoModalProps) {
  const [nome, setNome] = useState('');
  const [taxaStr, setTaxaStr] = useState('0,00');
  const [contato, setContato] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const addExcursao = useAddExcursao();

  useEffect(() => {
    if (open) {
      setNome(defaultNome || '');
      setTaxaStr('0,00');
      setContato('');
      setLocalizacao('');
    }
  }, [open, defaultNome]);

  const handleSave = async () => {
    const trimmed = nome.trim();
    if (trimmed.length < 2) {
      toast.error('Nome da excursão deve ter ao menos 2 caracteres.');
      return;
    }
    const taxa = parseCurrencyBR(taxaStr);
    if (taxa < 0) {
      toast.error('Taxa não pode ser negativa.');
      return;
    }

    try {
      const nova = await addExcursao.mutateAsync({
        nome: trimmed,
        taxa,
        contato: contato.trim() || undefined,
        localizacao: localizacao.trim() || undefined,
        ativo: true,
      });
      toast.success(`Excursão "${nova.nome}" cadastrada e selecionada`);
      onCreated(nova);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar excursão';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Excursão</DialogTitle>
          <DialogDescription>
            Cadastre uma nova excursão rapidamente. Ela ficará disponível na aba Excursões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="quick-exc-nome">Nome *</Label>
            <Input
              id="quick-exc-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Excursão Maria"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-exc-taxa">Taxa (R$) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                id="quick-exc-taxa"
                inputMode="decimal"
                value={taxaStr}
                onChange={(e) => setTaxaStr(e.target.value)}
                onBlur={() => setTaxaStr(formatCurrencyBR(parseCurrencyBR(taxaStr)))}
                placeholder="0,00"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-exc-contato">Contato</Label>
            <Input
              id="quick-exc-contato"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-exc-loc">Localização</Label>
            <Input
              id="quick-exc-loc"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Cidade / Estado"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={addExcursao.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={addExcursao.isPending}
          >
            {addExcursao.isPending ? 'Salvando...' : 'Salvar Excursão'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
