
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';

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
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Prise en Charge (Bilan)"
      icon={<ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
      maxWidth="max-w-sm"
      footer={
        <>
          <Button 
            variant="outline" 
            onClick={onCancel} 
            className="rounded-xl text-xs py-2 px-3.5 border-slate-300 dark:border-slate-700 min-h-[40px]"
          >
            Annuler
          </Button>
          <Button 
            variant="primary" 
            onClick={handleConfirm} 
            disabled={!team} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs py-2 px-4 shadow-md shadow-emerald-600/20 min-h-[40px]"
          >
            Commencer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
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
    </Modal>
  );
};

