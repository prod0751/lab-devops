import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardDescription, CardTitle } from '../components/ui/card';
import { useAuth } from '../providers/auth-provider';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      if (isAxiosError<{ message?: string }>(err)) {
        setError(err.response?.data?.message || err.message);
        return;
      }
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      setError('Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <Card className="md:col-span-1">
          <CardTitle>DSK Stock</CardTitle>
          <CardDescription>
            Gestion de stock full-stack (NestJS + React) prête pour Kubernetes, ArgoCD et Harbor.
          </CardDescription>
          <div className="mt-6 space-y-2 text-sm text-slate-400">
            <p>Auth locale, JWT, UI moderne Tailwind/shadcn.</p>
            <p>Dashboards, alertes low stock, historique des mouvements.</p>
          </div>
        </Card>
        <Card className="md:col-span-1">
          <CardTitle>{mode === 'login' ? 'Connexion' : 'Inscription'}</CardTitle>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm text-slate-300">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@dsk.lab"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Mot de passe</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex items-center justify-between">
              <Button type="submit" disabled={loading}>
                {loading ? '...' : mode === 'login' ? 'Se connecter' : "Créer le compte"}
              </Button>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? "Pas encore de compte ?" : 'Déjà inscrit ?'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
