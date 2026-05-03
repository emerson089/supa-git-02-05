import { useState, forwardRef, useEffect } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Cliente } from '@/contexts/ClientesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useClienteContatos } from '@/hooks/useClienteContatos';

interface WhatsAppCatalogButtonProps {
  cliente: Cliente;
}

const normalizePhoneE164 = (raw: string): { valid: boolean; phone: string; error?: string } => {
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  
  // Caso especial: 11 dígitos começando com 55 (55 + DDD + 7 dígitos)
  if (digits.length === 11 && digits.startsWith('55')) {
    digits = digits.slice(0, 4) + '9' + digits.slice(4);
  }

  // Caso especial: 9 dígitos sem o 55 (DDD + 7 dígitos)
  if (digits.length === 9 && !digits.startsWith('55')) {
    digits = digits.slice(0, 2) + '9' + digits.slice(2);
  }

  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  if (digits.length < 12) return { valid: false, phone: '', error: 'Telefone muito curto.' };
  if (digits.length > 13) return { valid: false, phone: '', error: 'Telefone muito longo.' };
  return { valid: true, phone: digits };
};

interface CatalogoAtivo {
  file_path: string;
  mensagem: string;
  nome: string;
}

const SAUDACOES = [
  'Olá', 'Oii', 'Oie', 'Opa', 'Olaa', 'Oiii', 'E aí', 'Fala', 'Oi', 'Tudo bem?', 
  'Bom dia', 'Boa tarde', 'Boa noite', 'Oiie', 'Opaa', 'Olá, tudo bem?', 'Oi, tudo bom?',
  'Hey', 'Salve', 'Opa! Tudo certo?', 'Tudo certo por aí?', 'Oi como vai?', 'Passando por aqui para deixar...',
  'Oi, passando para te mandar...', 'Oi! Tudo tranquilo?', 'E aí, beleza?'
];

export const WhatsAppCatalogButton = forwardRef<HTMLButtonElement, WhatsAppCatalogButtonProps>(
  function WhatsAppCatalogButton({ cliente }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { marcarContato } = useClienteContatos();
    const [enviando, setEnviando] = useState(false);
    const [catalogosAtivos, setCatalogosAtivos] = useState<CatalogoAtivo[]>([]);
    const [loadingAtivos, setLoadingAtivos] = useState(true);

    useEffect(() => {
      if (!user?.id) return;
      setLoadingAtivos(true);
      supabase
        .from('catalogos')
        .select('file_path, mensagem, nome')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .then(({ data }) => {
          if (data) setCatalogosAtivos(data as CatalogoAtivo[]);
          setLoadingAtivos(false);
        });
    }, [user?.id]);

    const enviarCatalogo = async () => {
      const phoneResult = normalizePhoneE164(cliente.telefone);
      if (!phoneResult.valid) {
        toast({ title: "Telefone inválido", description: phoneResult.error, variant: "destructive" });
        return;
      }

      if (catalogosAtivos.length === 0) {
        toast({ title: "Nenhum catálogo ativo", description: "Ative pelo menos um catálogo nas configurações.", variant: "destructive" });
        return;
      }

      setEnviando(true);
      try {
        if (!user?.id) throw new Error("Usuário não autenticado.");

        for (const cat of catalogosAtivos) {
          const isFirst = catalogosAtivos.indexOf(cat) === 0;
          const filePath = cat.file_path;

          const { data: signedData, error: signedError } = await supabase.storage
            .from('lotes')
            .createSignedUrl(filePath, 604800);

          if (signedError || !signedData?.signedUrl) {
            console.error(`Catálogo ${cat.nome} não encontrado.`);
            continue;
          }

          let caption = '';
          if (isFirst) {
            const hasNameTag = cat.mensagem?.includes('{nome}');
            const saudacaoAleatoria = SAUDACOES[Math.floor(Math.random() * SAUDACOES.length)];
            
            const baseCaption = cat.mensagem || `Segue o nosso catálogo "${cat.nome}".`;
            
            caption = hasNameTag
              ? baseCaption.replace(/\{nome\}/g, cliente.nome.split(' ')[0])
              : `${saudacaoAleatoria} ${cliente.nome.split(' ')[0]}! ${baseCaption}`;
          } else {
            // No segundo catálogo em diante, não adicionamos saudação automática
            // Enviamos apenas a mensagem se ela existir, senão vai vazio
            caption = cat.mensagem
              ? cat.mensagem.replace(/\{nome\}/g, cliente.nome.split(' ')[0])
              : '';
          }

          const fileName = `${cat.nome.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`;

          const { error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
              type: 'document',
              phone: phoneResult.phone,
              documentUrl: signedData.signedUrl,
              fileName,
              caption,
            },
          });

          if (error) throw error;
          
          // Pequeno delay entre catálogos para garantir ordem
          if (catalogosAtivos.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        // Registrar contato
        marcarContato(cliente.id, 'whatsapp');

        toast({
          title: "✅ Envio concluído!",
          description: `${catalogosAtivos.length} catálogo(s) enviado(s) para ${cliente.nome.split(' ')[0]}.`,
        });
      } catch (err: any) {
        console.error('Erro ao enviar Catálogo:', err);
        toast({
          title: "Erro ao enviar",
          description: err?.message || "Não foi possível enviar o(s) catálogo(s).",
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
