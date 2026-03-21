
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ResponderModalProps {
  isOpen: boolean;
  onConfirm: (data: { name: string; firstName: string; team: string }) => void;
  onCancel: () => void;
  teamsList?: string[];
}

export const ResponderModal: React.FC<ResponderModalProps> = ({ isOpen, onConfirm, onCancel, teamsList = [] }) => {
  const { profile, currentTeam } = useAuth();
  const [team, setTeam] = useState('');
  
  // Effet pour mettre à jour l'équipe locale quand le modal s'ouvre
  useEffect(() => {
      if (isOpen) {
          if (currentTeam) {
              setTeam(currentTeam);
          } else {
              setTeam('');
          }
      }
  }, [isOpen, currentTeam]);

  if (!isOpen) return null;

  const handleConfirm = () => {
      onConfirm({
          name: profile?.lastName || 'Anonyme',
          firstName: profile?.firstName || '',
          team: team
      });
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-6 text-blue-600 dark:text-blue-400">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full"><ShieldCheck className="w-6 h-6" /></div>
          <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Prise en charge</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Nouveau bilan victime</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700 mb-4 flex items-center gap-3">
            <div className="bg-white dark:bg-slate-800 p-2 rounded-full text-slate-400">
                <User className="w-5 h-5" />
            </div>
            <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Intervenant identifié</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                    {profile ? `${profile.firstName} ${profile.lastName}` : 'Utilisateur Local'}
                </span>
            </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Sélectionnez votre Équipe</label>
              <select 
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                value={team}
                onChange={e => setTeam(e.target.value)}
              >
                  <option value="">-- Choisir --</option>
                  {teamsList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} fullWidth>Annuler</Button>
          <Button variant="primary" onClick={handleConfirm} fullWidth disabled={!team}>Commencer</Button>
        </div>
      </div>
    </div>
  );
};
