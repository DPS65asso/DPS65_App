
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Event, Victim, Outcome, Solute, LogbookEntry, Mission, UserProfile } from '../types';
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
       if (victim.deceasedDate || victim.deceasedTime) {
           const dateStr = safeDateFormat(victim.deceasedDate);
           const timeStr = victim.deceasedTime || '';
           outcomeText += `\nDécès: ${dateStr} ${timeStr}`.trim();
       }
       if (victim.deceasedDetails) outcomeText += `\n(${victim.deceasedDetails})`;
    }

    let nameText = victim.fullName;
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
        const sortedVitals = [...victim.vitals].sort((a, b) => b.time.localeCompare(a.time));
        lastVital = sortedVitals[0];
        if (victim.vitals.length > 1) constantsText.push(`(Total: ${victim.vitals.length} relevés)`);
    } else if (victim.pulse || victim.bp || victim.sao2 || victim.glycemia || victim.temp || victim.eva) {
        lastVital = {
            pulse: victim.pulse, bp: victim.bp, sao2: victim.sao2, glycemia: victim.glycemia, temp: victim.temp, eva: victim.eva, time: ''
        };
    }

    if (lastVital) {
        if (lastVital.time) constantsText.push(`@ ${lastVital.time}`);
        if (lastVital.pulse) constantsText.push(`FC: ${lastVital.pulse}`);
        if (lastVital.sao2) constantsText.push(`SaO2: ${lastVital.sao2}%`);
        if (lastVital.bp) constantsText.push(`TA: ${lastVital.bp}`);
        if (lastVital.glycemia) constantsText.push(`Gly: ${lastVital.glycemia}`);
        if (lastVital.temp) constantsText.push(`T: ${lastVital.temp}°C`);
        if (lastVital.eva) constantsText.push(`EVA: ${lastVital.eva}/10`);
    }

    const formattedConstants = constantsText.length > 0 ? constantsText.join('\n') : '-';

    let interventionLines = [`Motif: ${victim.reason}`];
    
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
    const doc = new jsPDF('landscape');
    await addHeaderLogo(doc);
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text('DPS65 - Fiche Bilan Secours', 40, 20);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Événement : ${event.name}`, 40, 30);
    doc.text(`Date : ${safeDateFormat(event.date)} | Lieu : ${event.location}`, 14, 40);
    autoTable(doc, {
        head: [TABLE_COLUMNS],
        body: getVictimRows([victim]),
        startY: 48,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: { 5: { cellWidth: 35 }, 6: { cellWidth: 90 } },
        didDrawCell: (data) => {
            if (data.column.index === 7 && data.cell.section === 'body') {
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
                        const imgHeight = 12;
                        const imgWidth = 30;
                        const x = data.cell.x + 2;
                        const y = data.cell.y + data.cell.height - imgHeight - 2;
                        doc.addImage(signatureToDraw, 'PNG', x, y, imgWidth, imgHeight);
                        doc.setFontSize(6);
                        doc.text(signatureLabel, x, y - 1);
                    } catch(e) {}
                }
            }
        }
    });
    if (victim.photos && victim.photos.length > 0) {
        doc.addPage();
        await addHeaderLogo(doc);
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text('ANNEXE : PHOTOS (Blessures / Mécanismes)', 40, 20);
        const photoSize = 100;
        let yOffset = 30;
        let xOffset = 14;
        for (let i = 0; i < victim.photos.length; i++) {
            if (yOffset + photoSize > 190) { doc.addPage(); yOffset = 20; }
            try {
                const p = victim.photos[i];
                const source = p.blob || p.dataUrl;
                if (source) {
                    const imgElement = await loadImage(source);
                    if (imgElement.width > 0) {
                        doc.addImage(imgElement, 'JPEG', xOffset, yOffset, photoSize, photoSize);
                        doc.setFontSize(10);
                        doc.text(new Date(p.timestamp).toLocaleString(), xOffset, yOffset + photoSize + 5);
                    }
                }
            } catch (e) {
                console.error("Image error", e);
                doc.text("[Image indisponible]", xOffset, yOffset + 10);
            }
            if (xOffset === 14) { xOffset += photoSize + 10; } else { xOffset = 14; yOffset += photoSize + 15; }
        }
    }
    const fileName = `DPS65_Fiche_${victim.bibNumber || 'Inconnu'}_${victim.fullName.replace(/\s+/g, '_')}.pdf`;
    return { fileName, blob: doc.output('blob') };
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
