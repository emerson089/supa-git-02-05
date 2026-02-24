import { useState, forwardRef } from 'react';
import { MessageCircle, ShoppingBag, RefreshCw, Clock, Copy } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Cliente } from '@/contexts/ClientesContext';
import { ClienteCRMStats } from '@/hooks/useClientesCRM';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WhatsAppButtonProps {
  cliente: Cliente;
  stats?: ClienteCRMStats;
  onContatoRegistrado?: () => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Detectar dispositivo móvel por user-agent (mais confiável que breakpoint)
const getDeviceInfo = () => {
  if (typeof navigator === 'undefined') return { isIOS: false, isAndroid: false, isMobileDevice: false };
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobileDevice = isIOS || isAndroid;
  
  return { isIOS, isAndroid, isMobileDevice };
};

// Normalizar telefone para formato E.164 (ex: 5511999999999)
const normalizePhoneE164 = (raw: string): { valid: boolean; phone: string; error?: string } => {
  // Remove tudo que não for dígito
  let digits = raw.replace(/\D/g, '');
  
  // Remove zeros à esquerda
  digits = digits.replace(/^0+/, '');
  
  // Adiciona código do país se não tiver
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  // Validar comprimento (55 + DDD(2) + número(8-9) = 12-13 dígitos)
  if (digits.length < 12) {
    return { valid: false, phone: '', error: 'Telefone muito curto. Verifique o DDD e o número.' };
  }
  
  if (digits.length > 13) {
    return { valid: false, phone: '', error: 'Telefone muito longo. Verifique o formato.' };
  }
  
  return { valid: true, phone: digits };
};

const templates = [
  {
    id: 'vendas',
    label: 'Vendas - Novidades',
    icon: ShoppingBag,
    mensagem: 'Olá [Nome], chegaram novidades na Delookii Jeans! Posso te enviar o catálogo da semana?',
  },
  {
    id: 'reativacao',
    label: 'Reativação de Cliente',
    icon: RefreshCw,
    mensagem: 'Oi [Nome], tudo bem? Estamos liberando o catálogo da nova coleção hoje em primeira mão para você. Tem modelos que vão esgotar rápido. Quer dar uma olhadinha?',
  },
  {
    id: 'pendente',
    label: 'Pedido Pendente',
    icon: Clock,
    mensagem: 'Oi [Nome], seu pedido de [Valor] ainda está reservado, mas a procura está alta. Podemos confirmar o pagamento para garantir suas peças?',
  },
];

export const WhatsAppButton = forwardRef<HTMLButtonElement, WhatsAppButtonProps>(
  function WhatsAppButton({ cliente, stats, onContatoRegistrado }, ref) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const processarMensagem = (texto: string, templateId: string) => {
    const nome = cliente.nome.split(' ')[0];
    
    // For "pendente" template, use the value of the last pending order
    let valor: string;
    if (templateId === 'pendente' && stats?.ultimoPedidoPendenteValor) {
      valor = formatCurrency(stats.ultimoPedidoPendenteValor);
    } else {
      valor = formatCurrency(stats?.totalComprado || 0);
    }
    
    return texto.replace('[Nome]', nome).replace('[Valor]', valor);
  };

  const handleSelectTemplate = (template: typeof templates[0]) => {
    const mensagemProcessada = processarMensagem(template.mensagem, template.id);
    setMensagem(mensagemProcessada);
    setMenuOpen(false);
    setModalOpen(true);
  };

  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      toast({
        title: "Mensagem copiada!",
        description: "Cole no WhatsApp manualmente.",
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Selecione e copie o texto manualmente.",
        variant: "destructive",
      });
    }
  };

  const enviarWhatsApp = () => {
    // Validar telefone
    const phoneResult = normalizePhoneE164(cliente.telefone);
    if (!phoneResult.valid) {
      toast({
        title: "Telefone inválido",
        description: phoneResult.error,
        variant: "destructive",
      });
      return;
    }

    const phone = phoneResult.phone;
    const encodedMsg = encodeURIComponent(mensagem);
    const { isMobileDevice, isIOS } = getDeviceInfo();

    // URLs disponíveis
    const deepLink = `whatsapp://send?phone=${phone}&text=${encodedMsg}`;
    const webWhatsApp = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
    const waMe = `https://wa.me/${phone}?text=${encodedMsg}`;

    if (isMobileDevice) {
      // Mobile: tentar deep link primeiro, fallback para wa.me
      window.location.href = deepLink;
      
      // Fallback após 1s se ainda estiver na página
      setTimeout(() => {
        if (document.visibilityState !== 'hidden') {
          window.location.href = waMe;
        }
      }, 1000);
    } else {
      // Desktop: usar web.whatsapp.com (evita api.whatsapp.com)
      // Abrir em nova aba com link nativo
      const link = document.createElement('a');
      link.href = webWhatsApp;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setModalOpen(false);
    onContatoRegistrado?.();
  };

  const renderTemplateMenu = () => (
    <div className="py-1">
      {templates.map((template) => {
        const Icon = template.icon;
        return (
          <DropdownMenuItem
            key={template.id}
            onClick={() => handleSelectTemplate(template)}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer min-h-[48px]"
          >
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-5 w-5 text-[#25D366]" />
            </div>
            <span className="text-sm font-medium">{template.label}</span>
          </DropdownMenuItem>
        );
      })}
    </div>
  );

  // Desktop: Dialog | Mobile: Drawer (Bottom Sheet)
  const renderMessageModal = () => {
    if (isMobile) {
      return (
        <Drawer open={modalOpen} onOpenChange={setModalOpen}>
          <DrawerContent className="px-4 pb-8 max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Enviar Mensagem</DrawerTitle>
              <DrawerDescription>
                Personalize a mensagem para {cliente.nome.split(' ')[0]}
              </DrawerDescription>
            </DrawerHeader>
            
            <div className="space-y-4 px-4 flex-1 overflow-auto">
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={6}
                className="text-base min-h-[140px] resize-none"
                placeholder="Oi Aline, seu pedido de R$ 1.447,00 ainda está reservado, mas a procura está alta. Podemos confirmar o pagamento para garantir suas peças?"
              />
            </div>

            <DrawerFooter className="px-4 pt-4 gap-2">
              <Button
                onClick={enviarWhatsApp}
                className="w-full h-12 bg-[#25D366] hover:bg-[#20BD5A] text-white text-base font-semibold rounded-xl"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Enviar para o WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={copiarMensagem}
                className="w-full h-12 rounded-xl"
              >
                <Copy className="mr-2 h-5 w-5" />
                Copiar mensagem
              </Button>
              <DrawerClose asChild>
                <Button variant="ghost" className="w-full h-10 rounded-xl text-muted-foreground">
                  Cancelar
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      );
    }

    return (
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem</DialogTitle>
            <DialogDescription>
              Personalize a mensagem para {cliente.nome.split(' ')[0]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={6}
              className="text-base min-h-[140px] resize-none"
              placeholder="Oi Aline, seu pedido de R$ 1.447,00 ainda está reservado, mas a procura está alta. Podemos confirmar o pagamento para garantir suas peças?"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="h-10 rounded-xl text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={copiarMensagem}
              className="h-11 rounded-xl"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button
              onClick={enviarWhatsApp}
              className="h-11 bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold rounded-xl"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Mobile: Template selection via Drawer
  if (isMobile) {
    return (
      <>
        <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors"
          >
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
          </Button>
          
          <DrawerContent className="pb-8">
            <DrawerHeader className="text-left">
              <DrawerTitle>Enviar WhatsApp</DrawerTitle>
              <DrawerDescription>
                Escolha um modelo de mensagem para {cliente.nome.split(' ')[0]}
              </DrawerDescription>
            </DrawerHeader>
            
            <div className="px-4 space-y-2">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors min-h-[56px]"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6 text-[#25D366]" />
                    </div>
                    <span className="text-base font-medium text-left">{template.label}</span>
                  </button>
                );
              })}
            </div>

            <DrawerFooter className="px-4 pt-4">
              <DrawerClose asChild>
                <Button variant="outline" className="w-full h-12 rounded-xl">
                  Cancelar
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        
        {renderMessageModal()}
      </>
    );
  }

  // Desktop: Dropdown Menu
  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="w-8 h-8 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 flex items-center justify-center transition-colors"
            title="Enviar WhatsApp"
          >
            <MessageCircle size={14} className="text-[#25D366]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {renderTemplateMenu()}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {renderMessageModal()}
    </>
  );
});

WhatsAppButton.displayName = 'WhatsAppButton';
