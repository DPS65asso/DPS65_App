
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Event, Victim, Outcome, TriageColor, Solute, LogbookEntry, Mission, UserProfile } from '../types';
import { safeDateFormat, safeTimeFormat } from '../utils/security';
import { auditService } from './auditService';
import { storageService } from './storageService';
import { loadImage, addHeaderLogo } from './pdfUtils';

const TABLE_COLUMNS = ["Arr.", "Dép.", "Dos.", "Nom / Contact", "Interv.", "Constantes (Dernières)", "Interventions", "Devenir"];

const getVictimRows = (victims: Victim[]) => {
  return victims.map(victim => {
    let outcomeText: string = victim.outcome;
    if (victim.outcome === Outcome.EVACUATED_HOSPITAL && victim.hospitalName) outcomeText += `\nvers ${victim.hospitalName}`;
    if (victim.outcome === Outcome.DECEASED) {
       if (victim.deceasedDoctorName) outcomeText += `\nMéd. : Dr. ${victim.deceasedDoctorName}`;
       if (victim.deceasedDate || victim.deceasedTime) {
           const dateStr = safeDateFormat(victim.deceasedDate);
           const timeStr = victim.deceasedTime || '';
           outcomeText += `\nConstaté: ${dateStr} ${timeStr}`.trim();
       }
       if (victim.deceasedDetails) outcomeText += `\n(${victim.deceasedDetails})`;
    }

    let nameText = victim.fullName;
    if (victim.birthDate) nameText += `\nNé(e) le: ${safeDateFormat(victim.birthDate)}`;
    if (victim.triageColor) nameText = `[${victim.triageColor}] ${nameText}`;
    if (victim.phoneNumber) nameText += `\nTél: ${victim.phoneNumber}`;
    if (victim.emergencyContact) nameText += `\nICE: ${victim.emergencyContact}`;

    let responderText = '-';
    const currentResp = `${victim.responderName || ''} ${victim.responderFirstName || ''}`.trim();
    if (currentResp) {
        responderText = `ACTUEL:\n${currentResp}`;
        if (victim.responderTeam) responderText += ` (${victim.responderTeam})`;
    }

    if (victim.responderHistory && victim.responderHistory.length > 0) {
        responderText += `\n\n--- RELÈVES ---`;
        victim.responderHistory.forEach(h => {
            const t = new Date(h.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            responderText += `\n[${t}] ${h.firstName} ${h.name} (${h.team})`;
        });
    }

    let constantsText = [];
    let lastVital = null;
    
    if (victim.vitals && victim.vitals.length > 0) {
        const sortedVitals = [...victim.vitals].sort((a, b) => a.time.localeCompare(b.time));
        sortedVitals.forEach(v => {
            let line = `[${v.time}] `;
            if (v.pulse) line += `FC:${v.pulse} `;
            if (v.sao2) line += `SpO2:${v.sao2}% `;
            if (v.bp) line += `TA:${v.bp} `;
            if (v.glycemia) line += `Gly:${v.glycemia} `;
            if (v.temp) line += `T:${v.temp}° `;
            if (v.eva) line += `EVA:${v.eva}/10 `;
            constantsText.push(line.trim());
        });
    } else if (victim.pulse || victim.bp || victim.sao2 || victim.glycemia || victim.temp || victim.eva) {
        let line = "";
        if (victim.pulse) line += `FC:${victim.pulse} `;
        if (victim.sao2) line += `SpO2:${victim.sao2}% `;
        if (victim.bp) line += `TA:${victim.bp} `;
        if (victim.glycemia) line += `Gly:${victim.glycemia} `;
        if (victim.temp) line += `T:${victim.temp}° `;
        if (victim.eva) line += `EVA:${victim.eva}/10 `;
        constantsText.push(line.trim());
    }

    const formattedConstants = constantsText.length > 0 ? constantsText.join('\n') : '-';

    let interventionLines = [`Motif: ${victim.reason}`];
    
    if (victim.allergies && victim.allergies !== 'Aucune') interventionLines.push(`Allergies: ${victim.allergies}`);
    if (victim.treatments && victim.treatments !== 'Aucun') interventionLines.push(`TTT: ${victim.treatments}`);

    if (victim.resourceUsed && victim.resourceUsed !== 'none') {
        interventionLines.push(`Install.: ${victim.resourceUsed === 'stretcher' ? 'Brancard' : 'Chaise'}`);
    }

    if (victim.careOnSiteTime) interventionLines.push(`PC Terrain: ${safeTimeFormat(victim.careOnSiteTime)}`);
    
    if (victim.hasTourniquet) {
        const tTime = victim.tourniquetTime ? safeTimeFormat(victim.tourniquetTime) : 'Non précisée';
        interventionLines.push(`!!! GARROT POSÉ : ${tTime} !!!`);
    }

    interventionLines.push(`Soins: ${victim.careProvided}`);
    
    if (victim.cprHistory && victim.cprHistory.length > 0) {
        interventionLines.push(`\n--- RÉANIMATION (RCP) ---`);
        const start = victim.cprHistory.find(e => e.action === 'START');
        if (start) interventionLines.push(`Début: ${new Date(start.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}`);
        
        if (victim.cprDurationSeconds) {
             const m = Math.floor(victim.cprDurationSeconds / 60);
             const s = victim.cprDurationSeconds % 60;
             interventionLines.push(`Durée Totale: ${m}m ${s}s`);
        }

        const importantEvents = victim.cprHistory.filter(e => 
            ['DRUG', 'ANALYSIS', 'ROSC', 'STOP'].includes(e.action) || 
            (e.details && e.details.toLowerCase().includes('choc'))
        );
        
        if (importantEvents.length > 0) {
            interventionLines.push("Chronologie :");
            importantEvents.forEach(e => {
                const t = new Date(e.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
                interventionLines.push(`[${t}] ${e.action}: ${e.details || ''}`);
            });
        }
    }

    if (victim.isAdvancedMode) {
        interventionLines.push(`\n--- SOINS IDE ---`);
        if (victim.hasKt) {
             const ktTimeStr = victim.ktTime ? safeTimeFormat(victim.ktTime) : '';
             interventionLines.push(`• Pose KT: Oui ${ktTimeStr ? `à ${ktTimeStr}` : ''}`);
        }
        
        if (victim.solutes && victim.solutes.length > 0) {
            victim.solutes.forEach((s: Solute) => { if (s.name) interventionLines.push(`• Soluté: ${s.name} à ${s.time}`); });
        }
        
        if (victim.medicationsList && victim.medicationsList.length > 0) {
             victim.medicationsList.forEach(m => {
                 interventionLines.push(`• [${m.time}] ${m.name} (${m.dose})`);
             });
        }
        
        if (victim.medications) interventionLines.push(`• Obs TTT: ${victim.medications}`);
        interventionLines.push(`• Validé SAMU: ${victim.samuValidated ? 'OUI' : 'NON'}`);
    }
    
    if (victim.photos && victim.photos.length > 0) {
        interventionLines.push(`\n[${victim.photos.length} Photo(s) en annexe]`);
    }

    return [safeTimeFormat(victim.arrivalTime), victim.departureTime ? safeTimeFormat(victim.departureTime) : '-', victim.bibNumber || '-', nameText, responderText, formattedConstants, interventionLines.join('\n'), outcomeText];
  });
};

export const generateSingleVictimReport = async (event: Event, victim: Victim) => {
    // 1. Initialiser le document PDF en Portrait (p), millimètres (mm), format A4 (210x297)
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // 2. Charger le logo en haut à gauche
    await addHeaderLogo(doc);
    
    // 3. Dessiner l'en-tête de la fiche
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(194, 24, 7); // Crimson SSU/SAMU red
    doc.text("FICHE-BILAN DE SECOURS", 42, 18);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // Slate slate-500
    doc.text("Dispositif Prévisionnel de Secours pour événements sportifs", 42, 23);
    doc.text("Document confidentiel — Secret Médical — Conforme SSU & Régulation SAMU", 42, 27);
    
    // Cadre rouge discret CONFIDENTIEL en haut à droite
    doc.setDrawColor(220, 38, 38);
    doc.rect(148, 12, 50, 15);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 38, 38);
    doc.text("DOSSIER CONFIDENTIEL", 151, 17);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Prise en charge # ${victim.bibNumber || 'Sans Num'}`, 151, 23);

    // Ligne décorative rouge
    doc.setDrawColor(194, 24, 7);
    doc.setLineWidth(0.8);
    doc.line(12, 31, 198, 31);
    doc.setLineWidth(0.2); // Remettre à niveau fin par défaut

    // --- COORDONNÉES DE L'INTERVENTION ---
    const drawSectionHeader = (title: string, yPos: number) => {
        doc.setFillColor(194, 24, 7);
        doc.rect(12, yPos, 186, 5.5, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), 15, yPos + 4);
    };

    // Y initial
    let y = 34;

    // SECTION 1. CONTEXTE POUR L'INTERVENTION
    drawSectionHeader("1. CONTEXTE ET EFFECTIFS DE L'INTERVENTION", y);
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(12, y + 5.5, 186, 16, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59); // Slate 800
    
    // Placer les infos sur 2 lignes dans l'encadré
    doc.text("ÉVÉNEMENT :", 15, y + 10);
    doc.text("DATE :", 15, y + 14);
    doc.text("LIEU DE CHOC / POSTE :", 15, y + 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.text(event.name.toUpperCase(), 35, y + 10);
    doc.text(safeDateFormat(event.date), 25, y + 14);
    doc.text(event.location, 50, y + 18);

    // Colonne de droite dans l'encadré
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.text("INTERVENANT EN CHARGE :", 110, y + 10);
    doc.text("ÉQUIPE SECCOURISTE :", 110, y + 14);
    doc.text("HEURE DE PREMIÈRE CONSTANTE :", 110, y + 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    const respName = `${victim.responderFirstName || ''} ${victim.responderName || ''}`.trim() || 'Non spécifié';
    doc.text(respName, 148, y + 10);
    doc.text(victim.responderTeam || 'Equipe DPS', 142, y + 14);
    
    let firstCareTime = safeTimeFormat(victim.arrivalTime);
    if (victim.vitals && victim.vitals.length > 0) {
        firstCareTime = victim.vitals[0].time;
    }
    doc.text(firstCareTime, 158, y + 18);

    // Ajuster y
    y += 25;

    // SECTION 2. IDENTIFICATION DE LA VICTIME
    drawSectionHeader("2. ÉTAT CIVIL & IDENTITÉ DE LA VICTIME", y);
    doc.rect(12, y + 5.5, 186, 16.5, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    doc.text("NOM COMPLET :", 15, y + 10);
    doc.text("DATE DE NAISSANCE :", 15, y + 14);
    doc.text("NUMÉRO DE DOSSARD :", 15, y + 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0); // Plus noir pour signature/identité
    doc.text(victim.fullName || 'Inconnu(e) (ou UA non identifiée)', 38, y + 10);
    doc.text(victim.birthDate ? safeDateFormat(victim.birthDate) : 'Non renseignée', 46, y + 14);
    doc.text(victim.bibNumber || 'N/A', 48, y + 18);

    // Droite
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("TÉLÉPHONE :", 110, y + 10);
    doc.text("URGENCE (ICE) :", 110, y + 14);
    doc.text("CODE TRIAGE VITAL :", 110, y + 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(victim.phoneNumber || 'N/R', 130, y + 10);
    doc.text(victim.emergencyContact || 'N/R', 135, y + 14);

    // Code Triage avec badge couleur
    const triageStr = victim.triageColor || 'Non spécifié';
    let triageColorRGB = [51, 65, 85]; // slate par défaut
    if (victim.triageColor) {
        if (victim.triageColor.includes('UA') || victim.triageColor.includes('Rouge')) triageColorRGB = [194, 24, 7];
        else if (victim.triageColor.includes('UR') || victim.triageColor.includes('Jaune')) triageColorRGB = [217, 119, 6];
        else if (victim.triageColor.includes('UIP') || victim.triageColor.includes('Vert')) triageColorRGB = [5, 150, 105];
        else if (victim.triageColor.includes('DCD') || victim.triageColor.includes('Noir')) triageColorRGB = [0, 0, 0];
    }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(triageColorRGB[0], triageColorRGB[1], triageColorRGB[2]);
    doc.text(triageStr, 142, y + 18);

    // Ajuster y
    y += 26;

    // SECTION 3. ANAMNÈSE, MOTIF DE PRISE EN CHARGE ET CLINIQUE (MADO / SAMPLE)
    drawSectionHeader("3. ANAMNÈSE & MOTIF D'ACCUEIL (M.A.D.O. / S.A.M.P.L.E.)", y);
    doc.rect(12, y + 5.5, 186, 20.5, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    doc.text("PLAINTES ET HISTOIRE DE L'ÉVÉNEMENT (SITUATION ET MÉCANISME) :", 15, y + 10);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    
    // Diviser le texte s'il est long
    const reasonLines = doc.splitTextToSize(victim.reason || 'Aucun motif renseigné.', 178);
    doc.text(reasonLines.slice(0, 2), 15, y + 14); // Afficher max 2 lignes compactes ici

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("TRAITEMENTS EN COURS / ANTÉCÉDENTS :", 15, y + 21);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(victim.treatments || 'Aucun d\'après la victime / entourage', 72, y + 21);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.text("ALLERGIES DÉCLARÉES :", 15, y + 24);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    
    const isAllergic = victim.allergies && victim.allergies !== 'Aucune';
    if (isAllergic) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(194, 24, 7); // Rouge si allergies
    }
    doc.text(victim.allergies || 'Aucune connue d\'après interrogatoire', 48, y + 24);
    doc.setTextColor(51, 65, 85);
    doc.setFont('Helvetica', 'normal');

    // Ajuster y
    y += 30;

    // SECTION 4. FICHE DE SURVEILLANCE CLINIQUE (CONSTANTES)
    drawSectionHeader("4. PARAMÈTRES VITAUX ET CONSTANTES CHRONOLOGIQUES", y);
    
    // Préparer les données pour autoTable
    const vitalsColumns = ["Heure", "Fréq. Cardiaque (FC)", "Fréq. Réspi (FR)", "Sat. Oxygène (SpO2)", "Pression Art. (TA)", "Température", "Dextro / Gly.", "Doul. (EVA)"];
    
    let tableRows = [];
    if (victim.vitals && victim.vitals.length > 0) {
        const sorted = [...victim.vitals].sort((a,b) => a.time.localeCompare(b.time));
        tableRows = sorted.map(v => [
            v.time || '-',
            v.pulse ? `${v.pulse} bpm` : '-',
            '-', // SSU/SAMU FR est souvent estimé, on peut mettre une colonne vide ou vide si non renseigné
            v.sao2 ? `${v.sao2} %` : '-',
            v.bp ? `${v.bp} mmHg` : '-',
            v.temp ? `${v.temp} °C` : '-',
            v.glycemia ? `${v.glycemia} g/L` : '-',
            v.eva ? `${v.eva} / 10` : '-'
        ]);
    } else {
        // Fallback s'il y a des constantes directes sur l'objet mais pas listées dans vitals
        if (victim.pulse || victim.bp || victim.sao2 || victim.glycemia || victim.temp || victim.eva) {
            tableRows.push([
                safeTimeFormat(victim.arrivalTime) || 'Début',
                victim.pulse ? `${victim.pulse} bpm` : '-',
                '-',
                victim.sao2 ? `${victim.sao2} %` : '-',
                victim.bp ? `${victim.bp} mmHg` : '-',
                victim.temp ? `${victim.temp} °C` : '-',
                victim.glycemia ? `${victim.glycemia} g/L` : '-',
                victim.eva ? `${victim.eva} / 10` : '-'
            ]);
        } else {
            tableRows.push([
                'N/A', 'aucune constante vitale mesurée', '-', '-', '-', '-', '-', '-'
            ]);
        }
    }

    autoTable(doc, {
        head: [vitalsColumns],
        body: tableRows,
        startY: y + 5.5,
        theme: 'grid',
        headStyles: { 
            fillColor: [30, 41, 59], // Slate 800 pour constantes
            textColor: [255, 255, 255],
            fontSize: 7.5,
            halign: 'center',
            cellPadding: 1
        },
        styles: { 
            fontSize: 7.5, 
            cellPadding: 1.5, 
            halign: 'center',
            textColor: [51, 65, 85]
        },
        columnStyles: { 
            0: { fontStyle: 'bold' },
            1: { cellWidth: 32 }
        }
    });

    let autoTableY = (doc as any).lastAutoTable.finalY;
    y = autoTableY + 4;

    // SECTION 5. GESTES EFFECTUÉS & DISPOSITIFS PRATIQUÉS
    drawSectionHeader("5. GESTES EFFECTUÉS, AMÉLIORATION & DISPOSITIFS", y);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    
    // Déterminer la hauteur nécessaire selon contenu
    let extraHeight = 0;
    if (victim.isAdvancedMode) extraHeight += 12; // place pour KT et solutés
    
    doc.rect(12, y + 5.5, 186, 22.5 + extraHeight, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    doc.text("GESTES ET SOINS GÉNÉRAUX PRODIGUÉS :", 15, y + 10);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    
    const careLines = doc.splitTextToSize(victim.careProvided || 'Pose de poche de froid, repos, surveillance.', 178);
    doc.text(careLines.slice(0, 2), 15, y + 14);

    // Alerte Garrot ou réa (Important ++)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("DISPOSITIF DE TRANSPORT :", 15, y + 21);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    
    let installText = 'Position d\'attente standard';
    if (victim.resourceUsed === 'stretcher') installText = 'Matériel Immobilisation / Brancard';
    else if (victim.resourceUsed === 'chair') installText = 'Assise sur Chaise de transport';
    doc.text(installText, 55, y + 21);

    // Garrot
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.text("POSE DE GARROT DE SECOURS :", 110, y + 21);
    
    if (victim.hasTourniquet) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(194, 24, 7); // Rouge alerte garrot
        doc.text(`OUI à ${victim.tourniquetTime ? safeTimeFormat(victim.tourniquetTime) : 'Heure inconnue'}`, 152, y + 21);
    } else {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text("NON", 152, y + 21);
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("RÉANIMATION (RCP) :", 15, y + 25);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    let rcpText = "Non concerné";
    if (victim.cprDurationSeconds) {
        rcpText = `Oui (Durée RCP: ${Math.floor(victim.cprDurationSeconds / 60)}m ${victim.cprDurationSeconds % 60}s)`;
    }
    doc.text(rcpText, 45, y + 25);

    // Solutés et VVP si mode paramédic
    if (victim.isAdvancedMode) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(115, 30, 160); // Violet pour soins avancés
        doc.text("VOLET SOINS AVANCÉS (IDE / MÉDECIN) :", 15, y + 30);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        
        let advancedDetails = `Pose de KT: ${victim.hasKt ? `Oui (${victim.ktTime ? safeTimeFormat(victim.ktTime) : 'N/C'})` : 'Non'}`;
        if (victim.solutes && victim.solutes.length > 0) {
            advancedDetails += ` | Soluté(s): ${victim.solutes.map(s => `${s.name || 'Soluté'} (${s.time})`).join(', ')}`;
        }
        if (victim.medicationsList && victim.medicationsList.length > 0) {
            advancedDetails += ` | Médicament(s): ${victim.medicationsList.map(m => `${m.name} (${m.dose || 'dose'}) à ${m.time}`).join(', ')}`;
        }
        doc.text(doc.splitTextToSize(advancedDetails, 178), 15, y + 33);
    }

    y += 28 + extraHeight;

    // SECTION 6. DEVENIR DE LA VICTIME, SIGNATURES & DÉCHARGE (SITUÉ AU DESIGN COLLÉ BAS)
    const pageHeight = doc.internal.pageSize.height;
    
    // Forcer le bloc signatures en bas de page pour avoir un rendu parfait
    y = Math.max(y + 2, pageHeight - 88); 
    
    drawSectionHeader("6. ADMISSION, DEVENIR DE LA VICTIME & SIGNATURES", y);
    doc.rect(12, y + 5.5, 186, 32.5, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    doc.text("DEVENIR APRÈS PREMIER ACCUEIL / SOINS (DÉCISION) :", 15, y + 10);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(194, 24, 7);
    doc.text(victim.outcome || 'Traitement en cours', 15, y + 14);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(victim.outcome === Outcome.DECEASED ? "CONSTAT DE DÉCÈS (RÉGLEMENTAIRE) :" : "ORIENTATION / VÉHICULE / HÔPITAL :", 110, y + 10);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    if (victim.outcome === Outcome.DECEASED) {
        let deathInfo = `Dr. ${victim.deceasedDoctorName || 'Médecin non renseigné'}`;
        if (victim.deceasedDate || victim.deceasedTime) {
            deathInfo += ` | ${safeDateFormat(victim.deceasedDate)} à ${victim.deceasedTime || 'N/C'}`;
        }
        if (victim.deceasedDetails) {
            deathInfo += ` (${victim.deceasedDetails})`;
        }
        doc.text(deathInfo, 110, y + 14);
    } else {
        doc.text(victim.hospitalName || 'Laissée sur place / Non évacuée', 110, y + 14);
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("LIAISON RÉGULATION SAMU (CENTRE 15) :", 15, y + 19);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(victim.samuValidated ? "VALIDÉ PAR LE SAMU ET LE MÉDECIN RÉGULATEUR DE GARDE" : "Non régulé (Bilan standard sans complication ou soins simples)", 15, y + 23);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.text("HORAIRES :", 110, y + 19);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Arrivée: ${safeTimeFormat(victim.arrivalTime)} | Départ: ${victim.departureTime ? safeTimeFormat(victim.departureTime) : 'N/C'}`, 110, y + 23);

    // Dessiner 2 zones d'émargement / de signature côte à côte (y: y + 42)
    const sigY = y + 41;
    
    // Cadre signature 1: Chef d'Équipe / Responsable / Valideur
    doc.rect(12, sigY, 90, 26);
    doc.setFillColor(241, 245, 249);
    doc.rect(12, sigY, 90, 4.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text("SIGNATURE CHEF D'ÉQUIPE / RESPONSABLE", 14, sigY + 3);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    const chefName = victim.validatedBy || respName;
    doc.text(`Nom: ${chefName}`, 14, sigY + 9);
    const validTime = victim.validatedAt 
      ? new Date(victim.validatedAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})
      : (victim.departureTime ? safeTimeFormat(victim.departureTime) : new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}));
    doc.text(`Heure: ${validTime}`, 14, sigY + 13);
    
    // Signature Chef d'équipe / Valideur dans le Cadre 1
    const chefSigToDraw = (victim.outcome !== Outcome.REFUSED_CARE && victim.outcome !== Outcome.DECEASED) ? victim.signatureData : null;
    if (chefSigToDraw) {
        try {
            doc.addImage(chefSigToDraw, 'PNG', 48, sigY + 5, 52, 18);
            doc.setFontSize(6.5);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(16, 185, 129);
            doc.text("✓ Signature Numérique Chef", 14, sigY + 22);
        } catch(e) {
            doc.setFontSize(6.5);
            doc.text("Signature Certifiée", 14, sigY + 22);
        }
    } else {
        doc.setFontSize(6.5);
        doc.setTextColor(100);
        doc.text("Signature Certifiée", 14, sigY + 22);
    }

    // Cadre signature 2: Décharge Victime (Refus de soins) OU Constat de Décès (Médecin)
    doc.rect(108, sigY, 90, 26);
    doc.setFillColor(241, 245, 249);
    doc.rect(108, sigY, 90, 4.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    if (victim.outcome === Outcome.DECEASED) {
        doc.setFontSize(6.5);
        doc.text("CONSTAT DE DÉCÈS - SIGNATURE MÉDECIN", 110, sigY + 3);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);
        const docName = victim.deceasedDoctorName ? `Dr. ${victim.deceasedDoctorName}` : 'Dr. Non renseigné';
        const docDate = victim.deceasedDate ? safeDateFormat(victim.deceasedDate) : 'N/C';
        const docTime = victim.deceasedTime || 'N/C';
        doc.text(`${docName} - ${docDate} à ${docTime}`, 110, sigY + 9);

        if (victim.doctorSignatureData) {
            try {
                doc.addImage(victim.doctorSignatureData, 'PNG', 110, sigY + 10, 85, 12);
                doc.setFontSize(6);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(220, 38, 38);
                doc.text("✓ Constat de Décès Signé par le Médecin", 110, sigY + 23);
            } catch(e) {
                console.error("Erreur d'insertion signature médecin décès :", e);
            }
        } else {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(220, 38, 38);
            doc.text("Constat de décès non signé numériquement", 110, sigY + 23);
        }
    } else if (victim.outcome === Outcome.REFUSED_CARE) {
        doc.setFontSize(6.5);
        doc.text("SIGNATURE POUR DÉCHARGE (REFUS DE SOINS)", 110, sigY + 3);
        if (victim.signatureData) {
            try {
                doc.addImage(victim.signatureData, 'PNG', 110, sigY + 5, 85, 16);
                doc.setFontSize(6.5);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(220, 38, 38);
                doc.text("[Signature Victime - Refus de soins]", 110, sigY + 23);
            } catch(e) {
                console.error("Erreur d'insertion signature décharge PDF :", e);
            }
        } else {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(220, 38, 38);
            doc.text("Refus de soins notifié (Non signé)", 110, sigY + 13);
        }
    } else {
        doc.setFontSize(6.5);
        doc.text("SIGNATURE POUR DÉCHARGE / ÉMARGEMENT", 110, sigY + 3);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(140);
        doc.text("Émargement en cas de refus de soins : (N/A)", 110, sigY + 13);
    }

    // Bas de page (Mention légale de confidentialité)
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Cool Slate-400
    doc.setFont('Helvetica', 'normal');
    doc.text("Ce document est conforme au règlement RGPD sur la protection des données de santé personnelles. Doit être conservé 5 ans sous clé par l'association.", 105, pageHeight - 8, { align: 'center' });

    // --- ANNEXE : PHOTOS ---
    if (victim.photos && victim.photos.length > 0) {
        doc.addPage();
        await addHeaderLogo(doc);
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(194, 24, 7);
        doc.text('ANNEXE PHOTOGRAPHIQUE (PLAIES & MÉCANISMES)', 42, 18);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Victime : ${victim.fullName || 'Non spécifiée'} | Dossard : ${victim.bibNumber || 'N/A'}`, 42, 24);
        
        doc.line(12, 28, 198, 28);
        
        const photoSize = 75;
        let yOffset = 34;
        let xOffset = 14;
        
        for (let i = 0; i < victim.photos.length; i++) {
            if (yOffset + photoSize + 15 > pageHeight - 15) { 
                doc.addPage(); 
                yOffset = 25; 
            }
            try {
                const p = victim.photos[i];
                const source = p.blob || p.dataUrl;
                if (source) {
                    const imgElement = await loadImage(source);
                    if (imgElement.width > 0) {
                        doc.addImage(imgElement, 'JPEG', xOffset, yOffset, photoSize, photoSize);
                        doc.setFontSize(8);
                        doc.setTextColor(50);
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`Photo ${i + 1}`, xOffset, yOffset + photoSize + 4);
                        doc.setFont('Helvetica', 'normal');
                        doc.text(new Date(p.timestamp).toLocaleString('fr-FR'), xOffset, yOffset + photoSize + 8);
                    }
                }
            } catch (e) {
                console.error("Image error", e);
                doc.text("[Image non chargeable ou expirée]", xOffset, yOffset + 10);
            }
            if (xOffset === 14) { 
                xOffset += photoSize + 15; 
            } else { 
                xOffset = 14; 
                yOffset += photoSize + 15; 
            }
        }
    }

    const fileName = `DPS65_SSU_SAMU_${victim.bibNumber || 'Inconnu'}_${victim.fullName.replace(/\s+/g, '_')}.pdf`;
    return { fileName, blob: doc.output('blob') };
};

export const generateEventReport = async (event: Event, victims: Victim[]) => {
    const doc = new jsPDF('landscape');
    await addHeaderLogo(doc);
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text('DPS65 - Registre des Interventions', 40, 20);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Événement : ${event.name}`, 40, 30);
    doc.text(`Date : ${safeDateFormat(event.date)} | Lieu : ${event.location}`, 14, 40);
    doc.text(`Total victimes : ${victims.length}`, 14, 46);

    autoTable(doc, {
        head: [TABLE_COLUMNS],
        body: getVictimRows(victims),
        startY: 50,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: { 
            0: { cellWidth: 15 }, // Arr.
            1: { cellWidth: 15 }, // Dép.
            2: { cellWidth: 12 }, // Dos.
            3: { cellWidth: 35 }, // Nom
            4: { cellWidth: 35 }, // Interv.
            5: { cellWidth: 35 }, // Constantes
            6: { cellWidth: 80 }, // Interventions
            7: { cellWidth: 40 }  // Devenir
        },
        didDrawCell: (data) => {
            if (data.column.index === 7 && data.cell.section === 'body') {
                const victim = victims[data.row.index];
                let signatureToDraw = null;
                let signatureLabel = "";
                if (victim.outcome === Outcome.REFUSED_CARE && victim.signatureData) {
                    signatureToDraw = victim.signatureData;
                    signatureLabel = "(Victime)";
                } else if (victim.outcome === Outcome.DECEASED && victim.doctorSignatureData) {
                    signatureToDraw = victim.doctorSignatureData;
                    signatureLabel = "(Médecin)";
                }
                if (signatureToDraw) {
                    try {
                        const imgHeight = 8;
                        const imgWidth = 20;
                        const x = data.cell.x + 2;
                        const y = data.cell.y + data.cell.height - imgHeight - 1;
                        doc.addImage(signatureToDraw, 'PNG', x, y, imgWidth, imgHeight);
                        doc.setFontSize(5);
                        doc.text(signatureLabel, x, y - 1);
                    } catch(e) {}
                }
            }
        }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} sur ${pageCount} - Registre DPS65`, 280, 205, { align: 'right' });
    }

    doc.save(`Registre_${event.name.replace(/\s+/g, '_')}_${safeDateFormat(event.date)}.pdf`);
};

export const generateMissionOrder = async (mission: Mission, participants: UserProfile[]) => {
  const doc = new jsPDF();
  
  // INTÉGRATION DU LOGO (Important : await pour attendre le chargement)
  await addHeaderLogo(doc);

  doc.setFontSize(22);
  doc.setTextColor(220, 38, 38);
  doc.text('ORDRE DE MISSION', 105, 22, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('DISPOSITIF PREMIERS SECOURS 65', 105, 30, { align: 'center' });

  doc.setDrawColor(200);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 40, 182, 45, 3, 3, 'FD');

  doc.setFontSize(14);
  doc.setTextColor(0, 50, 100);
  doc.text(`Mission : ${mission.title}`, 20, 50);
  
  doc.setFontSize(11);
  doc.setTextColor(50);
  doc.text(`Type : ${mission.type}`, 20, 60);
  doc.text(`Date : ${safeDateFormat(mission.date)}`, 20, 68);
  doc.text(`Horaires : ${mission.timeStart} - ${mission.timeEnd}`, 100, 68);
  doc.text(`Lieu : ${mission.location}`, 20, 76);
  
  const count = participants.length;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Effectif présent : ${count} membre(s)`, 14, 95);

  const tableBody = participants.map(p => {
      let roleDisplay = p.role.toUpperCase();
      if (p.role === 'logisticien') roleDisplay = 'SECOURISTE';
      
      return [
          p.lastName.toUpperCase(),
          p.firstName,
          roleDisplay,
          p.phone || '-',
          ''
      ];
  });

  autoTable(doc, {
      startY: 100,
      head: [['Nom', 'Prénom', 'Qualification/Rôle', 'Téléphone', 'Émargement / Heure Arrivée']],
      body: tableBody,
      theme: 'grid',
      headStyles: { 
          fillColor: [41, 128, 185],
          halign: 'center'
      },
      columnStyles: { 
          0: { fontStyle: 'bold' },
          4: { cellWidth: 60 } 
      },
      styles: { 
          minCellHeight: 12, 
          valign: 'middle',
          fontSize: 10
      }
  });

  const pageHeight = doc.internal.pageSize.height;
  const signatureY = (doc as any).lastAutoTable.finalY + 20;

  if (signatureY < pageHeight - 50) {
      doc.setFontSize(10);
      doc.text("Le Responsable Opérationnel :", 130, signatureY);
      doc.rect(130, signatureY + 5, 60, 30);
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  const footerText = `Document généré le ${new Date().toLocaleString()} via App DPS65 - Document Officiel`;
  doc.text(footerText, 105, pageHeight - 10, { align: 'center' });
  
  const safeName = mission.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`Ordre_Mission_${mission.date}_${safeName}.pdf`);
};

export const generateSynopticMissionReport = async (event: Event, victims: Victim[], logbook: LogbookEntry[] = []) => {
  const doc = new jsPDF();
  await addHeaderLogo(doc);

  // Titre
  doc.setFontSize(20);
  doc.setTextColor(220, 38, 38);
  doc.text('BILAN SYNOPTIQUE DE FIN DE DISPOSITIF', 105, 22, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('DISPOSITIF DE PREMIERS SECOURS 65 - RAPPORT OFFICIEL', 105, 28, { align: 'center' });

  // Encadré Résumé Événement
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 35, 182, 38, 3, 3, 'FD');

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`Dispositif : ${event.name}`, 20, 44);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date : ${safeDateFormat(event.date)}`, 20, 52);
  doc.text(`Lieu : ${event.location || 'Non précisé'}`, 20, 59);
  doc.text(`Total Victimes Traitées : ${victims.length}`, 120, 52);

  // Statistiques de Triage & Devenir
  const countUA = victims.filter(v => v.triageColor === TriageColor.UA).length;
  const countUR = victims.filter(v => v.triageColor === TriageColor.UR).length;
  const countUPL = victims.filter(v => v.triageColor === TriageColor.UIP || !v.triageColor).length;
  const countEvac = victims.filter(v => v.outcome === Outcome.EVACUATED_HOSPITAL).length;
  const countRefused = victims.filter(v => v.outcome === Outcome.REFUSED_CARE).length;
  const countLeft = victims.filter(v => v.outcome === Outcome.RELEASED).length;
  const countInProg = victims.filter(v => v.outcome === Outcome.TREATMENT_IN_PROGRESS).length;

  autoTable(doc, {
    startY: 78,
    head: [['Urgence Vitale (UA)', 'Urgence Relative (UR)', 'Imliqués / UPL', 'Évacués Hôpital', 'Refus Soins', 'Laissés sur place', 'En cours']],
    body: [
      [`${countUA}`, `${countUR}`, `${countUPL}`, `${countEvac}`, `${countRefused}`, `${countLeft}`, `${countInProg}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], halign: 'center', fontSize: 8 },
    bodyStyles: { halign: 'center', fontSize: 11, fontStyle: 'bold' }
  });

  // Répartition par Hôpital / Destination
  const hospitalMap: Record<string, number> = {};
  victims.forEach(v => {
    if (v.outcome === Outcome.EVACUATED_HOSPITAL) {
      const hName = v.hospitalName || 'Hôpital Non Précisé';
      hospitalMap[hName] = (hospitalMap[hName] || 0) + 1;
    }
  });

  const hospitalRows = Object.entries(hospitalMap).map(([h, count]) => [h, `${count} victime(s)`]);

  if (hospitalRows.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    const nextY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Répartition des Évacuations Hospitalières :', 14, nextY);

    autoTable(doc, {
      startY: nextY + 4,
      head: [['Établissement Hospitalier / Destination', 'Nombre d\'Évacuations']],
      body: hospitalRows,
      theme: 'striped',
      headStyles: { fillColor: [185, 28, 28], fontSize: 9 }
    });
  }

  // Extrait de la Main Courante (Top évènements)
  if (logbook.length > 0) {
    const logY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Aperçu de la Main Courante / Chronologie du Dispositif :', 14, logY);

    const logRows = logbook.slice(0, 15).map(l => [
      new Date(l.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      l.category || 'INFO',
      l.author || 'P.C.',
      l.message
    ]);

    autoTable(doc, {
      startY: logY + 4,
      head: [['Heure', 'Catégorie', 'Auteur', 'Événement / Message']],
      body: logRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 30 }, 2: { cellWidth: 35 }, 3: { cellWidth: 'auto' } },
      styles: { fontSize: 8 }
    });
  }

  // Zone de Signature
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const pageHeight = doc.internal.pageSize.height;

  if (finalY < pageHeight - 45) {
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Le Chef de Dispositif / Chef de Poste :", 15, finalY);
    doc.rect(15, finalY + 4, 75, 25);

    doc.text("Le Médecin / Régulateur :", 115, finalY);
    doc.rect(115, finalY + 4, 75, 25);
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} sur ${pageCount} - Rapport Synoptique DPS65`, 195, pageHeight - 8, { align: 'right' });
  }

  const safeEventName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`Bilan_Synoptique_${safeEventName}_${safeDateFormat(event.date)}.pdf`);
};

