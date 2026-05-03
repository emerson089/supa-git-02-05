import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck, X, Search, Package, Loader2, Plus, Minus, Package2 } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { cn } from '@/lib/utils';
import { parseProductName } from '@/utils/productNameUtils';

interface Produto {
  id: string;
  nome: string;
  precoUnitario: number | null;
  imagemUrl?: string | null;
  localizacao?: string | null;
}

interface ItemCarga {
  itemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
  modeloId: string | null;
}

interface SkuInfo {
  id: string;
  tamanho: string | null; // null = produto sem tamanho extraído (solo)
  disponivel: number;
  produto: Produto;
}

interface ModeloGroup {
  key: string;
  nomeExibicao: string;
  refBase: string;
  valorUnitario: number;
  imagemUrl: string | null;
  skus: SkuInfo[];
  totalEmCarga: number;
}

export interface NovaCargaStepProdutosProps {
  produtos: Produto[];
  itensCarga: ItemCarga[];
  isLoading: boolean;
  buscaProduto: string;
  onBuscaChange: (value: string) => void;
  onAddItem: (produto: Produto, quantidade: number) => boolean;
  onUpdateQtd: (itemId: string, novaQuantidade: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClose: () => void;
  getDisponivelCentral: (itemId: string) => number;
  formatCurrency: (value: number) => string;
  titulo?: string;
  onTituloChange?: (value: string) => void;
  onOpenGrade?: () => void;
}

const SIZE_ORDER: Record<string, number> = {
  PP: 1, P: 2, M: 3, G: 4, GG: 5, XG: 6, XGG: 7,
  G1: 8, G2: 9, G3: 10, G4: 11, G5: 12,
};

function sortTamanhos(a: SkuInfo, b: SkuInfo): number {
  if (!a.tamanho || !b.tamanho) return 0;
  const aNum = parseInt(a.tamanho);
  const bNum = parseInt(b.tamanho);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  if (!isNaN(aNum)) return -1;
  if (!isNaN(bNum)) return 1;
  return (SIZE_ORDER[a.tamanho] ?? 99) - (SIZE_ORDER[b.tamanho] ?? 99);
}

export function NovaCargaStepProdutos({
  produtos,
  itensCarga,
  isLoading,
  buscaProduto,
  onBuscaChange,
  onAddItem,
  onUpdateQtd,
  onRemoveItem,
  onClose,
  getDisponivelCentral,
  formatCurrency,
  titulo,
  onTituloChange,
  onOpenGrade,
}: NovaCargaStepProdutosProps) {

  const modeloGroups = useMemo((): ModeloGroup[] => {
    const groups: Record<string, ModeloGroup> = {};

    for (const produto of produtos) {
      const info = parseProductName(produto.nome, produto.id);
      const preco = produto.precoUnitario || 0;
      
      const modeloId = (() => {
        try {
          const loc = JSON.parse(produto.localizacao || '{}');
          return loc.modeloId || null;
        } catch { return null; }
      })();

      // Prioriza modeloId para agrupamento, senão usa lógica baseada em nome/ref
      const key = modeloId ? `mod-${modeloId}-${preco}` : (info.tamanho ? `${info.refBase}-${preco}` : `solo-${produto.id}`);

      if (!groups[key]) {
        groups[key] = {
          key,
          nomeExibicao: info.nomeExibicao,
          refBase: info.refBase,
          valorUnitario: preco,
          imagemUrl: produto.imagemUrl ?? null,
          skus: [],
          totalEmCarga: 0,
        };
      }

      const disponivel = getDisponivelCentral(produto.id);
      const emCarga = itensCarga.find(i => i.itemId === produto.id);

      groups[key].skus.push({
        id: produto.id,
        // null = produto sem tamanho (solo) → renderizado como linha simples
        tamanho: info.tamanho ?? null,
        disponivel,
        produto,
      });
      groups[key].totalEmCarga += emCarga?.quantidade || 0;
    }

    return Object.values(groups)
      .map(g => ({ ...g, skus: [...g.skus].sort(sortTamanhos) }))
      .sort((a, b) => {
        if (a.totalEmCarga > 0 && b.totalEmCarga === 0) return -1;
        if (a.totalEmCarga === 0 && b.totalEmCarga > 0) return 1;
        return a.nomeExibicao.localeCompare(b.nomeExibicao);
      });
  }, [produtos, itensCarga, getDisponivelCentral]);

  const selecionados = modeloGroups.filter(g => g.totalEmCarga > 0).length;

  const handleSkuClick = (sku: SkuInfo) => {
    if (itensCarga.some(i => i.itemId === sku.id)) return;
    if (sku.disponivel <= 0) return;
    onAddItem(sku.produto, 1);
  };

  const handleIncrement = (sku: SkuInfo, qtd: number) => {
    if (qtd >= sku.disponivel) return;
    onUpdateQtd(sku.id, qtd + 1);
  };

  const handleDecrement = (sku: SkuInfo, qtd: number) => {
    if (qtd <= 1) onRemoveItem(sku.id);
    else onUpdateQtd(sku.id, qtd - 1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">Nova Carga</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenGrade && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenGrade}
              className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5 font-medium text-xs"
            >
              <Package2 size={13} />
              Por Grade
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Título da carga */}
      {onTituloChange && (
        <div className="px-4 py-2.5 border-b bg-muted/10 shrink-0">
          <Input
            placeholder="Nome da carga (opcional) — ex: Alfaiataria, Jeans..."
            value={titulo || ''}
            onChange={(e) => onTituloChange(e.target.value)}
            className="h-9 bg-background text-sm"
          />
        </div>
      )}

      {/* Busca */}
      <div className="px-4 py-2.5 border-b bg-muted/20 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo ou referência..."
            value={buscaProduto}
            onChange={(e) => onBuscaChange(e.target.value)}
            autoFocus
            className="pl-9 pr-8 h-9 bg-background"
          />
          {buscaProduto && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => onBuscaChange('')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Barra de contagem */}
      <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-muted-foreground border-b bg-muted/10 shrink-0">
        <span>{modeloGroups.length} modelo{modeloGroups.length !== 1 ? 's' : ''}</span>
        {selecionados > 0 && (
          <>
            <span>·</span>
            <span className="text-primary font-medium">
              {selecionados} selecionado{selecionados !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>

      {/* Lista de modelos */}
      <div className="flex-1 overflow-y-auto pb-40">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : modeloGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum modelo encontrado</p>
            {buscaProduto && (
              <p className="text-xs mt-1 text-muted-foreground/70">Tente outro termo de busca</p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {modeloGroups.map(grupo => {
              const emCarga = grupo.totalEmCarga > 0;
              return (
                <div
                  key={grupo.key}
                  className={cn(
                    "px-4 py-3 transition-colors",
                    emCarga && "bg-emerald-50/60 dark:bg-emerald-950/20"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                      <LotImage
                        src={grupo.imagemUrl}
                        alt={grupo.nomeExibicao}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info + chips */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold line-clamp-1 leading-snug">
                          {grupo.nomeExibicao}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                          {formatCurrency(grupo.valorUnitario)}
                        </span>
                      </div>

                      {/* Size chips ou controle solo */}
                      {grupo.skus[0]?.tamanho ? (
                        /* Produtos COM tamanho: chips de tamanho */
                        <div className="flex flex-wrap gap-1.5">
                          {grupo.skus.map(sku => {
                            const item = itensCarga.find(i => i.itemId === sku.id);
                            const qtd = item?.quantidade || 0;
                            const semEstoque = sku.disponivel <= 0;

                            if (qtd > 0) {
                              return (
                                <div
                                  key={sku.id}
                                  className="inline-flex items-center bg-primary text-primary-foreground rounded-lg text-xs font-semibold overflow-hidden"
                                >
                                  <span className="pl-2.5 pr-1 py-1 leading-none">{sku.tamanho}</span>
                                  <span className="pr-1 py-1 opacity-60 leading-none">·</span>
                                  <span className="pr-1.5 py-1 leading-none tabular-nums">{qtd}</span>
                                  <button
                                    className="w-6 h-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
                                    onClick={() => handleDecrement(sku, qtd)}
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <button
                                    className="w-6 h-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation disabled:opacity-40"
                                    onClick={() => handleIncrement(sku, qtd)}
                                    disabled={qtd >= sku.disponivel}
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <button
                                key={sku.id}
                                disabled={semEstoque}
                                onClick={() => handleSkuClick(sku)}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-colors touch-manipulation leading-none",
                                  semEstoque
                                    ? "border-border/50 text-muted-foreground/40 cursor-not-allowed bg-muted/20"
                                    : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/60 active:bg-primary/20"
                                )}
                              >
                                <span>{sku.tamanho}</span>
                                {!semEstoque && (
                                  <span className="text-[10px] opacity-60 tabular-nums">{sku.disponivel}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* Produto SEM tamanho (solo): controles + / - inline */
                        (() => {
                          const sku = grupo.skus[0];
                          if (!sku) return null;
                          const item = itensCarga.find(i => i.itemId === sku.id);
                          const qtd = item?.quantidade || 0;
                          const semEstoque = sku.disponivel <= 0;
                          return (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                "text-xs font-medium",
                                semEstoque ? "text-muted-foreground/50" : "text-emerald-600"
                              )}>
                                {semEstoque ? 'Sem estoque' : `Disp: ${sku.disponivel}`}
                              </span>
                              {!semEstoque && qtd === 0 && (
                                <button
                                  onClick={() => handleSkuClick(sku)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-medium transition-colors touch-manipulation"
                                >
                                  <Plus size={11} />
                                  Adicionar
                                </button>
                              )}
                              {qtd > 0 && (
                                <div className="inline-flex items-center bg-primary text-primary-foreground rounded-lg text-xs font-semibold overflow-hidden">
                                  <span className="pl-2.5 pr-1.5 py-1 leading-none tabular-nums">{qtd} pç</span>
                                  <button
                                    className="w-6 h-full flex items-center justify-center hover:bg-white/20 transition-colors touch-manipulation"
                                    onClick={() => handleDecrement(sku, qtd)}
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <button
                                    className="w-6 h-full flex items-center justify-center hover:bg-white/20 transition-colors touch-manipulation disabled:opacity-40"
                                    onClick={() => handleIncrement(sku, qtd)}
                                    disabled={qtd >= sku.disponivel}
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
