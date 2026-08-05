
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { ShieldCheck, User, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 my-auto">
        <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between border-b border-blue-800/80">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Prise en Charge (Bilan)</span>
          </div>
          <button type="button" onClick={onCancel} className="p-1 text-slate-300 hover:text-white rounded-lg transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="bg-white dark:bg-slate-700 p-2 rounded-full text-slate-500 dark:text-slate-300">
                  <User className="w-4 h-4" />
              </div>
              <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Intervenant identifié</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                      {profile ? `${profile.firstName} ${profile.lastName}` : 'Utilisateur Local'}
                  </span>
              </div>
          </div>

          <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Sélectionnez votre Équipe *</label>
              <select 
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                value={team}
                onChange={e => setTeam(e.target.value)}
              >
                  <option value="">-- Choisir une équipe --</option>
                  {teamsList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
          </div>
        </div>
        
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onCancel} className="rounded-lg text-xs py-1.5 px-3 border-slate-300 dark:border-slate-700">Annuler</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!team} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs py-1.5 px-4 shadow-md shadow-emerald-600/20">Commencer</Button>
        </div>
      </div>
    </div>
  );
};
