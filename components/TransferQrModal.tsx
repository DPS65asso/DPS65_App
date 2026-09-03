
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Victim } from '../types';
import { Share2, Smartphone } from 'lucide-react';
import { Modal } from './Modal';

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
      if (victim.birthDate) d.j = victim.birthDate;     // j = birthDate
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfert Rapide par QR Code"
      icon={<Share2 className="w-4 h-4 text-emerald-400 shrink-0" />}
      maxWidth="max-w-sm"
      footer={
        <button 
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs sm:text-sm font-bold transition-colors border border-slate-200 dark:border-slate-700 min-h-[40px] cursor-pointer"
        >
          Fermer
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden min-h-[250px]">
          {qrSrc ? (
              <img src={qrSrc} alt="QR Code" className="w-64 h-64 object-contain mix-blend-multiply" />
          ) : (
              <div className="animate-pulse text-slate-400 text-xs">Génération...</div>
          )}
          
          <div className="absolute bottom-0 inset-x-0 bg-slate-100/90 p-1 text-[10px] text-slate-800 text-center font-bold border-t border-slate-200">
              Format V3 - Haute Lisibilité
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Scannez avec la tablette de destination.</span>
        </div>
      </div>
    </Modal>
  );
};
