import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { ROLE_LANDING_PAGES } from '@/types/roles';

const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Deve conter pelo menos um número'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function AlterarSenha() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  
  const { user } = useAuth();
  const { role, mustChangePassword, refreshProfile } = useRole();
  const navigate = useNavigate();

  // If user doesn't need to change password and is not on this page intentionally,
  // redirect to their landing page
  useEffect(() => {
    if (!mustChangePassword && role) {
      // User came here voluntarily, that's fine
    }
  }, [mustChangePassword, role, navigate]);

  const validateForm = () => {
    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const fieldErrors: { newPassword?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'newPassword') fieldErrors.newPassword = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const translateAuthError = (raw: string): string => {
    const msg = raw.toLowerCase();
    if (msg.includes('different from the old password') || msg.includes('same_password')) {
      return 'A nova senha precisa ser diferente da senha temporária que você recebeu.';
    }
    if (msg.includes('weak') || msg.includes('password should be')) {
      return 'Senha muito fraca. Use letras maiúsculas, minúsculas e números.';
    }
    if (msg.includes('session') || msg.includes('jwt')) {
      return 'Sua sessão expirou. Faça login novamente.';
    }
    return raw || 'Erro ao atualizar senha';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;
    if (!validateForm()) return;

    setLoading(true);

    try {
      // 1. Update auth password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error(translateAuthError(updateError.message));
        setLoading(false);
        return;
      }

      // 2. Clear must_change_password via security-definer RPC
      // (direct UPDATE is blocked by fn_protect_must_change_password trigger
      // for non-admin users — the RPC bypasses it safely)
      const { error: rpcError } = await supabase.rpc('mark_password_changed');

      if (rpcError) {
        console.error('Failed to mark password changed:', rpcError);
        toast.error('Senha alterada, mas houve um erro ao atualizar seu perfil. Faça login novamente.');
        setLoading(false);
        return;
      }

      toast.success('Senha alterada com sucesso!');

      // 3. Wait for profile to refresh BEFORE navigating, otherwise
      // ProtectedRoute will see the stale mustChangePassword=true and bounce back
      await refreshProfile();

      const landingPage = role ? ROLE_LANDING_PAGES[role] : '/';
      navigate(landingPage, { replace: true });

    } catch (err) {
      console.error('Unexpected error changing password:', err);
      toast.error('Erro ao alterar senha. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Alterar Senha</CardTitle>
          <CardDescription>
            {mustChangePassword 
              ? 'Para sua segurança, você precisa criar uma nova senha antes de continuar.'
              : 'Crie uma nova senha para sua conta.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mustChangePassword && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              ⚠️ Use uma senha <strong>diferente</strong> da que você recebeu por mensagem. Mínimo 8 caracteres com maiúscula, minúscula e número.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
