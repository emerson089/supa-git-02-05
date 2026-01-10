import React, { createContext, useContext, ReactNode } from 'react';
import { usePedidos as usePedidosQuery, useAddPedido, useUpdatePedido, useRemovePedido, usePedidoById, PedidoDB, PedidoInsert, PedidoUpdate } from '@/hooks/usePedidosData';

export interface ItemPedido {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface Pedido {
  id: string;
  clienteId: string;
  clienteNome: string;
  cidade: string;
  estado: string;
  telefone: string;
  excursao: string;
  status: string;
  statusPagamento: string;
  statusPedido: string;
  statusEntrega: string;
  formaPagamento: string;
  observacoes: string;
  itens: ItemPedido[];
  totalPecas: number;
  valorTotal: number;
  dataCriacao: string;
  estornoRealizado?: boolean;
}

interface PedidosContextType {
  pedidos: Pedido[];
  isLoading: boolean;
  addPedido: (pedido: Omit<Pedido, 'id' | 'dataCriacao'>) => Promise<Pedido>;
  updatePedido: (id: string, data: Partial<Pedido>) => void;
  removePedido: (id: string) => void;
  getPedidoById: (id: string) => Pedido | undefined;
}

const PedidosContext = createContext<PedidosContextType | undefined>(undefined);

// Transform database format to context format
function transformDBToContext(pedidoDB: PedidoDB): Pedido {
  return {
    id: pedidoDB.id,
    clienteId: pedidoDB.cliente_id || '',
    clienteNome: pedidoDB.cliente_nome,
    cidade: pedidoDB.cidade || '',
    estado: pedidoDB.estado || '',
    telefone: pedidoDB.telefone || '',
    excursao: pedidoDB.excursao || '',
    status: pedidoDB.status || 'Pendente',
    statusPagamento: pedidoDB.status_pagamento || 'Pendente',
    statusPedido: pedidoDB.status_pedido || 'Pendente',
    statusEntrega: pedidoDB.status_entrega || 'Pendente',
    formaPagamento: pedidoDB.forma_pagamento || '',
    observacoes: pedidoDB.observacoes || '',
    itens: (pedidoDB.itens || []).map(item => ({
      id: item.id,
      produtoId: item.produto_id || '',
      produtoNome: item.produto_nome,
      quantidade: item.quantidade,
      valorUnitario: Number(item.valor_unitario),
    })),
    totalPecas: pedidoDB.total_pecas || 0,
    valorTotal: Number(pedidoDB.valor_total) || 0,
    dataCriacao: pedidoDB.created_at,
    estornoRealizado: pedidoDB.estorno_realizado || false,
  };
}

export function PedidosProvider({ children }: { children: ReactNode }) {
  const { data: pedidosDB, isLoading } = usePedidosQuery();
  const addPedidoMutation = useAddPedido();
  const updatePedidoMutation = useUpdatePedido();
  const removePedidoMutation = useRemovePedido();

  const pedidos: Pedido[] = (pedidosDB || []).map(transformDBToContext);

  const addPedido = async (pedidoData: Omit<Pedido, 'id' | 'dataCriacao'>): Promise<Pedido> => {
    const pedidoInsert: PedidoInsert = {
      cliente_id: pedidoData.clienteId || null,
      cliente_nome: pedidoData.clienteNome,
      cidade: pedidoData.cidade,
      estado: pedidoData.estado,
      telefone: pedidoData.telefone,
      excursao: pedidoData.excursao,
      status: pedidoData.status,
      status_pagamento: pedidoData.statusPagamento,
      status_pedido: pedidoData.statusPedido,
      status_entrega: pedidoData.statusEntrega,
      forma_pagamento: pedidoData.formaPagamento,
      observacoes: pedidoData.observacoes,
      total_pecas: pedidoData.totalPecas,
      valor_total: pedidoData.valorTotal,
      estorno_realizado: pedidoData.estornoRealizado,
      itens: pedidoData.itens.map(item => ({
        produto_id: item.produtoId || null,
        produto_nome: item.produtoNome,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
      })),
    };

    const result = await addPedidoMutation.mutateAsync(pedidoInsert);
    
    return {
      ...pedidoData,
      id: result.id,
      dataCriacao: result.created_at,
    };
  };

  const updatePedido = (id: string, data: Partial<Pedido>) => {
    const updateData: PedidoUpdate = {};
    
    if (data.clienteId !== undefined) updateData.cliente_id = data.clienteId || null;
    if (data.clienteNome !== undefined) updateData.cliente_nome = data.clienteNome;
    if (data.cidade !== undefined) updateData.cidade = data.cidade;
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.telefone !== undefined) updateData.telefone = data.telefone;
    if (data.excursao !== undefined) updateData.excursao = data.excursao;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.statusPagamento !== undefined) updateData.status_pagamento = data.statusPagamento;
    if (data.statusPedido !== undefined) updateData.status_pedido = data.statusPedido;
    if (data.statusEntrega !== undefined) updateData.status_entrega = data.statusEntrega;
    if (data.formaPagamento !== undefined) updateData.forma_pagamento = data.formaPagamento;
    if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;
    if (data.totalPecas !== undefined) updateData.total_pecas = data.totalPecas;
    if (data.valorTotal !== undefined) updateData.valor_total = data.valorTotal;
    if (data.estornoRealizado !== undefined) updateData.estorno_realizado = data.estornoRealizado;

    updatePedidoMutation.mutate({ id, data: updateData });
  };

  const removePedido = (id: string) => {
    removePedidoMutation.mutate(id);
  };

  const getPedidoById = (id: string) => {
    return pedidos.find(pedido => pedido.id === id);
  };

  return (
    <PedidosContext.Provider value={{ pedidos, isLoading, addPedido, updatePedido, removePedido, getPedidoById }}>
      {children}
    </PedidosContext.Provider>
  );
}

export function usePedidos() {
  const context = useContext(PedidosContext);
  if (!context) {
    throw new Error('usePedidos deve ser usado dentro de um PedidosProvider');
  }
  return context;
}
