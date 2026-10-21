/**
 * Service de gestion des cartes hors-ligne pour les Hautes-Pyrénées (65).
 * Utilise la Cache Storage API du navigateur pour stocker les tuiles de carte.
 */

const CACHE_NAME = 'map-tiles-offline';

// Bounding box des Hautes-Pyrénées (65)
const HP_BBOX = {
    minLat: 42.66,
    maxLat: 43.58,
    minLon: -0.56,
    maxLon: 0.65
};

// Niveaux de zoom à télécharger pour un usage hors-ligne optimal et léger
const MIN_ZOOM = 8;
const MAX_ZOOM = 13;

// Fonctions de conversion de coordonnées géographiques en coordonnées de tuiles
export function lon2tile(lon: number, zoom: number): number {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number): number {
    return Math.floor(
        ((1 -
            Math.log(
                Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
            ) / Math.PI) / 2) *
            Math.pow(2, zoom)
    );
}

// Génère la liste de toutes les URL de tuiles à télécharger pour la BBox
export function generateTileUrls(): string[] {
    const urls: string[] = [];
    
    for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
        const xMin = lon2tile(HP_BBOX.minLon, z);
        const xMax = lon2tile(HP_BBOX.maxLon, z);
        const yMin = lat2tile(HP_BBOX.maxLat, z); // Note: latitude max correspond à Y min
        const yMax = lat2tile(HP_BBOX.minLat, z);
        
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                // Utilise le sous-domaine 'a' par défaut pour la normalisation
                urls.push(`https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`);
            }
        }
    }
    
    return urls;
}

/**
 * Génère la liste des URL de tuiles pour un rayon de ~10km autour d'un point GPS
 */
export function generateLocalEventTileUrls(lat: number, lon: number): string[] {
    const urls: string[] = [];
    const dLat = 10 / 111; // 10 km de rayon en latitude
    const dLon = 10 / (111 * Math.cos((lat * Math.PI) / 180)); // 10 km de rayon en longitude
    
    const minLat = lat - dLat;
    const maxLat = lat + dLat;
    const minLon = lon - dLon;
    const maxLon = lon + dLon;
    
    // Zoom local ultra-précis pour le terrain
    const MIN_LOCAL_ZOOM = 11;
    const MAX_LOCAL_ZOOM = 16;
    
    for (let z = MIN_LOCAL_ZOOM; z <= MAX_LOCAL_ZOOM; z++) {
        const xMin = lon2tile(minLon, z);
        const xMax = lon2tile(maxLon, z);
        const yMin = lat2tile(maxLat, z);
        const yMax = lat2tile(minLat, z);
        
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                urls.push(`https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`);
            }
        }
    }
    
    return urls;
}

const HP_TOWNS: { [key: string]: [number, number] } = {
    'tarbes': [43.23, 0.08],
    'lourdes': [43.10, -0.05],
    'bagneres': [43.06, 0.15],
    'bagnères': [43.06, 0.15],
    'cauterets': [42.88, -0.11],
    'argeles': [43.00, -0.10],
    'argelès': [43.00, -0.10],
    'arrens': [42.95, -0.21],
    'gavarnie': [42.73, -0.01],
    'saint-lary': [42.82, 0.32],
    'st-lary': [42.82, 0.32],
    'lannemezan': [43.13, 0.38],
    'vic-en-bigorre': [43.38, 0.05],
    'tournay': [43.18, 0.24],
    'capvern': [43.10, 0.31],
    'luz': [42.87, 0.00],
    'loudenvielle': [42.79, 0.41],
    'campan': [43.01, 0.17],
    'bareges': [42.89, 0.06],
    'barèges': [42.89, 0.06],
    'vielle-aure': [42.83, 0.32],
    'arreau': [42.90, 0.36]
};

/**
 * Calcul les coordonnées géographiques d'un événement
 */
export function getEventCoordinates(event: any): { lat: number; lng: number } {
    // 1. Essayer avec le trackData (Legacy)
    if (event.trackData && event.trackData.length > 0) {
        const lats = event.trackData.map((p: any) => p[0]);
        const lngs = event.trackData.map((p: any) => p[1]);
        const avgLat = lats.reduce((sum: number, val: number) => sum + val, 0) / event.trackData.length;
        const avgLng = lngs.reduce((sum: number, val: number) => sum + val, 0) / event.trackData.length;
        return { lat: avgLat, lng: avgLng };
    }
    
    // 2. Essayer avec les tracks (Nouveau)
    if (event.tracks && event.tracks.length > 0) {
        let sumLat = 0, sumLng = 0, count = 0;
        event.tracks.forEach((t: any) => {
            if (t.data && t.data.length > 0) {
                t.data.forEach((p: any) => {
                    sumLat += p[0];
                    sumLng += p[1];
                    count++;
                });
            }
        });
        if (count > 0) {
            return { lat: sumLat / count, lng: sumLng / count };
        }
    }
    
    // 3. Essayer de mapper le nom de la ville
    if (event.location) {
        const locLower = event.location.toLowerCase();
        for (const [key, coords] of Object.entries(HP_TOWNS)) {
            if (locLower.includes(key)) {
                return { lat: coords[0], lng: coords[1] };
            }
        }
    }
    
    // 4. Par défaut : centre des Hautes-Pyrénées (Tarbes)
    return { lat: 43.23, lng: 0.08 };
}

/**
 * Normalise une URL Leaflet en remplaçant les sous-domaines aléatoires (a, b, c) par 'a'
 */
export function normalizeTileUrl(url: string): string {
    if (url.includes('tile.openstreetmap.org')) {
        return url.replace(/https:\/\/[a-c]\.tile\.openstreetmap\.org/, 'https://a.tile.openstreetmap.org');
    }
    if (url.includes('tile.opentopomap.org')) {
        return url.replace(/https:\/\/[a-c]\.tile\.opentopomap\.org/, 'https://a.tile.opentopomap.org');
    }
    return url;
}

/**
 * Nettoie automatiquement les anciennes tuiles périmées (ex: Carto nécessitant désormais une clé d'API)
 */
export async function cleanupLegacyCartoTiles(): Promise<void> {
    try {
        if (!('caches' in window)) return;
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        for (const req of requests) {
            if (req.url.includes('cartocdn.com') || req.url.includes('carto.com')) {
                await cache.delete(req);
            }
        }
    } catch (e) {
        console.warn("Échec du nettoyage des anciennes tuiles Carto", e);
    }
}

/**
 * Vérifie si la carte hors-ligne est intégralement stockée localement
 */
export async function getOfflineMapStatus(): Promise<{
    isDownloaded: boolean;
    cachedCount: number;
    totalCount: number;
    percent: number;
}> {
    try {
        if (!('caches' in window)) {
            return { isDownloaded: false, cachedCount: 0, totalCount: 0, percent: 0 };
        }
        
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        const cachedUrls = new Set(keys.map(request => request.url));
        
        const targetUrls = generateTileUrls();
        let matchCount = 0;
        
        for (const url of targetUrls) {
            if (cachedUrls.has(url)) {
                matchCount++;
            }
        }
        
        const total = targetUrls.length;
        const percent = total > 0 ? Math.round((matchCount / total) * 100) : 0;
        
        return {
            isDownloaded: percent >= 95, // Tolérance si des tuiles particulières ont échoué
            cachedCount: matchCount,
            totalCount: total,
            percent
        };
    } catch (e) {
        console.error("Erreur lors de la lecture du statut de la carte hors-ligne :", e);
        return { isDownloaded: false, cachedCount: 0, totalCount: 0, percent: 0 };
    }
}

/**
 * Télécharge toutes les tuiles de la carte des Hautes-Pyrénées de manière concurrente limitée
 */
export async function downloadOfflineMap(
    onProgress: (progress: { downloaded: number; total: number; percent: number; currentUrl?: string }) => void,
    signal?: AbortSignal
): Promise<void> {
    const urls = generateTileUrls();
    await downloadTileUrls(urls, onProgress, signal);
}

/**
 * Télécharge une liste arbitraire d'URL de tuiles de manière optimisée
 */
export async function downloadTileUrls(
    urls: string[],
    onProgress: (progress: { downloaded: number; total: number; percent: number; currentUrl?: string }) => void,
    signal?: AbortSignal
): Promise<void> {
    if (!('caches' in window)) {
        throw new Error("L'API Cache n'est pas supportée par ce périphérique.");
    }
    
    if (signal?.aborted) {
        throw new DOMException('Download aborted', 'AbortError');
    }
    
    const total = urls.length;
    if (total === 0) return;

    const cache = await caches.open(CACHE_NAME);

    // Vérification stricte du mode en ligne / mode avion
    if (!navigator.onLine) {
        // Vérifier si toutes les tuiles sont déjà présentes en cache local
        let missingCount = 0;
        for (const url of urls) {
            const match = await cache.match(url);
            if (!match) {
                missingCount++;
            }
        }
        if (missingCount > 0) {
            throw new Error(`Téléchargement impossible : vous êtes hors-ligne ou en mode avion (${missingCount} tuile(s) manquante(s)). Connectez-vous à Internet pour télécharger la carte.`);
        } else {
            onProgress({
                downloaded: total,
                total,
                percent: 100,
                currentUrl: "Toutes les tuiles sont déjà disponibles hors-ligne"
            });
            return;
        }
    }
    
    // Pour ne pas surcharger le réseau, on télécharge par paquets de requêtes concurrentes d'intensité raisonnable
    const CONCURRENCY_LIMIT = 8;
    let index = 0;
    let newlyDownloadedCount = 0;
    let alreadyCachedCount = 0;
    let failedCount = 0;
    let processedCount = 0;
    
    async function worker() {
        while (index < total) {
            if (signal?.aborted) {
                break;
            }
            const currentIndex = index++;
            const url = urls[currentIndex];
            if (!url) continue;
            
            let isTileReady = false;
            try {
                // 1. Vérifier si déjà présent en cache local
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    alreadyCachedCount++;
                    isTileReady = true;
                } else {
                    // 2. Télécharger la tuile avec un timeout de 8s
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);
                    
                    const onAbort = () => controller.abort();
                    if (signal) {
                        if (signal.aborted) controller.abort();
                        else signal.addEventListener('abort', onAbort, { once: true });
                    }
                    
                    try {
                        const response = await fetch(url, { 
                            signal: controller.signal,
                            headers: { 'Accept': 'image/*' }
                        });
                        clearTimeout(timeoutId);
                        
                        if (response.ok) {
                            await cache.put(url, response);
                            newlyDownloadedCount++;
                            isTileReady = true;
                        } else {
                            failedCount++;
                        }
                    } catch (fetchErr) {
                        clearTimeout(timeoutId);
                        if (signal?.aborted) throw fetchErr;
                        failedCount++;
                    } finally {
                        if (signal) signal.removeEventListener('abort', onAbort);
                    }
                }
            } catch (e) {
                if (signal?.aborted) break;
                failedCount++;
            } finally {
                if (signal?.aborted) {
                    break;
                }
                processedCount++;
                const securedCount = alreadyCachedCount + newlyDownloadedCount;
                onProgress({
                    downloaded: securedCount,
                    total,
                    percent: Math.min(100, Math.round((processedCount / total) * 100)),
                    currentUrl: isTileReady 
                        ? `Tuile ${processedCount}/${total}` 
                        : `Échec tuile ${processedCount}/${total}`
                });
            }
        }
    }
    
    // Lancer les workers concurrents
    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, total) }, worker);
    await Promise.all(workers);
    
    if (signal?.aborted) {
        throw new DOMException('Download aborted', 'AbortError');
    }

    const securedCount = alreadyCachedCount + newlyDownloadedCount;

    // Si aucune tuile n'a pu être téléchargée et qu'il y a eu des échecs (ex: coupure réseau, mode avion survenu)
    if (failedCount > 0 && newlyDownloadedCount === 0 && alreadyCachedCount < total * 0.9) {
        throw new Error("Échec du téléchargement : aucune connexion Internet active pour récupérer les tuiles de carte. Désactivez le mode avion.");
    }

    // Si un taux d'échec critique survient (> 25% des tuiles à télécharger)
    const neededToDownload = total - alreadyCachedCount;
    if (neededToDownload > 0 && failedCount > neededToDownload * 0.25) {
        throw new Error(`Téléchargement incomplet : ${failedCount} tuile(s) n'ont pas pu être téléchargées (connexion instable ou interrompue).`);
    }
}

/**
 * Supprime l'intégralité du cache des tuiles
 */
export async function deleteOfflineMap(): Promise<boolean> {
    if (!('caches' in window)) return false;
    return await caches.delete(CACHE_NAME);
}

/**
 * Calcule le nombre de tuiles et la taille estimée du cache hors-ligne
 */
export async function getOfflineMapSize(): Promise<{ count: number; estimatedSizeMB: number }> {
    if (!('caches' in window)) return { count: 0, estimatedSizeMB: 0 };
    try {
        const hasCache = await caches.has(CACHE_NAME);
        if (!hasCache) return { count: 0, estimatedSizeMB: 0 };
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        const count = keys.length;
        // Une tuile Carto Voyager pèse en moyenne ~18 à 22 Ko
        const estimatedSizeMB = Math.round(((count * 20) / 1024) * 10) / 10;
        return { count, estimatedSizeMB };
    } catch (e) {
        return { count: 0, estimatedSizeMB: 0 };
    }
}
