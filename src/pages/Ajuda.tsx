import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  HelpCircle, 
  MessageCircle, 
  FileText, 
  Mail,
  ExternalLink 
} from 'lucide-react';

export default function Ajuda() {
  const isMobile = useIsMobile();

  const helpItems = [
    {
      icon: <FileText className="h-5 w-5" />,
      title: 'Documentação',
      description: 'Consulte nosso guia completo de uso do sistema.',
      action: 'Ver Documentação',
      href: '#',
    },
    {
      icon: <MessageCircle className="h-5 w-5" />,
      title: 'Suporte via Chat',
      description: 'Fale com nossa equipe de suporte em tempo real.',
      action: 'Iniciar Chat',
      href: '#',
    },
    {
      icon: <Mail className="h-5 w-5" />,
      title: 'Email de Suporte',
      description: 'Envie sua dúvida por email para nossa equipe.',
      action: 'Enviar Email',
      href: 'mailto:suporte@delockjeans.com.br',
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {!isMobile && <AppSidebar />}
      
      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
        {isMobile && <MobileHeader title="Ajuda" />}
        
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Central de Ajuda</h1>
            <p className="text-muted-foreground mt-2">
              Como podemos ajudar você hoje?
            </p>
          </div>

          {/* Help Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {helpItems.map((item, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-2">
                    {item.icon}
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <a href={item.href}>
                      {item.action}
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <Card>
            <CardHeader>
              <CardTitle>Perguntas Frequentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b pb-4">
                <h4 className="font-medium mb-1">Como criar um novo pedido?</h4>
                <p className="text-sm text-muted-foreground">
                  Acesse o menu "Novo Pedido", selecione o cliente e adicione os itens desejados.
                </p>
              </div>
              <div className="border-b pb-4">
                <h4 className="font-medium mb-1">Como gerenciar o estoque?</h4>
                <p className="text-sm text-muted-foreground">
                  No menu "Estoque", você pode visualizar, adicionar e ajustar quantidades de produtos.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Como acompanhar a produção?</h4>
                <p className="text-sm text-muted-foreground">
                  O módulo "Produção" mostra o status de cada lote no formato Kanban.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {isMobile && <BottomNavigation />}
    </div>
  );
}
