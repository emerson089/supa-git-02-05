import { useCallback, useMemo } from 'react';
import { useEstoque, ItemEstoque } from '@/contexts/EstoqueContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────
export type TipoGarment = 'SH' | 'CA' | 'SA' | 'VS' | 'CJ' | 'MK' | 'OT';

export const TIPO_GARMENT_LABELS: Record<TipoGarment, string> = {
    SH: 'Short (SH)',
    CA: 'Calça (CA)',
    SA: 'Saia (SA)',
    VS: 'Vestido (VS)',
    CJ: 'Conjunto (CJ)',
    MK: 'Macaquinho (MK)',
    OT: 'Outro (OT)',
};

export const TAMANHOS_LETRAS = ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3'] as const;
export const TAMANHOS_NUMERICOS = ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54'] as const;
export type Tamanho = typeof TAMANHOS_LETRAS[number] | typeof TAMANHOS_NUMERICOS[number];

// Prefixo especial salvo na categoria para identificar modelos padronizados
export const CATEGORIA_MODELO_PAD = 'Modelo Padronizado';
export const CATEGORIA_VARIACAO_PAD = 'Variação Padronizada';

// Grade de atacado vinculada a um modelo
export interface GradeAtacado {
    id: string;
    nome: string;                                  // ex: "Grade Completa"
    itens: { tamanho: string; quantidade: number }[]; // tamanho → qtd por grade
    precoSugerido: number;                         // editável (default: soma qtd × preçoUnitario)
    totalPecas: number;                            // calculado
}

// Metadados extras são armazenados como JSON em `localizacao` no item PAI
export interface ModeloPadronizadoMeta {
    tipo: TipoGarment;
    composicao: string;
    colecao: string;
    custoProducao: number;
    referencia: string; // ex: SH2603-0042
    grades?: GradeAtacado[]; // grades de atacado (opcional)
}

// Estrutura de um Modelo Padronizado (item pai)
export interface ModeloPadronizado extends ItemEstoque {
    meta: ModeloPadronizadoMeta;
    variacoes: VariacaoModelo[];
}

// Estrutura de uma Variação (item filho)
export interface VariacaoModelo extends ItemEstoque {
    tamanho: string;      // ex: M
    referencia: string;   // ex: SH2603-0042-M
    modeloId: string;     // id do item pai (para referência lógica, guardado na localizacao)
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * A referência do modelo pai é guardada no campo `localizacao` como JSON.
 * Exemplo: {"tipo":"SH","composicao":"Denim","colecao":"Verão","custoProducao":25,"referencia":"SH2603-0042"}
 */
function parseMeta(localizacao: string | null | undefined): ModeloPadronizadoMeta | null {
    if (!localizacao) return null;
    try {
        const obj = JSON.parse(localizacao);
        if (obj && obj.referencia && obj.tipo) return obj as ModeloPadronizadoMeta;
    } catch {
        // não é JSON
    }
    return null;
}

/**
 * A variação guarda no campo `localizacao` um JSON com tamanho e referência
 * Ex: {"tamanho":"M","referencia":"SH2603-0042-M","modeloId":"uuid"}
 */
function parseVariacaoMeta(localizacao: string | null | undefined): { tamanho: string; referencia: string; modeloId: string } | null {
    if (!localizacao) return null;
    try {
        const obj = JSON.parse(localizacao);
        if (obj && obj.tamanho && obj.referencia) return obj;
    } catch {
        // não é JSON
    }
    return null;
}

// ─────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────
export function useModelosPadronizados() {
    const { itens, addItem, updateItem, removeItem } = useEstoque();
    const { user } = useAuth();

    // Todos os itens pai (modelo padronizado)
    const modelosPai = useMemo(() =>
        itens.filter(i => i.tipo === 'acabado' && i.categoria === CATEGORIA_MODELO_PAD),
        [itens]
    );

    // Todos os itens filhos (variações)
    const variacoes = useMemo(() =>
        itens.filter(i => i.tipo === 'acabado' && i.categoria === CATEGORIA_VARIACAO_PAD),
        [itens]
    );

    // Modelos com suas variações hidratadas
    const modelosComVariacoes: ModeloPadronizado[] = useMemo(() => {
        return modelosPai.map(pai => {
            const meta = parseMeta(pai.localizacao);
            if (!meta) return null;

            const vars: VariacaoModelo[] = variacoes
                .filter(v => {
                    const vm = parseVariacaoMeta(v.localizacao);
                    return vm?.modeloId === pai.id;
                })
                .map(v => {
                    const vm = parseVariacaoMeta(v.localizacao)!;
                    return {
                        ...v,
                        tamanho: vm.tamanho,
                        referencia: vm.referencia,
                        modeloId: pai.id,
                    };
                });

            return {
                ...pai,
                meta,
                variacoes: vars,
            } as ModeloPadronizado;
        }).filter(Boolean) as ModeloPadronizado[];
    }, [modelosPai, variacoes]);

    // ── Gerar próxima referência sequencial ──────────────────
    const gerarReferenciaBase = useCallback(async (tipo: TipoGarment): Promise<string> => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `${tipo}${yy}${mm}-`;

        // Buscar todos os itens que já usam o prefixo
        if (!user) return `${prefix}0001`;

        try {
            const { data } = await supabase
                .from('estoque_itens')
                .select('localizacao')
                .eq('user_id', user.id)
                .eq('categoria', CATEGORIA_MODELO_PAD);

            const nums: number[] = [];
            (data || []).forEach(row => {
                const meta = parseMeta(row.localizacao);
                if (meta?.referencia?.startsWith(prefix)) {
                    const seqStr = meta.referencia.split('-')[1];
                    const seq = parseInt(seqStr, 10);
                    if (!isNaN(seq)) nums.push(seq);
                }
            });

            const maxSeq = nums.length > 0 ? Math.max(...nums) : 0;
            const nextSeq = String(maxSeq + 1).padStart(4, '0');
            return `${prefix}${nextSeq}`;
        } catch {
            return `${prefix}0001`;
        }
    }, [user]);

    // ── Criar modelo padronizado + variações ────────────────
    const criarModeloPadronizado = useCallback(async (params: {
        nome: string;
        tipo: TipoGarment;
        composicao: string;
        colecao: string;
        precoVenda: number;
        custoProducao: number;
        imagemUrl?: string;
        referencia: string;
        tamanhos: string[];
        estoqueInicialPorTamanho: Record<string, number>; // tamanho -> quantidade inicial
        grades?: GradeAtacado[]; // grades de atacado (opcional)
    }) => {
        const meta: ModeloPadronizadoMeta = {
            tipo: params.tipo,
            composicao: params.composicao,
            colecao: params.colecao,
            custoProducao: params.custoProducao,
            referencia: params.referencia,
            grades: params.grades ?? [],
        };

        // Criar item PAI (sem quantidade direta; servidor de resumo)
        const totalQtd = Object.values(params.estoqueInicialPorTamanho).reduce((s, v) => s + v, 0);

        const pai = await addItem({
            nome: `${params.nome} — ${params.referencia}`,
            tipo: 'acabado',
            categoria: CATEGORIA_MODELO_PAD,
            quantidade: totalQtd,
            unidade: 'peças',
            quantidadeMinima: 0,
            precoUnitario: params.precoVenda,
            localizacao: JSON.stringify(meta),
            imagemUrl: params.imagemUrl,
        });

        // Criar uma variação para cada tamanho selecionado
        const variationPromises = params.tamanhos.map(tamanho => {
            const refVariacao = `${params.referencia}-${tamanho}`;
            const qtd = params.estoqueInicialPorTamanho[tamanho] ?? 0;

            const varMeta = { tamanho, referencia: refVariacao, modeloId: pai.id };
            return addItem({
                nome: `${params.nome} — ${refVariacao}`,
                tipo: 'acabado',
                categoria: CATEGORIA_VARIACAO_PAD,
                quantidade: qtd,
                unidade: 'peças',
                quantidadeMinima: 0,
                precoUnitario: params.precoVenda,
                localizacao: JSON.stringify(varMeta),
                imagemUrl: params.imagemUrl,
            });
        });

        await Promise.all(variationPromises);
        return pai;
    }, [addItem]);

    // ── Atualizar grades de um modelo ───────────────────────
    const updateModeloGrades = useCallback(async (modeloId: string, grades: GradeAtacado[]) => {
        const modelo = modelosPai.find(m => m.id === modeloId);
        if (!modelo) return;
        const metaAtual = parseMeta(modelo.localizacao);
        if (!metaAtual) return;
        const novasMeta: ModeloPadronizadoMeta = { ...metaAtual, grades };
        await updateItem(modeloId, { localizacao: JSON.stringify(novasMeta) });
    }, [modelosPai, updateItem]);

    // ── Editar metadados de um modelo padronizado ────────────
    const editarModeloPadronizado = useCallback(async (modeloId: string, params: {
        nome: string;
        composicao: string;
        colecao: string;
        precoVenda: number;
        custoProducao: number;
        grades?: GradeAtacado[];
    }) => {
        const modelo = modelosPai.find(m => m.id === modeloId);
        if (!modelo) return;
        const metaAtual = parseMeta(modelo.localizacao);
        if (!metaAtual) return;

        const novasMeta: ModeloPadronizadoMeta = {
            ...metaAtual,
            composicao: params.composicao,
            colecao: params.colecao,
            custoProducao: params.custoProducao,
            grades: params.grades ?? metaAtual.grades ?? [],
        };

        // Atualiza item pai
        await updateItem(modeloId, {
            nome: `${params.nome} — ${metaAtual.referencia}`,
            precoUnitario: params.precoVenda,
            localizacao: JSON.stringify(novasMeta),
        });

        // Atualiza preço de todas as variações
        const varsDoModelo = variacoes.filter(v => {
            const vm = parseVariacaoMeta(v.localizacao);
            return vm?.modeloId === modeloId;
        });
        await Promise.all(varsDoModelo.map(v => updateItem(v.id, { precoUnitario: params.precoVenda })));
    }, [modelosPai, variacoes, updateItem]);

    // ── Excluir modelo + todas as variações ─────────────────
    const excluirModeloPadronizado = useCallback(async (modeloId: string) => {
        const varsDoModelo = variacoes.filter(v => {
            const vm = parseVariacaoMeta(v.localizacao);
            return vm?.modeloId === modeloId;
        });
        await Promise.all(varsDoModelo.map(v => removeItem(v.id)));
        await removeItem(modeloId);
    }, [variacoes, removeItem]);

    // ── Obter variações de um modelo ────────────────────────
    const getVariacoesDe = useCallback((modeloId: string): VariacaoModelo[] => {
        return variacoes
            .filter(v => {
                const vm = parseVariacaoMeta(v.localizacao);
                return vm?.modeloId === modeloId;
            })
            .map(v => {
                const vm = parseVariacaoMeta(v.localizacao)!;
                return { ...v, tamanho: vm.tamanho, referencia: vm.referencia, modeloId };
            });
    }, [variacoes]);

    return {
        modelosPadronizados: modelosComVariacoes,
        variacoes,
        gerarReferenciaBase,
        criarModeloPadronizado,
        editarModeloPadronizado,
        excluirModeloPadronizado,
        getVariacoesDe,
        updateModeloGrades,
        parseMeta,
        parseVariacaoMeta,
        CATEGORIA_MODELO_PAD,
        CATEGORIA_VARIACAO_PAD,
    };
}
