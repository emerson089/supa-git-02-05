import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
    ModeloPadronizado,
    VariacaoModelo,
    TIPO_GARMENT_LABELS,
} from '@/hooks/useModelosPadronizados';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import {
    Package,
    Tag,
    Tags,
    Printer,
    Shirt,
    DollarSign,
    Palette,
    Hash,
    Layers,
} from 'lucide-react';
import { EtiquetasModal } from './EtiquetasModal';

interface Props {
    modelo: ModeloPadronizado | null;
    open: boolean;
    onClose: () => void;
}

function ModeloImage({ imagemUrl, nome }: { imagemUrl?: string; nome: string }) {
    const { signedUrl, loading } = useSignedUrl(imagemUrl);
    if (!imagemUrl) {
        return (
            <div className="w-full h-48 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 flex items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground/30" />
            </div>
        );
    }
    if (loading) {
        return <div className="w-full h-48 rounded-xl bg-muted/50 animate-pulse" />;
    }
    return (
        <img
            src={signedUrl || imagemUrl}
            alt={nome}
            className="w-full h-48 rounded-xl object-cover shadow-md"
        />
    );
}

function getStockColor(qtd: number) {
    if (qtd === 0) return 'bg-red-100 text-red-700 border-red-200';
    if (qtd <= 3) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

export function DetalhesModeloPadronizadoModal({ modelo, open, onClose }: Props) {
    const [showEtiquetas, setShowEtiquetas] = useState(false);

    if (!modelo) return null;
    const { meta, variacoes, nome, precoUnitario } = modelo;

    const totalPecas = variacoes.reduce((s, v) => s + v.quantidade, 0);

    return (
        <>
            <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-purple-500/5 to-indigo-500/10">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-xl font-bold">{nome}</DialogTitle>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 border text-[10px] font-bold uppercase tracking-wider rounded-md gap-1">
                                        <Layers className="h-3 w-3" />
                                        Modelo Padronizado
                                    </Badge>
                                    <span className="text-xs text-muted-foreground font-mono">{meta.referencia}</span>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50"
                                onClick={() => setShowEtiquetas(true)}
                            >
                                <Printer className="h-4 w-4" />
                                Imprimir Etiquetas
                            </Button>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-auto">
                        <div className="px-6 py-4 space-y-6">
                            {/* Imagem + Dados principais */}
                            <div className="grid grid-cols-2 gap-6">
                                <ModeloImage imagemUrl={modelo.imagemUrl} nome={nome} />

                                <div className="space-y-3">
                                    {/* Tipo */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <Shirt className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Tipo:</span>
                                        <span className="font-semibold">{TIPO_GARMENT_LABELS[meta.tipo]}</span>
                                    </div>

                                    {/* Preço */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <DollarSign className="h-4 w-4 text-emerald-600" />
                                        <span className="text-muted-foreground">Venda:</span>
                                        <span className="font-bold text-emerald-600">
                                            R$ {(precoUnitario ?? 0).toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Custo */}
                                    {meta.custoProducao > 0 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Tag className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">Custo:</span>
                                            <span className="font-semibold">R$ {meta.custoProducao.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {/* Coleção */}
                                    {meta.colecao && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Palette className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">Coleção:</span>
                                            <span className="font-semibold">{meta.colecao}</span>
                                        </div>
                                    )}

                                    {/* Composição */}
                                    {meta.composicao && (
                                        <div className="flex items-start gap-2 text-sm">
                                            <Layers className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground">Composição:</span>
                                                <p className="font-semibold text-xs mt-0.5">{meta.composicao}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Total */}
                                    <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total em Estoque</p>
                                        <p className="text-2xl font-bold text-primary">{totalPecas}</p>
                                        <p className="text-xs text-muted-foreground">peças em {variacoes.length} variação(ões)</p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Tabela de variações */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <Tags className="h-4 w-4 text-primary" />
                                    Variações e Estoque
                                </h3>

                                <div className="rounded-xl border border-border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/40 border-b border-border">
                                                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tamanho</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referência</th>
                                                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código de Barras</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qtd.</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variacoes.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        Nenhuma variação cadastrada
                                                    </td>
                                                </tr>
                                            ) : (
                                                variacoes.map((v, idx) => (
                                                    <tr
                                                        key={v.id}
                                                        className={cn(
                                                            'border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20',
                                                            idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                                                        )}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <span className="font-bold text-base">{v.tamanho}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{v.referencia}</code>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <BarcodeInline value={v.referencia} />
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold">{v.quantidade}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Badge className={cn('text-[10px] border', getStockColor(v.quantidade))}>
                                                                {v.quantidade === 0 ? 'Esgotado' : v.quantidade <= 3 ? 'Baixo' : 'OK'}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <EtiquetasModal
                open={showEtiquetas}
                onClose={() => setShowEtiquetas(false)}
                variacoes={variacoes}
                nomeModelo={nome}
                precoVenda={precoUnitario ?? 0}
            />
        </>
    );
}

// ── Mini visualização de barcode inline ─────────────────
function BarcodeInline({ value }: { value: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const load = async () => {
            if (!canvasRef.current || !value) return;
            try {
                const JsBarcode = (await import('jsbarcode')).default;
                JsBarcode(canvasRef.current, value, {
                    format: 'CODE128',
                    width: 1.2,
                    height: 28,
                    displayValue: false,
                    margin: 2,
                });
            } catch (e) {
                console.warn('JsBarcode não carregado:', e);
            }
        };
        load();
    }, [value]);

    return <canvas ref={canvasRef} style={{ maxWidth: 100, height: 32 }} />;
}
