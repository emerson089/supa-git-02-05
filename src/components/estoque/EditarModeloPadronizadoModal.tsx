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
    VariacaoModelo,
    TAMANHOS_LETRAS,
    TAMANHOS_NUMERICOS,
} from '@/hooks/useModelosPadronizados';
import { useAddMovimentacao } from '@/hooks/useEstoqueData';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X, Package } from 'lucide-react';
import { GradesEditor } from './GradesEditor';

interface Props {
    modelo: ModeloPadronizado | null;
    open: boolean;
    onClose: () => void;
}

export function EditarModeloPadronizadoModal({ modelo, open, onClose }: Props) {


    const [nome, setNome] = useState('');
    const [composicao, setComposicao] = useState('');
    const [colecao, setColecao] = useState('');
    const [precoVenda, setPrecoVenda] = useState('');
    const [custoProducao, setCustoProducao] = useState('');
    const [grades, setGrades] = useState<GradeAtacado[]>([]);
    const [saving, setSaving] = useState(false);
    const [localVariacoes, setLocalVariacoes] = useState<VariacaoModelo[]>([]);
    const [addingSize, setAddingSize] = useState(false);
    const [newSize, setNewSize] = useState('');
    const [newSizeQtd, setNewSizeQtd] = useState('');

    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { mutateAsync: addMovimentacao } = useAddMovimentacao();
    const { editarModeloPadronizado, adicionarVariacao } = useModelosPadronizados();

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
            
            // Ordenar variações
            const ORDEM = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];
            const sorted = [...modelo.variacoes].sort(
                (a, b) => ORDEM.indexOf(a.tamanho) - ORDEM.indexOf(b.tamanho)
            );
            setLocalVariacoes(sorted);
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
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erro ao editar modelo');
        } finally {
            setSaving(false);
        }
    };

    const handleAddSize = async () => {
        if (!modelo) return;
        if (!newSize.trim()) return;
        const qtd = parseInt(newSizeQtd, 10) || 0;

        setSaving(true);
        try {
            const novaVar = await adicionarVariacao(modelo.id, newSize.trim().toUpperCase(), qtd);
            
            // Adicionar movimentação de entrada inicial
            if (qtd > 0) {
                await addMovimentacao({
                    itemId: novaVar.id,
                    tipo: 'entrada',
                    quantidade: qtd,
                    motivo: `Criação de variação (Edição) - Tam ${newSize}`,
                    producaoId: null
                });
            }

            toast.success(`Tamanho ${newSize} adicionado!`);
            setAddingSize(false);
            setNewSize('');
            setNewSizeQtd('');
            
            // Atualizar lista local
            const ORDEM = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];
            const novasVars = [...localVariacoes, { 
                ...novaVar, 
                tamanho: newSize.trim().toUpperCase(), 
                referencia: `${modelo.meta.referencia}-${newSize.trim().toUpperCase()}`,
                modeloId: modelo.id 
            } as VariacaoModelo].sort(
                (a, b) => ORDEM.indexOf(a.tamanho) - ORDEM.indexOf(b.tamanho)
            );
            setLocalVariacoes(novasVars);
            
            queryClient.invalidateQueries({ queryKey: ['modelos-padronizados', user?.id] });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erro ao adicionar tamanho');
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

                        {/* ── Tamanhos ───────────────────────────── */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Package className="h-3.5 w-3.5" />
                                    Tamanhos do Modelo
                                </Label>
                                {!addingSize && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setAddingSize(true)}
                                        className="h-7 text-xs gap-1 border border-dashed border-primary/30 text-primary hover:bg-primary/5 font-bold"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Novo Tamanho
                                    </Button>
                                )}
                            </div>

                            {addingSize && (
                                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-end gap-3">
                                        <div className="space-y-1.5 flex-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Tamanho</Label>
                                            <Input 
                                                placeholder="Ex: 46" 
                                                className="h-9 shadow-sm"
                                                value={newSize}
                                                onChange={e => setNewSize(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-1.5 w-24">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Qtd Inicial</Label>
                                            <Input 
                                                type="number" 
                                                placeholder="0" 
                                                className="h-9 shadow-sm"
                                                value={newSizeQtd}
                                                onChange={e => setNewSizeQtd(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={handleAddSize} disabled={saving} className="h-9 px-3">
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                Salvar
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setAddingSize(false)} disabled={saving} className="h-9 px-2">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {localVariacoes.map(v => (
                                    <div 
                                        key={v.id}
                                        className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border flex flex-col items-center min-w-[50px]"
                                    >
                                        <span className="text-xs font-black">{v.tamanho}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold">{v.quantidade} pçs</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* ── Grades de Atacado ─────────────────── */}
                        <GradesEditor
                            tamanhosSelecionados={localVariacoes.map(v => v.tamanho)}
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
