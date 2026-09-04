
import { Victim, Event as AppEvent, LogbookEntry, Track } from '../../types';

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

/**
 * FUSION ÉVÉNEMENT : Protège rigoureusement les tracés GPX et plans PDF contre tout écrasement ou perte.
 */
export const mergeEventData = (local?: AppEvent | null, remote?: AppEvent | null): AppEvent => {
    if (!local && !remote) return {} as AppEvent;
    if (!local) return remote as AppEvent;
    if (!remote) return local as AppEvent;

    const localTime = local.updatedAt || local.createdAt || 0;
    const remoteTime = remote.updatedAt || remote.createdAt || 0;

    const primary = localTime >= remoteTime ? local : remote;
    const secondary = localTime >= remoteTime ? remote : local;

    // 1. Fusion des tracés GPX (tracks)
    // On conserve impérativement tous les tracés existants (local ou remote)
    let mergedTracks: Track[] = [];
    if (local.tracks && local.tracks.length > 0 && remote.tracks && remote.tracks.length > 0) {
        const trackMap = new Map<string, Track>();
        local.tracks.forEach(t => trackMap.set(t.id || t.name, t));
        remote.tracks.forEach(t => trackMap.set(t.id || t.name, t));
        mergedTracks = Array.from(trackMap.values());
    } else if (local.tracks && local.tracks.length > 0) {
        mergedTracks = local.tracks;
    } else if (remote.tracks && remote.tracks.length > 0) {
        mergedTracks = remote.tracks;
    } else if (local.trackData && local.trackData.length > 0) {
        mergedTracks = [{ id: 'legacy-track-local', name: 'Tracé GPX', data: local.trackData, color: '#2563eb' }];
    } else if (remote.trackData && remote.trackData.length > 0) {
        mergedTracks = [{ id: 'legacy-track-remote', name: 'Tracé GPX', data: remote.trackData, color: '#2563eb' }];
    }

    // 2. Fusion des coordonnées de secours (trackData)
    let mergedTrackData = primary.trackData || secondary.trackData;
    if ((!mergedTrackData || mergedTrackData.length === 0) && mergedTracks.length > 0) {
        mergedTrackData = mergedTracks[0].data;
    }

    // 3. Fusion des plans de cartographie PDF (mapPdfs)
    // On conserve impérativement tous les fichiers PDF existants
    let mergedMapPdfs: { id: string; name: string; url: string; }[] = [];
    if (local.mapPdfs && local.mapPdfs.length > 0 && remote.mapPdfs && remote.mapPdfs.length > 0) {
        const pdfMap = new Map<string, { id: string; name: string; url: string; }>();
        // On privilégie les entrées qui ont une URL renseignée (Base64 ou Cloud URL)
        remote.mapPdfs.forEach(p => { if (p && p.url) pdfMap.set(p.id || p.name, p); });
        local.mapPdfs.forEach(p => { if (p && p.url) pdfMap.set(p.id || p.name, p); });
        mergedMapPdfs = Array.from(pdfMap.values());
    } else if (local.mapPdfs && local.mapPdfs.length > 0) {
        mergedMapPdfs = local.mapPdfs;
    } else if (remote.mapPdfs && remote.mapPdfs.length > 0) {
        mergedMapPdfs = remote.mapPdfs;
    } else if (local.mapPdfUrl) {
        mergedMapPdfs = [{ id: 'primary-pdf-local', name: 'Plan de cartographie.pdf', url: local.mapPdfUrl }];
    } else if (remote.mapPdfUrl) {
        mergedMapPdfs = [{ id: 'primary-pdf-remote', name: 'Plan de cartographie.pdf', url: remote.mapPdfUrl }];
    }

    // 4. URL PDF unique (mapPdfUrl)
    let mergedMapPdfUrl = primary.mapPdfUrl || secondary.mapPdfUrl;
    if (!mergedMapPdfUrl && mergedMapPdfs.length > 0) {
        mergedMapPdfUrl = mergedMapPdfs[0].url;
    }

    // 5. Normalisation des booléens d'archivage
    const isArchived = primary.isArchived !== undefined 
        ? primary.isArchived 
        : (primary.is_archived !== undefined 
            ? primary.is_archived 
            : (secondary.isArchived !== undefined ? secondary.isArchived : !!secondary.is_archived));

    return {
        ...secondary,
        ...primary,
        id: primary.id || secondary.id,
        name: primary.name || secondary.name || '',
        date: primary.date || secondary.date || '',
        location: primary.location || secondary.location || '',
        supervisorName: primary.supervisorName || secondary.supervisorName,
        supervisorPhone: primary.supervisorPhone || secondary.supervisorPhone,
        organizer_code: primary.organizer_code || secondary.organizer_code,
        resourceConfig: primary.resourceConfig || secondary.resourceConfig,
        isArchived,
        is_archived: isArchived,
        tracks: mergedTracks.length > 0 ? mergedTracks : undefined,
        trackData: mergedTrackData && mergedTrackData.length > 0 ? mergedTrackData : undefined,
        mapPdfs: mergedMapPdfs.length > 0 ? mergedMapPdfs : undefined,
        mapPdfUrl: mergedMapPdfUrl,
        updatedAt: Math.max(localTime, remoteTime, Date.now())
    };
};


