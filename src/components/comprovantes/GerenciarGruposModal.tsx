import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Pencil, Search, Loader2, AlertCircle, MessageCircle, Zap, RefreshCw, FileImage, FileText, MessageSquare, Wifi } from 'lucide-react';
import { useGruposComprovantes, useEventosBrutosNaoCadastrados, useEventosBrutosRecentes, GrupoComprovante, CORES_GRUPO, getCorClasses, ComprovanteCategoria } from '@/hooks/useGruposComprovantes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GerenciarGruposModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  group_whatsapp_id: string;
  nome: string;
  emoji: string;
  cor: string;
  categoria_padrao: ComprovanteCategoria;
  modo_categoria: 'fixa' | 'legenda_ja';
  aceita_pdf: boolean;
  ativo: boolean;
}

const FORM_INICIAL: FormState = {
  group_whatsapp_id: '',
  nome: '',
  emoji: '💬',
  cor: 'emerald',
  categoria_padrao: 'nao_classificado',
  modo_categoria: 'fixa',
  aceita_pdf: true,
  ativo: true,
};

const EMOJIS_SUGESTAO = ['💰', '💬', '🏟️', '👖', '👔', '🛍️', '📦', '🎯', '⭐', '🔥', '💼', '🏪'];

export function GerenciarGruposModal({ isOpen, onClose }: GerenciarGruposModalProps) {
  const { grupos, loading, createGrupo, updateGrupo, deleteGrupo, isCreating, isUpdating } = useGruposComprovantes();
  const { data: descobertos = [] } = useEventosBrutosNaoCadastrados();
  const { data: eventosRecentes = [], refetch: refetchEventos, isFetching: fetchingEventos } = useEventosBrutosRecentes(30);

  const [editando, setEditando] = useState<GrupoComprovante | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [confirmDelete, setConfirmDelete] = useState<GrupoComprovante | null>(null);
  const [configurandoZapi, setConfigurandoZapi] = useState(false);

  const ativarZapi = async () => {
    setConfigurandoZapi(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-config-grupos');
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Z-API configurada!', {
        description: 'Notificações de grupo ativadas. Mande uma mensagem no grupo agora pra testar.',
      });
      setTimeout(() => refetchEventos(), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast.error('Falha ao configurar Z-API', { description: msg });
    } finally {
      setConfigurandoZapi(false);
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_INICIAL);
    setShowForm(true);
  };

  const abrirEditar = (g: GrupoComprovante) => {
    setEditando(g);
    setForm({
      group_whatsapp_id: g.group_whatsapp_id,
      nome: g.nome,
      emoji: g.emoji,
      cor: g.cor,
      categoria_padrao: g.categoria_padrao,
      modo_categoria: g.pedir_legenda_ja ? 'legenda_ja' : 'fixa',
      aceita_pdf: g.aceita_pdf,
      ativo: g.ativo,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.group_whatsapp_id.trim() || !form.nome.trim()) return;

    const payload = {
      group_whatsapp_id: form.group_whatsapp_id.trim(),
      nome: form.nome.trim(),
      emoji: form.emoji || '💬',
      cor: form.cor,
      categoria_padrao: form.modo_categoria === 'legenda_ja' ? 'nao_classificado' as const : form.categoria_padrao,
      pedir_legenda_ja: form.modo_categoria === 'legenda_ja',
      aceita_pdf: form.aceita_pdf,
      ativo: form.ativo,
    };

    if (editando) {
      updateGrupo({ id: editando.id, updates: payload }, { onSuccess: () => setShowForm(false) });
    } else {
      createGrupo(payload, { onSuccess: () => setShowForm(false) });
    }
  };

  const usarDescoberto = (groupId: string, chatName: string | null) => {
    setForm(f => ({
      ...f,
      group_whatsapp_id: groupId,
      nome: f.nome || chatName || 'Novo Grupo',
    }));
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Grupos de WhatsApp
            </DialogTitle>
            <DialogDescription>
              Cadastre grupos do WhatsApp que enviam comprovantes. Cada grupo pode ter um nome, cor e categorização padrão.
            </DialogDescription>
          </DialogHeader>

          {!showForm ? (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-2">
                <Button onClick={abrirNovo} className="w-full gap-2" size="sm">
                  <Plus className="h-4 w-4" /> Adicionar Grupo
                </Button>

                {loading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
                ) : grupos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum grupo cadastrado ainda.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grupos.map(g => {
                      const cor = getCorClasses(g.cor);
                      return (
                        <div
                          key={g.id}
                          className={cn(
                            "p-3 rounded-xl border bg-card flex items-center gap-3",
                            !g.ativo && "opacity-50"
                          )}
                        >
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2", cor.chip)}>
                            {g.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm truncate">{g.nome}</p>
                              {!g.ativo && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                              {g.pedir_legenda_ja && <Badge variant="secondary" className="text-[10px]">J/A na legenda</Badge>}
                              {!g.pedir_legenda_ja && <Badge variant="secondary" className="text-[10px]">Cat. fixa: {g.categoria_padrao}</Badge>}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">{g.group_whatsapp_id}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditar(g)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(g)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Diagnóstico: descobertos */}
                {descobertos.length > 0 && (
                  <div className="mt-4 p-3 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10">
                    <div className="flex items-start gap-2 mb-2">
                      <Search className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          {descobertos.length} grupo(s) detectado(s) ainda não cadastrado(s)
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                          Mensagens chegando no webhook mas sem grupo configurado. Clique para cadastrar.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {descobertos.slice(0, 5).map(d => (
                        <button
                          key={d.group_whatsapp_id}
                          onClick={() => {
                            setEditando(null);
                            setForm({ ...FORM_INICIAL, group_whatsapp_id: d.group_whatsapp_id, nome: d.chat_name || '' });
                            setShowForm(true);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-white dark:bg-card hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors border border-amber-200 dark:border-amber-900/50"
                        >
                          <p className="text-xs font-semibold">{d.chat_name || 'Grupo sem nome'}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{d.group_whatsapp_id}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {d.total} mensagem(ns) · última {formatDistanceToNow(new Date(d.ultima_msg), { locale: ptBR, addSuffix: true })}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {descobertos.length === 0 && grupos.length > 0 && (
                  <div className="mt-4 p-3 rounded-xl border bg-muted/30 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                      <p>
                        Para cadastrar um grupo novo: mande qualquer mensagem nele pelo WhatsApp. O ID será detectado automaticamente e aparecerá aqui.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Painel de diagnóstico Z-API ── */}
                <div className="mt-6 border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Diagnóstico Z-API</h3>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 mb-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Zap className="h-4 w-4 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold">Não está recebendo mensagens de grupo?</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Por padrão a Z-API <strong>não envia</strong> webhooks de grupos. Clique abaixo pra ativar.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={ativarZapi}
                      disabled={configurandoZapi}
                      size="sm"
                      className="w-full gap-2"
                    >
                      {configurandoZapi ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Configurando...</>
                      ) : (
                        <><Zap className="h-3.5 w-3.5" /> Ativar notificações de grupo (Z-API)</>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Eventos recebidos no webhook (últimos 30 min)
                    </p>
                    <Button
                      onClick={() => refetchEventos()}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1"
                      disabled={fetchingEventos}
                    >
                      <RefreshCw className={cn("h-3 w-3", fetchingEventos && "animate-spin")} />
                      <span className="text-[11px]">Atualizar</span>
                    </Button>
                  </div>

                  {eventosRecentes.length === 0 ? (
                    <div className="p-4 rounded-lg border bg-muted/20 text-center">
                      <p className="text-xs text-muted-foreground">
                        Nenhum evento nos últimos 30 min.
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Mande uma mensagem em qualquer grupo do WhatsApp e clique em "Atualizar".
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {eventosRecentes.map(ev => {
                        const Icon = ev.message_type === 'image' ? FileImage
                          : ev.message_type === 'document' ? FileText
                          : MessageSquare;
                        const grupoCadastrado = grupos.find(g => g.group_whatsapp_id === ev.group_whatsapp_id);
                        return (
                          <div
                            key={ev.id}
                            className={cn(
                              "p-2 rounded-lg border text-[11px] flex items-start gap-2",
                              grupoCadastrado ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30" : "bg-card"
                            )}
                          >
                            <Icon className={cn(
                              "h-3.5 w-3.5 mt-0.5 flex-shrink-0",
                              ev.message_type === 'image' ? "text-blue-500" :
                              ev.message_type === 'document' ? "text-purple-500" :
                              "text-muted-foreground"
                            )} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold truncate">
                                  {ev.chat_name || 'Sem nome'}
                                </span>
                                {grupoCadastrado ? (
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                    {grupoCadastrado.emoji} cadastrado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-700 dark:text-amber-400">
                                    não cadastrado
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  {format(new Date(ev.created_at), 'HH:mm:ss')}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">
                                {ev.message_type} · {ev.group_whatsapp_id}
                              </p>
                              {ev.caption && (
                                <p className="text-[10px] text-muted-foreground italic truncate">
                                  "{ev.caption}"
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-2">
                <div>
                  <Label className="text-xs">Nome amigável *</Label>
                  <Input
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Confirmação de Pagamento 1"
                    className="h-9 mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">ID do grupo WhatsApp *</Label>
                  <Input
                    value={form.group_whatsapp_id}
                    onChange={e => setForm(f => ({ ...f, group_whatsapp_id: e.target.value }))}
                    placeholder="120363402446093422-group"
                    className="h-9 mt-1 font-mono text-xs"
                    disabled={!!editando}
                  />
                  {!editando && descobertos.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-muted-foreground">IDs detectados recentemente (clique para usar):</p>
                      {descobertos.slice(0, 3).map(d => (
                        <button
                          key={d.group_whatsapp_id}
                          onClick={() => usarDescoberto(d.group_whatsapp_id, d.chat_name)}
                          className="w-full text-left text-[11px] p-1.5 rounded bg-muted hover:bg-muted/80 font-mono truncate"
                        >
                          {d.chat_name ? `${d.chat_name} · ` : ''}{d.group_whatsapp_id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Emoji</Label>
                    <Input
                      value={form.emoji}
                      onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                      maxLength={4}
                      className="h-9 mt-1 text-lg"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {EMOJIS_SUGESTAO.map(e => (
                        <button
                          key={e}
                          onClick={() => setForm(f => ({ ...f, emoji: e }))}
                          className={cn(
                            "w-7 h-7 rounded text-base hover:bg-muted",
                            form.emoji === e && "bg-primary/10 ring-2 ring-primary"
                          )}
                        >{e}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Cor</Label>
                    <Select value={form.cor} onValueChange={v => setForm(f => ({ ...f, cor: v }))}>
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CORES_GRUPO.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3 h-3 rounded-full", getCorClasses(c.value).bg)} />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Categorização dos comprovantes</Label>
                  <RadioGroup
                    value={form.modo_categoria}
                    onValueChange={(v) => setForm(f => ({ ...f, modo_categoria: v as 'fixa' | 'legenda_ja' }))}
                    className="mt-2 space-y-2"
                  >
                    <div className="flex items-start gap-2 p-2 rounded-lg border">
                      <RadioGroupItem value="fixa" id="cat-fixa" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="cat-fixa" className="text-sm font-semibold cursor-pointer">Categoria fixa</Label>
                        <p className="text-[11px] text-muted-foreground">Todo comprovante deste grupo entra com a categoria definida abaixo.</p>
                        {form.modo_categoria === 'fixa' && (
                          <Select value={form.categoria_padrao} onValueChange={v => setForm(f => ({ ...f, categoria_padrao: v as ComprovanteCategoria }))}>
                            <SelectTrigger className="h-8 mt-2 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nao_classificado">❓ Não classificado</SelectItem>
                              <SelectItem value="jeans">👖 Jeans</SelectItem>
                              <SelectItem value="alfaiataria">👔 Alfaiataria</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded-lg border">
                      <RadioGroupItem value="legenda_ja" id="cat-legenda" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="cat-legenda" className="text-sm font-semibold cursor-pointer">Detectar pela legenda (J / A)</Label>
                        <p className="text-[11px] text-muted-foreground">Categoria definida pela legenda da imagem: <strong>J</strong> = Jeans, <strong>A</strong> = Alfaiataria.</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg border">
                  <div>
                    <Label className="text-sm font-semibold">Aceitar PDF</Label>
                    <p className="text-[11px] text-muted-foreground">Processar arquivos PDF além de imagens.</p>
                  </div>
                  <Switch
                    checked={form.aceita_pdf}
                    onCheckedChange={(c) => setForm(f => ({ ...f, aceita_pdf: c }))}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg border">
                  <div>
                    <Label className="text-sm font-semibold">Ativo</Label>
                    <p className="text-[11px] text-muted-foreground">Se desativado, mensagens deste grupo são ignoradas.</p>
                  </div>
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(c) => setForm(f => ({ ...f, ativo: c }))}
                  />
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {showForm ? (
              <>
                <Button variant="outline" onClick={() => setShowForm(false)} disabled={isCreating || isUpdating}>
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isCreating || isUpdating || !form.nome.trim() || !form.group_whatsapp_id.trim()}
                >
                  {(isCreating || isUpdating) && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  {editando ? 'Salvar alterações' : 'Cadastrar grupo'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.nome}" não será mais processado. Comprovantes já registrados continuarão visíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteGrupo(confirmDelete.id);
                setConfirmDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
