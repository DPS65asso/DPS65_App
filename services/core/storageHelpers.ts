
import { Victim, Event as AppEvent, LogbookEntry } from '../../types';

// SÉCURITÉ & CHIFFREMENT : DÉSACTIVÉS
// Les données transitent directement entre l'UI et la base de données locale (IndexedDB).
// Aucune transformation, aucun nettoyage, aucun chiffrement.

export const sanitizeVictimData = (victim: Victim): Victim => victim;
export const sanitizeEventData = (event: AppEvent): AppEvent => event;

// STOCKAGE
export const prepareVictimForStorage = async (victim: Victim) => {
    return victim;
};

// LECTURE
export const restoreVictimFromStorage = async (storedData: any): Promise<Victim> => {
    // Retour direct de l'objet stocké
    return storedData as Victim;
};

export const prepareLogForStorage = async (entry: LogbookEntry) => {
    return entry;
};

export const restoreLogFromStorage = async (stored: any): Promise<LogbookEntry> => {
    return stored;
};

/**
 * FUSION CRDT / FIELD-LEVEL MERGE POUR GÉRER LES CONFLITS HORS-LIGNE PAR CHAMP
 * Permet de combiner les modifications simultanées de deux secouristes sans perte de données.
 */
export const mergeVictimData = (local: Victim, remote: Victim): Victim => {
    if (!local) return remote;
    if (!remote) return local;

    const localTime = local.updatedAt || 0;
    const remoteTime = remote.updatedAt || 0;

    // Si l'un est nettement plus récent (par ex local offline crée plus tard), on garde la base du plus récent
    const primary = localTime >= remoteTime ? local : remote;
    const secondary = localTime >= remoteTime ? remote : local;

    // 1. Fusion des tableaux (Dédoublonnage par ID ou timestamp)
    const mergedVitalsMap = new Map();
    (secondary.vitals || []).forEach(v => mergedVitalsMap.set(v.id || v.time, v));
    (primary.vitals || []).forEach(v => mergedVitalsMap.set(v.id || v.time, v));
    const mergedVitals = Array.from(mergedVitalsMap.values()).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const mergedMedsMap = new Map();
    (secondary.medicationsList || []).forEach(m => mergedMedsMap.set(m.id || m.name, m));
    (primary.medicationsList || []).forEach(m => mergedMedsMap.set(m.id || m.name, m));
    const mergedMeds = Array.from(mergedMedsMap.values());

    const mergedSolutesMap = new Map();
    (secondary.solutes || []).forEach(s => mergedSolutesMap.set(s.id || s.name, s));
    (primary.solutes || []).forEach(s => mergedSolutesMap.set(s.id || s.name, s));
    const mergedSolutes = Array.from(mergedSolutesMap.values());

    const mergedCprMap = new Map();
    (secondary.cprHistory || []).forEach(c => mergedCprMap.set(`${c.timestamp}_${c.action}`, c));
    (primary.cprHistory || []).forEach(c => mergedCprMap.set(`${c.timestamp}_${c.action}`, c));
    const mergedCpr = Array.from(mergedCprMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    const mergedRespMap = new Map();
    (secondary.responderHistory || []).forEach(r => mergedRespMap.set(r.id || `${r.timestamp}_${r.name}`, r));
    (primary.responderHistory || []).forEach(r => mergedRespMap.set(r.id || `${r.timestamp}_${r.name}`, r));
    const mergedResp = Array.from(mergedRespMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // 2. Fusion champ par champ pour préserver les saisies non vides
    return {
        ...secondary,
        ...primary,
        // Préservation des saisies si le primaire avait laissé vide mais secondaire renseigné
        fullName: primary.fullName || secondary.fullName || '',
        bibNumber: primary.bibNumber || secondary.bibNumber || '',
        reason: primary.reason || secondary.reason || '',
        careProvided: primary.careProvided || secondary.careProvided || '',
        allergies: primary.allergies || secondary.allergies || '',
        treatments: primary.treatments || secondary.treatments || '',
        hospitalName: primary.hospitalName || secondary.hospitalName,
        phoneNumber: primary.phoneNumber || secondary.phoneNumber,
        emergencyContact: primary.emergencyContact || secondary.emergencyContact,
        
        // Validation & Signatures (Si l'un des deux a validé, on conserve)
        samuValidated: primary.samuValidated || secondary.samuValidated || false,
        signatureData: primary.signatureData || secondary.signatureData,
        doctorSignatureData: primary.doctorSignatureData || secondary.doctorSignatureData,

        // Tableaux fusionnés
        vitals: mergedVitals,
        medicationsList: mergedMeds,
        solutes: mergedSolutes,
        cprHistory: mergedCpr,
        responderHistory: mergedResp,

        // Horodatage final mis à jour
        updatedAt: Math.max(localTime, remoteTime, Date.now())
    };
};

