import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Shield, 
  Ban, 
  CheckCircle,
  Key,
  Loader2,
  Trash2,
  MapPin,
  User,
} from 'lucide-react';
import { AppRole, ROLE_DISPLAY_NAMES } from '@/types/roles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserData {
  id: string;
  user_id: string;
  nome: string | null;
  email: string;
  status: 'ativo' | 'inativo';
  role: AppRole | null;
  last_sign_in_at: string | null;
}

interface MobileUserCardProps {
  user: UserData;
  isCurrentUser: boolean;
  isTogglingStatus: boolean;
  isResettingPassword: boolean;
  onEditRole: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
  onConfigureLocations?: () => void;
}

export function MobileUserCard({
  user,
  isCurrentUser,
  isTogglingStatus,
  isResettingPassword,
  onEditRole,
  onToggleStatus,
  onResetPassword,
  onDelete,
  onConfigureLocations,
}: MobileUserCardProps) {
  const getRoleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'gerente':
        return 'secondary';
      case 'vendedor':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card className={`${user.status === 'inativo' ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* User Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {user.nome || 'Sem nome'}
                </span>
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">Você</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {user.email}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                  {user.role ? ROLE_DISPLAY_NAMES[user.role] : 'Sem role'}
                </Badge>
                <Badge 
                  variant={user.status === 'ativo' ? 'default' : 'destructive'} 
                  className="text-xs"
                >
                  {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {user.last_sign_in_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Último acesso: {format(new Date(user.last_sign_in_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0 h-10 w-10">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={onEditRole}
                disabled={isCurrentUser}
              >
                <Shield className="h-4 w-4 mr-2" />
                Alterar Role
              </DropdownMenuItem>
              
              {user.role === 'vendedor' && onConfigureLocations && (
                <DropdownMenuItem onClick={onConfigureLocations}>
                  <MapPin className="h-4 w-4 mr-2" />
                  Configurar Locais
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem
                onClick={onToggleStatus}
                disabled={isCurrentUser || isTogglingStatus}
              >
                {isTogglingStatus ? (
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
                onClick={onResetPassword}
                disabled={isCurrentUser || isResettingPassword}
              >
                {isResettingPassword ? (
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
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={onDelete}
                disabled={isCurrentUser}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
