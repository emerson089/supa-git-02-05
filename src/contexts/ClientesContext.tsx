import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { 
  useClientes as useClientesQuery, 
  useAddCliente, 
  useUpdateCliente, 
  useRemoveCliente,
  ClienteDB 
} from '@/hooks/useClientesData';

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  excursao: string;
  dataCadastro: string;
}

interface ClientesContextType {
  clientes: Cliente[];
  isLoading: boolean;
  addCliente: (cliente: Omit<Cliente, 'id' | 'dataCadastro'>) => Promise<Cliente>;
  updateCliente: (id: string, data: Partial<Cliente>) => Promise<void>;
  removeCliente: (id: string) => Promise<void>;
  getClienteById: (id: string) => Cliente | undefined;
}

const ClientesContext = createContext<ClientesContextType | undefined>(undefined);

function formatDateBR(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

function mapDBToCliente(dbCliente: ClienteDB): Cliente {
  return {
    id: dbCliente.id,
    nome: dbCliente.nome,
    telefone: dbCliente.telefone,
    cidade: dbCliente.cidade,
    estado: dbCliente.estado,
    excursao: dbCliente.excursao,
    dataCadastro: formatDateBR(dbCliente.created_at),
  };
}

export function ClientesProvider({ children }: { children: ReactNode }) {
  const { data: clientesDB, isLoading } = useClientesQuery();
  const addClienteMutation = useAddCliente();
  const updateClienteMutation = useUpdateCliente();
  const removeClienteMutation = useRemoveCliente();

  const clientes = useMemo(() => {
    return (clientesDB || []).map(mapDBToCliente);
  }, [clientesDB]);

  const addCliente = useCallback(async (data: Omit<Cliente, 'id' | 'dataCadastro'>): Promise<Cliente> => {
    const result = await addClienteMutation.mutateAsync({
      nome: data.nome,
      telefone: data.telefone,
      cidade: data.cidade,
      estado: data.estado,
      excursao: data.excursao,
    });
    return mapDBToCliente(result);
  }, [addClienteMutation]);

  const updateCliente = useCallback(async (id: string, data: Partial<Cliente>): Promise<void> => {
    const updateData: Record<string, string> = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.telefone !== undefined) updateData.telefone = data.telefone;
    if (data.cidade !== undefined) updateData.cidade = data.cidade;
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.excursao !== undefined) updateData.excursao = data.excursao;
    
    await updateClienteMutation.mutateAsync({ id, data: updateData });
  }, [updateClienteMutation]);

  const removeCliente = useCallback(async (id: string): Promise<void> => {
    await removeClienteMutation.mutateAsync(id);
  }, [removeClienteMutation]);

  const getClienteById = useCallback((id: string): Cliente | undefined => {
    return clientes.find(c => c.id === id);
  }, [clientes]);

  return (
    <ClientesContext.Provider value={{ clientes, isLoading, addCliente, updateCliente, removeCliente, getClienteById }}>
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientesContext() {
  const context = useContext(ClientesContext);
  if (!context) {
    throw new Error('useClientesContext must be used within a ClientesProvider');
  }
  return context;
}
