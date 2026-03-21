
import { BagType } from '../types';

interface InventoryItemTemplate {
    name: string;
    quantity: number;
    category: string;
}

export const BAG_TEMPLATES: Record<BagType, InventoryItemTemplate[]> = {
    'LOT_A': [
        // Administratif
        { category: 'Admin', name: 'Ordre de mission', quantity: 1 },
        { category: 'Admin', name: 'Main-courante', quantity: 1 },
        { category: 'Admin', name: 'Fiches bilan', quantity: 10 },
        { category: 'Admin', name: 'Fiches intervention', quantity: 5 },
        // Protection
        { category: 'Protection', name: 'Gants UU (paires)', quantity: 6 },
        { category: 'Protection', name: 'Lunettes protection', quantity: 4 },
        { category: 'Protection', name: 'Masques respiratoires', quantity: 4 },
        { category: 'Protection', name: 'Kit AES', quantity: 1 },
        { category: 'Protection', name: 'DASRI (sachets)', quantity: 3 },
        { category: 'Protection', name: 'Conteneur piquants', quantity: 1 },
        { category: 'Protection', name: 'Solution Hydro-alcoolique', quantity: 1 },
        // Bilan
        { category: 'Bilan', name: 'Tensiomètre', quantity: 1 },
        { category: 'Bilan', name: 'Thermomètre', quantity: 1 },
        { category: 'Bilan', name: 'Lampe pupille', quantity: 1 },
        { category: 'Bilan', name: 'Oxymètre', quantity: 1 },
        // Hémorragies
        { category: 'Hémorragies', name: 'Garrot toile', quantity: 1 },
        { category: 'Hémorragies', name: 'Pansements compressifs', quantity: 2 },
        { category: 'Hémorragies', name: 'Compresses stériles (paquets)', quantity: 10 },
        { category: 'Hémorragies', name: 'Champs stériles', quantity: 2 },
        { category: 'Hémorragies', name: 'Antiseptique (dosettes)', quantity: 10 },
        { category: 'Hémorragies', name: 'Sérum phy (dosettes)', quantity: 10 },
        // Immobilisation
        { category: 'Immob', name: 'Colliers cervicaux', quantity: 3 },
        { category: 'Immob', name: 'Écharpes', quantity: 2 },
        { category: 'Immob', name: 'Attelles', quantity: 1 },
        // Réa
        { category: 'Réa', name: 'Insufflateur Adulte', quantity: 1 },
        { category: 'Réa', name: 'Insufflateur Enfant', quantity: 1 },
        { category: 'Réa', name: 'Masques O2 HC Adulte', quantity: 2 },
        { category: 'Réa', name: 'Masques O2 HC Enfant', quantity: 2 },
        { category: 'Réa', name: 'Canules Guedel (Jeu)', quantity: 1 },
        { category: 'Réa', name: 'Aspirateur mucosités', quantity: 1 },
        // Divers
        { category: 'Divers', name: 'Couverture isotherme', quantity: 2 },
        { category: 'Divers', name: 'Sucre', quantity: 5 },
    ],
    'LOT_B': [
        // Version allégée du Lot A
        { category: 'Admin', name: 'Fiches bilan', quantity: 5 },
        { category: 'Protection', name: 'Gants UU (paires)', quantity: 4 },
        { category: 'Protection', name: 'Solution Hydro-alcoolique', quantity: 1 },
        { category: 'Bilan', name: 'Tensiomètre', quantity: 1 },
        { category: 'Bilan', name: 'Lampe', quantity: 1 },
        { category: 'Hémorragies', name: 'Garrot toile', quantity: 1 },
        { category: 'Hémorragies', name: 'Pansements compressifs', quantity: 2 },
        { category: 'Hémorragies', name: 'Compresses stériles', quantity: 6 },
        { category: 'Hémorragies', name: 'Antiseptique', quantity: 5 },
        { category: 'Immob', name: 'Colliers cervicaux', quantity: 2 },
        { category: 'Réa', name: 'Insufflateur Adulte', quantity: 1 },
        { category: 'Réa', name: 'Masques O2', quantity: 2 },
        { category: 'Divers', name: 'Couverture isotherme', quantity: 1 }
    ],
    'LOT_C': [
        // Petit sac
        { category: 'Admin', name: 'Fiches bilan', quantity: 2 },
        { category: 'Protection', name: 'Gants UU', quantity: 4 },
        { category: 'Bilan', name: 'Tensiomètre', quantity: 1 },
        { category: 'Hémorragies', name: 'Pansement compressif', quantity: 1 },
        { category: 'Hémorragies', name: 'Compresses', quantity: 5 },
        { category: 'Hémorragies', name: 'Antiseptique', quantity: 5 }
    ],
    'SAC_IDE': [
        // Ampoulier
        { category: 'Ampoulier', name: 'Adrénaline 1mg', quantity: 5 },
        { category: 'Ampoulier', name: 'Adrénaline 5mg', quantity: 2 },
        { category: 'Ampoulier', name: 'Amiodarone 300mg', quantity: 2 },
        { category: 'Ampoulier', name: 'Aspégic 500mg', quantity: 2 },
        { category: 'Ampoulier', name: 'Diazépam 10mg', quantity: 1 },
        { category: 'Ampoulier', name: 'G30% 10ml', quantity: 2 },
        { category: 'Ampoulier', name: 'Ipratropium 0.25mg', quantity: 6 },
        { category: 'Ampoulier', name: 'Kétoprofène 100mg', quantity: 2 },
        { category: 'Ampoulier', name: 'Morphine 1mg', quantity: 5 },
        { category: 'Ampoulier', name: 'Morphine 10mg', quantity: 2 },
        { category: 'Ampoulier', name: 'Naloxone 0.4mg', quantity: 2 },
        { category: 'Ampoulier', name: 'Ondansetron', quantity: 2 },
        { category: 'Ampoulier', name: 'Rivotril 1mg', quantity: 2 },
        { category: 'Ampoulier', name: 'NaCl 0.9% 10ml', quantity: 5 },
        { category: 'Ampoulier', name: 'NaCl 0.9% 100ml', quantity: 1 },
        // Matériel Injection
        { category: 'Injection', name: 'Aiguilles 18G', quantity: 10 },
        { category: 'Injection', name: 'Seringues 5ml', quantity: 5 },
        { category: 'Injection', name: 'Seringues 10ml', quantity: 5 },
        // Vrac
        { category: 'Vrac', name: 'Paracétamol 1g', quantity: 2 },
        { category: 'Vrac', name: 'Poche Pression', quantity: 1 },
        // Accès VVP
        { category: 'VVP', name: 'Cathéter 18G', quantity: 3 },
        { category: 'VVP', name: 'Cathéter 20G', quantity: 3 },
        { category: 'VVP', name: 'Cathéter 22G', quantity: 3 },
        { category: 'VVP', name: 'Perfuseur 3V', quantity: 5 },
        { category: 'VVP', name: 'Tegaderm', quantity: 5 },
        { category: 'VVP', name: 'Garrot', quantity: 1 },
        // Solutés
        { category: 'Solutés', name: 'G5% 250ml', quantity: 5 },
        { category: 'Solutés', name: 'NaCl 0.9% 250ml', quantity: 5 },
        { category: 'Solutés', name: 'Ringer Lactate 500ml', quantity: 5 },
        // Ventilation
        { category: 'Ventilation', name: 'Masque Nébuliseur Adulte', quantity: 2 },
        { category: 'Ventilation', name: 'Masque Nébuliseur Enfant', quantity: 2 },
        { category: 'Ventilation', name: 'I-Gel T3', quantity: 1 },
        { category: 'Ventilation', name: 'I-Gel T4', quantity: 1 },
        { category: 'Ventilation', name: 'Laryngoscope', quantity: 1 },
        { category: 'Ventilation', name: 'Sondes IOT', quantity: 3 },
        // Trauma
        { category: 'Trauma', name: 'Chest Seal', quantity: 3 },
        { category: 'Trauma', name: 'Wound Clot', quantity: 4 },
        { category: 'Trauma', name: 'Bandage Israélien', quantity: 4 },
        { category: 'Trauma', name: 'Garrot Tourniquet', quantity: 2 },
    ]
};
