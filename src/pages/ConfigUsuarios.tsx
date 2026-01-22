import { useState, useEffect } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Plus, 
  MoreHorizontal, 
  UserPlus, 
  Shield, 
  Ban, 
  CheckCircle,
  Key,
  Loader2,
  Users,
  Copy,
  Search,
} from 'lucide-react';
import { AppRole, ROLE_DISPLAY_NAMES } from '@/types/roles';
import { useRole } from '@/contexts/RoleContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ConfigUsuarios() {
  const isMobile = useIsMobile();
  const { profile: currentUserProfile } = useRole();
  const { 
    users, 
    loading, 
    fetchUsers, 
    inviteUser, 
    updateUserRole, 
    toggleUserStatus, 
    resetUserPassword 
  } = useUsers();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedUser, setSelectedUser] = useState<typeof users[0] | null>(null);
  const [showTempPassword, setShowTempPassword] = useState<string | null>(null);

  // Loading states for individual user actions
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  // Form state for creating user
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserNome, setNewUserNome] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('vendedor');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.nome?.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.role && ROLE_DISPLAY_NAMES[user.role].toLowerCase().includes(query))
    );
  });

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserNome || !newUserRole) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSubmitting(true);
    const result = await inviteUser({
      email: newUserEmail,
      nome: newUserNome,
      role: newUserRole,
    });

    if (result.success && result.tempPassword) {
      setShowTempPassword(result.tempPassword);
      setNewUserEmail('');
      setNewUserNome('');
      setNewUserRole('vendedor');
      setIsCreating(false);
      toast.success('Usuário criado com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao criar usuário');
    }
    setSubmitting(false);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newUserRole) return;

    setSubmitting(true);
    const success = await updateUserRole(selectedUser.user_id, newUserRole);
    if (success) {
      setIsEditingRole(false);
      setSelectedUser(null);
    }
    setSubmitting(false);
  };

  const handleToggleStatus = async (user: typeof users[0]) => {
    if (togglingUserId) return; // Prevent multiple clicks
    
    setTogglingUserId(user.user_id);
    const newStatus = user.status === 'ativo' ? 'inativo' : 'ativo';
    await toggleUserStatus(user.user_id, newStatus);
    setTogglingUserId(null);
  };

  const handleResetPassword = async (user: typeof users[0]) => {
    if (resettingUserId) return; // Prevent multiple clicks
    
    setResettingUserId(user.user_id);
    const tempPassword = await resetUserPassword(user.user_id);
    if (tempPassword) {
      setShowTempPassword(tempPassword);
    }
    setResettingUserId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Senha copiada para área de transferência');
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'gerente':
        return 'secondary';
      case 'vendedor':
        return 'outline';
      case 'vendedor_loja':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === 'ativo' ? 'default' : 'destructive';
  };

  return (
    <div className="flex min-h-screen bg-background">
      {!isMobile && <AppSidebar />}
      
      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
        {isMobile && <MobileHeader title="Gestão de Usuários" />}
        
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6" />
                Gestão de Usuários
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Gerencie os usuários e suas permissões
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.status === 'ativo').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter(u => u.role === 'admin').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Inativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {users.filter(u => u.status === 'inativo').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Último Acesso</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchQuery ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.nome || '-'}
                              {user.user_id === currentUserProfile?.user_id && (
                                <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {user.role ? ROLE_DISPLAY_NAMES[user.role] : 'Sem role'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(user.status)}>
                                {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {user.last_sign_in_at 
                                ? format(new Date(user.last_sign_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                : 'Nunca'}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setNewUserRole(user.role || 'vendedor');
                                      setIsEditingRole(true);
                                    }}
                                    disabled={user.user_id === currentUserProfile?.user_id}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Alterar Role
                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() => handleToggleStatus(user)}
                                                    disabled={
                                                      user.user_id === currentUserProfile?.user_id ||
                                                      togglingUserId === user.user_id
                                                    }
                                                  >
                                                    {togglingUserId === user.user_id ? (
                                                      <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        {user.status === 'ativo' ? 'Desativando...' : 'Ativando...'}
                                                      </>
                                                    ) : user.status === 'ativo' ? (
                                                      <>
                                                        <Ban className="h-4 w-4 mr-2" />
                                                        Desativar
                                                      </>
                                                    ) : (
                                                      <>
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Ativar
                                                      </>
                                                    )}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() => handleResetPassword(user)}
                                                    disabled={
                                                      user.user_id === currentUserProfile?.user_id ||
                                                      resettingUserId === user.user_id
                                                    }
                                                  >
                                                    {resettingUserId === user.user_id ? (
                                                      <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Resetando...
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Key className="h-4 w-4 mr-2" />
                                                        Resetar Senha
                                                      </>
                                                    )}
                                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {isMobile && <BottomNavigation />}

      {/* Create User Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Crie um novo usuário para o sistema. Uma senha temporária será gerada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                placeholder="Nome completo"
                value={newUserNome}
                onChange={(e) => setNewUserNome(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={newUserRole} 
                onValueChange={(value) => setNewUserRole(value as AppRole)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="vendedor_loja">Vendedor Loja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditingRole} onOpenChange={setIsEditingRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Role</DialogTitle>
            <DialogDescription>
              Altere o role do usuário {selectedUser?.nome || selectedUser?.email}. 
              O usuário será deslogado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Novo Role</Label>
              <Select 
                value={newUserRole} 
                onValueChange={(value) => setNewUserRole(value as AppRole)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="vendedor_loja">Vendedor Loja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingRole(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateRole} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog open={!!showTempPassword} onOpenChange={() => setShowTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha Temporária</DialogTitle>
            <DialogDescription>
              Guarde esta senha e informe ao usuário. Ela será exigida no primeiro login.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <code className="flex-1 text-lg font-mono">{showTempPassword}</code>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(showTempPassword || '')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              O usuário deverá trocar a senha no primeiro acesso.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTempPassword(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
