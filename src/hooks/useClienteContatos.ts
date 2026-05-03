import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CanalContato = 'whatsapp' | 'ligacao' | 'outro';

export interface ContatoRegistro {
  data: string;
  canal: CanalContato;
}

// ─────────────────────────────────────────────────────────
// localStorage fallback (used while Supabase loads / offline)
// ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'clientes_contatos';

function loadContatosLocal(): Record<string, ContatoRegistro> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveContatosLocal(contatos: Record<string, ContatoRegistro>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contatos));
  } catch { }
}

// ─────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────

/**
 * Manages contact markers for clients.
 *
 * Strategy:
 * 1. Optimistic update → updates UI immediately via localStorage state
 * 2. Persists to Supabase `cliente_contatos` table (upsert)
 * 3. On mount, loads latest data from Supabase and merges with localStorage
 */
export function useClienteContatos() {
  const { user } = useAuth();
  const [contatosMap, setContatosMap] = useState<Record<string, ContatoRegistro>>(loadContatosLocal);

  // ── Load from Supabase on mount ──────────────────────
  useEffect(() => {
    if (!user?.id) return;

    (supabase as any)
      .from('cliente_contatos')
      .select('cliente_id, canal, contatado_em')
      .eq('user_id', user.id)
      .then(({ data, error }: { data: any[] | null; error: any }) => {
        if (error || !data) return;

        const fromDB: Record<string, ContatoRegistro> = {};
        for (const row of data) {
          fromDB[row.cliente_id] = { data: row.contatado_em, canal: row.canal };
        }

        // Merge: DB is source of truth, but keep local items that are newer
        const local = loadContatosLocal();
        const merged: Record<string, ContatoRegistro> = { ...local };

        for (const [id, dbRecord] of Object.entries(fromDB)) {
          const localRecord = local[id];
          if (!localRecord || new Date(dbRecord.data) > new Date(localRecord.data)) {
            merged[id] = dbRecord;
          }
        }

        saveContatosLocal(merged);
        setContatosMap(merged);
      });
  }, [user?.id]);

  // ── Mark contact (optimistic + persist) ─────────────
  const marcarContato = useCallback((clienteId: string, canal: CanalContato) => {
    const record: ContatoRegistro = { data: new Date().toISOString(), canal };

    // 1. Optimistic update
    setContatosMap(prev => {
      const next = { ...prev, [clienteId]: record };
      saveContatosLocal(next);
      return next;
    });

    // 2. Persist to Supabase (fire-and-forget)
    if (user?.id) {
      (supabase as any)
        .from('cliente_contatos')
        .upsert(
          {
            cliente_id: clienteId,
            user_id: user.id,
            canal,
            contatado_em: record.data,
          },
          { onConflict: 'cliente_id,user_id' }
        )
        .then(({ error }: { error: any }) => {
          if (error) {
            console.warn('[useClienteContatos] Erro ao salvar contato no Supabase:', error.message);
            // Contato still saved in localStorage — no user-facing error needed
          }
        });
    }
  }, [user?.id]);

  const getContato = useCallback((clienteId: string): ContatoRegistro | null => {
    return contatosMap[clienteId] || null;
  }, [contatosMap]);

  return { contatosMap, marcarContato, getContato };
}
