import { useState, useCallback } from 'react';

export type CanalContato = 'whatsapp' | 'ligacao' | 'outro';

export interface ContatoRegistro {
  data: string;
  canal: CanalContato;
}

const STORAGE_KEY = 'clientes_contatos';

function loadContatos(): Record<string, ContatoRegistro> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveContatos(contatos: Record<string, ContatoRegistro>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contatos));
}

/**
 * Hook to manage client contact markers via localStorage.
 * Zero backend calls.
 */
export function useClienteContatos() {
  const [contatosMap, setContatosMap] = useState<Record<string, ContatoRegistro>>(loadContatos);

  const marcarContato = useCallback((clienteId: string, canal: CanalContato) => {
    setContatosMap(prev => {
      const next = {
        ...prev,
        [clienteId]: { data: new Date().toISOString(), canal },
      };
      saveContatos(next);
      return next;
    });
  }, []);

  const getContato = useCallback((clienteId: string): ContatoRegistro | null => {
    return contatosMap[clienteId] || null;
  }, [contatosMap]);

  return { contatosMap, marcarContato, getContato };
}
