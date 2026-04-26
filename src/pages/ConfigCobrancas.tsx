import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  MessageSquare, Save, Loader2, Clock, CheckCircle2, XCircle,
  History, Users, Edit3, Play, RefreshCw, AlertCircle, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

const TEMPLATES_PADRAO: Record<number, string> = {
  1: `Oi, [Nome]! 😊

Passando para avisar que seu pedido na *Delooki Jeans* está aguardando o pagamento no valor de *R$ [Valor]*.

O pagamento é necessário para separar seu pedido e garantir que tudo fique reservado pra você! 🥰

O prazo é até amanhã *(quinta-feira)*. Qualquer dúvida é só chamar!`,

  2: `Olá, [Nome]! 😊

Lembrando que *hoje é o último dia* para confirmar o pagamento do seu pedido de *R$ [Valor]*.

Precisamos do pagamento para separar tudo certinho pra você! 🥰

Qualquer dúvida, estamos aqui!`,

  3: `Oi, [Nome]! 🥰

Ainda não identificamos o pagamento do seu pedido de *R$ [Valor]*. O prazo encerra *hoje*!

Confirme o pagamento para garantirmos a separação do seu pedido — não queremos que você perca 😊

Qualquer dúvida, é só falar com a gente!`,
};

const HORARIOS = ['Quarta ~14h (1ª cobrança)', 'Quinta ~9h (2ª cobrança)', 'Quinta ~15h (3ª cobrança)'];

interface CobrancaEnviada {
  id: string;
  cliente_nome: string;
  telefone: string;
  tentativa: number;
  valor_total: number;
  status: string;
  erro: string | null;
  enviado_at: string;
}

interface ClienteExclusao {
  id: string;
  nome: string;
  telefone: string;
  excluir_cobranca_automatica: boolean;
}

const ConfigCobrancas = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Templates
  const [templates, setTemplates] = useState<Record<number, string>>({ ...TEMPLATES_PADRAO });
  const [savingTemplate, setSavingTemplate] = useState<number | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Histórico
  const [historico, setHistorico] = useState<CobrancaEnviada[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'semana' | 'mes'>('semana');

  // Exclusões
  const [clientes, setClientes] = useState<ClienteExclusao[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [salvandoExclusao, setSalvandoExclusao] = useState<string | null>(null);

  // Disparo manual
  const [disparando, setDisparando] = useState<number | null>(null);

  useEffect(() => {
    carregarTemplates();
    carregarHistorico();
    carregarClientes();
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [filtroPeriodo]);

  const carregarTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await supabase
        .from('templates_cobranca')
        .select('tentativa, mensagem')
        .eq('ativo', true);

      if (data && data.length > 0) {
        const mapa: Record<number, string> = { ...TEMPLATES_PADRAO };
        data.forEach((t: any) => { mapa[t.tentativa] = t.mensagem; });
        setTemplates(mapa);
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  const salvarTemplate = async (tentativa: number) => {
    setSavingTemplate(tentativa);
    try {
      const { error } = await supabase
        .from('templates_cobranca')
        .upsert({
          user_id: user!.id,
          tentativa,
          mensagem: templates[tentativa],
          ativo: true,
        }, { onConflict: 'user_id,tentativa' });

      if (error) throw error;
      toast.success(`Template da ${tentativa}ª cobrança salvo!`);
    } catch (err: any) {
      toast.error('Erro ao salvar template: ' + err.message);
    } finally {
      setSavingTemplate(null);
    }
  };

  const restaurarPadrao = (tentativa: number) => {
    setTemplates(prev => ({ ...prev, [tentativa]: TEMPLATES_PADRAO[tentativa] }));
    toast.info('Template restaurado para o padrão (não esqueça de salvar)');
  };

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const agora = new Date();
      let desde: Date;
      if (filtroPeriodo === 'semana') {
        const diaSemana = agora.getDay();
        const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
        desde = new Date(agora);
        desde.setDate(agora.getDate() - diasDesdeSegunda);
        desde.setHours(0, 0, 0, 0);
      } else {
        desde = new Date(agora.getFullYear(), agora.getMonth(), 1);
      }

      const { data } = await supabase
        .from('cobrancas_enviadas')
        .select('*')
        .gte('enviado_at', desde.toISOString())
        .order('enviado_at', { ascending: false });

      setHistorico(data ?? []);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const carregarClientes = async () => {
    setLoadingClientes(true);
    try {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, telefone, excluir_cobranca_automatica')
        .order('nome');
      setClientes(data ?? []);
    } finally {
      setLoadingClientes(false);
    }
  };

  const toggleExclusaoCliente = async (clienteId: string, valor: boolean) => {
    setSalvandoExclusao(clienteId);
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ excluir_cobranca_automatica: valor })
        .eq('id', clienteId);

      if (error) throw error;
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, excluir_cobranca_automatica: valor } : c));
      toast.success(valor ? 'Cliente excluído das cobranças automáticas' : 'Cliente incluído nas cobranças automáticas');
    } catch (err: any) {
      toast.error('Erro ao atualizar cliente: ' + err.message);
    } finally {
      setSalvandoExclusao(null);
    }
  };

  const dispararManual = async (tentativa: number) => {
    setDisparando(tentativa);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('cobranca-pendentes', {
        body: { tentativa },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw res.error;
      const resultado = res.data;
      toast.success(`Disparo concluído: ${resultado.enviados} enviados, ${resultado.falhas} falhas`);
      carregarHistorico();
    } catch (err: any) {
      toast.error('Erro no disparo: ' + (err.message ?? 'Verifique os logs'));
    } finally {
      setDisparando(null);
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
    c.telefone?.includes(buscaCliente)
  );

  const totalSemana = historico.length;
  const enviadosSemana = historico.filter(h => h.status === 'enviado').length;
  const falhasSemana = historico.filter(h => h.status === 'falhou').length;
  const excluidos = clientes.filter(c => c.excluir_cobranca_automatica).length;

  return (
    <div className="flex min-h-screen bg-background pb-24 md:pb-0">
      {isMobile && <MobileHeader title="Cobranças Automáticas" />}
      {!isMobile && <AppSidebar />}

      <main className={cn("flex-1 p-6 lg:p-8 overflow-auto", isMobile && "pt-20")}>
        <div className="max-w-3xl mx-auto space-y-6">

          <header>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="text-green-600" />
              Cobranças Automáticas
            </h1>
            <p className="text-muted-foreground mt-1">
              Disparo automático de cobranças via WhatsApp para pedidos com pagamento pendente
            </p>
          </header>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-none neu-card rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{totalSemana}</p>
                <p className="text-xs text-muted-foreground mt-1">Total disparado</p>
              </CardContent>
            </Card>
            <Card className="border-none neu-card rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{enviadosSemana}</p>
                <p className="text-xs text-muted-foreground mt-1">Enviados</p>
              </CardContent>
            </Card>
            <Card className="border-none neu-card rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{falhasSemana}</p>
                <p className="text-xs text-muted-foreground mt-1">Falhas</p>
              </CardContent>
            </Card>
            <Card className="border-none neu-card rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-500">{excluidos}</p>
                <p className="text-xs text-muted-foreground mt-1">Clientes excluídos</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="templates">
            <TabsList className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <TabsTrigger value="templates" className="flex-1 rounded-lg gap-2">
                <Edit3 size={14} /> Templates
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex-1 rounded-lg gap-2">
                <History size={14} /> Histórico
              </TabsTrigger>
              <TabsTrigger value="exclusoes" className="flex-1 rounded-lg gap-2">
                <Users size={14} /> Exclusões
              </TabsTrigger>
            </TabsList>

            {/* ABA TEMPLATES */}
            <TabsContent value="templates" className="space-y-4 mt-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-400">
                  Use <strong>[Nome]</strong> para o primeiro nome do cliente e <strong>[Valor]</strong> para o valor do pedido. O disparo automático ocorre: <strong>Quarta 14h</strong>, <strong>Quinta 9h</strong> e <strong>Quinta 15h</strong>.
                </p>
              </div>

              {[1, 2, 3].map((tentativa) => (
                <Card key={tentativa} className="border-none neu-card rounded-2xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-sm font-bold">
                          {tentativa}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{HORARIOS[tentativa - 1]}</CardTitle>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground h-7"
                        onClick={() => restaurarPadrao(tentativa)}
                      >
                        <RefreshCw size={12} className="mr-1" /> Padrão
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <Textarea
                      value={templates[tentativa] ?? ''}
                      onChange={(e) => setTemplates(prev => ({ ...prev, [tentativa]: e.target.value }))}
                      rows={7}
                      className="rounded-xl font-mono text-sm resize-none"
                      disabled={loadingTemplates}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        className="flex-1 h-9 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => salvarTemplate(tentativa)}
                        disabled={savingTemplate === tentativa}
                      >
                        {savingTemplate === tentativa
                          ? <><Loader2 size={14} className="mr-2 animate-spin" /> Salvando...</>
                          : <><Save size={14} className="mr-2" /> Salvar</>
                        }
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 rounded-xl gap-2 text-xs"
                        onClick={() => dispararManual(tentativa)}
                        disabled={disparando === tentativa}
                        title="Disparar agora manualmente"
                      >
                        {disparando === tentativa
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Play size={13} />
                        }
                        Disparar agora
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* ABA HISTÓRICO */}
            <TabsContent value="historico" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant={filtroPeriodo === 'semana' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl h-8 text-xs"
                    onClick={() => setFiltroPeriodo('semana')}
                  >
                    Esta semana
                  </Button>
                  <Button
                    variant={filtroPeriodo === 'mes' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl h-8 text-xs"
                    onClick={() => setFiltroPeriodo('mes')}
                  >
                    Este mês
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={carregarHistorico}>
                  <RefreshCw size={13} />
                </Button>
              </div>

              {loadingHistorico ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-slate-400" size={24} />
                </div>
              ) : historico.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Nenhuma cobrança enviada no período</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historico.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.status === 'enviado'
                          ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                          : <XCircle size={16} className="text-red-500 shrink-0" />
                        }
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.cliente_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.enviado_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            {item.erro && <span className="text-red-500 ml-2">· {item.erro}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant="outline" className="text-xs rounded-lg">
                          {item.tentativa}ª
                        </Badge>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          R$ {Number(item.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA EXCLUSÕES */}
            <TabsContent value="exclusoes" className="space-y-4 mt-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  Clientes com o toggle ativado <strong>não receberão</strong> nenhuma cobrança automática, independente do status do pedido. Para excluir um pedido específico, use a opção direto no pedido.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Buscar cliente..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  className="pl-10 h-10 rounded-xl"
                />
              </div>

              {loadingClientes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-slate-400" size={24} />
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Nenhum cliente encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientesFiltrados.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{cliente.nome}</p>
                        <p className="text-xs text-muted-foreground">{cliente.telefone || 'Sem telefone'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {cliente.excluir_cobranca_automatica && (
                          <Badge variant="destructive" className="text-xs rounded-lg">Excluído</Badge>
                        )}
                        {salvandoExclusao === cliente.id
                          ? <Loader2 size={16} className="animate-spin text-slate-400" />
                          : (
                            <Switch
                              checked={cliente.excluir_cobranca_automatica}
                              onCheckedChange={(val) => toggleExclusaoCliente(cliente.id, val)}
                            />
                          )
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default ConfigCobrancas;
