
import jsPDF from 'jspdf';

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

export const addHeaderLogo = async (doc: jsPDF) => {
    try {
        // Le logo est déposé dans le dossier public sous le nom "logo"
        // On essaie de le charger. Si l'extension est manquante, le navigateur essaiera de le résoudre.
        const logo = await loadImage('/logo');
        if (logo.width > 0) {
            doc.addImage(logo, 'PNG', 14, 10, 20, 20);
            return true;
        }
    } catch (e) {
        // Fallback au cas où le fichier a une extension .png
        try {
            const logoPng = await loadImage('/logo.png');
            if (logoPng.width > 0) {
                doc.addImage(logoPng, 'PNG', 14, 10, 20, 20);
                return true;
            }
        } catch (err) {
            console.warn("Logo non trouvé pour le PDF (tenté /logo et /logo.png)");
        }
    }
    return false;
};
