import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, X, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VariacaoModelo } from '@/hooks/useModelosPadronizados';

interface Props {
    open: boolean;
    onClose: () => void;
    variacoes: VariacaoModelo[];
    nomeModelo: string;
    precoVenda: number;
}

interface EtiquetaConfig {
    variacao: VariacaoModelo;
    quantidade: number;
    selecionada: boolean;
}

export function EtiquetasModal({ open, onClose, variacoes, nomeModelo, precoVenda }: Props) {
    const [configs, setConfigs] = useState<EtiquetaConfig[]>([]);
    const printRef = useRef<HTMLDivElement>(null);

    // Iniciar configs ao abrir
    useEffect(() => {
        if (open && variacoes.length > 0) {
            setConfigs(variacoes.map(v => ({
                variacao: v,
                quantidade: 1,
                selecionada: true,
            })));
        }
    }, [open, variacoes]);

    const toggleSelecionado = (id: string) => {
        setConfigs(prev => prev.map(c =>
            c.variacao.id === id ? { ...c, selecionada: !c.selecionada } : c
        ));
    };

    const setQuantidade = (id: string, qtd: number) => {
        setConfigs(prev => prev.map(c =>
            c.variacao.id === id ? { ...c, quantidade: Math.max(1, qtd) } : c
        ));
    };

    const etiquetasParaImprimir = configs.filter(c => c.selecionada);
    const totalEtiquetas = etiquetasParaImprimir.reduce((s, c) => s + c.quantidade, 0);

    const handlePrint = () => {
        window.print();
    };

    // Gerar lista expandida de etiquetas
    const etiquetasExpandidas: { variacao: VariacaoModelo; idx: number }[] = [];
    etiquetasParaImprimir.forEach(c => {
        for (let i = 0; i < c.quantidade; i++) {
            etiquetasExpandidas.push({ variacao: c.variacao, idx: etiquetasExpandidas.length });
        }
    });

    return (
        <>
            {/* Estilos de impressão injetados */}
            <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #etiquetas-print-area,
          #etiquetas-print-area * { visibility: visible !important; }
          #etiquetas-print-area {
            position: fixed !important;
            top: 0; left: 0;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .etiqueta-item {
            width: 50mm !important;
            height: 25mm !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
            border: 0.5pt solid #ccc !important;
            margin: 1mm !important;
            display: inline-block !important;
            vertical-align: top !important;
          }
        }
      `}</style>

            <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5 text-primary" />
                            Imprimir Etiquetas
                        </DialogTitle>
                        <DialogDescription>
                            Selecione as variações e quantidades de etiquetas para imprimir
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-auto">
                        <div className="px-6 py-4 space-y-3">
                            {configs.map(config => (
                                <div
                                    key={config.variacao.id}
                                    className={cn(
                                        'flex items-center gap-4 p-3 rounded-xl border transition-colors',
                                        config.selecionada ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'
                                    )}
                                >
                                    <Checkbox
                                        id={`et-${config.variacao.id}`}
                                        checked={config.selecionada}
                                        onCheckedChange={() => toggleSelecionado(config.variacao.id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm">{config.variacao.tamanho}</p>
                                        <code className="text-xs text-muted-foreground font-mono">{config.variacao.referencia}</code>
                                    </div>
                                    {/* Contador */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setQuantidade(config.variacao.id, config.quantidade - 1)}
                                            disabled={!config.selecionada}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={config.quantidade}
                                            onChange={e => setQuantidade(config.variacao.id, parseInt(e.target.value) || 1)}
                                            disabled={!config.selecionada}
                                            className="h-7 w-14 text-center text-sm p-1 border-border"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setQuantidade(config.variacao.id, config.quantidade + 1)}
                                            disabled={!config.selecionada}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                            <span className="font-bold text-foreground">{totalEtiquetas}</span> etiqueta(s) a imprimir
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button
                                onClick={handlePrint}
                                disabled={totalEtiquetas === 0}
                                className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                            >
                                <Printer className="h-4 w-4" />
                                Imprimir
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Área de impressão (oculta na tela, visível ao imprimir) */}
            <div id="etiquetas-print-area" style={{ display: 'none' }}>
                {etiquetasExpandidas.map(({ variacao, idx }) => (
                    <EtiquetaItem
                        key={idx}
                        variacao={variacao}
                        nomeModelo={nomeModelo}
                        precoVenda={precoVenda}
                    />
                ))}
            </div>
        </>
    );
}

// ── Etiqueta individual 50x25mm ─────────────────────────
function EtiquetaItem({
    variacao,
    nomeModelo,
    precoVenda,
}: {
    variacao: VariacaoModelo;
    nomeModelo: string;
    precoVenda: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const load = async () => {
            if (!canvasRef.current) return;
            try {
                const JsBarcode = (await import('jsbarcode')).default;
                JsBarcode(canvasRef.current, variacao.referencia, {
                    format: 'CODE128',
                    width: 1.5,
                    height: 32,
                    displayValue: false,
                    margin: 1,
                    background: '#ffffff',
                    lineColor: '#000000',
                });
            } catch (e) {
                console.warn('JsBarcode erro:', e);
            }
        };
        load();
    }, [variacao.referencia]);

    const nomeCurto = nomeModelo.length > 28 ? nomeModelo.substring(0, 28) + '…' : nomeModelo;

    return (
        <div
            className="etiqueta-item"
            style={{
                width: '50mm',
                height: '25mm',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.5mm 2mm',
                fontFamily: 'Arial, sans-serif',
                fontSize: '7pt',
                boxSizing: 'border-box',
                border: '0.5pt solid #ccc',
                margin: '1mm',
                verticalAlign: 'top',
                backgroundColor: '#fff',
            }}
        >
            {/* Nome do modelo */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '6.5pt', lineHeight: 1.1 }}>
                {nomeCurto}
            </div>

            {/* Código de barras */}
            <canvas ref={canvasRef} style={{ maxWidth: '46mm', height: '12mm' }} />

            {/* Referência */}
            <div style={{ fontSize: '6pt', fontFamily: 'monospace', color: '#333' }}>
                {variacao.referencia}
            </div>

            {/* Preço + Tamanho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#1a7f37' }}>
                    R$ {precoVenda.toFixed(2)}
                </span>
                <span style={{
                    fontSize: '9pt',
                    fontWeight: 'bold',
                    background: '#1a1a1a',
                    color: '#fff',
                    padding: '0.5mm 2mm',
                    borderRadius: '1mm',
                }}>
                    {variacao.tamanho}
                </span>
            </div>
        </div>
    );
}
