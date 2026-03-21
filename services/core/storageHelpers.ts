
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
