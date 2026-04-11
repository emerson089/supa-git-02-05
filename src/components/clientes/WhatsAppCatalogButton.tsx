import { useState, forwardRef } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Cliente } from '@/contexts/ClientesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppCatalogButtonProps {
  cliente: Cliente;
}

const normalizePhoneE164 = (raw: string): { valid: boolean; phone: string; error?: string } => {
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  if (digits.length < 12) {
    return { valid: false, phone: '', error: 'Telefone muito curto.' };
  }
  if (digits.length > 13) {
    return { valid: false, phone: '', error: 'Telefone muito longo.' };
  }
  return { valid: true, phone: digits };
};

export const WhatsAppCatalogButton = forwardRef<HTMLButtonElement, WhatsAppCatalogButtonProps>(
  function WhatsAppCatalogButton({ cliente }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [enviando, setEnviando] = useState(false);

    const enviarCatalogo = async () => {
      const phoneResult = normalizePhoneE164(cliente.telefone);
      if (!phoneResult.valid) {
        toast({
          title: "Telefone inválido",
          description: phoneResult.error,
          variant: "destructive",
        });
        return;
      }

      setEnviando(true);

      try {
        if (!user?.id) {
          throw new Error("Usuário não autenticado.");
        }

        // Obter URL assinada do catálogo (7 dias de validade)
        const { data: signedData, error: signedError } = await supabase.storage
          .from('lotes')
          .createSignedUrl(`${user.id}/catalogos/oficial.pdf`, 604800);

        if (signedError || !signedData?.signedUrl) {
          throw new Error("Catálogo PDF oficial não encontrado. Por favor, faça o upload nas Configurações.");
        }

        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
          body: { 
            type: 'document',
            phone: phoneResult.phone, 
            documentUrl: signedData.signedUrl,
            fileName: 'Catalogo Delookii.pdf',
            caption: 'Olá ' + cliente.nome.split(' ')[0] + '! Segue o nosso catálogo mais recente com todas as novidades. Qualquer dúvida, estou à disposição!'
          },
        });

        if (error) {
          throw error;
        }

        toast({
          title: "✅ Catálogo enviado!",
          description: `Catálogo enviado para ${cliente.nome.split(' ')[0]} via WhatsApp.`,
        });

      } catch (err: any) {
        console.error('Erro ao enviar Catálogo:', err);
        toast({
          title: "Erro ao enviar",
          description: err?.message || "Não foi possível enviar o catálogo. Verifique sua conexão.",
          variant: "destructive",
        });
      } finally {
        setEnviando(false);
      }
    };

    return (
      <button
        ref={ref}
        onClick={(e) => { e.stopPropagation(); enviarCatalogo(); }}
        disabled={enviando}
        className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 flex items-center justify-center transition-colors shadow-sm ml-1.5 disabled:opacity-50"
        title="Enviar Catálogo PDF"
      >
        {enviando ? (
          <Loader2 size={14} className="text-orange-600 dark:text-orange-400 animate-spin" />
        ) : (
          <BookOpen size={14} className="text-orange-600 dark:text-orange-400" />
        )}
      </button>
    );
  }
);

WhatsAppCatalogButton.displayName = 'WhatsAppCatalogButton';
