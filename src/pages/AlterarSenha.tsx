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
import { Loader2, Lock, Eye, EyeOff, LogOut } from 'lucide-react';
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
  
  const { user, signOut } = useAuth();
  const { role, mustChangePassword, refreshProfile } = useRole();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      toast.error('Erro ao sair. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const landingPage = role ? ROLE_LANDING_PAGES[role] : '/';
    navigate(landingPage);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;
    if (!validateForm()) return;

    setLoading(true);

    try {
      // 1. Atualizar a senha no Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('Erro Auth Supabase:', updateError);
        if (updateError.message.includes('weak') || updateError.status === 422) {
          toast.error('Senha muito fraca!', {
            description: 'O sistema de segurança rejeitou esta senha por ser muito comum. Tente usar símbolos (@, #, $) e evite seu nome.',
            duration: 6000,
          });
        } else {
          toast.error(updateError.message || 'Erro ao atualizar senha');
        }
        setLoading(false);
        return;
      }

      // 2. Atualizar a flag no perfil usando a nova função RPC (mais segura e fura o trigger)
      if (user) {
        console.log('Limpando flag de mudança de senha via RPC...');
        const { error: rpcError } = await supabase.rpc('confirm_password_change');

        if (rpcError) {
          console.warn('Erro ao chamar RPC confirm_password_change, tentando update direto:', rpcError);
          // Fallback para update direto caso a migração ainda não tenha sido aplicada
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              must_change_password: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (profileError) {
            console.error('Erro no update direto do perfil:', profileError);
            throw new Error('Falha ao atualizar status do perfil');
          }
        }
      }

      // 3. Recarregar o perfil no contexto global
      console.log('Sincronizando perfil global...');
      await refreshProfile();

      // 4. Verificação de segurança: Aguardar até que o perfil reflita a mudança
      let finalRole = role;
      let perfilConfirmado = false;

      for (let i = 0; i < 5; i++) {
        const { data: checkData } = await supabase.rpc('get_my_profile');
        if (checkData && checkData[0]) {
          const p = checkData[0];
          if (p.must_change_password === false) {
            finalRole = p.role;
            perfilConfirmado = true;
            break;
          }
        }
        console.log(`Aguardando sincronização (tentativa ${i+1})...`);
        await new Promise(r => setTimeout(r, 800));
        await refreshProfile();
      }

      if (!perfilConfirmado) {
        toast.warning('A senha foi alterada, mas o sistema está demorando para responder. Tente recarregar a página se não for redirecionado.');
      }

      toast.success('Senha alterada com sucesso!');

      // 5. Redirecionar usando o cargo mais atualizado
      const landingPage = finalRole ? ROLE_LANDING_PAGES[finalRole] : '/';
      console.log('Navegando para:', landingPage);
      
      // Pequeno delay final para garantir que o toast seja lido
      setTimeout(() => {
        navigate(landingPage, { replace: true });
      }, 300);

    } catch (error: any) {
      console.error('Erro no processo de alteração:', error);
      toast.error('Erro ao processar alteração. Por favor, recarregue a página.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-20">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-none shadow-2xl shadow-primary/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <CardHeader className="text-center pb-8 pt-10">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 rotate-3">
            <Lock className="w-8 h-8 text-primary -rotate-3" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Alterar Senha
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400 mt-2 max-w-[280px] mx-auto text-base">
            {mustChangePassword 
              ? 'Para sua segurança, você precisa criar uma nova senha antes de continuar.'
              : 'Defina uma nova senha segura para sua conta.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword" id="label-new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pr-12 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-destructive font-medium">{errors.newPassword}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" id="label-confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pr-12 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive font-medium">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Lock className="mr-2 h-5 w-5" />}
                Alterar Senha
              </Button>

              {!mustChangePassword && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full h-12 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" 
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancelar e Voltar
                </Button>
              )}

              <Button 
                type="button" 
                variant="link" 
                className="w-full text-slate-400 hover:text-primary text-sm flex items-center justify-center gap-2" 
                onClick={handleLogout}
                disabled={loading}
              >
                <LogOut className="h-4 w-4" />
                Sair e voltar ao login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-sm text-slate-400 font-medium">
        © {new Date().getFullYear()} Delooki Jeans ERP
      </p>
    </div>
  );
}
