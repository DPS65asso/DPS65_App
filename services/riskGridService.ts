import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addHeaderLogo, addAssociationSignature, getStoredSignatoryInfo } from './pdfUtils';
import { safeDateFormat } from '../utils/security';

export interface RiskGridData {
    eventName: string;
    eventDate: string;
    eventTimeStart: string;
    eventTimeEnd: string;
    eventLocation: string;
    organizerName: string;
    organizerContact: string;
    organizerPhone: string;
    organizerEmail: string;
    qualiteRepresentant?: string;
    activityType: string;
    
    // Grille RNMSC (Référentiel National des Missions de Sécurité Civile - DPS)
    // P = Effectif du public simultané
    publicCount: number;
    
    // E1 = Comportement du public (assis, debout, dynamique, mouvement)
    e1Value: number; // 0.25 (assis/calme), 0.30 (debout statique), 0.35 (dynamique/festif/sportif), 0.40 (mouvement foule/nuit)
    e1Label: string;
    
    // E2 = Environnement et accessibilité du site
    e2Value: number; // 0.25 (structure fixe urbaine, secours immédiats), 0.30 (plein air plat < 2ha), 0.35 (terrain accidenté/étendu 2-5ha), 0.40 (zone montagne/forêt difficile > 5ha)
    e2Label: string;
    
    // T = Délai d'intervention des secours publics (SDIS 65 / SAMU 65)
    tValue: number; // 0.25 (< 10 min), 0.30 (10-20 min), 0.35 (20-30 min), 0.40 (> 30 min ou accès difficile)
    tLabel: string;
    
    // Risque spécifique / Activité particulière (Acteurs / Concurrents)
    participantsCount: number;
    specificRisks: string[];
    
    // Calculs
    indiceI: number; // I = P x (E1 + E2 + T)
    dispositifType: 'PAPS' | 'DPS-PE' | 'DPS-ME' | 'DPS-GE';
    recommendedSecouristes: number;
    recommendedPse2: number;
    recommendedPse1: number;
    recommendedChefPoste: number;
    recommendedChefSection: number;
    recommendedVpsp: number;
    notes?: string;

    // Moyens modulés par l'utilisateur
    nbSecouristes?: number;
    nbPse2?: number;
    nbPse1?: number;
    hasChefPoste?: boolean;
    nbChefsPoste?: number;
    hasVpsp?: boolean;
    nbVpsp?: number;
    hasVehiculePersonnel?: boolean;
    nbVehiculePersonnel?: number;

    // Signature et responsable
    signatoryName?: string;
    signatoryTitle?: string;
    signatureAssoBase64?: string;
    autoSign?: boolean;
}

export function computeRiskGrid(data: Partial<RiskGridData>): {
    indiceI: number;
    dispositifType: 'PAPS' | 'DPS-PE' | 'DPS-ME' | 'DPS-GE';
    recommendedSecouristes: number;
    recommendedPse2: number;
    recommendedPse1: number;
    recommendedChefPoste: number;
    recommendedChefSection: number;
    recommendedVpsp: number;
    papsPossible: boolean;
} {
    const P = Number(data.publicCount || 0) + Number(data.participantsCount || 0);
    const E1 = Number(data.e1Value || 0.25);
    const E2 = Number(data.e2Value || 0.25);
    const T = Number(data.tValue || 0.25);
    
    const sumFactors = E1 + E2 + T;
    // Formule RNMSC officielle : I = P x (E1 + E2 + T)
    const indiceI = Math.round(P * sumFactors);
    
    // Échelle RNMSC : Risque i = I / 1000
    const iScore = indiceI / 1000;
    
    let dispositifType: 'PAPS' | 'DPS-PE' | 'DPS-ME' | 'DPS-GE' = 'DPS-PE';
    let totalSecouristes = 2;
    let chefPoste = 1;
    let chefSection = 0;
    let vpsp = 1;
    let papsPossible = false;
    
    if (iScore <= 0.25) {
        dispositifType = 'PAPS';
        totalSecouristes = 2;
        chefPoste = 0;
        vpsp = 0;
        papsPossible = true;
    } else if (iScore <= 1.125) {
        dispositifType = 'DPS-PE';
        if (iScore <= 0.600) {
            totalSecouristes = 2;
            chefPoste = 1;
            vpsp = 1;
        } else if (iScore <= 0.850) {
            totalSecouristes = 3;
            chefPoste = 1;
            vpsp = 1;
        } else {
            totalSecouristes = Math.min(12, Math.max(4, Math.ceil(iScore * 4)));
            chefPoste = 1;
            vpsp = 1;
        }
    } else if (iScore <= 12) {
        dispositifType = 'DPS-ME';
        totalSecouristes = Math.max(13, Math.min(36, Math.ceil(iScore * 3)));
        chefPoste = Math.ceil(totalSecouristes / 10);
        chefSection = 1;
        vpsp = Math.max(1, Math.ceil(totalSecouristes / 8));
    } else {
        dispositifType = 'DPS-GE';
        totalSecouristes = Math.max(37, Math.ceil(iScore * 2.5));
        chefPoste = Math.ceil(totalSecouristes / 8);
        chefSection = Math.ceil(totalSecouristes / 20);
        vpsp = Math.max(2, Math.ceil(totalSecouristes / 6));
    }
    
    // Répartition PSE2 / PSE1
    const pse2 = Math.ceil(totalSecouristes * 0.6);
    const pse1 = Math.max(0, totalSecouristes - pse2);
    
    return {
        indiceI,
        dispositifType,
        recommendedSecouristes: totalSecouristes,
        recommendedPse2: pse2,
        recommendedPse1: pse1,
        recommendedChefPoste: chefPoste,
        recommendedChefSection: chefSection,
        recommendedVpsp: vpsp,
        papsPossible
    };
}

export const generateRiskGridPdf = async (data: RiskGridData) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // 1. Logo de l'association (en haut à gauche)
    await addHeaderLogo(doc, 14, 8, 18, 18);
    
    // 2. Titre Principal Centré Parfaitement
    const centerX = 105; // Milieu exact de la page A4 (210mm)
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(185, 28, 28); // Rouge Sécurité Civile #B91C1C
    doc.text("GRILLE D'ÉVALUATION DES RISQUES & DIMENSIONNEMENT DPS", centerX, 13.5, { align: 'center' });
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("Conforme au Référentiel National des Missions de Sécurité Civile (RNMSC)", centerX, 18.5, { align: 'center' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Direction Générale de la Sécurité Civile et de la Gestion des Crises (DGSCGC)", centerX, 23, { align: 'center' });
    
    // Ligne de séparation élégante
    doc.setDrawColor(185, 28, 28);
    doc.setLineWidth(0.8);
    doc.line(12, 27.5, 198, 27.5);
    doc.setLineWidth(0.2);
    
    let y = 31.5;
    
    const drawSection = (title: string, yPos: number) => {
        doc.setFillColor(15, 23, 42); // Navy Slate 900
        doc.roundedRect(12, yPos, 186, 5.5, 1, 1, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 15, yPos + 3.9);
    };

    // SECTION 1 : RENSEIGNEMENTS GÉNÉRAUX & ORGANISATEUR
    drawSection("1. Renseignements Événement & Organisateur", y);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, y + 5.5, 186, 25, 1, 1, 'FD');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    
    doc.text("NOM DE L'ÉVÉNEMENT :", 15, y + 10);
    doc.text("DATE & HORAIRES :", 15, y + 15);
    doc.text("LIEU DE L'ÉVÉNEMENT :", 15, y + 20);
    doc.text("TYPE D'ACTIVITÉ :", 15, y + 25);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(data.eventName || 'Non précisé', 54, y + 10);
    doc.text(`${safeDateFormat(data.eventDate)} | ${data.eventTimeStart || '--:--'} - ${data.eventTimeEnd || '--:--'}`, 50, y + 15);
    doc.text(data.eventLocation || 'Hautes-Pyrénées (65)', 53, y + 20);
    doc.text(data.activityType || 'Sport / Rassemblement public', 48, y + 25);
    
    // Colonne droite
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text("ORGANISATEUR :", 112, y + 10);
    doc.text("CONTACT / RESPONSABLE :", 112, y + 15);
    doc.text("TÉLÉPHONE :", 112, y + 20);
    doc.text("EMAIL :", 112, y + 25);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(data.organizerName || 'Non précisé', 142, y + 10);
    doc.text(data.organizerContact || '-', 158, y + 15);
    doc.text(data.organizerPhone || '-', 136, y + 20);
    doc.text(data.organizerEmail || '-', 127, y + 25);
    
    y += 34.5;
    
    // SECTION 2 : GRILLE DES CRITÈRES RNMSC
    drawSection("2. Paramètres & Coefficients du Risque (RNMSC)", y);
    
    const criteriaRows = [
        [
            "Effectif Public Simultané (P)",
            `${data.publicCount} pers. (+ ${data.participantsCount} participants/acteurs)`,
            `P = ${data.publicCount + data.participantsCount}`
        ],
        [
            "Comportement du Public (E1)",
            data.e1Label || 'Comportement général',
            `E1 = ${data.e1Value.toFixed(2)}`
        ],
        [
            "Environnement & Accessibilité (E2)",
            data.e2Label || 'Caractéristiques du terrain',
            `E2 = ${data.e2Value.toFixed(2)}`
        ],
        [
            "Délai d'intervention Secours Publics (T)",
            data.tLabel || 'Délai d\'arrivée SDIS/SAMU',
            `T = ${data.tValue.toFixed(2)}`
        ]
    ];
    
    autoTable(doc, {
        head: [['Critère Réglementaire', 'Description & Hypothèse Retenue', 'Valeur / Coefficient']],
        body: criteriaRows,
        startY: y + 5.5,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 7.5 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 55 },
            1: { cellWidth: 95 },
            2: { cellWidth: 36, halign: 'center', fontStyle: 'bold' }
        }
    });
    
    y = (doc as any).lastAutoTable.finalY + 4;
    
    // SECTION 3 : RÉSULTAT DU CALCUL DE L'INDICE & DIMENSIONNEMENT
    drawSection("3. Résultat du Calcul & Dimensionnement Préconisé", y);
    
    const totalPeople = Number(data.publicCount || 0) + Number(data.participantsCount || 0);
    const sumFactors = (data.e1Value + data.e2Value + data.tValue).toFixed(2);
    const iScore = (data.indiceI / 1000).toFixed(3);
    
    // Encadré Résultat Clé
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(12, y + 6, 186, 20, 1.5, 1.5, 'FD');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text(`FORMULE OFFICIELLE : I = P x (E1 + E2 + T) = ${totalPeople} x (${sumFactors})`, 16, y + 11.5);
    
    doc.setFontSize(10.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`INDICE DE RISQUE (i) : ${iScore}   |   DISPOSITIF REQUIS : ${data.dispositifType}`, 16, y + 18);
    
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`(PAPS : i <= 0.25 | DPS-PE : 0.25 < i <= 1.125 | DPS-ME : 1.125 < i <= 12 | DPS-GE : i > 12)`, 16, y + 23.5);
    
    y += 28.5;
    
    // Tableau dynamique des Moyens Humains et Matériels (adapté aux réglages utilisateur)
    const effectiveSecouristes = data.nbSecouristes !== undefined ? Number(data.nbSecouristes) : data.recommendedSecouristes;
    const effectivePse2 = Math.ceil(effectiveSecouristes * 0.6);
    const effectivePse1 = Math.max(0, effectiveSecouristes - effectivePse2);
    
    const resRows: string[][] = [
        ["Secouristes Qualifiés (Total)", `${effectiveSecouristes} intervenants`, "Minimum légal opérationnel"],
        ["Secouristes PSE2 (Équipiers)", `${effectivePse2} intervenants`, "Premiers secours en équipe niveau 2"],
        ["Secouristes PSE1 (Équipiers)", `${effectivePse1} intervenants`, "Premiers secours en équipe niveau 1"],
    ];

    // Chef de poste modulable
    const nbChefs = data.hasChefPoste !== false ? (data.nbChefsPoste !== undefined ? Number(data.nbChefsPoste) : data.recommendedChefPoste) : 0;
    if (nbChefs > 0) {
        resRows.push(["Chefs de Poste de Secours", `${nbChefs}`, "Encadrement et coordination sur site"]);
    } else {
        resRows.push(["Chefs de Poste de Secours", "Non requis (PAPS / Binôme)", "Coordination intégrée"]);
    }

    // Chef de section si grand dispositif
    if (data.recommendedChefSection > 0) {
        resRows.push(["Chefs de Section", `${data.recommendedChefSection}`, "Commandement de secteur"]);
    }

    // VPSP modulable
    const nbVpsp = data.hasVpsp !== false ? (data.nbVpsp !== undefined ? Number(data.nbVpsp) : data.recommendedVpsp) : 0;
    if (nbVpsp > 0) {
        resRows.push(["Véhicules de Premiers Secours (VPSP)", `${nbVpsp} VPSP`, "Véhicule de secours aménagé et équipé"]);
    }

    // Véhicule personnel / VL modulable
    if (data.hasVehiculePersonnel && (data.nbVehiculePersonnel || 0) > 0) {
        resRows.push(["Véhicules Personnels (VL)", `${data.nbVehiculePersonnel} VL`, "Liaison, reconnaissance et relève"]);
    }
    
    autoTable(doc, {
        head: [['Ressource & Qualification', 'Quantité Retenue', 'Rôle & Destination']],
        body: resRows,
        startY: y,
        theme: 'striped',
        headStyles: { fillColor: [185, 28, 28], fontSize: 7.5 },
        styles: { fontSize: 7, cellPadding: 1.8 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 65 },
            1: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 76 }
        }
    });
    
    y = (doc as any).lastAutoTable.finalY + 4;
    
    // SECTION 4 : RISQUES SPÉCIFIQUES & NOTES
    if ((data.specificRisks && data.specificRisks.length > 0) || data.notes) {
        drawSection("4. Risques Particuliers & Mesures Complémentaires", y);
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        
        let boxHeight = 13;
        if (data.notes && data.specificRisks && data.specificRisks.length > 0) boxHeight = 18;
        doc.roundedRect(12, y + 5.5, 186, boxHeight, 1, 1, 'FD');
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);
        
        let textY = y + 9.5;
        if (data.specificRisks && data.specificRisks.length > 0) {
            const risksText = data.specificRisks.join(' • ');
            const wrappedRisks = doc.splitTextToSize(`Risques identifiés : ${risksText}`, 178);
            doc.text(wrappedRisks, 15, textY);
            textY += 5;
        }
        
        if (data.notes) {
            const wrappedNotes = doc.splitTextToSize(`Observations : ${data.notes}`, 178);
            doc.text(wrappedNotes, 15, textY);
        }
        y += boxHeight + 8;
    }
    
    // SIGNATURES & VALIDATION
    const pageHeight = doc.internal.pageSize.height;
    const signY = Math.max(y + 2, pageHeight - 44);
    
    // Bloc Organisateur
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(12, signY, 88, 28, 1, 1, 'D');
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(12, signY, 88, 5, 1, 1, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    // Phrase demandée exactement : L'ORGANISATEUR (LU & APPROUVE)
    doc.text("L'ORGANISATEUR (LU & APPROUVE)", 14, signY + 3.5);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Nom : ${data.organizerContact || data.organizerName || '-'}`, 14, signY + 8.5);
    doc.text(`Qualité : ${data.qualiteRepresentant || 'Organisateur'}`, 14, signY + 12);
    doc.text("Date & Signature :", 14, signY + 16);
    
    // Bloc DPS 65
    doc.roundedRect(110, signY, 88, 28, 1, 1, 'D');
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(110, signY, 88, 5, 1, 1, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("DISPOSITIF PREMIERS SECOURS 65 (DPS65)", 112, signY + 3.5);
    
    const storedInfo = getStoredSignatoryInfo();
    const signatoryName = data.signatoryName || storedInfo.name;
    const signatoryTitle = data.signatoryTitle || storedInfo.title;
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Le Responsable Opérationnel : ${signatoryName}`, 112, signY + 8.5);
    doc.text(`Qualité : ${signatoryTitle}`, 112, signY + 12);
    doc.text(`Fait le ${safeDateFormat(data.eventDate || new Date().toISOString())}`, 112, signY + 15.5);
    
    // Apposition automatique de la signature de l'association si disponible
    if (data.autoSign !== false) {
        await addAssociationSignature(doc, 142, signY + 10, 36, 15, data.signatureAssoBase64);
    }
    
    // Pied de page
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Grille d'évaluation des risques générée le ${new Date().toLocaleDateString('fr-FR')} via DPS65 Opérationnel — Document Officiel`, centerX, pageHeight - 5, { align: 'center' });
    
    const safeName = (data.eventName || 'evenement').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Grille_Risques_${safeDateFormat(data.eventDate)}_${safeName}.pdf`);
};
