import { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Package2, Layers, Search, ChevronRight, ArrowLeft, AlertTriangle,
  Plus, Minus, Truck, Trash2, X, Edit3, DollarSign
} from 'lucide-react';
import { useModelosPadronizados, ModeloPadronizado } from '@/hooks/useModelosPadronizados';
import { useIsMobile } from '@/hooks/use-mobile';
import { LotImage } from '@/components/production/LotImage';
import { parseProductName, groupItensByModel } from '@/utils/productNameUtils';

// ─── Tipos ────────────────────────────────────────────────

export interface ItemCarga {
  itemId: string;
  nome: string;
  referencia: string;
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

  const modelosCount = useMemo(() => {
    return new Set(itensCarga.map(i => parseProductName(i.nome, i.referencia).refBase)).size;
  }, [itensCarga]);

  // ─── Agrupar itens do carrinho ──────────────────────────
  const itensAgrupados = useMemo(() => {
    const groups = groupItensByModel(itensCarga, {
      getItemId: i => i.itemId,
      getItemNome: i => i.nome,
      getItemPreco: i => i.precoUnitario,
      getItemQtd: i => i.quantidade,
      getItemImagem: i => i.imagemUrl,
      getItemReferencia: i => i.referencia
    });
    return Object.values(groups);
  }, [itensCarga]);

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

  const gradeSizes: string[] = useMemo(() => {
    if (!selectedModel) return [];
    
    // Obter apenas tamanhos que possuem alguma unidade no estoque central
    // Isso evita que tamanhos zerados "travem" a funcionalidade de adicionar grade completa
    const tamanhosDisponiveis = selectedModel.variacoes
      .filter(v => getDisponivelCentral(v.id) > 0)
      .map(v => v.tamanho);

    const preDefinidas = selectedModel.meta.grades?.[0]?.itens;
    if (preDefinidas?.length) {
      // Se houver grade pré-definida, filtramos para manter apenas o que TEM estoque
      // Isso permite que o usuário adicione "grades completas" do que está disponível
      return preDefinidas
        .map(i => i.tamanho)
        .filter(t => tamanhosDisponiveis.includes(t))
        .sort(compararTamanhos);
    }
    
    // Sem grades pré-definidas: a grade completa é o conjunto de tudo que tem estoque
    return tamanhosDisponiveis.sort(compararTamanhos);
  }, [selectedModel, getDisponivelCentral]);

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
          referencia: selectedModel.meta.referencia || selectedModel.nome,
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
          novosItens.push({
            itemId: v.id,
            nome: v.nome,
            referencia: v.referencia || v.nome,
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
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
          <Input
            placeholder="Buscar por nome ou referência..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-12 h-14 rounded-2xl border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-background shadow-sm text-base focus-visible:ring-indigo-500/20"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="grid grid-cols-1 gap-3 pb-6">
          {modelos.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground/40">
              <Package2 className="h-12 w-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm font-medium">{search ? `Nenhum modelo encontrado para "${search}"` : 'Nenhum modelo disponível no estoque'}</p>
            </div>
          ) : modelos.map(m => (
            <button key={m.id} onClick={() => handleSelectModel(m)}
              className="w-full group p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/5 transition-all text-left flex items-center gap-5">
              <div className="h-16 w-16 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden border border-slate-100 dark:border-slate-800">
                {m.imagemUrl
                  ? <LotImage src={m.imagemUrl} alt={m.nome} className="w-full h-full object-cover" />
                  : <Layers className="h-8 w-8 text-slate-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="font-black text-slate-900 dark:text-slate-100 truncate text-base tracking-tight">
                    {parseProductName(m.nome, m.meta.referencia).nomeBase}
                  </p>
                  <p className="text-emerald-600 font-black text-base shrink-0">{formatCurrency(m.precoUnitario || 0)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {m.meta.referencia}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    • {m.totalDisponivel} disponíveis
                  </span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shrink-0">
                <ChevronRight className="h-6 w-6" />
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const stepConfigure = selectedModel && stats ? (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Card modelo selecionado - Compacto */}
        <div className="p-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-background flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 shadow-md shadow-indigo-100 dark:shadow-none flex items-center justify-center shrink-0 overflow-hidden border border-white dark:border-indigo-900">
              {selectedModel.imagemUrl
                ? <LotImage src={selectedModel.imagemUrl} alt={selectedModel.nome} className="w-full h-full object-cover" />
                : <Package2 className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <p className="font-black text-slate-900 dark:text-slate-100 truncate text-sm tracking-tight">
                {parseProductName(selectedModel.nome, selectedModel.meta.referencia).nomeBase}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">REF {selectedModel.meta.referencia}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{formatCurrency(selectedModel.precoUnitario || 0)}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStep('search')}
            className="rounded-lg hover:bg-white text-[10px] font-bold text-indigo-600 h-7 px-2 shrink-0">
            Trocar
          </Button>
        </div>

        {selectedModel.variacoes.length === 0 ? (
          <div className="p-4 rounded-xl border border-slate-100 bg-white dark:bg-slate-900/50 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase">Quantidade</p>
              <p className="text-[10px] text-slate-400 font-bold">Disponível: {getDisponivelCentral(selectedModel.id)} pçs</p>
            </div>
            <Stepper value={manualQtd['AVULSO'] || 0} onChange={v => setManualQtd({ AVULSO: v })} max={getDisponivelCentral(selectedModel.id)} className="w-28 h-9" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Seção Combinada: Estoque e Grade */}
            <div className="grid grid-cols-12 gap-3">
              {/* Disponibilidade Resumida */}
              <div className="col-span-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Estoque Central</p>
                <div className="flex flex-wrap gap-1">
                  {selectedModel.variacoes.map(v => {
                    const disp = stats.perSize[v.tamanho]?.disponivel || 0;
                    if (disp === 0) return null;
                    return (
                      <div key={v.tamanho} className="inline-flex items-center rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-[2px_2px_0px_rgba(0,0,0,0.02)]">
                        <span className="bg-slate-800 text-white text-[8px] font-black px-1 py-0.5 min-w-[18px] text-center">{v.tamanho}</span>
                        <span className="text-slate-900 dark:text-slate-100 text-[9px] font-bold px-1 py-0.5">{disp}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multiplicador de Grade Compacto */}
              <div className="col-span-8 p-3 rounded-xl border border-indigo-100 bg-indigo-50/20 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Grades Completas</p>
                  <p className="text-[8px] text-indigo-400 font-bold mt-1 uppercase">Max: {stats.gradesLivres} grades disponíveis</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {gradeSizes.map(t => (
                      <span key={t} className="text-[8px] font-bold px-1 rounded bg-white border border-indigo-100 text-indigo-400 uppercase">{t}</span>
                    ))}
                  </div>
                  <Stepper value={numGrades} onChange={setNumGrades} max={stats.gradesLivres} className="w-28 h-9" />
                </div>
              </div>
            </div>

            {/* Ajuste Fino (Avulsos) - Grid mais compacto */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ajuste por Tamanho</Label>
                <div className="h-px flex-1 mx-3 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {selectedModel.variacoes.map(v => {
                  const s = stats.perSize[v.tamanho];
                  const isInGrade = gradeSizes.includes(v.tamanho);
                  const base = isInGrade ? numGrades : 0;
                  const manual = manualQtd[v.tamanho] || 0;
                  const total = base + manual;
                  return (
                    <div key={v.tamanho}
                      className={cn(
                        "p-2 rounded-xl border transition-all shadow-sm flex flex-col items-center",
                        s?.overStock
                          ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                          : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50"
                      )}>
                      <div className="flex items-center gap-1 mb-1.5">
                        <span className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded",
                          isInGrade ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                        )}>{v.tamanho}</span>
                      </div>
                      
                      <div className="w-full relative">
                        <Input
                          type="number"
                          value={total || ''}
                          onChange={e => {
                            const newTotal = Math.max(0, parseInt(e.target.value) || 0);
                            const m = Math.max(0, newTotal - base);
                            setManualQtd(prev => ({ ...prev, [v.tamanho]: m }));
                          }}
                          className={cn(
                            "h-8 text-center font-bold text-xs p-0 border-slate-100 focus-visible:ring-indigo-500/20",
                            s?.overStock && "border-red-300 bg-red-50"
                          )}
                        />
                        {/* Indicador de estoque insuficiente sutil */}
                        {s?.overStock && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
                      </div>
                      
                      <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Disp: {s?.disponivel ?? 0}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alerta de estoque compacto */}
            {stats.hasOverStock && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-100">
                <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
                <p className="text-[10px] font-bold text-red-700 uppercase">Estoque insuficiente detectado!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  ) : null;

  const cartPanel = (
    <div className="w-80 xl:w-96 shrink-0 flex flex-col bg-slate-50/50 dark:bg-slate-950/20 border-l backdrop-blur-sm">
      {/* Título da carga */}
      <div className="px-5 py-4 border-b shrink-0 bg-white/40 dark:bg-black/20">
        <Label className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest mb-2 block">Nome da Carga</Label>
        <div className="relative group">
          <Input 
            placeholder="Ex: Alfaiataria, Jeans..." 
            value={titulo}
            onChange={e => onTituloChange(e.target.value)} 
            className="h-10 bg-white/80 dark:bg-background/80 border-indigo-100/50 focus:border-indigo-500 transition-all rounded-xl pl-9 text-sm shadow-sm" 
          />
          <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="px-5 py-3 border-b shrink-0 flex items-center justify-between bg-indigo-50/30 dark:bg-indigo-950/10">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-black text-indigo-900/60 dark:text-indigo-100/60 uppercase tracking-tighter">Itens no Carrinho</span>
        </div>
        {itensCarga.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/30 border border-indigo-100/50 shadow-sm">
            <span className="text-[10px] font-bold text-indigo-700 tabular-nums">
              {modelosCount} mod · {itensCarga.length} sku · {totalCarga} pç
            </span>
          </div>
        )}
      </div>

      {/* Lista */}
      {itensCarga.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 px-6 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full" />
            <Package2 className="h-16 w-16 relative opacity-20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-indigo-900/40 dark:text-indigo-100/40">Seu carrinho está vazio</p>
            <p className="text-[11px] mt-1 opacity-60 max-w-[180px] mx-auto">Explore os modelos à esquerda e adicione as quantidades desejadas.</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-3 py-4">
          <div className="space-y-4">
            {itensAgrupados.map((grupo, gIdx) => (
              <div key={gIdx} className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden">
                {/* Header do Grupo */}
                <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <LotImage src={grupo.imagemUrl} alt={grupo.nomeBase} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate leading-none mb-1">{grupo.nomeBase}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded uppercase">REF {grupo.refBase}</span>
                      <span className="text-[9px] font-medium text-slate-400 tabular-nums">{formatCurrency(grupo.precoUnitario)} un</span>
                    </div>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                    onClick={() => {
                      // Remover todas as variações deste grupo
                      grupo.tamanhosComQtd.forEach((t: any) => onRemoveItem(t.itemId));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Lista de Tamanhos */}
                <div className="p-2 space-y-1">
                  {grupo.tamanhosComQtd.map((t: any) => {
                    // Encontrar o item original para obter as quantidades disponíveis
                    const itemOriginal = itensCarga.find(i => i.itemId === t.itemId);
                    return (
                      <div key={t.itemId} className="flex items-center justify-between gap-2 p-1.5 pl-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-black text-slate-400 w-5">{t.tamanho || 'UN'}</span>
                          <span className="text-[10px] font-bold text-emerald-600 tabular-nums">
                            {formatCurrency(grupo.precoUnitario * t.quantidade)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-5 w-5 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-none"
                            onClick={() => { 
                              if (t.quantidade <= 1) onRemoveItem(t.itemId); 
                              else onUpdateQtd(t.itemId, t.quantidade - 1); 
                            }}
                          >
                            {t.quantidade <= 1 ? <X size={10} /> : <Minus size={10} />}
                          </Button>
                          <span className="w-5 text-center text-[10px] font-black tabular-nums text-slate-900 dark:text-slate-100">{t.quantidade}</span>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-5 w-5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-none"
                            onClick={() => onUpdateQtd(t.itemId, t.quantidade + 1)}
                            disabled={itemOriginal ? t.quantidade >= itemOriginal.disponivelCentral : false}
                          >
                            <Plus size={10} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      <div className="border-t p-5 bg-white dark:bg-slate-950 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Total</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums leading-none">
              {formatCurrency(valorCarga)}
            </span>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all" onClick={onClose}>Cancelar</Button>
          <Button 
            className="flex-[2] h-12 rounded-2xl gap-2 font-black uppercase tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none bg-indigo-600 hover:bg-indigo-700 transition-all" 
            onClick={onCriarCarga}
            disabled={itensCarga.length === 0 || isPending}
          >
            {isPending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <><Truck className="h-5 w-5" />Finalizar Carga</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const header = (
    <DialogHeader className="px-6 pt-6 pb-5 border-b bg-gradient-to-r from-indigo-600 to-indigo-900 shrink-0">
      <div className="flex items-center gap-4">
        {step === 'configure' && (
          <Button variant="ghost" size="icon" onClick={() => setStep('search')} className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-black text-white tracking-tight">Nova Carga para Feira</DialogTitle>
            <DialogDescription className="text-indigo-100/70 text-xs font-medium uppercase tracking-widest mt-0.5">
              Busque por nome ou referência
            </DialogDescription>
          </div>
        </div>
      </div>
    </DialogHeader>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90dvh] p-0 flex flex-col gap-0 rounded-t-[32px] overflow-hidden border-t-0 shadow-2xl">
          {header}
          <div className="flex-1 overflow-hidden">
            {step === 'search' ? stepSearch : stepConfigure}
          </div>
          <div className="border-t p-6 bg-white shrink-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{modelosCount} mod · {itensCarga.length} sku · {totalCarga} pç</span>
              <span className="text-xl font-black text-indigo-600 tabular-nums">{formatCurrency(valorCarga)}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold" onClick={onClose}>Fechar</Button>
              <Button className="flex-[2] h-12 rounded-2xl font-black uppercase tracking-widest bg-indigo-600" onClick={onCriarCarga} disabled={itensCarga.length === 0 || isPending}>
                {isPending ? "Criando..." : "Criar Carga"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] h-[750px] p-0 overflow-hidden flex flex-col gap-0 border-none shadow-2xl rounded-[32px]">
        {header}
        <div className="flex-1 flex overflow-hidden bg-white">
          <div className="flex-1 flex flex-col overflow-hidden">
            {step === 'search' ? stepSearch : stepConfigure}
            {step === 'configure' && stats && stats.totalItems > 0 && (
              <div className="px-6 py-5 border-t bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total do Modelo</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-slate-900 dark:text-slate-100">{stats.totalItems} peças</span>
                    <span className="text-lg font-bold text-emerald-600 tabular-nums">• {formatCurrency(stats.totalItems * (selectedModel?.precoUnitario || 0))}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('search')} className="h-12 px-6 rounded-2xl font-bold">Voltar</Button>
                  <Button onClick={handleConfirm} disabled={stats.hasOverStock} className="h-12 px-8 rounded-2xl font-black uppercase bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                    {stats.hasOverStock ? "Estoque Insuficiente" : `Adicionar ao Carrinho`}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {cartPanel}
        </div>
      </DialogContent>
    </Dialog>
  );
}
