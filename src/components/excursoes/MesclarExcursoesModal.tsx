import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2, Loader2, Search, AlertTriangle, Merge } from 'lucide-react';
import { toast } from 'sonner';
import { Excursao } from '@/hooks/useExcursoes';
import { useMesclarExcursoes } from '@/hooks/useMesclarExcursoes';
import { cn } from '@/lib/utils';

interface MesclarExcursoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excursoes: Excursao[];
}

type Step = 'selecionar' | 'confirmar' | 'concluido';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ExcursaoPicker({
  label,
  excursoes,
  selected,
  excludeId,
  onSelect,
}: {
  label: string;
  excursoes: Excursao[];
  selected: Excursao | null;
  excludeId?: string;
  onSelect: (e: Excursao) => void;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);

  const filtradas = useMemo(() =>
    excursoes
      .filter(e => e.id !== excludeId)
      .filter(e => e.nome.toLowerCase().includes(busca.toLowerCase())),
    [excursoes, excludeId, busca]
  );

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {selected ? (
        <div
          className="p-3 border-2 border-primary rounded-xl cursor-pointer hover:border-primary/70 transition-colors"
          onClick={() => { setAberto(true); setBusca(''); }}
        >
          <p className="font-semibold text-sm">{selected.nome}</p>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            <span>Taxa: <span className="text-emerald-600 font-semibold">{formatCurrency(selected.taxa)}</span></span>
            {selected.origem && <span>· {selected.origem}</span>}
            {selected.localizacao && <span>· {selected.localizacao}</span>}
          </div>
        </div>
      ) : (
        <div
          className="p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors text-center text-sm text-muted-foreground"
          onClick={() => { setAberto(true); setBusca(''); }}
        >
          Clique para selecionar...
        </div>
      )}

      {aberto && (
        <div className="border border-border rounded-xl overflow-hidden shadow-lg bg-background">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar excursão..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-8 h-8 text-sm rounded-lg"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtradas.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhuma encontrada</p>
            ) : filtradas.map(e => (
              <button
                key={e.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0"
                onClick={() => { onSelect(e); setAberto(false); setBusca(''); }}
              >
                <p className="text-sm font-medium">{e.nome}</p>
                <p className="text-xs text-muted-foreground">Taxa: {formatCurrency(e.taxa)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MesclarExcursoesModal({ open, onOpenChange, excursoes }: MesclarExcursoesModalProps) {
  const [step, setStep] = useState<Step>('selecionar');
  const [fonte, setFonte] = useState<Excursao | null>(null);
  const [destino, setDestino] = useState<Excursao | null>(null);
  const [copiarTaxa, setCopiarTaxa] = useState(false);
  const [resultado, setResultado] = useState<{ clientesAtualizados: number; pedidosAtualizados: number } | null>(null);

  const mesclar = useMesclarExcursoes();

  const podeConfirmar = fonte && destino && fonte.id !== destino.id;
  const deveSugerirCopiarTaxa = fonte && destino && fonte.taxa > 0 && destino.taxa === 0;

  const handleConfirmar = async () => {
    if (!fonte || !destino) return;
    try {
      const res = await mesclar.mutateAsync({
        fonte: { id: fonte.id, nome: fonte.nome, taxa: fonte.taxa },
        destino: { id: destino.id, nome: destino.nome, taxa: destino.taxa },
        copiarTaxa,
      });
      setResultado(res);
      setStep('concluido');
      toast.success(`Mesclagem concluída!`);
    } catch (err: any) {
      toast.error('Erro ao mesclar: ' + (err.message ?? 'Verifique os logs'));
    }
  };

  const handleFechar = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('selecionar');
      setFonte(null);
      setDestino(null);
      setCopiarTaxa(false);
      setResultado(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge size={18} className="text-primary" />
            Mesclar Excursões
          </DialogTitle>
          <DialogDescription>
            Una duas excursões duplicadas. Todos os clientes e pedidos serão migrados.
          </DialogDescription>
        </DialogHeader>

        {step === 'selecionar' && (
          <div className="space-y-5 pt-2">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30 flex gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-400">
                A excursão <strong>ELIMINAR</strong> será deletada. Todos os clientes e pedidos serão migrados para a excursão <strong>MANTER</strong>.
              </p>
            </div>

            <ExcursaoPicker
              label="❌ Excursão a ELIMINAR (duplicata antiga)"
              excursoes={excursoes}
              selected={fonte}
              excludeId={destino?.id}
              onSelect={setFonte}
            />

            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px w-12 bg-border" />
                <ArrowRight size={14} className="text-primary" />
                <div className="h-px w-12 bg-border" />
              </div>
            </div>

            <ExcursaoPicker
              label="✅ Excursão a MANTER (versão correta)"
              excursoes={excursoes}
              selected={destino}
              excludeId={fonte?.id}
              onSelect={setDestino}
            />

            {deveSugerirCopiarTaxa && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <Checkbox
                  id="copiar-taxa"
                  checked={copiarTaxa}
                  onCheckedChange={v => setCopiarTaxa(!!v)}
                />
                <Label htmlFor="copiar-taxa" className="text-sm cursor-pointer">
                  Copiar taxa <span className="font-bold text-emerald-600">{formatCurrency(fonte!.taxa)}</span> da excursão eliminada para a mantida
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    A excursão mantida está com taxa R$ 0,00
                  </span>
                </Label>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleFechar} className="flex-1 h-11 rounded-xl">
                Cancelar
              </Button>
              <Button
                onClick={() => setStep('confirmar')}
                disabled={!podeConfirmar}
                className="flex-1 h-11 rounded-xl"
              >
                Revisar mesclagem
              </Button>
            </div>
          </div>
        )}

        {step === 'confirmar' && fonte && destino && (
          <div className="space-y-5 pt-2">
            <div className="bg-secondary/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Será eliminada</p>
                  <p className="font-semibold text-sm truncate line-through text-red-500">{fonte.nome}</p>
                  <p className="text-xs text-muted-foreground">Taxa: {formatCurrency(fonte.taxa)}</p>
                </div>
                <ArrowRight size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Será mantida</p>
                  <p className="font-semibold text-sm truncate text-emerald-600">{destino.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Taxa: {formatCurrency(copiarTaxa && deveSugerirCopiarTaxa ? fonte.taxa : destino.taxa)}
                    {copiarTaxa && deveSugerirCopiarTaxa && <Badge className="ml-1 text-[9px] h-4 px-1">copiada</Badge>}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>✓ Todos os <strong>clientes</strong> vinculados a <em>"{fonte.nome}"</em> serão atualizados</p>
              <p>✓ Todos os <strong>pedidos</strong> (nome e ID) serão migrados para a nova excursão</p>
              <p className="text-red-500">✗ A excursão <em>"{fonte.nome}"</em> será deletada permanentemente</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('selecionar')} className="flex-1 h-11 rounded-xl" disabled={mesclar.isPending}>
                Voltar
              </Button>
              <Button
                onClick={handleConfirmar}
                disabled={mesclar.isPending}
                className="flex-1 h-11 rounded-xl bg-primary"
              >
                {mesclar.isPending
                  ? <><Loader2 size={15} className="mr-2 animate-spin" />Mesclando...</>
                  : 'Confirmar e Mesclar'
                }
              </Button>
            </div>
          </div>
        )}

        {step === 'concluido' && resultado && (
          <div className="pt-4 pb-2 text-center space-y-4">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
            <div>
              <p className="text-lg font-bold">Mesclagem concluída!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {resultado.clientesAtualizados} {resultado.clientesAtualizados === 1 ? 'cliente atualizado' : 'clientes atualizados'}
                {' · '}
                {resultado.pedidosAtualizados} {resultado.pedidosAtualizados === 1 ? 'pedido migrado' : 'pedidos migrados'}
              </p>
            </div>
            <Button onClick={handleFechar} className="h-11 rounded-xl px-8">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
