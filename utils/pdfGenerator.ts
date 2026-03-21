import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Event, Victim } from '../types';
import { safeDateFormat } from '../utils/security';
import { addHeaderLogo } from '../services/pdfUtils';

export const generateEventReportPDF = async (event: Event, victims: Victim[]) => {
  const doc = new jsPDF();
  
  await addHeaderLogo(doc);
  
  doc.setFontSize(18);
  doc.text(`Rapport d'événement: ${event.name}`, 14, 22);
  doc.setFontSize(12);
  doc.text(`Date: ${safeDateFormat(event.date)}`, 14, 30);
  doc.text(`Lieu: ${event.location}`, 14, 36);
  doc.text(`Total victimes: ${victims.length}`, 14, 42);

  const tableColumn = ["Dossard", "Nom", "Triage", "Arrivée", "Équipe"];
  const tableRows: any[] = [];

  victims.forEach(v => {
    const victimData = [
      v.bibNumber || '---',
      v.fullName,
      v.triageColor || 'NOVI',
      new Date(v.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      v.responderTeam || '---'
    ];
    tableRows.push(victimData);
  });

  (doc as any).autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 50,
  });

  doc.save(`rapport_${event.name.replace(/\s+/g, '_')}.pdf`);
};
