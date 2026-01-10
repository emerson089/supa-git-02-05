import { useState } from 'react';
import { Search, Phone, MapPin, Tag, User, Plus, Pencil, FileSpreadsheet, Download, Trash2, AlertTriangle } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useClientesContext, Cliente } from '@/contexts/ClientesContext';
import { ImportCSVModal } from '@/components/clientes/ImportCSVModal';
import { ClearDataModal } from '@/components/clientes/ClearDataModal';
import { ClienteSchema } from '@/lib/validations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const emptyCliente = {
  nome: '',
  telefone: '',
  cidade: '',
  estado: '',
  excursao: '',
};

export default function Clientes() {
  const { clientes, isLoading, addCliente, updateCliente, removeCliente } = useClientesContext();
  const [busca, setBusca] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState(emptyCliente);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);

  const clientesFiltrados = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
    cliente.telefone.includes(busca) ||
    cliente.cidade.toLowerCase().includes(busca.toLowerCase()) ||
    cliente.excursao.toLowerCase().includes(busca.toLowerCase())
  );

  const handleOpenNew = () => {
    setEditingCliente(null);
    setFormData(emptyCliente);
    setModalOpen(true);
  };

  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
      cidade: cliente.cidade,
      estado: cliente.estado,
      excursao: cliente.excursao,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    // Validate with Zod schema
    const result = ClienteSchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.errors[0]?.message || 'Dados inválidos';
      toast.error(firstError);
      return;
    }

    try {
      const validData = {
        nome: result.data.nome,
        telefone: result.data.telefone,
        cidade: result.data.cidade,
        estado: result.data.estado,
        excursao: result.data.excursao,
      };
      if (editingCliente) {
        await updateCliente(editingCliente.id, validData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await addCliente(validData);
        toast.success('Cliente cadastrado com sucesso!');
      }

      setModalOpen(false);
      setFormData(emptyCliente);
      setEditingCliente(null);
    } catch (error) {
      toast.error('Erro ao salvar cliente');
    }
  };

  const handleDeleteClick = (cliente: Cliente) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (clienteToDelete) {
      try {
        await removeCliente(clienteToDelete.id);
        toast.success('Cliente removido com sucesso!');
        setDeleteDialogOpen(false);
        setClienteToDelete(null);
      } catch (error) {
        toast.error('Erro ao remover cliente');
      }
    }
  };

  const handleExportCSV = () => {
    if (clientes.length === 0) {
      toast.error('Não há clientes para exportar.');
      return;
    }

    const headers = ['Nome', 'Telefone', 'Cidade', 'Estado', 'Excursão'];
    const csvRows = [
      headers.join(','),
      ...clientes.map(c => 
        [c.nome, c.telefone, c.cidade, c.estado, c.excursao]
          .map(field => `"${(field || '').replace(/"/g, '""')}"`)
          .join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Lista de clientes exportada com sucesso!');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">Gerencie sua base de clientes</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button 
              onClick={() => setClearDataModalOpen(true)}
              variant="outline"
              className="h-11 px-5 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <AlertTriangle size={18} className="mr-2" />
              Limpar Dados
            </Button>
            <Button 
              onClick={handleExportCSV}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white transition-colors shadow-lg"
            >
              <Download size={18} className="mr-2" />
              Exportar Clientes
            </Button>
            <Button 
              onClick={() => setImportModalOpen(true)}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white transition-colors shadow-lg"
            >
              <FileSpreadsheet size={18} className="mr-2" />
              Importar Planilha
            </Button>
            <Button 
              onClick={handleOpenNew}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white transition-colors shadow-lg"
            >
              <Plus size={18} className="mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="neu-card p-4 mb-8 rounded-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Buscar por nome, telefone, cidade ou excursão..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-12 pl-12 rounded-xl neu-input border-0 bg-background text-base"
            />
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {clientesFiltrados.map((cliente) => (
            <div
              key={cliente.id}
              className="neu-card p-5 rounded-2xl hover:shadow-neu transition-all duration-200 group relative"
            >
              {/* Action Buttons */}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenEdit(cliente)}
                  className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors"
                >
                  <Pencil size={14} className="text-muted-foreground hover:text-primary" />
                </button>
                <button
                  onClick={() => handleDeleteClick(cliente)}
                  className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                </button>
              </div>

              {/* Header do Card */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <User size={24} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className="font-semibold text-foreground text-lg truncate group-hover:text-primary transition-colors">
                    {cliente.nome}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cadastrado em {cliente.dataCadastro}
                  </p>
                </div>
              </div>

              {/* Info do Card */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Phone size={14} className="text-muted-foreground" />
                  </div>
                  <span className="text-foreground">{cliente.telefone}</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <MapPin size={14} className="text-muted-foreground" />
                  </div>
                  <span className="text-foreground">
                    {cliente.cidade}, {cliente.estado}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Tag size={14} className="text-muted-foreground" />
                  </div>
                  <span className="text-foreground">
                    Excursão: <span className="font-medium text-primary">{cliente.excursao}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {clientesFiltrados.length === 0 && (
          <div className="neu-card p-12 rounded-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum cliente encontrado
            </h3>
            <p className="text-muted-foreground">
              Tente ajustar os termos da busca ou adicione um novo cliente.
            </p>
          </div>
        )}
      </main>

      {/* Modal de Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                placeholder="Nome do cliente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excursao">Excursão</Label>
              <Input
                id="excursao"
                value={formData.excursao}
                onChange={(e) => setFormData(prev => ({ ...prev, excursao: e.target.value }))}
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                placeholder="Nome da excursão"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="flex-1 h-11 rounded-xl border-0 text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
              >
                {editingCliente ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Importação CSV */}
      <ImportCSVModal open={importModalOpen} onOpenChange={setImportModalOpen} />

      {/* Modal de Limpar Dados */}
      <ClearDataModal open={clearDataModalOpen} onOpenChange={setClearDataModalOpen} />

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir o cliente <span className="font-semibold text-foreground">{clienteToDelete?.nome}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-xl border-0 text-muted-foreground hover:text-foreground">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
