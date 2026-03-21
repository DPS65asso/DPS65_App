
import { Event, Victim, UserUniformData, UserProfile, VehicleDefinition, VehicleCheck } from '../types';
import { safeDateFormat, safeTimeFormat } from '../utils/security';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadImage, addHeaderLogo } from './pdfUtils';

const escapeCsv = (str: string | undefined): string => {
    if (!str) return '';
    let clean = str;
    
    // Protection CSV Injection
    if (/^[\=\+\-\@]/.test(clean)) {
        clean = "'" + clean;
    }
    
    clean = clean.replace(/"/g, '""');
    return `"${clean}"`;
};

export const exportService = {
    generateCsv: (events: Event[], victimsMap: Record<string, Victim[]>): string => {
        let csv = '\uFEFF'; 
        csv += "Evenement,Date,Lieu,Victime_Nom,Dossard,Arrivee,Depart,Devenir,Hopital,Motif,Soins,Garrot,Constantes_Derniere,Intervenant,Details_RCP,Medicaments,Photos_Nb\n";

        events.forEach(event => {
            const victims = victimsMap[event.id] || [];
            victims.forEach(v => {
                const lastVital = v.vitals && v.vitals.length > 0 
                    ? v.vitals.sort((a,b) => b.time.localeCompare(a.time))[0] 
                    : null;
                
                let vitalStr = "";
                if (lastVital) {
                    if (lastVital.bp) vitalStr += `TA:${lastVital.bp} `;
                    if (lastVital.pulse) vitalStr += `FC:${lastVital.pulse} `;
                    if (lastVital.sao2) vitalStr += `SpO2:${lastVital.sao2}% `;
                }

                let cprStr = "";
                if (v.cprHistory && v.cprHistory.length > 0) {
                    const sortedHistory = [...v.cprHistory].sort((a,b) => a.timestamp - b.timestamp);
                    cprStr = sortedHistory.map(e => {
                        const t = new Date(e.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        return `[${t}] ${e.action}${e.details ? `: ${e.details}` : ''}`;
                    }).join('; ');
                }

                let medStr = v.medications || "";
                if (v.medicationsList && v.medicationsList.length > 0) {
                    const listStr = v.medicationsList.map(m => `${m.name}(${m.dose})@${m.time}`).join('; ');
                    medStr = listStr + (medStr ? ` | ${medStr}` : "");
                }

                let tourniquetStr = "Non";
                if (v.hasTourniquet) {
                    tourniquetStr = `OUI à ${v.tourniquetTime ? safeTimeFormat(v.tourniquetTime) : '?'}`;
                }

                const line = [
                    escapeCsv(event.name),
                    escapeCsv(safeDateFormat(event.date)),
                    escapeCsv(event.location),
                    escapeCsv(v.fullName),
                    escapeCsv(v.bibNumber),
                    escapeCsv(safeTimeFormat(v.arrivalTime)),
                    escapeCsv(safeTimeFormat(v.departureTime)),
                    escapeCsv(v.outcome),
                    escapeCsv(v.hospitalName),
                    escapeCsv(v.reason),
                    escapeCsv(v.careProvided),
                    escapeCsv(tourniquetStr),
                    escapeCsv(vitalStr.trim()),
                    escapeCsv(`${v.responderName || ''} ${v.responderTeam || ''}`.trim()),
                    escapeCsv(cprStr),
                    escapeCsv(medStr),
                    v.photos ? v.photos.length : 0
                ].join(',');
                
                csv += line + "\n";
            });
        });

        return csv;
    },

    generateUniformPdf: async (profiles: UserProfile[], uniforms: UserUniformData[]) => {
        const doc = new jsPDF('landscape');
        
        // Header Logo
        await addHeaderLogo(doc);

        doc.setFontSize(20);
        doc.setTextColor(220, 38, 38); // Red DPS
        doc.text('COMMANDE ÉQUIPEMENTS & VESTIAIRE', 40, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 40, 28);

        // Préparation des données du tableau
        const tableBody = profiles.map(p => {
            const u = uniforms.find(uni => uni.id === p.id);
            
            const getQty = (type: string) => {
                if (!u) return ''; // Vide si pas de donnée
                const item = u.items.find(i => i.type === type);
                return (item && item.requestedQty > 0) ? item.requestedQty.toString() : '';
            };

            const sizes = u?.sizes || { top: '', bottom: '', shoes: '', head: '' };

            return [
                `${p.lastName.toUpperCase()} ${p.firstName}`,
                sizes.top || '-',
                sizes.bottom || '-',
                sizes.shoes || '-',
                sizes.head || '-',
                getQty('TSHIRT'),
                getQty('POLO'),
                getQty('POLAIRE'),
                getQty('SOFTSHELL'),
                getQty('PANTALON'),
                getQty('CASQUETTE'),
                getQty('CHAUSSURES')
            ];
        });

        // Filtrer pour mettre en premier ceux qui ont commandé quelque chose ? 
        // Non, on garde l'ordre alphabétique pour faciliter la distribution, mais on mettra en évidence les commandes.
        tableBody.sort((a, b) => a[0].localeCompare(b[0]));

        autoTable(doc, {
            startY: 35,
            head: [[
                'Membre', 
                'T. Haut', 'T. Bas', 'Pointure', 'T. Tête', 
                'T-Shirt', 'Polo', 'Polaire', 'Softshell', 'Pantalon', 'Casq.', 'Rang.'
            ]],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: [41, 128, 185], // Bleu DPS
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 50 }, // Nom
                1: { halign: 'center', cellWidth: 15 }, // T. Haut
                2: { halign: 'center', cellWidth: 15 }, // T. Bas
                3: { halign: 'center', cellWidth: 18 }, // Pointure
                4: { halign: 'center', cellWidth: 15 }, // Tête
                // Colonnes Articles
                5: { halign: 'center' },
                6: { halign: 'center' },
                7: { halign: 'center' },
                8: { halign: 'center' },
                9: { halign: 'center' },
                10: { halign: 'center' },
                11: { halign: 'center' },
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
            },
            didDrawCell: (data) => {
                // Mettre en évidence les cellules de commande (index 5 à 11) si valeur présente
                if (data.section === 'body' && data.column.index >= 5) {
                    if (data.cell.raw && data.cell.raw !== '') {
                        // Pas de dessin possible ici, on gère ça via styles normalement ou hooks
                    }
                }
            },
            willDrawCell: (data) => {
                if (data.section === 'body' && data.column.index >= 5) {
                    if (data.cell.raw && data.cell.raw !== '' && data.cell.raw !== '0') {
                        doc.setFillColor(254, 243, 199); // Orange clair pour les commandes
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(180, 83, 9); // Texte orange foncé
                    }
                }
            }
        });

        const fileName = `DPS65_Commande_Vestiaire_${new Date().toISOString().split('T')[0]}.pdf`;
        return { fileName, blob: doc.output('blob') };
    },

    generateVehicleHistoryPdf: async (vehicle: VehicleDefinition, checks: VehicleCheck[]) => {
        const doc = new jsPDF();
        
        // Logo
        await addHeaderLogo(doc);

        doc.setFontSize(20);
        doc.setTextColor(41, 128, 185); // Bleu DPS
        doc.text(`Carnet de Bord : ${vehicle.name}`, 40, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Type : ${vehicle.type}`, 40, 26);
        doc.text(`Édité le : ${new Date().toLocaleDateString('fr-FR')}`, 150, 20);

        // Trier l'historique du plus récent au plus ancien
        const sortedChecks = [...checks].sort((a,b) => b.date - a.date);

        const tableBody = sortedChecks.map(check => {
            const date = new Date(check.date).toLocaleDateString('fr-FR');
            const time = new Date(check.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
            
            // Dans la V4, alerts[0] contient "TYPE : Description"
            // On parse pour séparer si possible
            let details = check.alerts && check.alerts.length > 0 ? check.alerts[0] : '---';
            let type = 'RELEVÉ';
            
            if (details.includes(':')) {
                const parts = details.split(':');
                type = parts[0].trim();
                details = parts.slice(1).join(':').trim();
            }

            return [
                `${date} ${time}`,
                `${check.km} km`,
                type,
                details,
                check.user
            ];
        });

        autoTable(doc, {
            startY: 35,
            head: [['Date / Heure', 'Kilométrage', 'Type Intervention', 'Détails / Travaux', 'Auteur']],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold',
            },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 25, fontStyle: 'bold' },
                2: { cellWidth: 35, fontStyle: 'bold' },
                3: { cellWidth: 'auto' }, 
                4: { cellWidth: 35 }
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak'
            },
            didParseCell: (data) => {
                // Coloration conditionnelle selon le type
                if (data.section === 'body') {
                    // Correction TS7053: On cast row.raw en 'any' pour accéder à l'index 2 car row.raw est typé RowInput générique
                    const type = (data.row.raw as any)[2] as string;
                    if (type === 'PANNE') {
                        data.cell.styles.fillColor = [254, 226, 226]; // Red
                        data.cell.styles.textColor = [185, 28, 28];
                    } else if (type === 'ENTRETIEN' || type === 'PNEUS' || type === 'DISTRIBUTION') {
                        data.cell.styles.fillColor = [239, 246, 255]; // Blue
                        data.cell.styles.textColor = [29, 78, 216];
                    }
                }
            }
        });

        const safeName = vehicle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `Historique_Vehicule_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;
        return { fileName, blob: doc.output('blob') };
    }
};
