import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Victim, Outcome } from '../types';

interface ReBilanTimerBadgeProps {
  victim: Victim;
  className?: string;
}

export const ReBilanTimerBadge: React.FC<ReBilanTimerBadgeProps> = ({ victim, className = '' }) => {
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);

  useEffect(() => {
    const calculateElapsed = () => {
      if (victim.outcome !== Outcome.TREATMENT_IN_PROGRESS) {
        setElapsedMinutes(0);
        return;
      }

      let referenceTimeMs = new Date(victim.arrivalTime || Date.now()).getTime();

      // Prise de la constante la plus récente
      if (victim.vitals && victim.vitals.length > 0) {
        const sorted = [...victim.vitals].sort((a, b) => (b.time || '').localeCompare(a.time || ''));
        const lastVital = sorted[0];
        if (lastVital && lastVital.time) {
          const parts = lastVital.time.split(/:|h/);
          if (parts.length >= 2) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(h) && !isNaN(m)) {
              const d = new Date();
              d.setHours(h, m, 0, 0);
              // Si l'heure calculée est dans le futur (ex: minuit passé), on recule d'un jour
              if (d.getTime() > Date.now()) {
                d.setDate(d.getDate() - 1);
              }
              referenceTimeMs = d.getTime();
            }
          }
        }
      }

      const diffMs = Date.now() - referenceTimeMs;
      const mins = Math.max(0, Math.floor(diffMs / 60000));
      setElapsedMinutes(mins);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 30000); // Mise à jour toutes les 30s
    return () => clearInterval(interval);
  }, [victim]);

  if (victim.outcome !== Outcome.TREATMENT_IN_PROGRESS) {
    return null;
  }

  // Couleurs du badge selon le délai de re-bilan
  let colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
  let label = `Bilan : ${elapsedMinutes}m`;
  let isAlert = false;

  if (elapsedMinutes >= 30) {
    colorStyle = 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700 animate-pulse font-bold shadow-sm';
    label = `Re-bilan : ${elapsedMinutes}m (Critique)`;
    isAlert = true;
  } else if (elapsedMinutes >= 15) {
    colorStyle = 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 font-semibold';
    label = `Re-bilan : ${elapsedMinutes}m`;
    isAlert = true;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${colorStyle} ${className}`}>
      {isAlert ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </span>
  );
};
