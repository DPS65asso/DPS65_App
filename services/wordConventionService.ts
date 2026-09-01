
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

export interface ConventionFormData {
    // Organisateur / Société
    nomSociete?: string;
    nomOrganisateur: string;
    nomResponsable?: string;
    representantOrganisateur: string;
    qualiteRepresentant: string;
    adresseOrganisateur: string;
    telephoneOrganisateur: string;
    emailOrganisateur: string;
    mailOrganisateur?: string;
    
    // Événement
    nomEvenement: string;
    dateEvenement: string;
    dateFinEvenement?: string;
    lieuEvenement: string;
    typeEvenement: string;
    horairesDebut: string;
    horairesFin: string;
    horairesMiseEnPlace: string;
    
    // Public & Effectifs
    effectifPublic: number | string;
    effectifParticipants: number | string;
    dispositifEngage?: string;
    typeDispositif: string; // PAPS, DPS-PE, DPS-ME, DPS-GE
    nbSecouristes: number | string;
    nbPse2: number | string;
    nbPse1: number | string;
    nbChefsPoste: number | string;
    hasChefPoste?: boolean;
    nbVpsp: number | string;
    hasVpsp?: boolean;
    nbVehiculePersonnel?: number | string;
    hasVehiculePersonnel?: boolean;
    
    // Conditions financières & Logistiques
    coutPrestation: number | string;
    repasPrisEnCharge: boolean | string;
    hebergementPrisEnCharge: boolean | string;
    localMiseADisposition: string;
    dateConvention: string;
    lieuSignature: string;
    
    // DPS65 Contact
    representantDps: string;
    qualiteDps: string;
    telephoneDps: string;
    emailDps: string;
    
    // Clés personnalisées additionnelles (extensible)
    [key: string]: any;
}

/**
 * Lit un fichier Word .docx (ArrayBuffer ou Blob), remplace toutes les variables {variable}
 * et retourne le nouveau fichier Word généré.
 */
export async function populateWordDocument(
    fileBuffer: ArrayBuffer,
    data: ConventionFormData
): Promise<Blob> {
    try {
        const zip = new PizZip(fileBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => ''
        });

        const formattedData: Record<string, any> = { ...data };

        // 1. Valeurs canoniques
        const dateConvention = data.dateConvention || new Date().toLocaleDateString('fr-FR');
        const nomEvenement = data.nomEvenement || data.eventName || '';
        const lieuEvenement = data.lieuEvenement || data.eventLocation || '';
        const nomSociete = data.nomSociete || data.nomOrganisateur || data.organizerName || '';
        const nomResponsable = data.nomResponsable || data.representantOrganisateur || data.organizerContact || '';
        const mailOrganisateur = data.mailOrganisateur || data.emailOrganisateur || data.organizerEmail || '';
        const dispositifEngage = data.dispositifEngage || data.typeDispositif || data.dispositifType || 'DPS-PE';
        
        const nbSecouristes = String(data.nbSecouristes ?? data.recommendedSecouristes ?? 2);
        
        const hasVpsp = data.hasVpsp !== undefined ? data.hasVpsp : Number(data.nbVpsp || 0) > 0;
        const nbVpsp = hasVpsp ? String(data.nbVpsp ?? data.recommendedVpsp ?? 1) : "0";
        
        const hasVehiculePersonnel = data.hasVehiculePersonnel !== undefined ? data.hasVehiculePersonnel : Number(data.nbVehiculePersonnel || 0) > 0;
        const nbVehiculePersonnel = hasVehiculePersonnel ? String(data.nbVehiculePersonnel ?? 1) : "0";
        
        const hasChefPoste = data.hasChefPoste !== undefined ? data.hasChefPoste : Number(data.nbChefsPoste || 0) > 0;
        const nbChefsPoste = hasChefPoste ? String(data.nbChefsPoste ?? data.recommendedChefPoste ?? 1) : "0";

        // 2. Dictionnaire exhaustif avec toutes les variations possibles de balises Word
        const keyMappings: Record<string, any> = {
            // Date de la convention
            'date_convention': dateConvention,
            'dateConvention': dateConvention,
            'date_de_la_convention': dateConvention,
            'Date de la convention': dateConvention,
            'DATE_DE_LA_CONVENTION': dateConvention,
            'DATE_CONVENTION': dateConvention,
            'date_signature': dateConvention,
            
            // Nom de l'événement
            'nom_evenement': nomEvenement,
            'nomEvenement': nomEvenement,
            'nom_de_l_evenement': nomEvenement,
            'nom_de_l_événement': nomEvenement,
            'Nom de l\'evenement': nomEvenement,
            'Nom de l\'événement': nomEvenement,
            'NOM_DE_L_EVENEMENT': nomEvenement,
            'evenement': nomEvenement,
            'intitule_evenement': nomEvenement,
            
            // Lieu de l'événement
            'lieu_evenement': lieuEvenement,
            'lieuEvenement': lieuEvenement,
            'lieu_de_l_evenement': lieuEvenement,
            'lieu_de_l_événement': lieuEvenement,
            'Lieu de l\'evenement': lieuEvenement,
            'Lieu de l\'événement': lieuEvenement,
            'LIEU_DE_L_EVENEMENT': lieuEvenement,
            'lieu': lieuEvenement,
            'ville_evenement': lieuEvenement,
            
            // Nom de la société
            'nom_societe': nomSociete,
            'nomSociete': nomSociete,
            'nom_de_la_societe': nomSociete,
            'nom_de_la_société': nomSociete,
            'Nom de la société': nomSociete,
            'Nom de la societe': nomSociete,
            'NOM_DE_LA_SOCIETE': nomSociete,
            'societe': nomSociete,
            'société': nomSociete,
            'nom_organisateur': nomSociete,
            'nomOrganisateur': nomSociete,
            'raison_sociale': nomSociete,
            'organisateur': nomSociete,
            
            // Nom du responsable
            'nom_responsable': nomResponsable,
            'nomResponsable': nomResponsable,
            'nom_du_responsable': nomResponsable,
            'Nom du responsable': nomResponsable,
            'NOM_DU_RESPONSABLE': nomResponsable,
            'responsable': nomResponsable,
            'representant_organisateur': nomResponsable,
            'representantOrganisateur': nomResponsable,
            'representant': nomResponsable,
            'signataire_organisateur': nomResponsable,
            
            // Mail de l'organisateur
            'mail_organisateur': mailOrganisateur,
            'mailOrganisateur': mailOrganisateur,
            'email_organisateur': mailOrganisateur,
            'emailOrganisateur': mailOrganisateur,
            'mail_de_l_organisateur': mailOrganisateur,
            'email_de_l_organisateur': mailOrganisateur,
            'Mail de l\'organisateur': mailOrganisateur,
            'Email de l\'organisateur': mailOrganisateur,
            'MAIL_DE_L_ORGANISATEUR': mailOrganisateur,
            'EMAIL_DE_L_ORGANISATEUR': mailOrganisateur,
            'mail': mailOrganisateur,
            'email': mailOrganisateur,
            
            // Dispositif engagé
            'dispositif_engage': dispositifEngage,
            'dispositifEngage': dispositifEngage,
            'dispositif_engagé': dispositifEngage,
            'Dispositif engagé': dispositifEngage,
            'Dispositif engage': dispositifEngage,
            'DISPOSITIF_ENGAGE': dispositifEngage,
            'type_dispositif': dispositifEngage,
            'typeDispositif': dispositifEngage,
            'dispositif': dispositifEngage,
            
            // Nombre d'intervenant secouriste
            'nombre_intervenant_secouriste': nbSecouristes,
            'nombre_intervenants_secouristes': nbSecouristes,
            'nombre_d_intervenants_secouristes': nbSecouristes,
            'nombre_d_intervenant_secouriste': nbSecouristes,
            'Nombre d\'intervenant secouriste': nbSecouristes,
            'Nombre d\'intervenants secouristes': nbSecouristes,
            'NOMBRE_INTERVENANT_SECOURISTE': nbSecouristes,
            'nb_secouristes': nbSecouristes,
            'nbSecouristes': nbSecouristes,
            'nombre_secouristes': nbSecouristes,
            'effectif_secouristes': nbSecouristes,
            
            // Nombre de véhicule personnel
            'nombre_vehicule_personnel': nbVehiculePersonnel,
            'nombre_de_vehicule_personnel': nbVehiculePersonnel,
            'nombre_de_vehicules_personnels': nbVehiculePersonnel,
            'Nombre de véhicule personnel': nbVehiculePersonnel,
            'Nombre de véhicules personnels': nbVehiculePersonnel,
            'NOMBRE_DE_VEHICULE_PERSONNEL': nbVehiculePersonnel,
            'nb_vehicules_personnels': nbVehiculePersonnel,
            'nb_vehicule_personnel': nbVehiculePersonnel,
            'nbVehiculePersonnel': nbVehiculePersonnel,
            'vehicules_personnels': nbVehiculePersonnel,
            'nb_vl': nbVehiculePersonnel,
            'nombre_vl': nbVehiculePersonnel,
            
            // Nombre de véhicule de Premier Secours
            'nombre_vehicule_premier_secours': nbVpsp,
            'nombre_de_vehicule_premier_secours': nbVpsp,
            'nombre_de_vehicule_de_premier_secours': nbVpsp,
            'nombre_de_vehicules_de_premiers_secours': nbVpsp,
            'Nombre de véhicule de Premier Secours': nbVpsp,
            'Nombre de véhicule de premiers secours': nbVpsp,
            'Nombre de véhicules de premiers secours': nbVpsp,
            'NOMBRE_DE_VEHICULE_DE_PREMIER_SECOURS': nbVpsp,
            'nb_vpsp': nbVpsp,
            'nbVpsp': nbVpsp,
            'nombre_vpsp': nbVpsp,
            'vehicules_premiers_secours': nbVpsp,
            'vpsp': nbVpsp,

            // Chef de poste
            'nb_chefs_poste': nbChefsPoste,
            'nbChefsPoste': nbChefsPoste,
            'nombre_chefs_poste': nbChefsPoste,
            'Nombre de chefs de poste': nbChefsPoste,
            'chef_de_poste': nbChefsPoste,

            // Compléments logistiques & financiers
            'cout_prestation': String(data.coutPrestation || '0'),
            'coutPrestation': String(data.coutPrestation || '0'),
            'montant': String(data.coutPrestation || '0'),
            'horaires_debut': data.horairesDebut || data.eventTimeStart || '08:00',
            'horaires_fin': data.horairesFin || data.eventTimeEnd || '18:00',
            'horaires_mise_en_place': data.horairesMiseEnPlace || '07:30',
            'adresse_organisateur': data.adresseOrganisateur || '',
            'telephone_organisateur': data.telephoneOrganisateur || '',
            'lieu_signature': data.lieuSignature || 'Tarbes'
        };

        // Appliquer toutes les correspondances
        Object.assign(formattedData, keyMappings);

        doc.render(formattedData);

        const out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        return out;
    } catch (error: any) {
        console.error("Erreur lors de la génération du document Word :", error);
        throw new Error(`Échec de remplissage de la convention Word : ${error?.message || error}`);
    }
}

/**
 * Extrait la liste des tags/variables détectés dans un fichier Word .docx
 */
export function inspectWordTags(fileBuffer: ArrayBuffer): string[] {
    try {
        const zip = new PizZip(fileBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true
        });
        
        // Docxtemplater exposes inspecting tags or we can parse text
        const text = doc.getFullText();
        const matches = text.match(/\{([^{}]+)\}/g);
        if (!matches) return [];
        const unique = Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())));
        return unique;
    } catch (e) {
        console.warn("Impossible d'inspecter les tags Word", e);
        return [];
    }
}
