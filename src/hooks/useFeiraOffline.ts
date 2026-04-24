import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { TransferenciaComItens } from '@/hooks/useTransferencias';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface OfflineRetornoItem {
    itemId: string;
    quantidadeRetornada: number;
}

export interface OfflineRetornoPayload {
    id: string;               // Generated locally (crypto.randomUUID)
    cargaId: string;
    cargaDescricao: string;   // e.g. "feira jeans 16:35"
    itens: OfflineRetornoItem[];
    dataRetorno: string;      // ISO string
    observacoes: string;
    savedAt: string;          // ISO string
    syncStatus: 'pending' | 'syncing' | 'done' | 'error';
    syncError?: string;
}

// ─────────────────────────────────────────────────────────
// localStorage keys
// ─────────────────────────────────────────────────────────

const CACHE_CARGAS_KEY = 'feira-offline-cargas';
const QUEUE_KEY = 'feira-offline-queue';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function loadQueue(): OfflineRetornoPayload[] {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveQueue(queue: OfflineRetornoPayload[]) {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
        // localStorage full or unavailable
    }
}

function loadCachedCargas(): TransferenciaComItens[] {
    try {
        const raw = localStorage.getItem(CACHE_CARGAS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCachedCargas(cargas: TransferenciaComItens[]) {
    try {
        localStorage.setItem(CACHE_CARGAS_KEY, JSON.stringify(cargas));
    } catch { }
}

// ─────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────

export function useFeiraOffline() {
    const { user } = useAuth();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [queue, setQueue] = useState<OfflineRetornoPayload[]>(loadQueue);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncingRef = useRef(false); // Prevent concurrent syncs

    // ── Network detection ──────────────────────────────────
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ── Cache active cargas ────────────────────────────────
    const cacheCargas = useCallback((cargas: TransferenciaComItens[]) => {
        saveCachedCargas(cargas);
    }, []);

    const getCachedCargas = useCallback((): TransferenciaComItens[] => {
        return loadCachedCargas();
    }, []);

    // ── Save return offline ────────────────────────────────
    const saveOfflineRetorno = useCallback((
        carga: TransferenciaComItens,
        itens: OfflineRetornoItem[],
        observacoes: string = ''
    ) => {
        const payload: OfflineRetornoPayload = {
            id: crypto.randomUUID(),
            cargaId: carga.id,
            cargaDescricao: [
                carga.localDestinoNome,
                carga.dataSaida ? new Date(carga.dataSaida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
            ].filter(Boolean).join(' '),
            itens,
            dataRetorno: new Date().toISOString(),
            observacoes,
            savedAt: new Date().toISOString(),
            syncStatus: 'pending',
        };

        const updated = [...loadQueue(), payload];
        saveQueue(updated);
        setQueue(updated);
        return payload.id;
    }, []);

    // ── Sync a single payload to Supabase ─────────────────
    const syncPayload = useCallback(async (payload: OfflineRetornoPayload, userId: string) => {
        // Call the same logic as useRegistrarRetornoFeira
        const { error: retornoError } = await supabase
            .from('transferencias')
            .update({
                status: 'concluida',
                data_retorno: payload.dataRetorno,
                observacoes: payload.observacoes || null,
            })
            .eq('id', payload.cargaId);

        if (retornoError) throw retornoError;

        // Update each item's quantidade_retornada
        for (const item of payload.itens) {
            const { error: itemError } = await supabase
                .from('transferencia_itens')
                .update({ quantidade_retornada: item.quantidadeRetornada })
                .eq('transferencia_id', payload.cargaId)
                .eq('item_id', item.itemId);

            if (itemError) throw itemError;
        }

        // Trigger stock sync via the existing RPC/function if needed
        // (same as useRegistrarRetornoFeira onSuccess)
    }, []);

    // ── Auto-sync when coming back online ─────────────────
    const syncAll = useCallback(async () => {
        if (!user || syncingRef.current) return;
        const pending = loadQueue().filter(p => p.syncStatus === 'pending');
        if (pending.length === 0) return;

        syncingRef.current = true;
        setIsSyncing(true);

        const currentQueue = loadQueue();
        let anyError = false;

        for (const payload of pending) {
            // Mark as syncing
            const updatedQueue = currentQueue.map(p =>
                p.id === payload.id ? { ...p, syncStatus: 'syncing' as const } : p
            );
            saveQueue(updatedQueue);
            setQueue([...updatedQueue]);

            try {
                await syncPayload(payload, user.id);

                const doneQueue = loadQueue().map(p =>
                    p.id === payload.id ? { ...p, syncStatus: 'done' as const } : p
                );
                saveQueue(doneQueue);
                setQueue([...doneQueue]);
            } catch (err: any) {
                anyError = true;
                const errQueue = loadQueue().map(p =>
                    p.id === payload.id
                        ? { ...p, syncStatus: 'error' as const, syncError: err.message }
                        : p
                );
                saveQueue(errQueue);
                setQueue([...errQueue]);
            }
        }

        syncingRef.current = false;
        setIsSyncing(false);

        // Remove successfully synced items after a short delay
        setTimeout(() => {
            const cleaned = loadQueue().filter(p => p.syncStatus !== 'done');
            saveQueue(cleaned);
            setQueue(cleaned);
        }, 3000);

        if (!anyError) {
            toast.success('Retornos sincronizados com sucesso!');
        } else {
            toast.error('Alguns retornos não puderam ser sincronizados. Verifique a conexão.');
        }
    }, [user, syncPayload]);

    // Trigger sync automatically when coming back online
    useEffect(() => {
        if (isOnline) {
            const pending = queue.filter(p => p.syncStatus === 'pending');
            if (pending.length > 0) {
                syncAll();
            }
        }
    }, [isOnline]); // Intentionally only on isOnline change

    // Avisar usuário ao fechar aba com retornos offline pendentes não sincronizados
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const pending = loadQueue().filter(p => p.syncStatus === 'pending' || p.syncStatus === 'syncing');
            if (pending.length > 0) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // ── Remove a queued item ───────────────────────────────
    const removeFromQueue = useCallback((id: string) => {
        const updated = loadQueue().filter(p => p.id !== id);
        saveQueue(updated);
        setQueue(updated);
    }, []);

    const pendingCount = queue.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'syncing').length;
    const errorCount = queue.filter(p => p.syncStatus === 'error').length;

    return {
        isOnline,
        isSyncing,
        queue,
        pendingCount,
        errorCount,
        cacheCargas,
        getCachedCargas,
        saveOfflineRetorno,
        syncAll,
        removeFromQueue,
    };
}
