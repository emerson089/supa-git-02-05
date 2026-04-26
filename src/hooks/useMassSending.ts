import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useMassSending = () => {
    const { user } = useAuth();

    const isBlacklisted = useCallback(async (telefone: string) => {
        if (!user?.id) return false;
        const { data } = await (supabase
            .from('blacklist' as any)
            .select('id') as any)
            .eq('user_id', user.id)
            .eq('telefone', telefone)
            .maybeSingle();
        return !!data;
    }, [user?.id]);

    const addToBlacklist = async (telefone: string, motivo: string = 'Automático: Falha no envio', origem: string = 'auto') => {
        if (!user?.id) return;
        const { error } = await (supabase
            .from('blacklist' as any)
            .upsert({ user_id: user.id, telefone, motivo, origem }) as any);
        if (error) console.error('Error adding to blacklist:', error);
    };

    const removeFromBlacklist = async (id: string) => {
        if (!user?.id) return;
        const { error } = await (supabase
            .from('blacklist' as any)
            .delete() as any)
            .eq('id', id)
            .eq('user_id', user.id);
        if (error) console.error('Error removing from blacklist:', error);
    };

    const getBlacklist = async () => {
        if (!user?.id) return [];
        const { data } = await (supabase
            .from('blacklist' as any)
            .select('id, telefone, motivo, origem, created_at') as any)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        return data || [];
    };

    const getCampanhasHistorico = async (desde?: Date) => {
        if (!user?.id) return [];
        let q = (supabase
            .from('campanhas_historico' as any)
            .select('*') as any)
            .eq('user_id', user.id)
            .order('data_disparo', { ascending: false })
            .limit(100);
        if (desde) q = q.gte('data_disparo', desde.toISOString());
        const { data } = await q;
        return data || [];
    };

    const getPerfilConfig = async () => {
        if (!user?.id) return null;
        const { data } = await (supabase
            .from('perfil_configuracoes' as any)
            .select('*') as any)
            .eq('user_id', user.id)
            .maybeSingle();
        return data;
    };

    const savePerfilConfig = async (config: { limite_diario_mensagens: number; pausa_inteligente: boolean }) => {
        if (!user?.id) return;
        const { error } = await (supabase
            .from('perfil_configuracoes' as any)
            .upsert({ user_id: user.id, ...config }) as any);
        if (error) console.error('Error saving perfil config:', error);
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
        const { error } = await (supabase
            .from('campanhas_historico' as any)
            .insert({
                user_id: user.id,
                ...dados
            }) as any);
        if (error) console.error('Error saving campaign history:', error);
    };

    const getEnviosHojeCount = async () => {
        if (!user?.id) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data } = await (supabase
            .from('campanhas_historico' as any)
            .select('sucessos') as any)
            .eq('user_id', user.id)
            .gte('data_disparo', today.toISOString());
            
        // Sum total successes from all campaigns today
        return (data || []).reduce((acc: number, curr: any) => acc + (curr.sucessos || 0), 0);
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
