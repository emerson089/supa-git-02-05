import { useState, useMemo } from 'react';
import { Search, GitMerge, ArrowRight, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClientePaginatedDB } from '@/hooks/useClientesPaginated';
import { useMesclarClientes } from '@/hooks/useMesclarClientes';

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPhone(phone: string): string {
  if (!phone) return '';
  const n = phone.replace(/\D/g, '');
  if (n.length <= 10)
    return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
}

// ────────────────────────────────────────────────────
// Mini card usado no preview lado a lado
// ────────────────────────────────────────────────────

function ClienteMiniCard({
  cliente,
  label,
  labelColor,
}: {
  cliente: ClientePaginatedDB;
  label: string;
  labelColor: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
      <Badge className={`text-[10px] px-2 py-0.5 ${labelColor}`}>{label}</Badge>
      <p className="font-semibold text-foreground text-sm truncate">{cliente.nome}</p>
      <p className="text-xs text-muted-foreground truncate">
        {formatPhone(cliente.telefone) || 'Sem telefone'}
      </p>
      {cliente.excursao && (
        <p className="text-xs text-primary truncate">{cliente.excursao}</p>
      )}
      {(cliente.total_comprado ?? 0) > 0 && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {formatCurrency(cliente.total_comprado ?? 0)}
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

interface MesclarClientesModalProps {
  /** Cliente que será eliminado (o "duplicado" selecionado no card) */
  fonte: ClientePaginatedDB;
  /** Lista completa para busca do destino */
  clientes: ClientePaginatedDB[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ────────────────────────────────────────────────────
// Modal principal
// ────────────────────────────────────────────────────

export function MesclarClientesModal({
  fonte,
  clientes,
  open,
  onOpenChange,
}: MesclarClientesModalProps) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [busca, setBusca] = useState('');
  const [destino, setDestino] = useState<ClientePaginatedDB | null>(null);
  const [pedidosTransferidos, setPedidosTransferidos] = useState(0);

  const { mutate: mesclar, isPending } = useMesclarClientes();

  // ── Busca filtrada (exclui o próprio fonte) ──────────────────────
  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.toLowerCase();
    return clientes
      .filter(
        (c) =>
          c.id !== fonte.id &&
          (c.nome.toLowerCase().includes(termo) ||
            (c.telefone || '').replace(/\D/g, '').includes(termo.replace(/\D/g, '')))
      )
      .slice(0, 10);
  }, [busca, clientes, fonte.id]);

  // ── Reset ao fechar ──────────────────────────────────────────────
  function handleOpenChange(v: boolean) {
    if (!v) {
      setEtapa(1);
      setBusca('');
      setDestino(null);
      setPedidosTransferidos(0);
    }
    onOpenChange(v);
  }

  // ── Confirmar mesclagem ──────────────────────────────────────────
  function handleConfirmar() {
    if (!destino) return;
    mesclar(
      { fonteId: fonte.id, destinoId: destino.id },
      {
        onSuccess: (data) => {
          setPedidosTransferidos(data.pedidosTransferidos);
          setEtapa(3);
        },
      }
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <GitMerge size={18} className="text-primary" />
            Mesclar Clientes
          </DialogTitle>
        </DialogHeader>

        {/* ── Etapa 1: buscar destino ──────────────────────────────── */}
        {etapa === 1 && (
          <div className="space-y-5 mt-2">
            {/* Cliente fonte */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Cliente a eliminar
              </p>
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <p className="font-semibold text-foreground">{fonte.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPhone(fonte.telefone) || 'Sem telefone'}
                  {fonte.excursao ? ` · ${fonte.excursao}` : ''}
                </p>
                {(fonte.total_comprado ?? 0) > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {formatCurrency(fonte.total_comprado ?? 0)}
                  </p>
                )}
              </div>
            </div>

            {/* Busca do destino */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Buscar cliente de destino
              </p>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setDestino(null); }}
                  placeholder="Nome ou telefone..."
                  className="pl-9 h-10 rounded-xl border-border"
                  autoFocus
                />
              </div>

              {/* Lista de resultados */}
              {resultados.length > 0 && !destino && (
                <div className="mt-2 rounded-xl border border-border bg-background shadow-md overflow-hidden max-h-52 overflow-y-auto">
                  {resultados.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setDestino(c); setBusca(c.nome); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors text-left border-b border-border last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatPhone(c.telefone) || 'Sem telefone'}
                          {c.excursao ? ` · ${c.excursao}` : ''}
                        </p>
                      </div>
                      {(c.total_comprado ?? 0) > 0 && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
                          {formatCurrency(c.total_comprado ?? 0)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {busca.trim() && resultados.length === 0 && !destino && (
                <p className="text-xs text-muted-foreground mt-2 px-1">Nenhum cliente encontrado.</p>
              )}
            </div>

            {/* Preview lado a lado */}
            {destino && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Resumo da mesclagem
                </p>
                <div className="flex items-center gap-3">
                  <ClienteMiniCard
                    cliente={fonte}
                    label="Será excluído"
                    labelColor="bg-destructive text-destructive-foreground border-0"
                  />
                  <ArrowRight size={20} className="text-muted-foreground flex-shrink-0" />
                  <ClienteMiniCard
                    cliente={destino}
                    label="Ficará ativo"
                    labelColor="bg-primary text-primary-foreground border-0"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 h-10 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                disabled={!destino}
                onClick={() => setEtapa(2)}
                className="flex-1 h-10 rounded-xl"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Etapa 2: confirmação ─────────────────────────────────── */}
        {etapa === 2 && destino && (
          <div className="space-y-5 mt-2">
            <div className="rounded-xl border border-orange-300 dark:border-orange-800/40 bg-orange-50/60 dark:bg-orange-950/20 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm text-foreground">
                  <p>
                    Todos os pedidos de{' '}
                    <span className="font-semibold">{fonte.nome}</span> serão
                    transferidos para{' '}
                    <span className="font-semibold">{destino.nome}</span>.
                  </p>
                  <p>
                    O cadastro de{' '}
                    <span className="font-semibold text-destructive">{fonte.nome}</span>{' '}
                    será excluído permanentemente.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEtapa(1)}
                disabled={isPending}
                className="flex-1 h-10 rounded-xl"
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirmar}
                disabled={isPending}
                className="flex-1 h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isPending ? (
                  <>
                    <Loader2 size={15} className="mr-2 animate-spin" />
                    Mesclando...
                  </>
                ) : (
                  'Confirmar Mesclagem'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Etapa 3: resultado ───────────────────────────────────── */}
        {etapa === 3 && (
          <div className="flex flex-col items-center gap-4 py-4 mt-2 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-base">Mesclagem concluída!</p>
              <p className="text-sm text-muted-foreground">
                {pedidosTransferidos}{' '}
                {pedidosTransferidos === 1 ? 'pedido transferido' : 'pedidos transferidos'}.
              </p>
            </div>
            <Button
              onClick={() => handleOpenChange(false)}
              className="h-10 px-8 rounded-xl mt-2"
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
