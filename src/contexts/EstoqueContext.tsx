import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import {
  useEstoqueItens,
  useEstoqueMovimentacoes,
  useAddItem,
  useUpdateItem,
  useRemoveItem,
  useAddMovimentacao,
  ItemEstoque as DbItemEstoque,
  MovimentacaoEstoque,
  TipoEstoque,
} from '@/hooks/useEstoqueData';

export type StatusEstoque = 'disponivel' | 'em_producao' | 'reservado' | 'baixo_estoque';

// Extended item with computed status for backward compatibility
export interface ItemEstoque extends DbItemEstoque {
  status: StatusEstoque;
}

export type { TipoEstoque, MovimentacaoEstoque };

// Legacy type mapping for backward compatibility
type LegacyTipo = 'materia_prima' | 'produto_acabado';

const mapLegacyTipo = (tipo: LegacyTipo): TipoEstoque => {
  return tipo === 'materia_prima' ? 'materia-prima' : 'acabado';
};

const calcularStatus = (item: DbItemEstoque): StatusEstoque => {
  if (item.quantidade <= 0) return 'em_producao';
  if (item.quantidade <= item.quantidadeMinima) return 'baixo_estoque';
  return 'disponivel';
};

interface EstoqueContextType {
  itens: ItemEstoque[];
  movimentacoes: MovimentacaoEstoque[];
  isLoading: boolean;
  addItem: (item: {
    nome: string;
    tipo: LegacyTipo | TipoEstoque;
    categoria: string;
    quantidade: number;
    unidade: string;
    quantidadeMinima: number;
    precoUnitario: number;
    localizacao: string;
    imagemUrl?: string;
    loteProducaoId?: string;
  }) => Promise<ItemEstoque>;
  updateItem: (id: string, data: Partial<{
    nome: string;
    tipo: LegacyTipo | TipoEstoque;
    categoria: string;
    quantidade: number;
    unidade: string;
    quantidadeMinima: number;
    precoUnitario: number;
    localizacao: string;
    imagemUrl: string;
  }>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  getItemById: (id: string) => ItemEstoque | undefined;
  getItensByTipo: (tipo: LegacyTipo | TipoEstoque) => ItemEstoque[];
  deduzirEstoque: (itemId: string, quantidade: number, loteProducaoId: string) => Promise<boolean>;
  adicionarEstoque: (itemId: string, quantidade: number, motivo: string, loteProducaoId?: string) => Promise<void>;
  integrarProducao: (nome: string, quantidade: number, loteProducaoId: string, imagemUrl?: string, precoVenda?: number, categoria?: string) => Promise<ItemEstoque>;
  criarProdutoAcabado: (nome: string, quantidade: number, loteProducaoId: string, categoria?: string) => Promise<ItemEstoque>;
  verificarDisponibilidade: (itemId: string, quantidade: number) => boolean;
  getMateriasPrimas: () => ItemEstoque[];
  getProdutosAcabados: () => ItemEstoque[];
}

const EstoqueContext = createContext<EstoqueContextType | undefined>(undefined);

export function EstoqueProvider({ children }: { children: ReactNode }) {
  const { data: dbItens = [], isLoading: isLoadingItens } = useEstoqueItens();
  const { data: movimentacoes = [], isLoading: isLoadingMov } = useEstoqueMovimentacoes();
  const addItemMutation = useAddItem();
  const updateItemMutation = useUpdateItem();
  const removeItemMutation = useRemoveItem();
  const addMovimentacaoMutation = useAddMovimentacao();

  const isLoading = isLoadingItens || isLoadingMov;

  // Add computed status to items
  const itens: ItemEstoque[] = useMemo(() => 
    dbItens.map(item => ({ ...item, status: calcularStatus(item) })),
    [dbItens]
  );

  const normalizeTipo = (tipo: LegacyTipo | TipoEstoque): TipoEstoque => {
    if (tipo === 'materia_prima' || tipo === 'produto_acabado') {
      return mapLegacyTipo(tipo);
    }
    return tipo;
  };

  const addItem = useCallback(async (data: {
    nome: string;
    tipo: LegacyTipo | TipoEstoque;
    categoria: string;
    quantidade: number;
    unidade: string;
    quantidadeMinima: number;
    precoUnitario: number;
    localizacao: string;
    imagemUrl?: string;
    loteProducaoId?: string;
  }): Promise<ItemEstoque> => {
    const result = await addItemMutation.mutateAsync({
      nome: data.nome,
      tipo: normalizeTipo(data.tipo),
      categoria: data.categoria,
      quantidade: data.quantidade,
      unidade: data.unidade,
      quantidadeMinima: data.quantidadeMinima,
      precoUnitario: data.precoUnitario,
      localizacao: data.localizacao,
      imagemUrl: data.imagemUrl || null,
      producaoId: data.loteProducaoId || null,
    });
    return { ...result, status: calcularStatus(result) };
  }, [addItemMutation]);

  const updateItem = useCallback(async (id: string, data: Partial<{
    nome: string;
    tipo: LegacyTipo | TipoEstoque;
    categoria: string;
    quantidade: number;
    unidade: string;
    quantidadeMinima: number;
    precoUnitario: number;
    localizacao: string;
    imagemUrl: string;
  }>): Promise<void> => {
    const updates: Partial<ItemEstoque> & { id: string } = { id };
    
    if (data.nome !== undefined) updates.nome = data.nome;
    if (data.tipo !== undefined) updates.tipo = normalizeTipo(data.tipo);
    if (data.categoria !== undefined) updates.categoria = data.categoria;
    if (data.quantidade !== undefined) updates.quantidade = data.quantidade;
    if (data.unidade !== undefined) updates.unidade = data.unidade;
    if (data.quantidadeMinima !== undefined) updates.quantidadeMinima = data.quantidadeMinima;
    if (data.precoUnitario !== undefined) updates.precoUnitario = data.precoUnitario;
    if (data.localizacao !== undefined) updates.localizacao = data.localizacao;
    if (data.imagemUrl !== undefined) updates.imagemUrl = data.imagemUrl;
    
    await updateItemMutation.mutateAsync(updates);
  }, [updateItemMutation]);

  const removeItem = useCallback(async (id: string): Promise<void> => {
    await removeItemMutation.mutateAsync(id);
  }, [removeItemMutation]);

  const getItemById = useCallback((id: string): ItemEstoque | undefined => {
    return itens.find(item => item.id === id);
  }, [itens]);

  const getItensByTipo = useCallback((tipo: LegacyTipo | TipoEstoque): ItemEstoque[] => {
    const normalizedTipo = normalizeTipo(tipo);
    return itens.filter(item => item.tipo === normalizedTipo);
  }, [itens]);

  const getMateriasPrimas = useCallback((): ItemEstoque[] => {
    return itens.filter(item => item.tipo === 'materia-prima');
  }, [itens]);

  const getProdutosAcabados = useCallback((): ItemEstoque[] => {
    return itens.filter(item => item.tipo === 'acabado');
  }, [itens]);

  const verificarDisponibilidade = useCallback((itemId: string, quantidade: number): boolean => {
    const item = getItemById(itemId);
    if (!item) return false;
    return item.quantidade >= quantidade;
  }, [getItemById]);

  const deduzirEstoque = useCallback(async (itemId: string, quantidade: number, loteProducaoId: string): Promise<boolean> => {
    const item = getItemById(itemId);
    if (!item || item.quantidade < quantidade) return false;

    await updateItemMutation.mutateAsync({
      id: itemId,
      quantidade: item.quantidade - quantidade,
    });

    await addMovimentacaoMutation.mutateAsync({
      itemId,
      tipo: 'saida',
      quantidade,
      motivo: `Consumido na produção - Lote ${loteProducaoId}`,
      producaoId: loteProducaoId,
    });

    return true;
  }, [getItemById, updateItemMutation, addMovimentacaoMutation]);

  const adicionarEstoque = useCallback(async (itemId: string, quantidade: number, motivo: string, loteProducaoId?: string): Promise<void> => {
    const item = getItemById(itemId);
    if (!item) return;

    await updateItemMutation.mutateAsync({
      id: itemId,
      quantidade: item.quantidade + quantidade,
    });

    await addMovimentacaoMutation.mutateAsync({
      itemId,
      tipo: 'entrada',
      quantidade,
      motivo,
      producaoId: loteProducaoId || null,
    });
  }, [getItemById, updateItemMutation, addMovimentacaoMutation]);

  const criarProdutoAcabado = useCallback(async (nome: string, quantidade: number, loteProducaoId: string, categoria: string = 'Jeans'): Promise<ItemEstoque> => {
    const novoProduto = await addItemMutation.mutateAsync({
      nome,
      tipo: 'acabado',
      categoria,
      quantidade,
      unidade: 'peças',
      quantidadeMinima: 0,
      precoUnitario: 0,
      localizacao: 'Estoque Produção',
      imagemUrl: null,
      producaoId: loteProducaoId,
    });

    await addMovimentacaoMutation.mutateAsync({
      itemId: novoProduto.id,
      tipo: 'entrada',
      quantidade,
      motivo: `Produção concluída - Lote ${loteProducaoId}`,
      producaoId: loteProducaoId,
    });

    return { ...novoProduto, status: calcularStatus(novoProduto) };
  }, [addItemMutation, addMovimentacaoMutation]);

  const integrarProducao = useCallback(async (
    nome: string,
    quantidade: number,
    loteProducaoId: string,
    imagemUrl?: string,
    precoVenda?: number,
    categoria: string = 'Jeans'
  ): Promise<ItemEstoque> => {
    // Check if product with same name exists
    const produtoExistente = itens.find(
      item => item.tipo === 'acabado' && item.nome.toLowerCase() === nome.toLowerCase()
    );

    if (produtoExistente) {
      const novaQuantidade = produtoExistente.quantidade + quantidade;
      
      await updateItemMutation.mutateAsync({
        id: produtoExistente.id,
        quantidade: novaQuantidade,
        imagemUrl: imagemUrl || produtoExistente.imagemUrl || undefined,
        precoUnitario: precoVenda !== undefined ? precoVenda : (produtoExistente.precoUnitario || undefined),
      });

      await addMovimentacaoMutation.mutateAsync({
        itemId: produtoExistente.id,
        tipo: 'entrada',
        quantidade,
        motivo: `Entrada via Produção - Lote #${loteProducaoId}`,
        producaoId: loteProducaoId,
      });

      return { ...produtoExistente, quantidade: novaQuantidade, status: calcularStatus({ ...produtoExistente, quantidade: novaQuantidade }) };
    }

    // Create new product
    const novoProduto = await addItemMutation.mutateAsync({
      nome,
      tipo: 'acabado',
      categoria,
      quantidade,
      unidade: 'peças',
      quantidadeMinima: 0,
      precoUnitario: precoVenda || 0,
      localizacao: 'Estoque Produção',
      imagemUrl: imagemUrl || null,
      producaoId: loteProducaoId,
    });

    await addMovimentacaoMutation.mutateAsync({
      itemId: novoProduto.id,
      tipo: 'entrada',
      quantidade,
      motivo: `Entrada via Produção - Lote #${loteProducaoId}`,
      producaoId: loteProducaoId,
    });

    return { ...novoProduto, status: calcularStatus(novoProduto) };
  }, [itens, updateItemMutation, addItemMutation, addMovimentacaoMutation]);

  return (
    <EstoqueContext.Provider
      value={{
        itens,
        movimentacoes,
        isLoading,
        addItem,
        updateItem,
        removeItem,
        getItemById,
        getItensByTipo,
        deduzirEstoque,
        adicionarEstoque,
        integrarProducao,
        criarProdutoAcabado,
        verificarDisponibilidade,
        getMateriasPrimas,
        getProdutosAcabados,
      }}
    >
      {children}
    </EstoqueContext.Provider>
  );
}

export function useEstoque() {
  const context = useContext(EstoqueContext);
  if (!context) {
    throw new Error('useEstoque must be used within a EstoqueProvider');
  }
  return context;
}
