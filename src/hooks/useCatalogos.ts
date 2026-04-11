import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Catalogo {
  id: string;
  user_id: string;
  nome: string;
  file_path: string;
  mensagem: string;
  ativo: boolean;
  created_at: string;
}

export const useCatalogos = () => {
  const { user } = useAuth();
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCatalogos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalogos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCatalogos((data as Catalogo[]) || []);
    } catch (err) {
      console.error('Erro ao buscar catálogos:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCatalogos();
  }, [fetchCatalogos]);

  const uploadCatalogo = async (file: File, nome: string, mensagem: string) => {
    if (!user?.id) throw new Error('Usuário não autenticado');

    const uuid = crypto.randomUUID();
    const filePath = `${user.id}/catalogos/${uuid}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('lotes')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase
      .from('catalogos')
      .insert({
        user_id: user.id,
        nome,
        file_path: filePath,
        mensagem,
        ativo: catalogos.length === 0, // first catalog is auto-active
      });

    if (insertError) throw insertError;
    await fetchCatalogos();
  };

  const ativarCatalogo = async (id: string) => {
    if (!user?.id) return;
    // Deactivate all
    await supabase
      .from('catalogos')
      .update({ ativo: false })
      .eq('user_id', user.id);
    // Activate selected
    await supabase
      .from('catalogos')
      .update({ ativo: true })
      .eq('id', id);
    await fetchCatalogos();
    toast.success('Catálogo ativado!');
  };

  const excluirCatalogo = async (catalogo: Catalogo) => {
    // Delete from storage
    await supabase.storage.from('lotes').remove([catalogo.file_path]);
    // Delete from DB
    await supabase.from('catalogos').delete().eq('id', catalogo.id);
    await fetchCatalogos();
    toast.success('Catálogo excluído!');
  };

  const atualizarMensagem = async (id: string, mensagem: string) => {
    await supabase.from('catalogos').update({ mensagem }).eq('id', id);
    await fetchCatalogos();
  };

  // Migrate legacy oficial.pdf
  const migrateLegacy = useCallback(async () => {
    if (!user?.id || catalogos.length > 0 || loading) return;

    const legacyPath = `${user.id}/catalogos/oficial.pdf`;
    const { data } = await supabase.storage
      .from('lotes')
      .createSignedUrl(legacyPath, 60);

    if (data?.signedUrl) {
      await supabase.from('catalogos').insert({
        user_id: user.id,
        nome: 'Catálogo Principal',
        file_path: legacyPath,
        mensagem: 'Olá {nome}! Tudo bem? Segue nosso catálogo atualizado com todas as novidades! Qualquer dúvida, pode me chamar. 👇',
        ativo: true,
      });
      await fetchCatalogos();
    }
  }, [user?.id, catalogos.length, loading, fetchCatalogos]);

  useEffect(() => {
    if (!loading && catalogos.length === 0) {
      migrateLegacy();
    }
  }, [loading, catalogos.length, migrateLegacy]);

  const catalogoAtivo = catalogos.find((c) => c.ativo) || null;

  return {
    catalogos,
    catalogoAtivo,
    loading,
    uploadCatalogo,
    ativarCatalogo,
    excluirCatalogo,
    atualizarMensagem,
    refetch: fetchCatalogos,
  };
};
