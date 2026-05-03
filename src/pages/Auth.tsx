import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres')
});
export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const {
    signIn,
    user,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', {
        replace: true
      });
    }
  }, [user, authLoading, navigate]);
  if (authLoading || user) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  const validateForm = () => {
    const result = authSchema.safeParse({
      email,
      password
    });
    if (!result.success) {
      const fieldErrors: {
        email?: string;
        password?: string;
      } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
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
      const {
        error
      } = await signIn(email, password);
      if (error) {
        const message = error.message.includes('Invalid login credentials') ? 'Email ou senha incorretos' : error.message.includes('Email not confirmed') ? 'Confirme seu email antes de fazer login' : error.message;
        setLoading(false);
        setTimeout(() => toast.error(message), 0);
        return;
      }
      // Login success - auth state will redirect
    } catch {
      setLoading(false);
      setTimeout(() => toast.error('Ocorreu um erro. Tente novamente.'), 0);
    }
  };
  return <div className="min-h-screen bg-background p-4 relative overflow-hidden flex items-center justify-center text-card-foreground border-solid">
      {/* Elementos decorativos de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>
      
      {/* Card de Login */}
      <div className="w-full max-w-md neu-card p-8 relative animate-in fade-in slide-in-from-bottom-4 duration-500 border-primary-foreground">
        <div className="text-center mb-8">
          {/* Logo real da marca */}
          <div className="mx-auto w-20 h-20 mb-4">
            <img src="/favicon.png" alt="Delookii" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            DELOOKII JEANS  
          </h1>
          <p className="text-muted-foreground mt-2">
            Entre com suas credenciais para acessar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} maxLength={255} className="h-12 text-base" />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Senha
            </Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} maxLength={72} className="h-12 text-base" />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Delookii ERP - Sistema de Gestão
        </p>
      </div>
    </div>;
}