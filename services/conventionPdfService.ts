import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addHeaderLogo, addAssociationSignature, getStoredSignatoryInfo } from './pdfUtils';
import { ConventionFormData } from './wordConventionService';
import { safeDateFormat } from '../utils/security';

export async function generateOfficialConventionPdf(data: ConventionFormData): Promise<void> {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // 1. Logo
    await addHeaderLogo(doc, 14, 8, 18, 18);
    
    // 2. Titre Centré Parfaitement
    const centerX = 105;
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(185, 28, 28); // Rouge Sécurité Civile
    doc.text("CONVENTION DE DISPOSITIF PRÉVISIONNEL DE SECOURS", centerX, 13.5, { align: 'center' });
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("DPS65 — Dispositif de Premiers Secours des Hautes-Pyrénées (Loi 2004-811)", centerX, 18.5, { align: 'center' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const refCode = `Réf : DPS65-${new Date().getFullYear()}-${(data.nomEvenement || 'DPS').slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
    doc.text(`${refCode} • Conforme au RNMSC`, centerX, 23, { align: 'center' });
    
    doc.setDrawColor(185, 28, 28);
    doc.setLineWidth(0.8);
    doc.line(12, 27.5, 198, 27.5);
    doc.setLineWidth(0.2);
    
    let y = 31.5;

    const drawSection = (title: string, yPos: number) => {
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(12, yPos, 186, 5.5, 1, 1, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 15, yPos + 3.9);
    };

    // SECTION 1 : PARTIES CONTRACTANTES
    drawSection("1. Entre les parties soussignées", y);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, y + 5.5, 186, 30, 1, 1, 'FD');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text("L'ORGANISATEUR (Demandeur) :", 15, y + 10);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`${data.nomSociete || data.nomOrganisateur || 'Organisateur non renseigné'}`, 15, y + 14.5);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Représenté par : ${data.nomResponsable || data.representantOrganisateur || '-'} (${data.qualiteRepresentant || 'Responsable'})`, 15, y + 18.5);
    doc.text(`Adresse : ${data.adresseOrganisateur || '-'}`, 15, y + 22.5);
    doc.text(`Tél : ${data.telephoneOrganisateur || '-'} | Email : ${data.mailOrganisateur || data.emailOrganisateur || '-'}`, 15, y + 26.5);
    doc.text("D'une part,", 15, y + 32);
    
    // Colonne droite : DPS65
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text("L'ASSOCIATION DE SECOURS :", 110, y + 10);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text("DISPOSITIF PREMIERS SECOURS 65 (DPS65)", 110, y + 14.5);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Représenté par : ${data.representantDps || 'Responsable Opérationnel DPS65'}`, 110, y + 18.5);
    doc.text("Siège : Tarbes & Hautes-Pyrénées (65)", 110, y + 22.5);
    doc.text(`Tél : ${data.telephoneDps || '06 00 00 00 00'} | Email : ${data.emailDps || 'dps65.asso@gmail.com'}`, 110, y + 26.5);
    doc.text("D'autre part,", 110, y + 32);

    y += 40;

    // SECTION 2 : OBJET DU DISPOSITIF & ÉVÉNEMENT
    drawSection("2. Caractéristiques de la Manifestation & Dispositif", y);
    
    const eventRows = [
        ["Nom de la Manifestation", data.nomEvenement || 'Événement sportif / culturel'],
        ["Date(s) & Lieu", `${safeDateFormat(data.dateEvenement)} | ${data.lieuEvenement || 'Hautes-Pyrénées'}`],
        ["Horaires Opérationnels", `Dispositif actif de ${data.horairesDebut || '--:--'} à ${data.horairesFin || '--:--'} (Mise en place : ${data.horairesMiseEnPlace || 'H-30min'})`],
        ["Public & Participants", `${data.effectifPublic || 0} spectateurs simultanés / ${data.effectifParticipants || 0} participants`],
        ["Typologie Retenue", `${data.dispositifEngage || data.typeDispositif || 'DPS-PE'} (Conforme à la grille d'évaluation des risques RNMSC)`]
    ];
    
    autoTable(doc, {
        head: [['Paramètre', 'Détails Opérationnels Retenus']],
        body: eventRows,
        startY: y + 5.5,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], fontSize: 7.5 },
        styles: { fontSize: 7, cellPadding: 1.8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 131 } }
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    // SECTION 3 : MOYENS HUMAINS ET MATÉRIELS ENGAGÉS
    drawSection("3. Moyens Humains et Matériels Engagés par DPS65", y);
    
    const secCount = Number(data.nbSecouristes) || 4;
    const vpspCount = data.nbVpsp !== undefined ? Number(data.nbVpsp) : 1;
    const vlCount = data.nbVehiculePersonnel !== undefined ? Number(data.nbVehiculePersonnel) : 0;
    const pse2Count = data.nbPse2 !== undefined ? Number(data.nbPse2) : Math.ceil(secCount * 0.6);
    const pse1Count = data.nbPse1 !== undefined ? Number(data.nbPse1) : Math.max(0, secCount - pse2Count);
    const chefsCount = data.nbChefsPoste !== undefined ? Number(data.nbChefsPoste) : 1;
    
    const meansRows: string[][] = [
        ["Intervenants Secouristes", `${secCount} secouristes qualifiés (${pse2Count} PSE2, ${pse1Count} PSE1 à jour de formation)`],
        ["Chef de Poste / Encadrement", `${chefsCount} Chef de poste de secours désigné sur place`],
    ];

    if (vpspCount > 0) {
        meansRows.push(["Véhicules de Premiers Secours (VPSP)", `${vpspCount} VPSP aménagé et équipé avec lots opérationnels A/B/C`]);
    }
    if (vlCount > 0) {
        meansRows.push(["Véhicules Personnels (VL)", `${vlCount} véhicule(s) de liaison et relève`]);
    }
    meansRows.push(["Matériel de Réanimation & Soins", "Défibrillateur DSA, Oxygénothérapie d'urgence, Plan dur / Coquille, Matériel d'immobilisation complet"]);

    autoTable(doc, {
        head: [['Ressource', 'Engagement DPS65']],
        body: meansRows,
        startY: y + 5.5,
        theme: 'striped',
        headStyles: { fillColor: [185, 28, 28], fontSize: 7.5 },
        styles: { fontSize: 7, cellPadding: 1.8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 131 } }
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    // SECTION 4 : CONDITIONS FINANCIÈRES & LOGISTIQUE
    drawSection("4. Engagements Logistiques & Financiers", y);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, y + 5.5, 186, 24, 1, 1, 'FD');
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`• Logistique : L'organisateur met à disposition un local ou espace dédié (${data.localMiseADisposition || 'Poste de secours ou tente'}).`, 15, y + 9.5);
    doc.text(`• Repas des secouristes : ${data.repasPrisEnCharge ? 'Pris en charge et fournis par l\'organisateur' : 'À la charge de l\'association'}.`, 15, y + 14);
    doc.text(`• Participation aux frais : La participation s'élève à ${data.coutPrestation ? `${data.coutPrestation} € TTC` : 'Selon devis convenu'}.`, 15, y + 18.5);
    doc.text("• Liaisons Secours Publics : DPS65 assure la liaison directe avec le SAMU 65 (Centre 15) et le SDIS 65 (18/112).", 15, y + 23);

    y += 33.5;

    // SIGNATURES
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
    doc.text("L'ORGANISATEUR (LU & APPROUVE)", 14, signY + 3.5);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Fait à ${data.lieuSignature || 'Tarbes'}, le ${safeDateFormat(data.dateConvention || new Date().toISOString())}`, 14, signY + 8.5);
    doc.text(`Nom : ${data.nomResponsable || data.representantOrganisateur || data.nomOrganisateur || '-'}`, 14, signY + 12);
    doc.text("Signature & Cachet :", 14, signY + 16);

    // Bloc DPS 65
    doc.roundedRect(110, signY, 88, 28, 1, 1, 'D');
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(110, signY, 88, 5, 1, 1, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("DISPOSITIF PREMIERS SECOURS 65 (DPS65)", 112, signY + 3.5);
    
    const storedInfo = getStoredSignatoryInfo();
    const signatoryName = data.representantDps || storedInfo.name;
    const signatoryTitle = data.qualiteDps || storedInfo.title;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Fait à Tarbes, le ${safeDateFormat(data.dateConvention || new Date().toISOString())}`, 112, signY + 8.5);
    doc.text(`Le Responsable : ${signatoryName} (${signatoryTitle})`, 112, signY + 12);
    doc.text("Signature & Cachet Officiel :", 112, signY + 15.5);

    // Apposition automatique de la signature
    await addAssociationSignature(doc, 142, signY + 10, 36, 15);

    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Convention DPS établie en 2 exemplaires originaux — Générée via DPS65 Opérationnel`, centerX, pageHeight - 5, { align: 'center' });

    const safeName = (data.nomEvenement || 'convention').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Convention_DPS65_${safeDateFormat(data.dateEvenement)}_${safeName}.pdf`);
}
