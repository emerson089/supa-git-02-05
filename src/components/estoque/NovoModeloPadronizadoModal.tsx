import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Upload, Loader2, RefreshCw, ImagePlus, Package, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
    useModelosPadronizados,
    TipoGarment,
    TIPO_GARMENT_LABELS,
    TAMANHOS_LETRAS,
    TAMANHOS_NUMERICOS,
    TAMANHOS_ESPECIAIS,
    Tamanho,
    GradeAtacado,
} from '@/hooks/useModelosPadronizados';
import { GradesEditor } from './GradesEditor';

interface Props {
    open: boolean;
    onClose: () => void;
}

const TODOS_TAMANHOS: Tamanho[] = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS, ...TAMANHOS_ESPECIAIS];

export function NovoModeloPadronizadoModal({ open, onClose }: Props) {
    const { gerarReferenciaBase, criarModeloPadronizado } = useModelosPadronizados();

    // Form fields
    const [nome, setNome] = useState('');
    const [tipo, setTipo] = useState<TipoGarment | ''>('');
    const [composicao, setComposicao] = useState('');
    const [colecao, setColecao] = useState('');
    const [precoVenda, setPrecoVenda] = useState('');
    const [custoProducao, setCustoProducao] = useState('');
    const [referencia, setReferencia] = useState('');
    const [gerandoRef, setGerandoRef] = useState(false);
    const [imagemUrl, setImagemUrl] = useState('');
    const [imagemPreview, setImagemPreview] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [saving, setSaving] = useState(false);

    // Tamanhos selecionados e estoque inicial
    const [tamanhosSelecionados, setTamanhosSelecionados] = useState<Set<Tamanho>>(new Set());
    const [estoqueInicial, setEstoqueInicial] = useState<Record<string, number | ''>>({});
    const [grades, setGrades] = useState<GradeAtacado[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Gerar referência ao abrir modal ou mudar tipo
    useEffect(() => {
        if (open && tipo) {
            gerarRef(tipo);
        } else if (open && !tipo) {
            setReferencia('');
        }
    }, [open, tipo]);

    // Reset ao fechar
    useEffect(() => {
        if (!open) {
            setNome('');
            setComposicao('');
            setColecao('');
            setPrecoVenda('');
            setCustoProducao('');
            setImagemUrl('');
            setImagemPreview('');
            setTamanhosSelecionados(new Set());
            setEstoqueInicial({});
            setGrades([]);
            setTipo('');
        }
    }, [open]);

    const gerarRef = async (t: TipoGarment | '') => {
        if (!t) return;
        setGerandoRef(true);
        try {
            const ref = await gerarReferenciaBase(t);
            setReferencia(ref);
        } finally {
            setGerandoRef(false);
        }
    };

    const toggleTamanho = (t: Tamanho) => {
        setTamanhosSelecionados(prev => {
            const next = new Set(prev);
            if (next.has(t)) {
                next.delete(t);
                setEstoqueInicial(prevEst => { const { [t]: _, ...rest } = prevEst; return rest; });
            } else {
                next.add(t);
            }
            return next;
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => setImagemPreview(reader.result as string);
        reader.readAsDataURL(file);

        setUploadingImage(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { toast.error('Não autenticado'); return; }
            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const path = `${user.id}/produtos/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('lotes').upload(path, file);
            if (error) throw error;
            setImagemUrl(path);
            toast.success('Imagem carregada!');
        } catch {
            toast.error('Erro ao carregar imagem');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async () => {
        if (!nome.trim()) { toast.error('Informe o nome do modelo'); return; }
        if (!tipo) { toast.error('Selecione o tipo'); return; }
        if (!referencia.trim()) { toast.error('Referência é obrigatória'); return; }
        if (tamanhosSelecionados.size === 0) { toast.error('Selecione ao menos um tamanho'); return; }
        const pv = parseFloat(precoVenda);
        if (isNaN(pv) || pv <= 0) { toast.error('Informe o preço de venda'); return; }

        // Valida estoque inicial: todos os tamanhos devem ter quantidade preenchida
        const tamanhosFaltando = Array.from(tamanhosSelecionados).filter(
            t => estoqueInicial[t] === '' || estoqueInicial[t] === undefined
        );
        if (tamanhosFaltando.length > 0) {
            toast.warning(
                `Preencha o estoque inicial para: ${tamanhosFaltando.join(', ')}. Se não houver peças, informe 0.`
            );
            return;
        }

        setSaving(true);
        try {
            await criarModeloPadronizado({
                nome: nome.trim(),
                tipo,
                composicao: composicao.trim(),
                colecao: colecao.trim(),
                precoVenda: pv,
                custoProducao: parseFloat(custoProducao) || 0,
                imagemUrl: imagemUrl || undefined,
                referencia: referencia.trim(),
                tamanhos: Array.from(tamanhosSelecionados),
                estoqueInicialPorTamanho: Object.fromEntries(
                    Object.entries(estoqueInicial).map(([k, v]) => [k, typeof v === 'number' ? v : 0])
                ),
                grades,
            });
            toast.success(`Modelo "${nome}" criado com ${tamanhosSelecionados.size} variação(ões)!`);
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao criar modelo');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Novo Modelo Padronizado
                    </DialogTitle>
                    <DialogDescription>
                        Cadastre um modelo com variações de tamanho e código de barras automático
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-auto">
                    <div className="px-6 py-4 space-y-6">

                        {/* ── Imagem ─────────────────────────────── */}
                        <div className="flex gap-6 items-start">
                            <div
                                className="relative w-28 h-28 shrink-0 rounded-xl border-2 border-dashed border-border cursor-pointer overflow-hidden bg-muted/30 hover:border-primary/50 transition-colors group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {imagemPreview ? (
                                    <>
                                        <img src={imagemPreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ImagePlus className="h-6 w-6 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-1">
                                        {uploadingImage
                                            ? <Loader2 className="h-6 w-6 animate-spin" />
                                            : <><ImagePlus className="h-6 w-6" /><span className="text-[10px]">Foto</span></>}
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </div>

                            <div className="flex-1 space-y-4">
                                {/* Nome */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="pm-nome" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Nome do Modelo *
                                    </Label>
                                    <Input
                                        id="pm-nome"
                                        value={nome}
                                        onChange={e => setNome(e.target.value)}
                                        placeholder="Ex: Short Jeans Claro"
                                        className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                    />
                                </div>

                                {/* Tipo */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Tipo *
                                    </Label>
                                    <Select value={tipo} onValueChange={v => setTipo(v as TipoGarment)}>
                                        <SelectTrigger className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0">
                                            <SelectValue placeholder="Selecione um tipo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(TIPO_GARMENT_LABELS).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Referência ─────────────────────────── */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Referência Base *
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    value={referencia}
                                    onChange={e => setReferencia(e.target.value)}
                                    placeholder="Ex: CA2603-0001"
                                    className="h-10 font-mono shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={() => gerarRef(tipo)}
                                    disabled={gerandoRef}
                                    title="Gerar nova referência"
                                >
                                    {gerandoRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Formato: [SIGLA][AA][MM]-[SEQUENCIAL]. Variações receberão -{'{TAMANHO}'} ao final.
                            </p>
                        </div>

                        {/* ── Composição + Coleção ───────────────── */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="pm-comp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Composição / Tecido
                                </Label>
                                <Select value={composicao} onValueChange={setComposicao}>
                                    <SelectTrigger id="pm-comp" className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Alfaiataria">Alfaiataria</SelectItem>
                                        <SelectItem value="Jeans 100%">Jeans 100%</SelectItem>
                                        <SelectItem value="Jeans Lycra">Jeans Lycra</SelectItem>
                                        <SelectItem value="Alfaiataria Marrante">Alfaiataria Marrante</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="pm-col" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Coleção
                                </Label>
                                <Input
                                    id="pm-col"
                                    value={colecao}
                                    onChange={e => setColecao(e.target.value)}
                                    placeholder="Ex: Verão 2026"
                                    className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                />
                            </div>
                        </div>

                        {/* ── Preços ─────────────────────────────── */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="pm-pv" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Preço de Venda (R$) *
                                </Label>
                                <Input
                                    id="pm-pv"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={precoVenda}
                                    onChange={e => setPrecoVenda(e.target.value)}
                                    placeholder="0,00"
                                    className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="pm-cp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Custo de Produção (R$)
                                </Label>
                                <Input
                                    id="pm-cp"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={custoProducao}
                                    onChange={e => setCustoProducao(e.target.value)}
                                    placeholder="0,00"
                                    className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* ── Seletor de tamanhos ────────────────── */}
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Tamanhos *
                            </Label>

                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Letras</p>
                                <div className="flex gap-2 flex-wrap">
                                    {TAMANHOS_LETRAS.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => toggleTamanho(t)}
                                            className={cn(
                                                'h-9 px-4 rounded-lg text-sm font-semibold border-2 transition-all',
                                                tamanhosSelecionados.has(t)
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Especiais</p>
                                <div className="flex gap-2 flex-wrap">
                                    {TAMANHOS_ESPECIAIS.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => toggleTamanho(t)}
                                            className={cn(
                                                'h-9 px-4 rounded-lg text-sm font-semibold border-2 transition-all',
                                                tamanhosSelecionados.has(t)
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                            )}
                                            title="Tamanho Único"
                                        >
                                            {t}
                                        </button>
                                    ))}
                                    <span className="text-xs text-muted-foreground self-center ml-2">
                                        Use "SORTIDO" para cadastrar o estoque total sem separar por tamanho.
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Numéricos</p>
                                <div className="flex gap-2 flex-wrap">
                                    {TAMANHOS_NUMERICOS.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => toggleTamanho(t)}
                                            className={cn(
                                                'h-9 px-4 rounded-lg text-sm font-semibold border-2 transition-all',
                                                tamanhosSelecionados.has(t)
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Estoque inicial por tamanho ───────── */}
                        {tamanhosSelecionados.size > 0 && (
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Estoque Inicial por Tamanho
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Array.from(tamanhosSelecionados).map(t => (
                                        <div key={t} className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs font-mono font-bold">
                                                    {referencia}-{t}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground w-6 shrink-0">{t}</span>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={estoqueInicial[t] ?? ''}
                                                    placeholder="0"
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        if (val === '') {
                                                            setEstoqueInicial(prev => ({ ...prev, [t]: '' }));
                                                        } else {
                                                            const num = parseInt(val, 10);
                                                            setEstoqueInicial(prev => ({ ...prev, [t]: isNaN(num) ? '' : Math.max(0, num) }));
                                                        }
                                                    }}
                                                    className="h-9 text-center shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Total:{' '}
                                    <span className="font-bold text-primary">
                                        {Object.values(estoqueInicial).reduce((s: number, v) => s + (typeof v === 'number' ? v : 0), 0)} peças
                                    </span>
                                </p>
                            </div>
                        )}

                        {/* ── Separador + Grades de Atacado ────── */}
                        <Separator />
                        <GradesEditor
                            tamanhosSelecionados={Array.from(tamanhosSelecionados)}
                            precoUnitario={parseFloat(precoVenda) || 0}
                            grades={grades}
                            onChange={setGrades}
                        />
                    </div>
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || uploadingImage}
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 gap-2"
                    >
                        {saving
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</>
                            : <><Check className="h-4 w-4" /> Criar Modelo</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
