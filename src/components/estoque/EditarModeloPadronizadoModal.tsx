import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, Check, Pencil } from 'lucide-react';
import {
    useModelosPadronizados,
    ModeloPadronizado,
    GradeAtacado,
} from '@/hooks/useModelosPadronizados';
import { GradesEditor } from './GradesEditor';

interface Props {
    modelo: ModeloPadronizado | null;
    open: boolean;
    onClose: () => void;
}

export function EditarModeloPadronizadoModal({ modelo, open, onClose }: Props) {
    const { editarModeloPadronizado } = useModelosPadronizados();

    const [nome, setNome] = useState('');
    const [composicao, setComposicao] = useState('');
    const [colecao, setColecao] = useState('');
    const [precoVenda, setPrecoVenda] = useState('');
    const [custoProducao, setCustoProducao] = useState('');
    const [grades, setGrades] = useState<GradeAtacado[]>([]);
    const [saving, setSaving] = useState(false);

    // Preencher com dados atuais do modelo
    useEffect(() => {
        if (open && modelo) {
            // O nome do modelo pai tem o formato "Nome — REFERENCIA", extraímos só o nome
            const nomeSemRef = modelo.nome.split('—')[0].trim();
            setNome(nomeSemRef);
            setComposicao(modelo.meta.composicao ?? '');
            setColecao(modelo.meta.colecao ?? '');
            setPrecoVenda(String(modelo.precoUnitario ?? ''));
            setCustoProducao(String(modelo.meta.custoProducao ?? ''));
            setGrades(modelo.meta.grades ?? []);
        }
    }, [open, modelo]);

    // Reset ao fechar
    useEffect(() => {
        if (!open) {
            setNome('');
            setComposicao('');
            setColecao('');
            setPrecoVenda('');
            setCustoProducao('');
            setGrades([]);
        }
    }, [open]);

    const handleSave = async () => {
        if (!modelo) return;
        if (!nome.trim()) { toast.error('Informe o nome do modelo'); return; }
        const pv = parseFloat(precoVenda);
        if (isNaN(pv) || pv <= 0) { toast.error('Informe o preço de venda'); return; }

        setSaving(true);
        try {
            await editarModeloPadronizado(modelo.id, {
                nome: nome.trim(),
                composicao: composicao.trim(),
                colecao: colecao.trim(),
                precoVenda: pv,
                custoProducao: parseFloat(custoProducao) || 0,
                grades,
            });
            toast.success(`Modelo "${nome}" atualizado com sucesso!`);
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao editar modelo');
        } finally {
            setSaving(false);
        }
    };

    if (!modelo) return null;

    const tamanhosDasVariacoes = modelo.variacoes.map(v => v.tamanho);

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-primary" />
                        Editar Modelo Padronizado
                    </DialogTitle>
                    <DialogDescription>
                        Edite as informações do modelo{' '}
                        <span className="font-mono font-bold text-foreground">{modelo.meta.referencia}</span>.
                        Os tamanhos e variações de estoque são gerenciados separadamente.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-auto">
                    <div className="px-6 py-4 space-y-6">

                        {/* ── Nome ─────────────────────────────── */}
                        <div className="space-y-1.5">
                            <Label htmlFor="em-nome" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Nome do Modelo *
                            </Label>
                            <Input
                                id="em-nome"
                                value={nome}
                                onChange={e => setNome(e.target.value)}
                                placeholder="Ex: Short Jeans Claro"
                                className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                            />
                        </div>

                        {/* ── Composição + Coleção ───────────────── */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="em-comp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Composição / Tecido
                                </Label>
                                <Input
                                    id="em-comp"
                                    value={composicao}
                                    onChange={e => setComposicao(e.target.value)}
                                    placeholder="Ex: 70% Algodão, 30% Elastano"
                                    className="h-10 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="em-col" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Coleção
                                </Label>
                                <Input
                                    id="em-col"
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
                                <Label htmlFor="em-pv" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Preço de Venda (R$) *
                                </Label>
                                <Input
                                    id="em-pv"
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
                                <Label htmlFor="em-cp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Custo de Produção (R$)
                                </Label>
                                <Input
                                    id="em-cp"
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

                        {/* ── Grades de Atacado ─────────────────── */}
                        <GradesEditor
                            tamanhosSelecionados={tamanhosDasVariacoes}
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
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 gap-2"
                    >
                        {saving
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
                            : <><Check className="h-4 w-4" /> Salvar Alterações</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
