import { GoogleGenAI } from '@google/genai';
import { Victim } from '../types';

export const aiService = {
  /**
   * Génère une synthèse chronologique synthétique et structurée de la victime
   * spécialement formatée pour la transmission radio / téléphone au SAMU 15.
   */
  generateSamuChronologicalSummary: async (victim: Victim, eventName?: string): Promise<string> => {
    if (!process.env.API_KEY) {
      throw new Error("Clé API Gemini indisponible pour la synthèse SAMU.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = 'gemini-3-flash-preview';

    let ageDisplay = 'Âge inconnu';
    if (victim.birthDate) {
      try {
        const birthYear = new Date(victim.birthDate).getFullYear();
        const currentYear = new Date().getFullYear();
        if (!isNaN(birthYear)) {
          ageDisplay = `${currentYear - birthYear} ans (Né(e) le ${victim.birthDate})`;
        }
      } catch (e) {}
    }

    // Extraction et formatage propre des données de la victime
    const vitalsFormatted = (victim.vitals || []).map(v => 
      `- ${v.time} : Pouls ${v.pulse || '?'}/min, TA ${v.bp || '?'}, SaO2 ${v.sao2 || '?'}%, Glycémie ${v.glycemia || '?'} g/L, Temp ${v.temp || '?'}°C, EVA ${v.eva || '?'}`
    ).join('\n');

    const medsFormatted = (victim.medicationsList || []).map(m => 
      `- ${m.time} : ${m.name} (${m.dose})`
    ).join('\n');

    const cprFormatted = (victim.cprHistory || []).map(c => 
      `- ${new Date(c.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} : ${c.action} ${c.details ? `(${c.details})` : ''}`
    ).join('\n');

    const prompt = `Génère un bilan radio/téléphonique ultra-structuré et clair pour la régulation du SAMU (Centre 15) à partir des données de la victime suivante sur l'événement "${eventName || 'Dispositif DPS65'}" :

IDENTITÉ / ÂGE : ${victim.fullName || 'Inconnu'} (${ageDisplay})
N° DOSSARD / BADGE : ${victim.bibNumber || 'Aucun'}
MOTIF / CIRCONSTANCES : ${victim.reason || 'Non précisé'}
TRIAGE / URGENCE : ${victim.triageColor || 'UA'}
HEURE PRISE EN CHARGE : ${victim.arrivalTime || 'Inconnue'}
ANTECÉDENTS / TRAITEMENTS : ${victim.treatments || 'Aucun connu'}, ALLERGIES : ${victim.allergies || 'Aucune connue'}

HISTORIQUE CONSTANTES VITALES :
${vitalsFormatted || '- Aucune constante enregistrée'}

MÉDICAMENTS ADMINISTRÉS :
${medsFormatted || '- Aucun'}

RÉANIMATION / RCP :
${cprFormatted || '- Non applicable'}

SOINS & GESTES EFFECTUÉS : ${victim.careProvided || 'Aucun'}
ÉVOLUTION / DEVENIR ACTUEL : ${victim.outcome || 'En cours'}

CONSIGNES DE FORMATTAGE :
- Structure le bilan radio en 5 points clairs (1. Identité/Motif, 2. Bilan Vital & Chronologie, 3. Antécédents/Allergies, 4. Gestes/Traitements réalisés, 5. Demande / Conduite à tenir).
- Reste factuel, médicalement précis, sans jargon inutile.
- Sois concis pour permettre une lecture orale directe de 30 secondes au téléphone ou à la radio.`;

    const systemInstruction = "Tu es un régulateur médical de la Sécurité Civile (DPS65). Tu formules des bilans synthétiques parfaits pour le SAMU 15.";

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { systemInstruction }
    });

    return response.text || "Erreur de génération de la synthèse.";
  }
};
