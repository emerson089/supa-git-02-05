import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useMassSending = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

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

    const addToBlacklist = async (telefone: string, motivo: string = 'Automático: Falha no envio') => {
        if (!user?.id) return;
        const { error } = await (supabase
            .from('blacklist' as any)
            .upsert({ user_id: user.id, telefone, motivo, origem: 'auto' }) as any);
        if (error) console.error('Error adding to blacklist:', error);
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
        loading,
        isBlacklisted,
        addToBlacklist,
        saveCampanhaHistorico,
        getEnviosHojeCount
    };
};
