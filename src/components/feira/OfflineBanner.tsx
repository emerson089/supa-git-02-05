import { WifiOff, Wifi, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OfflineRetornoPayload } from '@/hooks/useFeiraOffline';

interface OfflineBannerProps {
    isOnline: boolean;
    isSyncing: boolean;
    queue: OfflineRetornoPayload[];
    pendingCount: number;
    errorCount: number;
    onSyncNow?: () => void;
}

export function OfflineBanner({
    isOnline,
    isSyncing,
    queue,
    pendingCount,
    errorCount,
    onSyncNow,
}: OfflineBannerProps) {
    const doneCount = queue.filter(p => p.syncStatus === 'done').length;

    // Hidden when fully online and no pending/error/done items
    if (isOnline && pendingCount === 0 && errorCount === 0 && doneCount === 0) {
        return null;
    }

    // ── Fully offline ──────────────────────────────────────
    if (!isOnline) {
        return (
            <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl mb-4',
                'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
            )}>
                <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Sem conexão com a internet
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                        {pendingCount > 0
                            ? `${pendingCount} retorno(s) salvos localmente — serão sincronizados quando a internet voltar`
                            : 'Você pode registrar retornos normalmente — serão salvos localmente'}
                    </p>
                </div>
                {pendingCount > 0 && (
                    <span className="flex-shrink-0 bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[24px] text-center">
                        {pendingCount}
                    </span>
                )}
            </div>
        );
    }

    // ── Online + syncing ───────────────────────────────────
    if (isOnline && isSyncing) {
        return (
            <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl mb-4',
                'bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
            )}>
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        Sincronizando retornos offline...
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                        Enviando {pendingCount} registro(s) para o servidor
                    </p>
                </div>
            </div>
        );
    }

    // ── Online + sync done ─────────────────────────────────
    if (isOnline && doneCount > 0 && pendingCount === 0 && errorCount === 0) {
        return (
            <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl mb-4',
                'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
            )}>
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p className="flex-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {doneCount} retorno(s) sincronizados com sucesso ✓
                </p>
            </div>
        );
    }

    // ── Online + errors ────────────────────────────────────
    if (isOnline && errorCount > 0) {
        return (
            <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl mb-4',
                'bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800'
            )}>
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                        {errorCount} retorno(s) com erro na sincronização
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400">
                        Verifique sua conexão e tente novamente
                    </p>
                </div>
                {onSyncNow && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-100 text-xs h-7 flex-shrink-0"
                        onClick={onSyncNow}
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Tentar novamente
                    </Button>
                )}
            </div>
        );
    }

    // ── Online + pending (from a previous offline session) ─
    if (isOnline && pendingCount > 0) {
        return (
            <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl mb-4',
                'bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
            )}>
                <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        {pendingCount} retorno(s) aguardando sincronização
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                        Registrados offline — clique para sincronizar agora
                    </p>
                </div>
                {onSyncNow && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-100 text-xs h-7 flex-shrink-0"
                        onClick={onSyncNow}
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sincronizar
                    </Button>
                )}
            </div>
        );
    }

    return null;
}
