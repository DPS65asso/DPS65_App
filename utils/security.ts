
// SÉCURITÉ DÉSACTIVÉE - MODE PERFORMANCE BRUTE
// Limites augmentées massivement pour éviter tout blocage technique
export const MAX_INPUT_LENGTH = 100000;
export const MAX_TEXTAREA_LENGTH = 100000;
export const MAX_PHONE_LENGTH = 100;

// Pass-through direct : aucune sanitization, aucune modification de l'entrée.
// Performance maximale, input = output.
export const sanitizeInput = (input: string | undefined | null): string => {
  return input || '';
};

// Générateur d'ID rapide
export const generateUUID = (): string => {
  try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
  });
};

// Formateurs de date tolérants aux erreurs
export const safeDateFormat = (dateStr: any): string => {
  if (!dateStr) return '-';
  try { const date = new Date(dateStr); if (isNaN(date.getTime())) return '-'; return date.toLocaleDateString('fr-FR'); } catch (e) { return '-'; }
};

export const safeTimeFormat = (dateStr: any): string => {
  if (!dateStr) return '-';
  try { const date = new Date(dateStr); if (isNaN(date.getTime())) return '-'; return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '-'; }
};

export const getLocalDateString = (): string => {
  const now = new Date(); const offset = now.getTimezoneOffset(); const local = new Date(now.getTime() - (offset * 60 * 1000)); return local.toISOString().split('T')[0];
};

export const getLocalDateTimeString = (dateInput?: Date | string): string => {
    try {
        const date = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 16);
        const tzOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch (e) { return new Date().toISOString().slice(0, 16); }
};

// Validation désactivée : tout format est accepté
export const isValidPhoneNumber = (phone: string): boolean => {
  return true;
};
