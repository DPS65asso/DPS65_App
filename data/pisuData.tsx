
import React from 'react';
import { HeartPulse, Flame, Activity, Zap, Wind, AlertTriangle, Pill, Syringe, Brain, Baby, Droplet, Moon } from 'lucide-react';

export interface Protocol {
    id: string;
    code: string;
    title: string;
    icon: React.ElementType;
    color: string;
    indication: string;
    contraIndication?: string;
    steps: string[];
    // Logique de calcul dynamique
    calculator?: (weight: number) => { label: string; value: string; detail?: string; alert?: boolean }[];
    alert?: string;
}

export const PISU_PROTOCOLS: Protocol[] = [
    {
        id: 'pisu_1a',
        code: 'P.I.S.U 1A',
        title: 'ACR Adulte',
        icon: HeartPulse,
        color: 'text-red-600',
        indication: 'Adulte/Enfant > 15 ans inconscient + Arrêt ventilatoire + Pas de pouls.',
        steps: [
            'RCP 30:2 en continue.',
            'Pose VVP NaCl 0.9% / IO.',
            'Préparer Adrénaline 1mg/ml (Pure).',
            'C.E.E. toutes les 2 min si conseillé.',
            'Adrénaline 1 mg IVD toutes les 4 min (cycles impairs).'
        ],
        calculator: () => [
            { label: 'Adrénaline (IVD)', value: '1 mg', detail: 'Toutes les 4 min' },
            { label: 'Amiodarone (Si FV/TV)', value: '300 mg', detail: 'Après 3ème choc' },
            { label: 'Amiodarone (Dose 2)', value: '150 mg', detail: 'Après 5ème choc' }
        ]
    },
    {
        id: 'pisu_1e',
        code: 'P.I.S.U 1E',
        title: 'ACR Enfant',
        icon: Baby,
        color: 'text-pink-500',
        indication: 'Enfant < 15 ans inconscient + Arrêt respi + Pas de pouls.',
        steps: [
            '5 Insufflations initiales puis RCP 15:2.',
            'Pose VVP / IO.',
            'Adrénaline diluée à 0.1 mg/ml (1mg + 9ml NaCl).',
            'Choc : 4 J/kg.'
        ],
        calculator: (w) => {
            const adreMg = w * 0.01;
            const adreMl = adreMg / 0.1; // Concentration 0.1mg/ml
            return [
                { label: 'Adrénaline (0.01 mg/kg)', value: `${adreMg.toFixed(2)} mg`, detail: `soit ${adreMl.toFixed(1)} ml (dilution 1/10)` },
                { label: 'Choc (4 J/kg)', value: `${(w * 4).toFixed(0)} J`, detail: 'Défibrillation' }
            ];
        }
    },
    {
        id: 'pisu_2a',
        code: 'P.I.S.U 2A',
        title: 'Brûlures Graves Adulte',
        icon: Flame,
        color: 'text-orange-600',
        indication: 'Brûlure thermique 2nd/3ème degré > 20% SCB.',
        contraIndication: 'Brûlure électrique, chimique.',
        steps: [
            'Refroidir (si < 20% et récente).',
            'O2 MHC 15L/min si SpO2 < 95%.',
            '2 VVP gros calibre.',
            'Remplissage Ringer Lactate.',
            'Antalgie (voir PISU 5A).',
            'Emballage stérile + Lutte hypothermie.'
        ],
        calculator: (w) => [
            { label: 'Ringer Lactate (1h)', value: `${(w * 20).toFixed(0)} ml`, detail: '20 ml/kg sur la 1ère heure' }
        ]
    },
    {
        id: 'pisu_2e',
        code: 'P.I.S.U 2E',
        title: 'Brûlures Graves Enfant',
        icon: Flame,
        color: 'text-orange-500',
        indication: 'SCB > 5% (< 1 an) ou > 10% (> 1 an).',
        steps: [
            'Refroidir (si < 10% et récente).',
            '2 VVP.',
            'Remplissage Ringer Lactate.',
            'Antalgie adaptée (PISU 5E).'
        ],
        calculator: (w) => [
            { label: 'Ringer Lactate (1h)', value: `${(w * 20).toFixed(0)} ml`, detail: '20 ml/kg sur la 1ère heure' }
        ]
    },
    {
        id: 'pisu_3',
        code: 'P.I.S.U 3',
        title: 'Choc Anaphylactique',
        icon: AlertTriangle,
        color: 'text-yellow-600',
        indication: 'Hypotension, OEdème, Urticaire, Dyspnée.',
        steps: [
            'Allonger (surélever jambes) ou Assis si dyspnée.',
            'O2 MHC 9L/min.',
            'VVP NaCl 0.9% 250ml (Garde veine).',
            'Adrénaline IV titrée par bolus de 0.1 mg.'
        ],
        calculator: () => [
            { label: 'Adrénaline (IVD)', value: '0.1 mg', detail: 'Titrée (Sur ordre médical)', alert: true },
            { label: 'Remplissage', value: '500 ml', detail: 'NaCl 0.9% si hypoTA persistante' }
        ],
        alert: "Attention : Adrénaline IV uniquement sur signes de choc décompensé."
    },
    {
        id: 'pisu_4a',
        code: 'P.I.S.U 4A',
        title: 'Convulsions Adulte',
        icon: Brain,
        color: 'text-purple-600',
        indication: 'Crises persistantes ou répétées sans reprise conscience.',
        steps: [
            'LVA + PLS + O2.',
            'HGT (Si < 0.60 -> PISU 9).',
            'VVP.',
            'Clonazépam (Rivotril) IVD.'
        ],
        calculator: (w) => [
            { label: 'Clonazépam (Rivotril)', value: `${(w * 0.015).toFixed(2)} mg`, detail: '0.015 mg/kg IVD lente' }
        ]
    },
    {
        id: 'pisu_4e',
        code: 'P.I.S.U 4E',
        title: 'Convulsions Enfant',
        icon: Brain,
        color: 'text-purple-500',
        indication: 'Convulsions enfant/nourrisson.',
        steps: [
            'LVA + PLS.',
            'HGT (Si < 0.60 -> PISU 9).',
            'Diazépam (Valium) IV ou IR.',
            'Si Fièvre > 38.5°C : Paracétamol.'
        ],
        calculator: (w) => [
            { label: 'Diazépam IV', value: `${(w * 0.2).toFixed(1)} mg`, detail: '0.2 mg/kg (Max 10mg)' },
            { label: 'Diazépam IR', value: `${(w * 0.5).toFixed(1)} mg`, detail: '0.5 mg/kg intra-rectal' },
            { label: 'Paracétamol', value: `${(w * 15).toFixed(0)} mg`, detail: '15 mg/kg IV/IR si fièvre' }
        ]
    },
    {
        id: 'pisu_5a',
        code: 'P.I.S.U 5A',
        title: 'Douleur Adulte',
        icon: Pill,
        color: 'text-blue-500',
        indication: 'EVA > 3.',
        contraIndication: 'Allergie, Insuffisance respi (Morphine), Grossesse (AINS).',
        steps: [
            'Évaluer EVA.',
            'Immobiliser fractures.',
            'EVA < 4 : Paracétamol.',
            'EVA > 4 : Paracétamol + Kétoprofène.',
            'EVA > 6 : Morphine titrée.'
        ],
        calculator: (w) => [
            { label: 'Paracétamol', value: '1 g', detail: 'IV sur 15 min' },
            { label: 'Kétoprofène', value: '100 mg', detail: 'IV dans 100ml NaCl' },
            { label: 'Morphine (Bolus)', value: `${(w * 0.05).toFixed(1)} mg`, detail: '0.05 mg/kg (Titration)', alert: true }
        ]
    },
    {
        id: 'pisu_5e',
        code: 'P.I.S.U 5E',
        title: 'Douleur Enfant',
        icon: Pill,
        color: 'text-blue-400',
        indication: 'EVA > 3 ou EN < 4.',
        steps: [
            'EVA < 4 : Paracétamol.',
            'EVA > 4 : Paracétamol.',
            'EVA > 6 : Morphine.'
        ],
        calculator: (w) => [
            { label: 'Paracétamol', value: `${(w * 15).toFixed(0)} mg`, detail: '15 mg/kg IV/PO' },
            { label: 'Morphine', value: `${(w * 0.05).toFixed(2)} mg`, detail: '0.05 mg/kg (Dilution 1mg/ml)', alert: true }
        ]
    },
    {
        id: 'pisu_6',
        code: 'P.I.S.U 6',
        title: 'Douleur Thoracique',
        icon: Activity,
        color: 'text-red-700',
        indication: 'Douleur thoracique non traumatique.',
        steps: [
            'Demi-assis.',
            'Constantes 2 bras.',
            'ECG 12 dérivations (et 18 si possible).',
            'VVP NaCl garde veine.',
            'Préparer : Aspirine, Dérivés nitrés (Ne pas donner sans avis médical).'
        ]
    },
    {
        id: 'pisu_7',
        code: 'P.I.S.U 7',
        title: 'Dyspnée Cardiaque (OAP)',
        icon: HeartPulse,
        color: 'text-red-500',
        indication: 'OAP, Crépitants, Orthopnée.',
        steps: [
            'Assis jambes pendantes.',
            'O2 MHC 9-15 L/min (Objectif SpO2 > 95%).',
            'ECG 12 dérivations.',
            'VVP NaCl garde veine.'
        ]
    },
    {
        id: 'pisu_8',
        code: 'P.I.S.U 8',
        title: 'Dyspnée Expiratoire (Asthme)',
        icon: Wind,
        color: 'text-blue-300',
        indication: 'Asthme, BPCO, Sibilants.',
        steps: [
            'Position confort (Assis).',
            'O2 MHC 15 L/min.',
            'Aérosol : Salbutamol + Ipratropium.'
        ],
        calculator: (w) => {
            const isChild = w < 30; // Cutoff arbitraire pour l'affichage simple
            return isChild ? [
                { label: 'Salbutamol (Enfant)', value: '2.5 mg', detail: 'Nébulisation 6L/min' },
                { label: 'Ipratropium (Enfant)', value: '0.25 mg', detail: 'Nébulisation' }
            ] : [
                { label: 'Salbutamol (Adulte)', value: '5 mg', detail: 'Nébulisation 6L/min' },
                { label: 'Ipratropium (Adulte)', value: '0.5 mg', detail: 'Nébulisation' }
            ];
        }
    },
    {
        id: 'pisu_9',
        code: 'P.I.S.U 9',
        title: 'Hypoglycémie',
        icon: Syringe,
        color: 'text-yellow-500',
        indication: 'Glycémie < 0.60 g/l.',
        steps: [
            'Conscient : Resucrage per os (Jus, Sucre).',
            'Inconscient : VVP G5% + G30% IVD.'
        ],
        calculator: () => [
            { label: 'G30% (IVD)', value: '10 ml', detail: 'IV Direct (Ampoule 10ml)' },
            { label: 'Relais', value: '250 ml', detail: 'G5% en perfusion' }
        ]
    },
    {
        id: 'pisu_10',
        code: 'P.I.S.U 10',
        title: 'Inconscience',
        icon: Moon,
        color: 'text-slate-600',
        indication: 'Personne inconsciente qui respire.',
        contraIndication: 'Troubles de la conscience associés à des troubles ventilatoires et/ou circulatoires.',
        steps: [
            'LVA + PLS.',
            'Prise des constantes : FC, TA, SpO2, Glycémie.',
            'Si Glycémie < 0.60 g/l -> PISU 9 (Hypoglycémie).',
            'Si SpO2 < 95% -> O2 MHC 9 L/min.',
            'Pose VVP NaCl 0.9% 250 ml.',
            'Bilan au 15.'
        ]
    },
    {
        id: 'pisu_11',
        code: 'P.I.S.U 11',
        title: 'Choc Hémorragique',
        icon: Droplet,
        color: 'text-red-800',
        indication: 'Hémorragie, Pâleur, TA < 90, FC > 120.',
        steps: [
            'Arrêt saignement (Compression/Garrot).',
            'O2 MHC 15 L/min.',
            '2 VVP gros calibre.',
            'Remplissage.'
        ],
        calculator: (w) => [
            { label: 'Remplissage', value: `${(w * 20).toFixed(0)} ml`, detail: 'NaCl ou Ringer (Max 2L avant avis)' }
        ]
    }
];
