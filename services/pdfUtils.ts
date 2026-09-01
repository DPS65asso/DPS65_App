import jsPDF from 'jspdf';

export const ASSO_LOGO_KEY = 'dps65_asso_logo_base64';
export const ASSO_SIGNATURE_KEY = 'dps65_asso_signature_base64';
export const ASSO_SIGNATORY_NAME_KEY = 'dps65_asso_signatory_name';
export const ASSO_SIGNATORY_TITLE_KEY = 'dps65_asso_signatory_title';
export const ASSO_AUTO_SIGN_KEY = 'dps65_auto_sign_enabled';

export const getStoredLogo = (): string | null => {
    try {
        return localStorage.getItem(ASSO_LOGO_KEY);
    } catch {
        return null;
    }
};

export const setStoredLogo = (base64: string): void => {
    try {
        localStorage.setItem(ASSO_LOGO_KEY, base64);
    } catch (e) {
        console.warn('Erreur stockage logo:', e);
    }
};

export const removeStoredLogo = (): void => {
    try {
        localStorage.removeItem(ASSO_LOGO_KEY);
    } catch (e) {
        console.warn('Erreur suppression logo:', e);
    }
};

export const getStoredSignature = (): string | null => {
    try {
        return localStorage.getItem(ASSO_SIGNATURE_KEY);
    } catch {
        return null;
    }
};

export const setStoredSignature = (base64: string): void => {
    try {
        localStorage.setItem(ASSO_SIGNATURE_KEY, base64);
    } catch (e) {
        console.warn('Erreur stockage signature:', e);
    }
};

export const removeStoredSignature = (): void => {
    try {
        localStorage.removeItem(ASSO_SIGNATURE_KEY);
    } catch (e) {
        console.warn('Erreur suppression signature:', e);
    }
};

export const getStoredSignatoryInfo = (): { name: string; title: string; autoSign: boolean } => {
    try {
        return {
            name: localStorage.getItem(ASSO_SIGNATORY_NAME_KEY) || 'Responsable Opérationnel DPS65',
            title: localStorage.getItem(ASSO_SIGNATORY_TITLE_KEY) || 'Responsable des Dispositifs',
            autoSign: localStorage.getItem(ASSO_AUTO_SIGN_KEY) !== 'false' // default true
        };
    } catch {
        return {
            name: 'Responsable Opérationnel DPS65',
            title: 'Responsable des Dispositifs',
            autoSign: true
        };
    }
};

export const setStoredSignatoryInfo = (name: string, title: string): void => {
    try {
        localStorage.setItem(ASSO_SIGNATORY_NAME_KEY, name);
        localStorage.setItem(ASSO_SIGNATORY_TITLE_KEY, title);
    } catch (e) {
        console.warn('Erreur stockage signataire:', e);
    }
};

export const isAutoSignEnabled = (): boolean => {
    try {
        return localStorage.getItem(ASSO_AUTO_SIGN_KEY) !== 'false';
    } catch {
        return true;
    }
};

export const setAutoSignEnabled = (enabled: boolean): void => {
    try {
        localStorage.setItem(ASSO_AUTO_SIGN_KEY, enabled ? 'true' : 'false');
    } catch (e) {
        console.warn('Erreur stockage auto-sign:', e);
    }
};

export const loadImage = (src: string | Blob): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        
        let url = '';
        if (src instanceof Blob) {
            url = URL.createObjectURL(src);
        } else {
            url = src;
        }

        img.src = url;
        
        img.onload = () => {
            resolve(img);
            if (src instanceof Blob) URL.revokeObjectURL(url);
        };
        
        img.onerror = (e) => {
            console.warn("Erreur chargement image PDF", src, e);
            if (src instanceof Blob) URL.revokeObjectURL(url);
            resolve(new Image()); 
        };
    });
};

export const addHeaderLogo = async (doc: jsPDF, x = 14, y = 8, width = 18, height = 18): Promise<boolean> => {
    // 1. Essayer le logo stocké dans localStorage
    const stored = getStoredLogo();
    if (stored) {
        try {
            const customImg = await loadImage(stored);
            if (customImg.width > 0) {
                doc.addImage(customImg, 'PNG', x, y, width, height);
                return true;
            }
        } catch (err) {
            console.warn("Erreur chargement logo custom", err);
        }
    }

    // 2. Essayer les logos par défaut dans public
    const fallbackSources = ['/logo-dps65.png', '/logo.png', '/logo', '/pwa-192x192.png', '/icon.svg'];
    for (const src of fallbackSources) {
        try {
            const logo = await loadImage(src);
            if (logo.width > 0) {
                doc.addImage(logo, 'PNG', x, y, width, height);
                return true;
            }
        } catch {
            // Continuer vers la source suivante
        }
    }

    return false;
};

export const addAssociationSignature = async (
    doc: jsPDF, 
    x: number, 
    y: number, 
    width = 38, 
    height = 16, 
    customSignatureBase64?: string
): Promise<boolean> => {
    const signatureData = customSignatureBase64 || getStoredSignature();
    if (!signatureData) return false;

    try {
        const img = await loadImage(signatureData);
        if (img.width > 0) {
            doc.addImage(img, 'PNG', x, y, width, height);
            return true;
        }
    } catch (err) {
        console.warn("Erreur insertion signature PDF", err);
    }
    return false;
};
