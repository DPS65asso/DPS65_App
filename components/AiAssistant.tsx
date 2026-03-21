
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Stethoscope, ShieldAlert, Loader2, Sparkles, Mic, MicOff, Volume2, StopCircle } from 'lucide-react';
import { auditService } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { GoogleGenAI } from "@google/genai";

const REGEX_PHONE = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g;
const REGEX_DATE = /\d{1,2}\/\d{1,2}\/\d{2,4}/g;
const REGEX_NIR = /[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}/g;
const REGEX_NAMES = /\b(M\.|Mme|Monsieur|Madame)\s+([A-Z][a-z]+)\b/g;

export const AiAssistant: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  const userRole = profile?.role || 'secouriste';
  const isMedicalMode = isAdmin || userRole === 'medecin' || userRole === 'infirmier';
  
  // Custom role label for UI display
  let roleLabel = isAdmin ? 'Administrateur (Superviseur)' : userRole === 'medecin' ? 'Médecin' : userRole === 'infirmier' ? 'Infirmier' : 'Secouriste';
  if (userRole === 'snu') roleLabel = "Stagiaire SNU";
  if (userRole === 'stagiaire') roleLabel = "Stagiaire";

  useEffect(() => {
      return () => {
          if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}
          if (synthesisRef.current) synthesisRef.current.cancel();
      };
  }, []);

  const anonymizeQuery = (text: string): string => {
    let safe = text;
    safe = safe.replace(REGEX_PHONE, "[TÉL MASQUÉ]");
    safe = safe.replace(REGEX_DATE, "[DATE MASQUÉE]");
    safe = safe.replace(REGEX_NIR, "[NIR MASQUÉ]");
    safe = safe.replace(REGEX_NAMES, "$1 [NOM MASQUÉ]");
    return safe;
  };

  const executeQuery = async (textInput: string) => {
    if (!textInput.trim()) return;
    
    setIsLoading(true);
    setError('');
    setResponse('');
    synthesisRef.current.cancel();
    setIsSpeaking(false);

    const safeQuery = anonymizeQuery(textInput);

    try {
        if (!process.env.API_KEY) {
            throw new Error("Clé API Gemini manquante.");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const modelName = 'gemini-3-flash-preview';
        
        const systemInstruction = `Tu es un assistant IA pour la sécurité civile française (DPS).
        Rôle utilisateur: ${roleLabel} (${userRole}).
        Contexte: Urgence, Secourisme (PSE1/PSE2), Médecine d'urgence.
        
        Règles CRITIQUES:
        1. Si l'utilisateur est Secouriste, SNU ou Stagiaire, tu NE DOIS PAS donner de posologie médicamenteuse ni de conseils médicaux avancés. Tu dois rester strictement dans le cadre des référentiels PSE1/PSE2. Renvoie vers le chef d'équipe ou le médecin régulateur (Centre 15) pour tout acte médical.
        2. Si l'utilisateur est Infirmier ou Médecin, tu peux afficher les protocoles PISU (Protocoles Infirmiers de Soins d'Urgence) et posologies adaptées.
        3. En cas de doute sur une urgence vitale, commence par "ALERTE 15 / MÉDECIN".
        4. Réponses courtes, structurées et opérationnelles.`;

        const result = await ai.models.generateContent({
            model: modelName,
            contents: safeQuery,
            config: { systemInstruction }
        });
        
        const aiText = result.text || "Pas de réponse de l'IA.";
        setResponse(aiText);
        auditService.log('AI_QUERY', `Role: ${userRole} - Status: OK`);

    } catch (err: any) {
      console.error("AI Error:", err);
      auditService.log('AI_QUERY', `Role: ${userRole} - Status: Error`);
      if (err.message?.includes('429') || err.message?.includes('Quota')) {
          setError("Quota IA dépassé. Veuillez réessayer plus tard.");
      } else {
          setError(err.message || "Service IA indisponible.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeQuery(query);
  };

  const toggleListening = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { alert("Votre navigateur ne supporte pas la dictée vocale."); return; }
      if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
      try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'fr-FR';
          recognition.onstart = () => setIsListening(true);
          recognition.onend = () => setIsListening(false);
          recognition.onresult = (e: any) => { setQuery(e.results[0][0].transcript); };
          recognitionRef.current = recognition;
          recognition.start();
      } catch (e) { setIsListening(false); }
  };

  const toggleSpeech = () => {
      if (isSpeaking) { synthesisRef.current.cancel(); setIsSpeaking(false); } else {
          if (!response) return;
          const utterance = new SpeechSynthesisUtterance(response.replace(/\*\*/g, ''));
          utterance.lang = 'fr-FR';
          utterance.onend = () => setIsSpeaking(false);
          synthesisRef.current.speak(utterance);
          setIsSpeaking(true);
      }
  };

  const renderResponse = (text: string) => {
      return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-indigo-700 dark:text-indigo-300 font-black">{part.slice(2, -2)}</strong>;
          return part;
      });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-lg border border-indigo-100 dark:border-slate-700 overflow-hidden mb-6">
      <div className="p-4 border-b border-indigo-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/30"><Bot className="w-5 h-5" /></div>
          <div><h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">IA Opérationnelle <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">Gemini Live</span></h3><p className="text-xs text-slate-500 dark:text-slate-400">Assistant sécurisé & anonymisé</p></div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${isMedicalMode ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>{isMedicalMode ? <Stethoscope className="w-4 h-4" /> : <User className="w-4 h-4" />}<span>Mode {roleLabel}</span></div>
      </div>
      <div className="p-4">
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-3 mb-4 rounded-r text-xs text-orange-800 dark:text-orange-300 flex items-start gap-2"><ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" /><div><strong>FILTRE DE CONFIDENTIALITÉ ACTIF :</strong> Les noms, dates et numéros sont automatiquement masqués.</div></div>
        <form onSubmit={handleSearch} className="relative mb-2">
          <input type="text" className="w-full pl-4 pr-20 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white placeholder-slate-400 shadow-sm transition-all" placeholder={isMedicalMode ? "Ex: Posologie Adrénaline arrêt..." : "Ex: Score de Glasgow..."} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="absolute right-2 top-2 flex gap-1">
              <button type="button" onClick={toggleListening} className={`p-1.5 rounded-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600'}`}>{isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
              <button type="submit" disabled={isLoading || !query.trim()} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
          </div>
        </form>
        {error && (<div className="text-center text-red-600 text-sm py-2 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900 font-bold animate-in fade-in">{error}</div>)}
        {response && (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-bottom-2 relative">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider"><Sparkles className="w-3 h-3" /> Réponse {isMedicalMode ? 'MÉDICALE' : 'SECOURISTE'}</div>
                    <button onClick={toggleSpeech} className={`p-1.5 rounded-full transition-colors ${isSpeaking ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{isSpeaking ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{renderResponse(response)}</div>
            </div>
        )}
      </div>
    </div>
  );
};
