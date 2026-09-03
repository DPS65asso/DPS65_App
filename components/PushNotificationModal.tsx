import React, { useState, useEffect } from 'react';
import { Send, X, Bell, Siren, ShieldAlert, Check, Radio, Stethoscope, Info, Sparkles, MessageSquare } from 'lucide-react';
import { storageService } from '../services/storageService';
import { syncService } from '../services/syncService';
import { useAuth } from '../context/AuthContext';
import { generateUUID } from '../utils/security';
import { AppConfig } from '../types';
import { sendNativeNotification, requestNotificationPermission } from '../services/notificationService';
import { Modal } from './Modal';

interface PushNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: 'INFO' | 'ALERTE' | 'ALERTE_GEN';
  defaultTitle?: string;
  defaultMessage?: string;
}

const PRESETS = [
  { label: '📢 Message du PC', category: 'INFO', title: '📢 Message du PC' },
  { label: '🚨 Alerte Météo / Secteur', category: 'ALERTE', title: '🚨 Alerte Météo & Secteur' },
  { label: '📻 Changement canal Radio', category: 'INFO', title: '📻 Changement Canal Radio' },
  { label: '🩺 Rappel Re-bilan Constantes', category: 'ALERTE', title: '🩺 Rappel Constantes Vitales' },
  { label: '📍 Consigne Déplacement', category: 'INFO', title: '📍 Consigne de Déplacement' },
  { label: '🆘 SOS Urgence Vitale', category: 'ALERTE_GEN', title: '🚨 URGENCE VITALE - RENFORTS' }
];

export const PushNotificationModal: React.FC<PushNotificationModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'INFO',
  defaultTitle = '',
  defaultMessage = ''
}) => {
  const { profile, currentTeam } = useAuth();
  const [title, setTitle] = useState(defaultTitle || '📢 Message du PC');
  const [message, setMessage] = useState(defaultMessage);
  const [category, setCategory] = useState<'INFO' | 'ALERTE' | 'ALERTE_GEN'>(defaultCategory);
  const [targetTeam, setTargetTeam] = useState<string>('ALL');
  const [teamsList, setTeamsList] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      storageService.getConfig().then((cfg: AppConfig | null) => {
        if (cfg?.teams) {
          setTeamsList(cfg.teams);
        }
      });
      // Vérifier permission notification navigateur
      requestNotificationPermission();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setTitle(preset.title);
    setCategory(preset.category as any);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    setSuccessMessage(null);

    try {
      const authorName = profile ? `${profile.firstName} ${profile.lastName}` : (currentTeam || 'PC DPS 65');
      const targetPrefix = targetTeam !== 'ALL' ? `[Équipe ${targetTeam}] ` : '';
      const fullMessage = `${targetPrefix}${title ? `${title} : ` : ''}${message.trim()}`;

      const entryId = generateUUID();
      const logEntry = {
        id: entryId,
        eventId: null,
        timestamp: Date.now(),
        message: fullMessage,
        category: category as any,
        author: authorName,
        title: title || 'Notification Push',
        targetTeam: targetTeam !== 'ALL' ? targetTeam : undefined
      };

      // 1. Sauvegarde locale dans le journal de bord
      await storageService.addLogbookEntry(logEntry);

      // 2. Diffusion BroadcastChannel instantanée pour les onglets connectés
      const commsBc = new BroadcastChannel('dps65_comms_channel');
      commsBc.postMessage({
        type: category === 'ALERTE_GEN' ? 'NEW_LOG' : 'PUSH_NOTIF',
        entry: logEntry
      });
      commsBc.close();

      // 3. Forcer le traitement du queue de synchro Supabase pour diffusion distante
      syncService.processQueue();

      // 4. Déclencher aussi une notification native sur le terminal local pour confirmation
      try {
        await sendNativeNotification(title || 'DPS65 Notification Push', {
          body: fullMessage,
          tag: `push-${entryId}`,
          requireInteraction: category === 'ALERTE_GEN',
          vibrate: category === 'ALERTE_GEN' ? [500, 100, 500, 100, 500] : [200, 100, 200]
        });
      } catch (err) {
        console.error("Erreur notification native:", err);
      }

      setSuccessMessage("Notification Push envoyée à toutes les équipes connectées !");
      setTimeout(() => {
        setMessage('');
        setSuccessMessage(null);
        setIsSending(false);
        onClose();
      }, 1200);

    } catch (err) {
      console.error("Erreur lors de l'envoi de la notification push:", err);
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Diffusion Notification Push (Temps Réel)"
      icon={<Bell className="w-4 h-4 text-emerald-400 shrink-0" />}
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px] cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="push-notification-form"
            disabled={isSending || !message.trim()}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition-all active:scale-95 flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'Diffusion...' : 'Envoyer Notif Push'}</span>
          </button>
        </>
      }
    >
      <form id="push-notification-form" onSubmit={handleSend} className="space-y-4">
          
          {/* PRESETS DE NOTIFICATION */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Modèles rapides
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-95"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* TITRE & NIVEAU D'URGENCE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                Titre de la notif
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Message du PC..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                Niveau de priorité
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white font-bold"
              >
                <option value="INFO">ℹ️ Info Standard</option>
                <option value="ALERTE">⚠️ Prioritaire / Alerte</option>
                <option value="ALERTE_GEN">🚨 URGENCE VITALE (Sirène)</option>
              </select>
            </div>
          </div>

          {/* DESTINATAIRE */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
              Destinataire
            </label>
            <select
              value={targetTeam}
              onChange={(e) => setTargetTeam(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white font-medium"
            >
              <option value="ALL">🌐 Toutes les équipes / Tous les utilisateurs</option>
              {teamsList.map(t => (
                <option key={t} value={t}>Équipe : {t}</option>
              ))}
            </select>
          </div>

          {/* MESSAGE */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
              Contenu de la notification
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Rédigez le message à diffuser..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium resize-none"
              required
            ></textarea>
          </div>

          {/* LIVE APERÇU APPAREIL */}
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Aperçu en direct sur smartphone
            </span>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${
                category === 'ALERTE_GEN' ? 'bg-red-500 text-white' :
                category === 'ALERTE' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
              }`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-800 dark:text-white truncate">
                    {title || 'DPS 65'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Maintenant</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                  {targetTeam !== 'ALL' ? `[Équipe ${targetTeam}] ` : ''}
                  {message || 'Le contenu de la notification apparaîtra ici...'}
                </p>
              </div>
            </div>
          </div>

          {/* SUCCESS BANNER */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

      </form>
    </Modal>
  );
};
