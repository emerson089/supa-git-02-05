import { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Package2, Layers, Search, ChevronRight, ArrowLeft, AlertTriangle,
  Plus, Minus, Truck, Trash2, X,
} from 'lucide-react';
import { useModelosPadronizados, ModeloPadronizado } from '@/hooks/useModelosPadronizados';
import { useIsMobile } from '@/hooks/use-mobile';
import { LotImage } from '@/components/production/LotImage';
import { parseProductName } from '@/utils/productNameUtils';

// ─── Tipos ────────────────────────────────────────────────

export interface ItemCarga {
  itemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
}

interface NovaCargaFeiraModalProps {
  open: boolean;
  onClose: () => void;
  itensCarga: ItemCarga[];
  onAddItems: (items: ItemCarga[]) => void;
  onUpdateQtd: (itemId: string, qty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCriarCarga: () => void;
  getDisponivelCentral: (itemId: string) => number;
  formatCurrency: (value: number) => string;
  titulo: string;
  onTituloChange: (t: string) => void;
  totalCarga: number;
  valorCarga: number;
  isPending: boolean;
}

const ORDEM_TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4', 'G5'];

function compararTamanhos(a: string, b: string) {
  const na = parseInt(a), nb = parseInt(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  const ia = ORDEM_TAMANHOS.indexOf(a.toUpperCase());
  const ib = ORDEM_TAMANHOS.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

function Stepper({ value, onChange, max, className }: {
  value: number; onChange: (v: number) => void; max?: number; className?: string;
}) {
  return (
    <div className={cn(
      "flex items-center rounded-xl border border-indigo-100 bg-white dark:bg-slate-900 overflow-hidden shadow-sm",
      className
    )}>
      <button type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 transition-colors border-r border-indigo-50">
        <Minus size={14} />
      </button>
      <Input
        type="number" value={value || ''}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-12 h-9 border-0 bg-transparent text-center font-bold text-sm focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        placeholder="0"
      />
      <button type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 transition-colors border-l border-indigo-50 disabled:opacity-30">
        <Plus size={14} />
      </button>
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────

export function NovaCargaFeiraModal({
  open, onClose, itensCarga, onAddItems, onUpdateQtd, onRemoveItem,
  onCriarCarga, getDisponivelCentral, formatCurrency,
  titulo, onTituloChange, totalCarga, valorCarga, isPending,
}: NovaCargaFeiraModalProps) {
  const isMobile = useIsMobile();
  const { modelosPadronizados } = useModelosPadronizados();

  const [step, setStep] = useState<'search' | 'configure'>('search');
  const [search, setSearch] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [numGrades, setNumGrades] = useState(0);
  const [manualQtd, setManualQtd] = useState<Record<string, number>>({});

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setStep('search');
      setSearch('');
      setSelectedModelId(null);
      setNumGrades(0);
      setManualQtd({});
    }
  }, [open]);

  // Mapear modelos
  const modelos = useMemo(() => {
    const term = search.toLowerCase().trim();
    return modelosPadronizados
      .filter(m => {
        const nome = m.nome.toLowerCase();
        const ref = m.meta.referencia.toLowerCase();
        return !term || nome.includes(term) || ref.includes(term);
      })
      .map(m => {
        const variacoes = [...m.variacoes].sort((a, b) => compararTamanhos(a.tamanho, b.tamanho));
        const totalDisponivel = m.variacoes.length > 0
          ? m.variacoes.reduce((s, v) => s + getDisponivelCentral(v.id), 0)
          : getDisponivelCentral(m.id);
        return { ...m, variacoes, totalDisponivel };
      })
      .filter(m => m.totalDisponivel > 0);
  }, [modelosPadronizados, search, getDisponivelCentral]);

  const selectedModel = useMemo(
    () => modelos.find(m => m.id === selectedModelId) ?? null,
    [modelos, selectedModelId]
  );

  const gradeSizes: string[] = useMemo(
    () => selectedModel?.meta.grades?.[0]?.itens.map(i => i.tamanho).sort(compararTamanhos) ?? [],
    [selectedModel]
  );

  // Cálculo de estoque e totais
  const stats = useMemo(() => {
    if (!selectedModel) return null;
    const isManual = selectedModel.variacoes.length === 0;

    if (isManual) {
      const disp = getDisponivelCentral(selectedModel.id);
      const qty = manualQtd['AVULSO'] || 0;
      return {
        totalItems: qty,
        numGradesDetected: 0,
        numLooseDetected: qty,
        gradesLivres: 0,
        hasOverStock: qty > disp,
        perSize: { AVULSO: { disponivel: disp, total: qty, overStock: qty > disp } },
        gradeSizes: [] as string[],
      };
    }

    const perSize: Record<string, { disponivel: number; total: number; overStock: boolean }> = {};
    let totalItems = 0;

    for (const v of selectedModel.variacoes) {
      const disponivel = getDisponivelCentral(v.id);
      const fromGrade = gradeSizes.includes(v.tamanho) ? numGrades : 0;
      const manual = manualQtd[v.tamanho] || 0;
      const total = fromGrade + manual;
      perSize[v.tamanho] = { disponivel, total, overStock: total > disponivel };
      totalItems += total;
    }

    const gradesLivres = gradeSizes.length > 0
      ? Math.min(...gradeSizes.map(t => {
          const v = selectedModel.variacoes.find(vv => vv.tamanho === t);
          return v ? Math.max(0, getDisponivelCentral(v.id) - (perSize[t]?.total || 0)) : 0;
        }))
      : 0;

    const gradesMaxPossivel = gradeSizes.length > 0
      ? Math.min(...gradeSizes.map(t => {
          const v = selectedModel.variacoes.find(vv => vv.tamanho === t);
          return v ? getDisponivelCentral(v.id) : 0;
        }))
      : 0;

    let numGradesDetected = 0;
    if (gradeSizes.length > 0)
      numGradesDetected = Math.min(...gradeSizes.map(t => perSize[t]?.total || 0));
    const numLooseDetected = totalItems - numGradesDetected * gradeSizes.length;

    return {
      totalItems,
      numGradesDetected,
      numLooseDetected,
      gradesLivres: gradesMaxPossivel,
      hasOverStock: Object.values(perSize).some(s => s.overStock),
      perSize,
      gradeSizes,
    };
  }, [selectedModel, numGrades, manualQtd, getDisponivelCentral, gradeSizes]);

  const handleSelectModel = (m: typeof modelos[0]) => {
    setSelectedModelId(m.id);
    setNumGrades(0);
    setManualQtd({});
    setStep('configure');
  };

  const handleConfirm = () => {
    if (!selectedModel || !stats || stats.totalItems === 0 || stats.hasOverStock) return;

    const novosItens: ItemCarga[] = [];
    const isManual = selectedModel.variacoes.length === 0;

    if (isManual) {
      const qty = manualQtd['AVULSO'] || 0;
      if (qty > 0) {
        novosItens.push({
          itemId: selectedModel.id,
          nome: selectedModel.nome,
          quantidade: qty,
          precoUnitario: selectedModel.precoUnitario || 0,
          disponivelCentral: getDisponivelCentral(selectedModel.id),
          imagemUrl: selectedModel.imagemUrl ?? null,
        });
      }
    } else {
      for (const v of selectedModel.variacoes) {
        const s = stats.perSize[v.tamanho];
        if (s && s.total > 0) {
          const nomeInfo = parseProductName(v.nome, v.localizacao || '');
          novosItens.push({
            itemId: v.id,
            nome: v.nome,
            quantidade: s.total,
            precoUnitario: selectedModel.precoUnitario || 0,
            disponivelCentral: s.disponivel,
            imagemUrl: v.imagemUrl ?? selectedModel.imagemUrl ?? null,
          });
        }
      }
    }

    onAddItems(novosItens);
    // Volta à busca para adicionar mais modelos
    setStep('search');
    setSelectedModelId(null);
    setNumGrades(0);
    setManualQtd({});
  };

  // ─── Blocos de conteúdo ────────────────────────────────

  const stepSearch = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Busca */}
      <div className="px-5 py-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ex: Calça jeans clara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-11 h-12 rounded-xl border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-background/50 shadow-sm text-base"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="grid grid-cols-1 gap-2 pb-6">
          {modelos.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Package2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{search ? `Nenhum modelo com "${search}"` : 'Nenhum modelo disponível'}</p>
            </div>
          ) : modelos.map(m => (
            <button key={m.id} onClick={() => handleSelectModel(m)}
              className="w-full group p-4 rounded-xl border border-indigo-50 dark:border-indigo-900/20 bg-white dark:bg-indigo-950/5 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-left flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                {m.imagemUrl
                  ? <LotImage src={m.imagemUrl} alt={m.nome} className="w-full h-full object-cover" />
                  : <Layers className="h-6 w-6 text-indigo-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-indigo-950 dark:text-indigo-100 truncate text-sm">{m.nome.split(' — ')[0].trim()}</p>
                  <p className="text-emerald-600 font-bold text-sm shrink-0">{formatCurrency(m.precoUnitario || 0)}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded tracking-wider uppercase">
                    Ref {m.meta.referencia}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    • {m.totalDisponivel} pçs disponíveis
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-indigo-200 group-hover:text-indigo-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const stepConfigure = selectedModel && stats ? (
    <ScrollArea className="flex-1">
      <div className="p-5 space-y-5">
        {/* Card modelo selecionado */}
        <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
              {selectedModel.imagemUrl
                ? <LotImage src={selectedModel.imagemUrl} alt={selectedModel.nome} className="w-full h-full object-cover" />
                : <Package2 className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-indigo-950 dark:text-indigo-100 truncate text-sm">{selectedModel.nome.split(' — ')[0].trim()}</p>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">REF {selectedModel.meta.referencia}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep('search')}
            className="rounded-lg border-indigo-200 text-xs font-bold text-indigo-600 h-8 shrink-0">
            Trocar modelo
          </Button>
        </div>

        {selectedModel.variacoes.length === 0 ? (
          /* Modelo manual */
          <div className="p-5 rounded-xl border border-indigo-100 bg-white dark:bg-background/40 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Quantidade</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Disponível: {getDisponivelCentral(selectedModel.id)} pçs
              </p>
            </div>
            <Stepper
              value={manualQtd['AVULSO'] || 0}
              onChange={v => setManualQtd({ AVULSO: v })}
              max={getDisponivelCentral(selectedModel.id)}
              className="w-32"
            />
          </div>
        ) : (
          <>
            {/* Estoque disponível */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Estoque Disponível</h4>
              <div className={`grid gap-3 ${gradeSizes.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {gradeSizes.length > 0 && (
                  <div className="p-4 rounded-xl bg-white dark:bg-background/40 border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-2xl font-black text-indigo-600">{stats.gradesLivres}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Grades Livres</p>
                  </div>
                )}
                <div className="p-4 rounded-xl bg-white dark:bg-background/40 border border-indigo-100 dark:border-indigo-900/30">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedModel.variacoes.filter(v => stats.perSize[v.tamanho]?.disponivel > 0).length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">Nenhuma peça avulsa</span>
                    ) : selectedModel.variacoes.map(v => {
                      const disp = stats.perSize[v.tamanho]?.disponivel || 0;
                      if (disp === 0) return null;
                      return (
                        <div key={v.tamanho} className="inline-flex items-center rounded-md border border-indigo-200 dark:border-indigo-800 overflow-hidden shadow-sm">
                          <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 min-w-[24px] text-center">{v.tamanho}</span>
                          <span className="bg-white dark:bg-slate-900 text-indigo-600 text-[11px] font-bold px-2 py-0.5">{disp}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2">Peças Disponíveis no Central</p>
                </div>
              </div>
            </div>

            {/* Inserir grades completas */}
            {gradeSizes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Inserir Grades Completas</Label>
                <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/20">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Grade Padrão</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Tamanhos: {gradeSizes.join(', ')}</p>
                  </div>
                  <Stepper value={numGrades} onChange={setNumGrades} max={stats.gradesLivres} className="w-32" />
                </div>
              </div>
            )}

            {/* Ajuste por tamanho */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Ajuste de Peças por Tamanho</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedModel.variacoes.map(v => {
                  const s = stats.perSize[v.tamanho];
                  const isInGrade = gradeSizes.includes(v.tamanho);
                  const base = isInGrade ? numGrades : 0;
                  const manual = manualQtd[v.tamanho] || 0;
                  const total = base + manual;
                  return (
                    <div key={v.tamanho}
                      className={cn(
                        "p-3 rounded-xl border transition-all",
                        s?.overStock
                          ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                          : "border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-background/20"
                      )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-indigo-950 dark:text-indigo-100">{v.tamanho}</span>
                          {isInGrade && <Layers className="h-3 w-3 text-indigo-400" />}
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground">Estoque: {s?.disponivel ?? 0}</span>
                      </div>
                      <Stepper
                        value={total}
                        onChange={newTotal => {
                          const m = Math.max(0, newTotal - base);
                          setManualQtd(prev => ({ ...prev, [v.tamanho]: m }));
                        }}
                        max={s?.disponivel}
                        className={cn("h-10 w-full", s?.overStock ? "border-red-300" : "border-indigo-100")}
                      />
                      {s?.overStock && (
                        <p className="text-[9px] text-red-600 font-bold mt-1 text-center uppercase tracking-tighter">Estoque insuficiente</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alerta de estoque */}
            {stats.hasOverStock && (
              <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Estoque Central insuficiente para alguns tamanhos. Reduza a quantidade antes de adicionar.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  ) : null;

  // ─── Painel do Carrinho (Desktop) ─────────────────────

  const cartPanel = (
    <div className="w-72 xl:w-80 shrink-0 flex flex-col bg-muted/5 border-l">
      {/* Título da carga */}
      <div className="px-4 py-3 border-b shrink-0">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome da carga (opcional)</Label>
        <Input placeholder="Ex: Alfaiataria, Jeans..." value={titulo}
          onChange={e => onTituloChange(e.target.value)} className="h-9 bg-background text-sm" />
      </div>

      {/* Cabeçalho */}
      <div className="px-4 py-2 border-b shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Carga</span>
        {itensCarga.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{itensCarga.length} sku · {totalCarga} pç</span>
        )}
      </div>

      {/* Lista */}
      {itensCarga.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-4">
          <Package2 className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium text-center">Nenhum item adicionado</p>
          <p className="text-xs mt-1 opacity-70 text-center">Selecione um modelo à esquerda</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {itensCarga.map(item => (
              <div key={item.itemId} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0 border">
                  <LotImage src={item.imagemUrl} alt={item.nome} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate leading-tight">
                    {parseProductName(item.nome, item.itemId).nomeExibicao}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.precoUnitario)}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => { if (item.quantidade <= 1) onRemoveItem(item.itemId); else onUpdateQtd(item.itemId, item.quantidade - 1); }}>
                    {item.quantidade <= 1 ? <X size={11} /> : <Minus size={11} />}
                  </Button>
                  <span className="w-6 text-center text-xs font-bold tabular-nums">{item.quantidade}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => onUpdateQtd(item.itemId, item.quantidade + 1)}
                    disabled={item.quantidade >= item.disponivelCentral}>
                    <Plus size={11} />
                  </Button>
                </div>
                <span className="text-xs font-bold text-primary tabular-nums w-14 text-right shrink-0">
                  {formatCurrency(item.precoUnitario * item.quantidade)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      <div className="border-t p-3 space-y-2.5 shrink-0 bg-muted/10">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-bold text-primary tabular-nums">{formatCurrency(valorCarga)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-9 gap-1.5" onClick={onCriarCarga}
            disabled={itensCarga.length === 0 || isPending}>
            {isPending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Criando...</> : <><Truck className="h-4 w-4" />Criar Carga</>}
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Footer do step configure ──────────────────────────

  const configureFooter = stats && stats.totalItems > 0 ? (
    <div className="px-5 py-4 border-t bg-white dark:bg-indigo-950/10 shrink-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
            {stats.totalItems} peças
            {stats.gradeSizes.length > 0 && (
              <span className="text-muted-foreground font-medium ml-1 text-xs">
                ({stats.numGradesDetected} grade{stats.numGradesDetected !== 1 ? 's' : ''} + {stats.numLooseDetected} avulsa{stats.numLooseDetected !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <div className="text-lg font-black text-emerald-600 tabular-nums">
            {formatCurrency(stats.totalItems * (selectedModel?.precoUnitario || 0))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('search')} className="flex-1 h-12 rounded-xl font-bold border-indigo-100">
            Voltar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={stats.hasOverStock}
            className={cn(
              "flex-[2] h-12 rounded-xl font-black uppercase tracking-widest transition-all",
              stats.hasOverStock
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
            )}>
            {stats.hasOverStock ? "Estoque Insuficiente" : `Adicionar ${stats.totalItems} Peças`}
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="px-5 py-4 border-t shrink-0">
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep('search')} className="flex-1 h-12 rounded-xl font-bold border-indigo-100">
          Voltar
        </Button>
        <Button disabled className="flex-[2] h-12 rounded-xl font-black uppercase tracking-widest opacity-50">
          Adicionar 0 Peças
        </Button>
      </div>
    </div>
  );

  // ─── Header ─────────────────────────────────────────────

  const header = (
    <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background shrink-0">
      <div className="flex items-center gap-3">
        {step === 'configure' && (
          <Button variant="ghost" size="icon" onClick={() => setStep('search')} className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <DialogTitle className="text-xl font-extrabold text-indigo-950 dark:text-indigo-100 tracking-tight flex items-center gap-2">
            <Package2 className="h-5 w-5 text-indigo-600" />
            {step === 'search' ? 'Nova Carga para Feira' : 'Configurar Seleção'}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-indigo-600/60 dark:text-indigo-400/50 uppercase tracking-widest">
            {step === 'search' ? 'Busque por nome ou referência' : `Ref: ${selectedModel?.meta.referencia}`}
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );

  // ─── Render ──────────────────────────────────────────────

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="bottom" className="h-[95vh] flex flex-col p-0 rounded-t-2xl overflow-hidden [&>button]:hidden">
          {header}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {step === 'search' ? stepSearch : stepConfigure}
          </div>
          {step === 'configure' && configureFooter}
          {step === 'search' && (
            <div className="border-t p-4 bg-background shrink-0">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-muted-foreground">{itensCarga.length} sku · {totalCarga} pç</span>
                <span className="font-bold text-primary tabular-nums">{formatCurrency(valorCarga)}</span>
              </div>
              <Button className="w-full h-12 gap-2 text-base font-semibold" onClick={onCriarCarga}
                disabled={itensCarga.length === 0 || isPending}>
                {isPending ? 'Criando...' : <><Truck className="h-5 w-5" />Criar Carga ({totalCarga} pç)</>}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[88vh] overflow-hidden flex flex-col p-0 gap-0 shadow-2xl border-indigo-100 dark:border-indigo-900/50">
        {header}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Coluna esquerda: busca/configure */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-gradient-to-b from-indigo-50/30 to-white dark:from-indigo-950/10 dark:to-background">
            {step === 'search' ? stepSearch : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {stepConfigure}
                {configureFooter}
              </div>
            )}
          </div>

          {/* Coluna direita: carrinho */}
          {cartPanel}
        </div>
      </DialogContent>
    </Dialog>
  );
}
