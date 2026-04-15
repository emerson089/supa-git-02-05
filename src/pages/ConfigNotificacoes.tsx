import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Save, 
  MessageSquare, 
  Phone,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const ConfigNotificacoes = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [numbers, setNumbers] = useState<string[]>([]);
  const [notifyOnOrder, setNotifyOnOrder] = useState(true);
  const [newNumber, setNewNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (user && !hasLoaded) {
      const metadata = user.user_metadata || {};
      setNumbers(metadata.notification_numbers || []);
      setNotifyOnOrder(metadata.notify_on_order !== false);
      setLoading(false);
      setHasLoaded(true);
    }
  }, [user, hasLoaded]);

  const handleAddNumber = () => {
    // Basic normalization
    let digits = newNumber.replace(/\D/g, '');
    
    if (digits.length < 10) {
      toast.error('Número inválido. Use o formato: 81 9XXXX-XXXX');
      return;
    }

    // Ensure 55 prefix for Brazil if not present
    if (digits.length <= 11) {
      digits = '55' + digits;
    }

    if (numbers.includes(digits)) {
      toast.error('Este número já está na lista.');
      return;
    }

    setNumbers([...numbers, digits]);
    setNewNumber('');
    toast.success('Número adicionado à lista (não esqueça de Salvar)');
  };

  const handleRemoveNumber = (index: number) => {
    setNumbers(numbers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          notification_numbers: numbers,
          notify_on_order: notifyOnOrder
        }
      });

      if (error) throw error;
      toast.success('Configurações de notificação salvas!');
    } catch (err: any) {
      console.error('Erro ao salvar notificações:', err);
      toast.error('Erro ao salvar: ' + (err.message || 'Verifique sua conexão'));
    } finally {
      setSaving(false);
    }
  };

  const formatDisplayNumber = (num: string) => {
    // display format: (XX) XXXXX-XXXX
    let pure = num.replace(/^55/, '');
    if (pure.length === 11) {
      return `(${pure.substring(0, 2)}) ${pure.substring(2, 7)}-${pure.substring(7)}`;
    }
    return num;
  };

  return (
    <div className="flex min-h-screen bg-background pb-24 md:pb-0">
      {isMobile && <MobileHeader title="Notificações" />}
      {!isMobile && <AppSidebar />}

      <main className={cn("flex-1 p-6 lg:p-8 overflow-auto", isMobile && "pt-20")}>
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
                <Bell className="text-indigo-600" />
                Notificações WhatsApp
              </h1>
              <p className="text-muted-foreground mt-1">Configure quem deve ser avisado sobre novas vendas</p>
            </div>
          </header>

          <Card className="border-none neu-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Avisar Gerência</CardTitle>
                  <CardDescription>Sempre enviar resumo de novos pedidos</CardDescription>
                </div>
                <Switch 
                  checked={notifyOnOrder}
                  onCheckedChange={setNotifyOnOrder}
                />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Números para Notificação
                </Label>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input 
                      placeholder="Ex: 81 98109-7616"
                      value={newNumber}
                      onChange={(e) => setNewNumber(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddNumber()}
                      className="pl-10 h-11 rounded-xl"
                    />
                  </div>
                  <Button 
                    variant="secondary" 
                    onClick={handleAddNumber}
                    className="h-11 px-4 rounded-xl"
                  >
                    <Plus size={20} />
                  </Button>
                </div>

                <div className="space-y-2 mt-4">
                  {numbers.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <MessageSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">Nenhum número configurado</p>
                    </div>
                  ) : (
                    numbers.map((num, index) => (
                      <div 
                        key={num} 
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm animate-in fade-in slide-in-from-left-2 duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <Phone size={14} />
                          </div>
                          <span className="font-medium text-slate-700 dark:text-slate-200 tracking-tight">
                            {formatDisplayNumber(num)}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveNumber(index)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                  <p className="font-bold mb-1 uppercase tracking-wider">Atenção</p>
                  As notificações serão enviadas utilizando a mesma API do WhatsApp configurada no sistema. 
                  Certifique-se de que sua instância do Z-API esteja ativa.
                </div>
              </div>

              <Button 
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Salvar Configurações</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default ConfigNotificacoes;
