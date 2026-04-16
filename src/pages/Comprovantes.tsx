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
import { Search, Eye, Filter, RefreshCw, FileText, CheckCircle, AlertTriangle, XCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { format, startOfDay, startOfMonth, endOfMonth, endOfDay } from 'date-fns';
import { useComprovantes, Comprovante } from '@/hooks/useComprovantes';
import { ComprovanteModal } from '@/components/comprovantes/ComprovanteModal';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function Comprovantes() {
  const isMobile = useIsMobile();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodoFilter, setPeriodoFilter] = useState<string>('hoje');
  
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
    startDate: start,
    endDate: end,
  };

  const { data, isLoading, isUpdating, updateComprovante, refetch, isFetching, deleteComprovante, isDeleting } = useComprovantes(filtros);
  const comprovantes = data?.data || [];

  // Hook extra para pegar TODOS do mês (para os cards), se não houver filtros exatos.
  // Como simplificação, usaremos dados estáticos na view atual ou somamos só o que já tá na tela, 
  // mas idealmente os cards precisam de totais independentes dos filtros de busca. 
  // Aqui somaremos o conteúdo visível ou todos se não houver busca textual.
  const valFormat = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const totaisRecebidos = comprovantes.filter(c => c.status === 'confirmado').reduce((acc, curr) => acc + (curr.valor || 0), 0);
  const totaisAguardando = comprovantes.filter(c => c.status === 'pendente_revisao').reduce((acc, curr) => acc + (curr.valor || 0), 0);
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
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-inter transition-colors duration-300">
      <AppSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <MobileHeader title="Comprovantes" />
        
        <main className="flex-1 overflow-y-auto w-full p-4 md:p-6 pb-24 md:pb-6 no-scrollbar custom-scrollbar">
          <div className="w-full mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Comprovantes</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Leitura automática de recibos integrados via Z-API</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm col-span-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Validado</p>
                    <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{valFormat(totaisRecebidos)}</h3>
                  </div>
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">{periodoFilter.toUpperCase()}</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm col-span-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Aguardando Revisão</p>
                    <h3 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{valFormat(totaisAguardando)}</h3>
                  </div>
                  <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">Somente não atualizados no Dashboard</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm col-span-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Qtd. Documentos</p>
                    <h3 className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">{quantidade}</h3>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">Leituras via Inteligência Artificial</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-zinc-900 p-3 rounded-lg border shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input 
                  placeholder="Buscar por nome do pagador..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="mes">Este Mês</SelectItem>
                  <SelectItem value="tudo">Todo o Histórico</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2 text-zinc-400 inline" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="confirmado">Confirmados</SelectItem>
                  <SelectItem value="pendente_revisao">Pendente Revisão</SelectItem>
                  <SelectItem value="rejeitado">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content Table */}
            <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50 dark:bg-zinc-950/50">
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Pagador</TableHead>
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
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                        </TableRow>
                      ))
                    ) : comprovantes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-zinc-500">
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
