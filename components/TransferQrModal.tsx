
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Victim } from '../types';
import { X, Share2, Smartphone } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  victim: Partial<Victim>;
}

export const TransferQrModal: React.FC<Props> = ({ isOpen, onClose, victim }) => {
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    if (isOpen && victim) {
      // --- FORMAT V3 : MINIFIÉ (ULTRA-LÉGER) ---
      // L'objectif est de réduire le nombre de caractères pour agrandir les pixels du QR Code.
      
      // 1. Nettoyage et tri des constantes (Max 3 dernières)
      const cleanVitals = (victim.vitals || [])
        .sort((a,b) => b.time.localeCompare(a.time))
        .slice(0, 3)
        .map(v => ({
            t: v.time,        // t = time
            p: v.pulse,       // p = pulse
            b: v.bp,          // b = blood pressure
            s: v.sao2,        // s = spo2
            g: v.glycemia,    // g = glycemia
            c: v.temp,        // c = celsius/temp
            e: v.eva          // e = eva
        }));

      // 2. Création de l'objet minifié (Mapping des clés)
      // On n'inclut les champs que s'ils ont une valeur (pour gagner de la place)
      const d: any = {};
      if (victim.fullName) d.a = victim.fullName;       // a = identity
      if (victim.bibNumber) d.b = victim.bibNumber;     // b = bib
      if (victim.triageColor) d.c = victim.triageColor; // c = color
      if (victim.reason) d.d = victim.reason;           // d = description/reason
      if (victim.careProvided) d.e = victim.careProvided; // e = execution/care
      if (victim.outcome) d.f = victim.outcome;         // f = finish/outcome
      if (victim.arrivalTime) d.g = victim.arrivalTime; // g = global arrival
      if (victim.phoneNumber) d.h = victim.phoneNumber; // h = handset
      if (victim.emergencyContact) d.i = victim.emergencyContact; // i = ice
      
      // Mode Avancé
      if (victim.isAdvancedMode) {
          d.x = 1; // x = eXpert mode
          if (victim.medications) d.m = victim.medications;
          if (victim.hasKt) d.k = 1;
      }

      if (cleanVitals.length > 0) d.v = cleanVitals;

      // 3. Payload Final : { v:3, d: {...} }
      // "v" pour version, "d" pour data. Extrêmement court.
      const payload = { v: 3, d: d };
      const dataToEncode = JSON.stringify(payload);

      QRCode.toDataURL(dataToEncode, { 
        width: 450, 
        margin: 1,
        // 'L' (Low) permet de récupérer 7% d'erreurs mais rend le QR code moins dense (plus gros points)
        // C'est idéal pour la lisibilité sur mauvais écrans/caméras si le contraste est bon.
        errorCorrectionLevel: 'L', 
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
      }, (err: any, url: string) => {
        if (!err) setQrSrc(url);
      });
    }
  }, [isOpen, victim]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 relative flex flex-col">
        <button 
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors z-10"
        >
            <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-3">
                <Share2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Transfert Rapide (V3)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Format optimisé pour lecture instantanée sur tous appareils.
            </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center bg-white p-4 rounded-xl border-2 border-slate-100 dark:border-slate-600 relative overflow-hidden min-h-[280px]">
            {qrSrc ? (
                <img src={qrSrc} alt="QR Code" className="w-full h-full object-contain mix-blend-multiply" />
            ) : (
                <div className="animate-pulse text-slate-400 text-xs">Génération...</div>
            )}
            
            <div className="absolute bottom-0 inset-x-0 bg-slate-100/90 p-1 text-[10px] text-slate-800 text-center font-bold border-t border-slate-200">
                Haute Lisibilité
            </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
            <Smartphone className="w-4 h-4" />
            <span>Utilisez le <strong>Scanner</strong> d'une autre tablette.</span>
        </div>
      </div>
    </div>
  );
};
