
import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { GraduationCap, Brain, CheckCircle2, Loader2, Sparkles, BookOpen, ExternalLink, ChevronDown, ChevronUp, AlertCircle, ArrowRight, PartyPopper } from 'lucide-react';
import { DailyQuiz, TrainingCourse, QuizQuestion } from '../../types';
import { getLocalDateString } from '../../utils/security';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { GoogleGenAI } from "@google/genai";
import { Button } from '../../components/Button';

// BASE DE DONNÉES DE SECOURS (POOL DE QUESTIONS)
// On pioche 3 questions dedans si l'IA échoue
const QUESTION_POOL: (QuizQuestion & { role: string, theme: string })[] = [
    {
        role: 'secouriste',
        question: "Lors d'un bilan ABCDE, que signifie la lettre 'D' ?",
        options: ["Détresse Respiratoire", "Disability (Neurologique)", "Défibrillateur", "Danger"],
        answerIndex: 1,
        explanation: "Le 'D' correspond à 'Disability', soit l'évaluation neurologique (Score de Glasgow, Glycémie, Pupilles, Motricité).",
        theme: "Bilan"
    },
    {
        role: 'secouriste',
        question: "Quelle est la fréquence de compression thoracique chez l'adulte ?",
        options: ["80-100 par min", "100-120 par min", "60-80 par min", "120-140 par min"],
        answerIndex: 1,
        explanation: "Les recommandations ERC préconisent une fréquence comprise entre 100 et 120 compressions par minute.",
        theme: "ACR"
    },
    {
        role: 'secouriste',
        question: "En présence d'une hémorragie externe massive, quel est le premier geste ?",
        options: ["Le garrot", "Le pansement compressif", "L'alerte", "La compression manuelle directe"],
        answerIndex: 3,
        explanation: "La compression directe est le geste immédiat. Si inefficace ou impossible, on pose un garrot.",
        theme: "Hémorragie"
    },
    {
        role: 'secouriste',
        question: "Quel est le débit d'O2 pour un masque haute concentration ?",
        options: ["2 L/min", "6 L/min", "9-15 L/min", "25 L/min"],
        answerIndex: 2,
        explanation: "Le MHC nécessite un débit suffisant (9 à 15 L/min) pour gonfler le réservoir et éviter la réinhalation de CO2.",
        theme: "Oxygénothérapie"
    },
    {
        role: 'secouriste',
        question: "Le score de Glasgow évalue :",
        options: ["La douleur", "La respiration", "La conscience", "Le pouls"],
        answerIndex: 2,
        explanation: "Le score de Glasgow (3 à 15) évalue l'état de conscience via l'ouverture des yeux, la réponse verbale et motrice.",
        theme: "Bilan"
    },
    {
        role: 'infirmier',
        question: "Quelle est la dose d'Adrénaline lors d'un ACR Adulte (IVD) ?",
        options: ["1 mg toutes les 4 min", "5 mg toutes les 2 min", "0.5 mg toutes les 3 min", "1 mg toutes les 10 min"],
        answerIndex: 0,
        explanation: "Protocole ACLS/PISU : 1 mg IVD toutes les 4 minutes (soit tous les 2 cycles de RCP).",
        theme: "PISU"
    },
    {
        role: 'infirmier',
        question: "Quel soluté est privilégié pour le remplissage d'un brûlé grave ?",
        options: ["G5%", "NaCl 0.9%", "Ringer Lactate", "Colloïdes"],
        answerIndex: 2,
        explanation: "Le Ringer Lactate est le soluté de choix (formule de Parkland) pour éviter l'acidose hyperchlorémique du NaCl massif.",
        theme: "Trauma"
    },
    {
        role: 'infirmier',
        question: "Quel médicament n'est PAS utilisé dans l'asthme aigu grave ?",
        options: ["Salbutamol", "Ipratropium", "Bêta-bloquant", "Corticoïdes"],
        answerIndex: 2,
        explanation: "Les Bêta-bloquants peuvent aggraver le bronchospasme et sont contre-indiqués dans l'asthme.",
        theme: "Respiratoire"
    },
    {
        role: 'medecin',
        question: "Dans l'ACR, quand administre-t-on l'Amiodarone ?",
        options: ["Dès la pose de VVP", "Après le 3ème CEE", "Après le 1er CEE", "Uniquement si Asystolie"],
        answerIndex: 1,
        explanation: "L'Amiodarone (300mg) est indiquée après le 3ème choc électrique externe en cas de FV/TV réfractaire.",
        theme: "ACR Spécialisé"
    },
    {
        role: 'medecin',
        question: "Contre-indication absolue à la thrombolyse d'un AVC ischémique ?",
        options: ["Âge > 80 ans", "Délai > 4h30", "Prise d'AVK avec INR > 1.7", "Diabète"],
        answerIndex: 2,
        explanation: "Un INR élevé (> 1.7) sous AVK est une contre-indication absolue en raison du risque hémorragique majeur.",
        theme: "Neuro"
    }
];

export const HrPage: React.FC = () => {
    const { profile } = useAuth();
    const [quiz, setQuiz] = useState<DailyQuiz | null>(null);
    const [courses, setCourses] = useState<TrainingCourse[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Suivi des réponses
    const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
    // Étape actuelle (0, 1, 2 ou 3 pour fini)
    const [currentStep, setCurrentStep] = useState(0);
    
    const [showResources, setShowResources] = useState(false);

    useEffect(() => {
        loadData();
    }, [profile?.role]);

    const loadData = async () => {
        loadDailyQuiz();
        const data = await storageService.getCourses();
        // Marquer comme vu pour le badge du dashboard
        localStorage.setItem('dps65_seen_courses', (data || []).length.toString());
        setCourses(data || []);
    };

    const loadDailyQuiz = async () => {
        const today = getLocalDateString();
        const storageKey = `dps65_daily_quiz_${today}_${profile?.role || 'secouriste'}_v3`; 
        
        try {
            const storedQuizStr = localStorage.getItem(storageKey);
            if (storedQuizStr) {
                const storedQuiz = JSON.parse(storedQuizStr) as DailyQuiz;
                // Validation structure v3 (array de questions)
                if(Array.isArray(storedQuiz.questions) && storedQuiz.questions.length > 0) {
                    setQuiz(storedQuiz);
                    const storedAnswers = localStorage.getItem(`dps65_quiz_answers_${storageKey}`);
                    if (storedAnswers) {
                        const parsedAnswers = JSON.parse(storedAnswers);
                        setUserAnswers(parsedAnswers);
                        // Reprendre là où on s'était arrêté
                        const answeredCount = Object.keys(parsedAnswers).length;
                        setCurrentStep(answeredCount);
                    }
                    return;
                }
            }
        } catch (e) {}

        await generateQuiz(storageKey, today);
    };

    const generateQuiz = async (storageKey: string, date: string) => {
        setLoading(true);
        const userRole = profile?.role || 'secouriste';
        
        // 1. Essai avec IA (Gemini)
        if (process.env.API_KEY && navigator.onLine) {
            try {
                const themes = ["PSE", "ACR", "Trauma", "Légal", "Bilan", "Hygiène"];
                const theme = themes[Math.floor(Math.random() * themes.length)];

                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const prompt = `Génère un Quiz Secourisme de 3 questions (rôle cible: ${userRole}, thème: ${theme}). 
                Format JSON strict: 
                { 
                  "questions": [
                    { "question": "...", "options": ["...", "...", "...", "..."], "answerIndex": 0, "explanation": "..." },
                    { "question": "...", "options": ["...", "...", "...", "..."], "answerIndex": 1, "explanation": "..." },
                    { "question": "...", "options": ["...", "...", "...", "..."], "answerIndex": 2, "explanation": "..." }
                  ]
                }`;

                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });

                const quizData = JSON.parse(response.text || '{}');
                
                if (quizData.questions && Array.isArray(quizData.questions) && quizData.questions.length === 3) {
                    const fullQuiz: DailyQuiz = { 
                        date, 
                        theme, 
                        questions: quizData.questions,
                        targetRole: userRole 
                    };
                    localStorage.setItem(storageKey, JSON.stringify(fullQuiz));
                    setQuiz(fullQuiz);
                    setLoading(false);
                    return;
                }
            } catch (e) { console.error("Gemini Fail, using fallback", e); }
        }

        // 2. Fallback Local
        const relevantPool = QUESTION_POOL.filter(q => q.role === userRole || (userRole === 'admin' && q.role === 'secouriste'));
        const poolToUse = relevantPool.length >= 3 ? relevantPool : QUESTION_POOL.filter(q => q.role === 'secouriste');
        
        const shuffled = [...poolToUse].sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, 3).map(q => ({
            question: q.question,
            options: q.options,
            answerIndex: q.answerIndex,
            explanation: q.explanation
        }));

        const fullQuiz: DailyQuiz = {
            date,
            theme: shuffled[0]?.theme || 'Général',
            questions: selectedQuestions,
            targetRole: userRole
        };
        
        localStorage.setItem(storageKey, JSON.stringify(fullQuiz));
        setQuiz(fullQuiz);
        setLoading(false);
    };

    const handleAnswer = (optionIdx: number) => {
        if (!quiz) return;
        // Si déjà répondu à cette étape, on ignore
        if (userAnswers[currentStep] !== undefined) return;

        const newAnswers = { ...userAnswers, [currentStep]: optionIdx };
        setUserAnswers(newAnswers);
        
        const storageKey = `dps65_daily_quiz_${getLocalDateString()}_${profile?.role || 'secouriste'}_v3`;
        localStorage.setItem(`dps65_quiz_answers_${storageKey}`, JSON.stringify(newAnswers));
    };

    const nextQuestion = () => {
        setCurrentStep(prev => prev + 1);
    };

    const renderQuizContent = () => {
        if (loading) return <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto w-10 h-10 text-white opacity-80" /></div>;
        if (!quiz) return <p className="text-center text-sm opacity-60 py-10">Aucun quiz disponible aujourd'hui.</p>;

        // ÉTAT FINI : 3 questions répondues
        if (currentStep >= 3) {
            return (
                <div className="text-center py-8 px-4 animate-in zoom-in duration-500">
                    <div className="inline-block p-4 bg-white/20 rounded-full mb-4 animate-bounce">
                        <PartyPopper className="w-12 h-12 text-yellow-300" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">MISSION ACCOMPLIE !</h3>
                    <p className="text-blue-100 mb-6 text-lg leading-relaxed">
                        Bien joué soldat ! 🫡 <br/>
                        Tu as validé tes connaissances du jour.<br/>
                        Repose tes neurones et reviens demain pour un nouveau défi !
                    </p>
                    <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-2">Récapitulatif</p>
                        <div className="flex justify-center gap-2">
                            {quiz.questions.map((q, idx) => {
                                const isCorrect = userAnswers[idx] === q.answerIndex;
                                return (
                                    <div key={idx} className={`w-3 h-3 rounded-full ${isCorrect ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        // ÉTAT EN COURS : Affichage Question
        const q = quiz.questions[currentStep];
        const userAnswer = userAnswers[currentStep];
        const isAnswered = userAnswer !== undefined;

        return (
            <div className="animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-center mb-4 opacity-80">
                    <span className="text-xs font-bold uppercase tracking-wider bg-black/20 px-2 py-1 rounded">Question {currentStep + 1} / 3</span>
                    <span className="text-[10px] font-mono">{quiz.theme}</span>
                </div>

                <h3 className="font-black text-xl leading-tight mb-6 min-h-[3.5rem]">{q.question}</h3>
                
                <div className="space-y-3 mb-6">
                    {q.options.map((opt, oIdx) => {
                        let btnClass = 'bg-white/10 border-white/20 hover:bg-white/20 text-white';
                        if (isAnswered) {
                            if (oIdx === q.answerIndex) btnClass = 'bg-green-500 border-green-400 text-white font-black shadow-lg shadow-green-900/20'; // Bonne réponse
                            else if (oIdx === userAnswer) btnClass = 'bg-red-500 border-red-400 text-white line-through opacity-80'; // Mauvaise réponse utilisateur
                            else btnClass = 'bg-black/10 border-white/5 opacity-40 text-slate-300'; // Autres options
                        }
                        
                        return (
                            <button 
                                key={oIdx} 
                                onClick={() => handleAnswer(oIdx)} 
                                disabled={isAnswered} 
                                className={`w-full p-4 rounded-xl border-2 text-left text-sm transition-all shadow-sm flex justify-between items-center group active:scale-[0.98] ${btnClass}`}
                            >
                                <span className="font-medium">{opt}</span>
                                {isAnswered && oIdx === q.answerIndex && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                                {isAnswered && oIdx === userAnswer && oIdx !== q.answerIndex && <AlertCircle className="w-5 h-5 shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {isAnswered && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
                            <h4 className="text-[10px] font-black uppercase mb-1 opacity-70 flex items-center gap-1"><Brain className="w-3 h-3"/> Le Saviez-vous ?</h4>
                            <p className="text-sm text-indigo-50 leading-relaxed font-medium">{q.explanation}</p>
                        </div>
                        
                        <button 
                            onClick={nextQuestion}
                            className="w-full py-4 bg-white text-indigo-700 font-black rounded-xl shadow-xl hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {currentStep < 2 ? "Question Suivante" : "Terminer le Quiz"} <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Layout title="Formation" showBack="/management" hideSync={true}>
            <div className="space-y-6 pb-20">
                
                {/* 1. E-LEARNING */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button onClick={() => setShowResources(!showResources)} className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs">Ressources & E-Learning</h3>
                        </div>
                        {showResources ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {showResources && (
                        <div className="p-4 divide-y dark:divide-slate-700">
                            {courses.length === 0 && <p className="text-center text-xs text-slate-400 py-6">Aucun cours disponible.</p>}
                            {(courses || []).map(c => (
                                <div key={c.id} className="py-4 flex justify-between items-center group">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{c.title}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">{c.category}</span>
                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">{c.type}</span>
                                        </div>
                                    </div>
                                    {c.url && <a href={c.url} target="_blank" className="p-2 text-blue-500 bg-blue-50 dark:bg-blue-900/30 rounded-full hover:scale-110 transition-transform"><ExternalLink className="w-5 h-5"/></a>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. QUIZ STEP-BY-STEP */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden min-h-[400px] flex flex-col">
                    {/* Background decor */}
                    <div className="absolute right-[-20px] top-[-20px] p-8 opacity-10"><Brain className="w-48 h-48" /></div>
                    <div className="absolute left-[-20px] bottom-[-20px] p-8 opacity-10"><GraduationCap className="w-32 h-32" /></div>
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-white/20 rounded-lg"><Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" /></div>
                            <h3 className="font-bold uppercase text-sm tracking-wide">Challenge du jour</h3>
                        </div>

                        <div className="flex-1 flex flex-col justify-center">
                            {renderQuizContent()}
                        </div>
                    </div>
                </div>

            </div>
        </Layout>
    );
};
