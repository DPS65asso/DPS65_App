
import React, { useState, useRef, useEffect } from 'react';
import { Languages, Volume2, Mic, MicOff, Loader2, ArrowRightLeft, MessageSquare, BookOpen, X } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const LANGUAGES = [
    { code: 'EN', name: 'Anglais', flag: '🇬🇧', langCode: 'en-US' },
    { code: 'ES', name: 'Espagnol', flag: '🇪🇸', langCode: 'es-ES' },
    { code: 'DE', name: 'Allemand', flag: '🇩🇪', langCode: 'de-DE' },
    { code: 'RU', name: 'Russe', flag: '🇷🇺', langCode: 'ru-RU' },
    { code: 'AR', name: 'Arabe', flag: '🇸🇦', langCode: 'ar-SA' },
    { code: 'IT', name: 'Italien', flag: '🇮🇹', langCode: 'it-IT' },
];

const FLASHCARDS = [
    // 1. Contact & Rassurance
    { fr: "Écoutez-moi", tr: { EN: "Listen to me", ES: "Escúcheme", DE: "Hören Sie mir zu", RU: "Послушайте меня", AR: "استمع إلي", IT: "Mi ascolti", PT: "Ouça-me" } },
    { fr: "Calmez-vous", tr: { EN: "Calm down", ES: "Cálmese", DE: "Beruhigen Sie sich", RU: "Успокойтесь", AR: "اهدأ", IT: "Si calmi", PT: "Acalme-se" } },
    { fr: "Je vais vous aider", tr: { EN: "I am going to help you", ES: "Le voy a ayudar", DE: "Ich werde Ihnen helfen", RU: "Я вам помогу", AR: "سأساعدك", IT: "La aiuterò", PT: "Vou ajudá-lo" } },
    
    // 2. Identité & Conscience
    { fr: "Comment vous appelez-vous ?", tr: { EN: "What is your name?", ES: "¿Cómo se llama?", DE: "Wie heißen Sie?", RU: "Как вас зовут?", AR: "ما اسمك؟", IT: "Come si chiama?", PT: "Como se chama?" } },
    { fr: "Quel âge avez-vous ?", tr: { EN: "How old are you?", ES: "¿Cuántos años tiene?", DE: "Wie alt sind Sie?", RU: "Сколько вам лет?", AR: "كم عمرك؟", IT: "Quanti anni ha?", PT: "Quantos anos tem?" } },
    { fr: "Ouvrez les yeux", tr: { EN: "Open your eyes", ES: "Abre los ojos", DE: "Öffnen Sie die Augen", RU: "Откройте глаза", AR: "افتح عينيك", IT: "Apra gli occhi", PT: "Abra os olhos" } },
    { fr: "Serrez ma main", tr: { EN: "Squeeze my hand", ES: "Aprieta mi mano", DE: "Drücken Sie meine Hand", RU: "Сожмите мою руку", AR: "اضغط على يدي", IT: "Mi stringa la mano", PT: "Aperte a minha mão" } },
    
    // 3. Douleur & État
    { fr: "Avez-vous mal ?", tr: { EN: "Are you in pain?", ES: "¿Le duele?", DE: "Haben Sie Schmerzen?", RU: "Вам больно?", AR: "هل تشعر بالألم؟", IT: "Ha dolore?", PT: "Sente dor?" } },
    { fr: "Où avez-vous mal ?", tr: { EN: "Where does it hurt?", ES: "¿Dónde le duele?", DE: "Wo haben Sie Schmerzen?", RU: "Где у вас болит?", AR: "أين تشعر بالألم؟", IT: "Dove le fa male?", PT: "Onde lhe dói?" } },
    { fr: "Avez-vous froid ?", tr: { EN: "Are you cold?", ES: "¿Tiene frío?", DE: "Ist Ihnen kalt?", RU: "Вам холодно?", AR: "هل تشعر بالبرد؟", IT: "Ha freddo?", PT: "Tem frio?" } },
    
    // 4. Instructions & Mobilité
    { fr: "Respirez lentement", tr: { EN: "Breathe slowly", ES: "Respire lentamente", DE: "Atmen Sie langsam", RU: "Дышите медленно", AR: "تنفس ببطء", IT: "Respiri lentamente", PT: "Respire lentamente" } },
    { fr: "Ne bougez pas", tr: { EN: "Don't move", ES: "No se mueva", DE: "Bewegen Sie sich nicht", RU: "Не двигайтесь", AR: "لا تتحرك", IT: "Non si muova", PT: "Não se mova" } },
    { fr: "Pouvez-vous vous lever ?", tr: { EN: "Can you stand up?", ES: "¿Puede levantarse?", DE: "Können Sie aufstehen?", RU: "Вы можете встать?", AR: "هل يمكنك الوقوف؟", IT: "Può alzarsi?", PT: "Pode levantar-se?" } },
    { fr: "Pouvez-vous marcher ?", tr: { EN: "Can you walk?", ES: "¿Puede caminar?", DE: "Können Sie gehen?", RU: "Вы можете идти?", AR: "هل يمكنك المشي؟", IT: "Può camminare?", PT: "Pode caminhar?" } },
    
    // 5. Antécédents
    { fr: "Allergie ?", tr: { EN: "Any allergies?", ES: "¿Tienes alergias?", DE: "Haben Sie Allergien?", RU: "Есть ли аллергия?", AR: "هل لديك حساسية؟", IT: "Ha allergie?", PT: "Tem alergias?" } },
    { fr: "Médicaments ?", tr: { EN: "Medication?", ES: "¿Medicamentos?", DE: "Medikamente?", RU: "Принимаете лекарства?", AR: "هل تأخذ أدوية؟", IT: "Prende farmaci?", PT: "Toma medicamentos?" } },
    { fr: "Enceinte ?", tr: { EN: "Pregnant?", ES: "¿Embarazada?", DE: "Schwanger?", RU: "Вы беременны?", AR: "هل أنتِ حامل؟", IT: "È incinta?", PT: "Está grávida?" } }
];

export const TranslationModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dialogue' | 'flashcards'>('dialogue');
    const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
    const [isListening, setIsListening] = useState<'fr' | 'target' | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [lastTranslation, setLastTranslation] = useState<{ original: string, translated: string } | null>(null);
    
    const recognitionRef = useRef<any>(null);
    const synthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);

    useEffect(() => {
        return () => {
            if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}
            if (synthesisRef.current) synthesisRef.current.cancel();
        };
    }, []);

    const speak = (text: string, langCode: string) => {
        synthesisRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        synthesisRef.current.speak(utterance);
    };

    const translateWithAI = async (text: string, from: string, to: string) => {
        setIsTranslating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const model = ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Traduire le texte suivant de ${from} vers ${to}. 
                Contexte: Secourisme d'urgence. La traduction doit être simple, claire et directe pour une victime.
                Texte: "${text}"
                Réponds UNIQUEMENT avec la traduction, sans guillemets ni explications.`,
            });
            const response = await model;
            return response.text?.trim() || "";
        } catch (error) {
            console.error("Translation error:", error);
            return "Erreur de traduction";
        } finally {
            setIsTranslating(false);
        }
    };

    const startListening = (mode: 'fr' | 'target') => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Votre navigateur ne supporte pas la reconnaissance vocale.");
            return;
        }

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(null);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = mode === 'fr' ? 'fr-FR' : selectedLang.langCode;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(mode);
        recognition.onend = () => setIsListening(null);
        
        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (!transcript) return;

            const fromLang = mode === 'fr' ? 'Français' : selectedLang.name;
            const toLang = mode === 'fr' ? selectedLang.name : 'Français';
            const toCode = mode === 'fr' ? selectedLang.langCode : 'fr-FR';

            const translated = await translateWithAI(transcript, fromLang, toLang);
            setLastTranslation({ original: transcript, translated });
            
            if (translated) {
                speak(translated, toCode);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
            {/* Header & Tabs */}
            <div className="p-4 bg-indigo-600 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <Languages className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">Traducteur d'Urgence</h2>
                        <p className="text-xs text-indigo-100">Communiquez avec les victimes étrangères</p>
                    </div>
                </div>

                <div className="flex bg-black/10 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('dialogue')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dialogue' ? 'bg-white text-indigo-600 shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        <MessageSquare className="w-4 h-4" /> Dialogue
                    </button>
                    <button 
                        onClick={() => setActiveTab('flashcards')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'flashcards' ? 'bg-white text-indigo-600 shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        <BookOpen className="w-4 h-4" /> Flash Cards
                    </button>
                </div>
            </div>

            <div className="p-4">
                {/* Language Selector */}
                <div className="grid grid-cols-2 gap-2 pb-4">
                    {LANGUAGES.map(lang => (
                        <button 
                            key={lang.code}
                            onClick={() => setSelectedLang(lang)}
                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${selectedLang.code === lang.code ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'}`}
                        >
                            <span className="text-xl">{lang.flag}</span>
                            <span className="text-sm font-bold">{lang.name}</span>
                        </button>
                    ))}
                </div>

                {activeTab === 'dialogue' ? (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Dialogue Controls */}
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => startListening('fr')}
                                disabled={isTranslating || (isListening !== null && isListening !== 'fr')}
                                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all active:scale-95 ${isListening === 'fr' ? 'bg-red-500 border-red-600 text-white animate-pulse' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100'}`}
                            >
                                <div className="p-3 bg-white/20 rounded-full">
                                    {isListening === 'fr' ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                                </div>
                                <span className="font-black text-sm uppercase tracking-wider">Moi (FR)</span>
                            </button>

                            <button 
                                onClick={() => startListening('target')}
                                disabled={isTranslating || (isListening !== null && isListening !== 'target')}
                                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all active:scale-95 ${isListening === 'target' ? 'bg-red-500 border-red-600 text-white animate-pulse' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'}`}
                            >
                                <div className="p-3 bg-white/20 rounded-full">
                                    {isListening === 'target' ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                                </div>
                                <span className="font-black text-sm uppercase tracking-wider">Lui ({selectedLang.code})</span>
                            </button>
                        </div>

                        {/* Translation Result */}
                        {(isTranslating || lastTranslation) && (
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4">
                                {isTranslating ? (
                                    <div className="flex items-center justify-center gap-3 py-4 text-indigo-600">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="font-bold">Traduction en cours...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1">IN</div>
                                            <p className="text-slate-600 dark:text-slate-400 text-sm italic">"{lastTranslation?.original}"</p>
                                        </div>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700 w-full"></div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1">OUT</div>
                                            <div className="flex-1">
                                                <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight">
                                                    {lastTranslation?.translated}
                                                </p>
                                                <button 
                                                    onClick={() => speak(lastTranslation?.translated || '', isListening === 'fr' ? selectedLang.langCode : 'fr-FR')}
                                                    className="mt-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:underline"
                                                >
                                                    <Volume2 className="w-4 h-4" /> Réécouter
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded text-[11px] text-amber-800 dark:text-amber-300">
                            <strong>Note :</strong> Parlez distinctement. L'IA traduit en tenant compte du contexte médical d'urgence.
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-300">
                        {FLASHCARDS.map((p, i) => (
                            <button 
                                key={i} 
                                onClick={() => speak(p.tr[selectedLang.code as keyof typeof p.tr], selectedLang.langCode)}
                                className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-start hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 transition-all active:scale-95 group"
                            >
                                <span className="text-sm font-black text-slate-800 dark:text-white mb-1"><strong>{p.fr}</strong></span>
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium italic flex items-center gap-1">
                                        {selectedLang.flag} {p.tr[selectedLang.code as keyof typeof p.tr]}
                                    </span>
                                    <Volume2 className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
