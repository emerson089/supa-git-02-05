import React, { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Eye, Filter, RefreshCw, FileText, AlertTriangle, Trash2, Shirt, Scissors, HelpCircle, Settings2 } from 'lucide-react';
import { format, startOfDay, startOfMonth, endOfMonth, endOfDay } from 'date-fns';
import { useComprovantes, useTotaisCategoria, Comprovante, ComprovanteCategoria } from '@/hooks/useComprovantes';
import { ComprovanteModal } from '@/components/comprovantes/ComprovanteModal';
import { GerenciarGruposModal } from '@/components/comprovantes/GerenciarGruposModal';
import { useGruposComprovantes, getCorClasses } from '@/hooks/useGruposComprovantes';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const valFormat = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function CategoriaBadge({ categoria }: { categoria: ComprovanteCategoria }) {
  if (categoria === 'jeans') {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none">👖 Jeans</Badge>;
  }
  if (categoria === 'alfaiataria') {
    return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-none">👔 Alfaiataria</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none">❓ Não classificado</Badge>;
}

export default function Comprovantes() {
  const isMobile = useIsMobile();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<ComprovanteCategoria | 'all'>('all');
  const [periodoFilter, setPeriodoFilter] = useState<string>('hoje');
  const [grupoFilter, setGrupoFilter] = useState<string>('all');
  
  const [selectedComprovante, setSelectedComprovante] = useState<Comprovante | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Calcula datas com base no atalho
  const getDates = () => {
    const hoje = new Date();
    if (periodoFilter === 'hoje') {
      return { start: startOfDay(hoje), end: endOfDay(hoje) };
    }
    if (periodoFilter === 'mes') {
      return { start: startOfMonth(hoje), end: endOfMonth(hoje) };
    }
    return { start: undefined, end: undefined }; // tudo
  };

  const { start, end } = getDates();

  const filtros = {
    searchTerm,
    status: statusFilter !== 'all' ? [statusFilter] : undefined,
    categoria: categoriaFilter,
    grupo: grupoFilter,
    startDate: start,
    endDate: end,
  };

  const { data, isLoading, isUpdating, updateComprovante, refetch, isFetching, deleteComprovante, isDeleting } = useComprovantes(filtros);
  const comprovantes = data?.data || [];

  // Totais por categoria do período (independente dos filtros de status/busca/categoria)
  const { data: totais } = useTotaisCategoria({ startDate: start, endDate: end });
  const tot = totais ?? { jeans: 0, alfaiataria: 0, naoClassificado: 0, total: 0, qtdJeans: 0, qtdAlfaiataria: 0, qtdNaoClassificado: 0 };

  const quantidade = data?.count || 0;

  const handleOpenModal = (c: Comprovante) => {
    setSelectedComprovante(c);
    setIsModalOpen(true);
  };

  const handleSaveModal = (id: string, updates: Partial<Comprovante>) => {
    updateComprovante({ id, updates }, {
      onSuccess: () => setIsModalOpen(false)
    });
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-background overflow-hidden font-inter transition-colors duration-300">
      <AppSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <MobileHeader title="Comprovantes" />
        
        <main className="flex-1 overflow-y-auto w-full p-4 md:p-6 pb-24 md:pb-6 no-scrollbar custom-scrollbar">
          <div className="w-full mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">Comprovantes</h1>
                <p className="text-sm font-medium text-muted-foreground mt-0.5">Leitura automática de recibos integrados via Z-API · use legenda <strong>J</strong> (Jeans) ou <strong>A</strong> (Alfaiataria) ao enviar a foto</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-8 text-xs font-semibold shadow-[3px_3px_8px_hsl(var(--muted)/0.35),-1px_-1px_5px_hsl(var(--background))] border-0 bg-card hover:bg-muted/50">
                  <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Jeans */}
              <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 shadow-[4px_4px_12px_hsl(var(--muted)/0.35),-2px_-2px_8px_hsl(var(--background))] transition-all duration-250 flex flex-col group hover:-translate-y-0.5 hover:shadow-[6px_6px_16px_hsl(var(--muted)/0.4),-3px_-3px_10px_hsl(var(--background))] p-4 sm:p-5">
                <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl transition-opacity bg-blue-500 opacity-80 group-hover:opacity-100" />
                <div className="flex flex-col gap-3 flex-1 pt-0.5">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50">
                      <Shirt className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400 uppercase tracking-wide">Jeans</span>
                  </div>
                  <div className="space-y-1 mt-auto pt-2">
                    <p className="text-xl sm:text-[26px] font-black tracking-tight leading-none tabular-nums text-blue-600 dark:text-blue-400">
                      {valFormat(tot.jeans)}
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate mt-2 border-t border-border/40 pt-2.5">
                      <strong className="text-foreground">{tot.qtdJeans}</strong> comprovante(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Alfaiataria */}
              <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 shadow-[4px_4px_12px_hsl(var(--muted)/0.35),-2px_-2px_8px_hsl(var(--background))] transition-all duration-250 flex flex-col group hover:-translate-y-0.5 hover:shadow-[6px_6px_16px_hsl(var(--muted)/0.4),-3px_-3px_10px_hsl(var(--background))] p-4 sm:p-5">
                <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl transition-opacity bg-purple-500 opacity-80 group-hover:opacity-100" />
                <div className="flex flex-col gap-3 flex-1 pt-0.5">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/50">
                      <Scissors className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-400 uppercase tracking-wide">Alfaiataria</span>
                  </div>
                  <div className="space-y-1 mt-auto pt-2">
                    <p className="text-xl sm:text-[26px] font-black tracking-tight leading-none tabular-nums text-purple-600 dark:text-purple-400">
                      {valFormat(tot.alfaiataria)}
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate mt-2 border-t border-border/40 pt-2.5">
                      <strong className="text-foreground">{tot.qtdAlfaiataria}</strong> comprovante(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Não Classificado */}
              <div className={cn("relative overflow-hidden rounded-2xl bg-card shadow-[4px_4px_12px_hsl(var(--muted)/0.35),-2px_-2px_8px_hsl(var(--background))] transition-all duration-250 flex flex-col group hover:-translate-y-0.5 hover:shadow-[6px_6px_16px_hsl(var(--muted)/0.4),-3px_-3px_10px_hsl(var(--background))] p-4 sm:p-5", tot.qtdNaoClassificado > 0 ? "border-2 border-amber-300 dark:border-amber-700" : "border border-border/60")}>
                <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl transition-opacity bg-amber-500 opacity-80 group-hover:opacity-100" />
                <div className="flex flex-col gap-3 flex-1 pt-0.5">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50">
                      {tot.qtdNaoClassificado > 0 ? <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" /> : <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400 uppercase tracking-wide">Pendente</span>
                  </div>
                  <div className="space-y-1 mt-auto pt-2">
                    <p className="text-xl sm:text-[26px] font-black tracking-tight leading-none tabular-nums text-amber-600 dark:text-amber-400">
                      {valFormat(tot.naoClassificado)}
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate mt-2 border-t border-border/40 pt-2.5">
                      {tot.qtdNaoClassificado > 0 ? <><strong className="text-foreground">{tot.qtdNaoClassificado}</strong> p/ classificar</> : 'Tudo classificado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Qtd Documentos */}
              <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 shadow-[4px_4px_12px_hsl(var(--muted)/0.35),-2px_-2px_8px_hsl(var(--background))] transition-all duration-250 flex flex-col group hover:-translate-y-0.5 hover:shadow-[6px_6px_16px_hsl(var(--muted)/0.4),-3px_-3px_10px_hsl(var(--background))] p-4 sm:p-5">
                <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl transition-opacity bg-emerald-500 opacity-80 group-hover:opacity-100" />
                <div className="flex flex-col gap-3 flex-1 pt-0.5">
                  <div className="flex items-center justify-between w-full">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400 uppercase tracking-wide">Validado</span>
                  </div>
                  <div className="space-y-1 mt-auto pt-2">
                    <p className="text-xl sm:text-[26px] font-black tracking-tight leading-none tabular-nums text-foreground">
                      {quantidade}
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate mt-2 border-t border-border/40 pt-2.5">
                      Total: <strong className="text-emerald-600 dark:text-emerald-400">{valFormat(tot.total)}</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 bg-card border border-border/60 rounded-2xl shadow-[4px_4px_12px_hsl(var(--muted)/0.35),-2px_-2px_8px_hsl(var(--background))] p-2 sm:p-2.5">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome do pagador..." 
                  className="pl-9 h-9 border-border/50 bg-background/50 text-sm font-medium focus-visible:ring-primary/20 transition-all rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
                <SelectTrigger className="w-full md:w-[160px] h-9 border-border/50 bg-background/50 font-semibold rounded-xl text-xs">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="mes">Este Mês</SelectItem>
                  <SelectItem value="tudo">Todo o Histórico</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoriaFilter} onValueChange={(v) => setCategoriaFilter(v as ComprovanteCategoria | 'all')}>
                <SelectTrigger className="w-full md:w-[180px] h-9 border-border/50 bg-background/50 font-semibold rounded-xl text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  <SelectItem value="jeans">👖 Jeans</SelectItem>
                  <SelectItem value="alfaiataria">👔 Alfaiataria</SelectItem>
                  <SelectItem value="nao_classificado">❓ Não classificado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] h-9 border-border/50 bg-background/50 font-semibold rounded-xl text-xs">
                  <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground inline" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="confirmado">Confirmados</SelectItem>
                  <SelectItem value="pendente_revisao">Pendente Revisão</SelectItem>
                  <SelectItem value="rejeitado">Rejeitados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={grupoFilter} onValueChange={setGrupoFilter}>
                <SelectTrigger className="w-full md:w-[220px] h-9 border-border/50 bg-background/50 font-semibold rounded-xl text-xs">
                  <SelectValue placeholder="Grupo / Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Grupos</SelectItem>
                  {/* Mapeamento de nomes amigáveis para os grupos conhecidos */}
                  {Array.from(new Set(comprovantes.map(c => c.grupo_whatsapp))).filter(Boolean).map(id => {
                    let label = id;
                    if (id === 'LOG_DESCOBERTA') label = '🔍 Logs de Descoberta';
                    else if (id?.includes('120363402446093422')) label = '💰 Confirmação de Pagamento';
                    else if (id?.includes('g.us')) label = '🏟️ Feira - Delookii';
                    
                    return <SelectItem key={id} value={id!}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Content Table */}
            <div className="bg-card border border-border/60 rounded-2xl shadow-[4px_4px_12px_hsl(var(--muted)/0.35),-2px_-2px_8px_hsl(var(--background))] overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50 dark:bg-zinc-950/50">
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Pagador</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Recebimento via</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                        </TableRow>
                      ))
                    ) : comprovantes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-zinc-500">
                          Nenhum comprovante recebido ou encontrado nos filtros atuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      comprovantes.map((comp) => (
                        <TableRow 
                          key={comp.id} 
                          className={comp.status === 'pendente_revisao' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}
                        >
                          <TableCell className="font-medium">
                            {format(new Date(comp.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div>
                              <span>{comp.nome_pagador || 'Não identificado'}</span>
                              <div className="text-xs text-muted-foreground">{comp.banco_origem}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] font-medium py-0 h-5 px-1.5 whitespace-nowrap overflow-hidden max-w-[120px] truncate border-none bg-zinc-100 text-zinc-600">
                              {(() => {
                                const id = comp.grupo_whatsapp;
                                if (id === 'LOG_DESCOBERTA') return 'DESCOBERTA';
                                if (id?.includes('120363402446093422')) return '💰 PAGAMENTO';
                                if (id?.includes('g.us')) return '🏟️ FEIRA';
                                return id?.split('@')[0] || 'N/A';
                              })()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <CategoriaBadge categoria={comp.categoria} />
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {valFormat(comp.valor || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal bg-zinc-100 dark:bg-zinc-800">
                              {comp.tipo_pagamento || 'N/D'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {comp.status === 'confirmado' && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none">Validado</Badge>}
                            {comp.status === 'pendente_revisao' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none">Em Análise</Badge>}
                            {comp.status === 'rejeitado' && <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Rejeitado</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenModal(comp)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setDeleteId(comp.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </main>
        {isMobile && <BottomNavigation />}

        <ComprovanteModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          comprovante={selectedComprovante}
          onSave={handleSaveModal}
          isSaving={isUpdating}
        />

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir comprovante?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O comprovante será removido permanentemente do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  if (deleteId) {
                    deleteComprovante(deleteId);
                    setDeleteId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
