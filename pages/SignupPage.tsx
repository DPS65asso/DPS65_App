
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { UserPlus, Loader2, AlertCircle, Shield, Stethoscope, HeartPulse, User, Lock } from 'lucide-react';
import { UserRole } from '../types';
import { authService } from '../services/authService';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accessCode: '', // Nouveau champ
    role: 'secouriste' as UserRole
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }

    if (!formData.accessCode) {
        setError("Code d'accès obligatoire.");
        return;
    }

    setLoading(true);

    try {
      await authService.register(
          formData.email, 
          formData.password, 
          formData.firstName, 
          formData.lastName, 
          formData.role,
          formData.accessCode // Transmis au service
      );
      await checkAuth();
      navigate('/');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center mb-6">
          <Logo className="w-16 h-16 mb-2" />
          <h1 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Inscription DPS65</h1>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prénom</label>
              <input type="text" required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" value={formData.firstName} onChange={e => handleChange('firstName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
              <input type="text" required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" value={formData.lastName} onChange={e => handleChange('lastName', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
            <input type="email" required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" value={formData.email} onChange={e => handleChange('email', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code d'accès Annuel</label>
            <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    required 
                    placeholder="Fourni par l'asso..."
                    className="w-full pl-9 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono uppercase" 
                    value={formData.accessCode} 
                    onChange={e => handleChange('accessCode', e.target.value.toUpperCase())} 
                />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Votre Rôle / Qualification</label>
            <div className="grid grid-cols-4 gap-2">
                <button 
                    type="button" 
                    onClick={() => handleChange('role', 'secouriste')}
                    className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${formData.role === 'secouriste' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <Shield className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase">Secouriste</span>
                </button>
                <button 
                    type="button" 
                    onClick={() => handleChange('role', 'infirmier')}
                    className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${formData.role === 'infirmier' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <Stethoscope className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase">Infirmier</span>
                </button>
                <button 
                    type="button" 
                    onClick={() => handleChange('role', 'medecin')}
                    className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${formData.role === 'medecin' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <HeartPulse className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase">Médecin</span>
                </button>
                <button 
                    type="button" 
                    onClick={() => handleChange('role', 'snu')}
                    className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${formData.role === 'snu' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <User className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase">SNU</span>
                </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic text-center">
                * Le rôle "Administrateur" est réservé à l'adresse officielle de l'asso.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe</label>
              <input type="password" required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" value={formData.password} onChange={e => handleChange('password', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmation</label>
              <input type="password" required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" value={formData.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)} />
            </div>
          </div>

          <Button type="submit" fullWidth disabled={loading} className="mt-6 py-3 text-lg" icon={loading ? <Loader2 className="animate-spin" /> : <UserPlus />}>
            {loading ? 'Création...' : "S'inscrire"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
};
