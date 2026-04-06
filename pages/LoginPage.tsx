
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { LogIn, Loader2, AlertCircle, Play } from 'lucide-react';
import { authService } from '../services/authService';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  
  const [loginType, setLoginType] = useState<'MEMBER' | 'ORGANIZER'>('MEMBER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizerCode, setOrganizerCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (loginType === 'MEMBER') {
        await authService.login(email, password);
      } else {
        await authService.loginAsOrganizer(organizerCode);
      }
      await checkAuth(); 
      
      // Déclenchement d'une synchro complète après connexion
      const { syncService } = await import('../services/syncService');
      syncService.retrySync();
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-20 h-20 mb-4" />
          <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Connexion DPS65</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Portail Opérationnel & Associatif</p>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
          <button 
            onClick={() => setLoginType('MEMBER')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginType === 'MEMBER' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
          >
            Membre
          </button>
          <button 
            onClick={() => setLoginType('ORGANIZER')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginType === 'ORGANIZER' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
          >
            Organisateur
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {loginType === 'MEMBER' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe</label>
                <input 
                  type="password" 
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code Organisateur</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all text-center text-xl font-black tracking-widest uppercase"
                placeholder="EX: ORGA-123"
                value={organizerCode}
                onChange={e => setOrganizerCode(e.target.value)}
              />
              <p className="mt-2 text-[10px] text-slate-400 text-center italic">
                Ce code vous est fourni par l'administrateur de l'événement.
              </p>
            </div>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-4 py-3 text-lg" icon={loading ? <Loader2 className="animate-spin" /> : <LogIn />}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  );
};
