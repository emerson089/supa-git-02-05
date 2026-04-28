import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useMassSending = () => {
    const { user } = useAuth();

    const isBlacklisted = useCallback(async (telefone: string) => {
        if (!user?.id) return false;
        const { data, error } = await supabase
            .from('blacklist')
            .select('id')
            .eq('user_id', user.id)
            .eq('telefone', telefone)
            .maybeSingle();
        if (error) {
            console.error('[blacklist] check failed:', error);
            return false;
        }
        return !!data;
    }, [user?.id]);

    const addToBlacklist = async (
        telefone: string,
        motivo: string = 'Automático: Falha no envio',
        origem: string = 'auto',
    ) => {
        if (!user?.id) return;
        const { error } = await supabase
            .from('blacklist')
            .upsert(
                { user_id: user.id, telefone, motivo, origem },
                { onConflict: 'user_id,telefone' },
            );
        if (error) console.error('[blacklist] add failed:', error);
    };

    const removeFromBlacklist = async (id: string) => {
        if (!user?.id) return;
        const { error } = await supabase
            .from('blacklist')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        if (error) console.error('[blacklist] remove failed:', error);
    };

    const getBlacklist = async () => {
        if (!user?.id) return [];
        const { data, error } = await supabase
            .from('blacklist')
            .select('id, telefone, motivo, origem, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('[blacklist] list failed:', error);
            return [];
        }
        return data || [];
    };

    const getCampanhasHistorico = async (desde?: Date) => {
        if (!user?.id) return [];
        let q = supabase
            .from('campanhas_historico')
            .select('*')
            .eq('user_id', user.id)
            .order('data_disparo', { ascending: false })
            .limit(100);
        if (desde) q = q.gte('data_disparo', desde.toISOString());
        const { data, error } = await q;
        if (error) {
            console.error('[campanhas_historico] list failed:', error);
            return [];
        }
        return data || [];
    };

    const getPerfilConfig = async () => {
        if (!user?.id) return null;
        const { data, error } = await supabase
            .from('perfil_configuracoes')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) {
            console.error('[perfil_configuracoes] read failed:', error);
            return null;
        }
        return data;
    };

    const savePerfilConfig = async (config: {
        limite_diario_mensagens: number;
        pausa_inteligente: boolean;
    }) => {
        if (!user?.id) return;
        const { error } = await supabase
            .from('perfil_configuracoes')
            .upsert(
                { user_id: user.id, ...config },
                { onConflict: 'user_id' },
            );
        if (error) console.error('[perfil_configuracoes] save failed:', error);
    };

    const saveCampanhaHistorico = async (dados: {
        nome_campanha: string;
        catalogo_id: string | null;
        total_contatos: number;
        sucessos: number;
        falhas: number;
        filtros_aplicados: any;
        velocidade: string;
    }) => {
        if (!user?.id) return;
        const { error } = await supabase
            .from('campanhas_historico')
            .insert({
                user_id: user.id,
                ...dados,
            });
        if (error) console.error('[campanhas_historico] save failed:', error);
    };

    const getEnviosHojeCount = async () => {
        if (!user?.id) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Conta envios diretos em catalogo_envios (a fonte da verdade real).
        const { count, error } = await supabase
            .from('catalogo_envios')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('enviado_em', today.toISOString());

        if (error) {
            console.error('[catalogo_envios] count today failed:', error);
            return 0;
        }
        return count ?? 0;
    };

    return {
        isBlacklisted,
        addToBlacklist,
        removeFromBlacklist,
        getBlacklist,
        saveCampanhaHistorico,
        getCampanhasHistorico,
        getEnviosHojeCount,
        getPerfilConfig,
        savePerfilConfig,
    };
};
